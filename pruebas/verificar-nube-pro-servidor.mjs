import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const requireProject = createRequire(new URL("../functions/index.js", import.meta.url));
const read = file => process.env.FINO_TEST_BASELINE
  ? execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function ownModule(file, require = requireProject) {
  const scope = { module: { exports: {} }, require, Date, console };
  vm.runInNewContext(read(file), scope);
  return scope.module.exports;
}
const entitlement = ownModule("functions/src/premium-entitlement.js");
assert.equal(entitlement.premium({ isPremium: false }, Date.now(), { active: true }), false,
  "el servidor no concede tester si falta la fecha, igual que las reglas");
const backend = ownModule("functions/src/cloud-access.js", name => name === "./premium-entitlement" ? entitlement : requireProject(name));
function fakeFirestore(initial) {
  const documents = new Map(Object.entries(initial));
  const writes = [];
  let failBatch = false;
  function doc(path) {
    return { path, get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }),
      delete: async () => { writes.push(["delete", path]); documents.delete(path); },
      collection: name => ({ limit: count => ({ get: async () => {
        const docs = [...documents.keys()].filter(key => key.startsWith(`${path}/${name}/`)).slice(0, count).map(key => ({ ref: doc(key) }));
        return { docs, empty: docs.length === 0 };
      } }) }) };
  }
  return { documents, writes, doc, collection: name => ({ doc: uid => doc(`${name}/${uid}`) }),
    getAll: async (...args) => {
      const { fieldMask } = args.pop();
      assert.ok(!fieldMask.some(field => ["transactions", "budgets", "userPhoto"].includes(field)), "la consulta de permisos ni siquiera descarga fotos/historial al servidor");
      return Promise.all(args.map(async ref => {
        const snapshot = await ref.get();
        return { exists: snapshot.exists, data: () => Object.fromEntries(Object.entries(snapshot.data() ?? {}).filter(([key]) => fieldMask.includes(key))) };
      }));
    },
    failNextBatch: () => { failBatch = true; },
    runTransaction: async run => run({ get: ref => ref.get(),
      set: (ref, value, options) => documents.set(ref.path, { ...(options?.merge ? documents.get(ref.path) : {}), ...value }),
      update: (ref, value) => documents.set(ref.path, { ...documents.get(ref.path), ...value }),
    }), batch: () => {
      const pending = [];
      return { delete: ref => pending.push(ref), commit: async () => {
        if (failBatch) { failBatch = false; throw new Error("NETWORK_CUT"); }
        for (const ref of pending) { writes.push(["delete", ref.path]); documents.delete(ref.path); }
      } };
    } };
}
const db = fakeFirestore({
  "users/alice": { hasOnboarded: true, isPremium: false, budgets: { month: 999 }, userPhoto: "PRIVATE_PHOTO", transactions: ["PRIVATE_MONEY"] },
  "users/bob": { hasOnboarded: true, isPremium: true, budgets: { month: 777 } },
  "users/alice/history/1": { transaction: "PRIVATE_HISTORY" },
  "users/bob/history/1": { transaction: "OTHER_ACCOUNT" },
});
const access = await backend.getCloudAccess(db, "alice", 100_000);
await assert.rejects(backend.deletePersonalCloudCopy(db, "bob/history/1"), /INVALID_UID/,
  "también rechaza rutas arbitrarias al limpiar desde el evento de Auth");
assert.equal(access.canSync, false);
assert.equal(access.hasCloudCopy, true);
assert.equal(JSON.stringify(access).includes("PRIVATE"), false);
assert.equal("transactions" in access, false);
assert.equal((await backend.getCloudAccess(db, "bob")).isPremium, true);
db.documents.set("testerPremium/alice", { active: true, grantedAt: { toMillis: () => 1 } });
assert.equal((await backend.getCloudAccess(db, "alice")).canSync, true);
db.documents.set("premiumTrialClaims/alice", { deletionPending: true });
assert.equal((await backend.getCloudAccess(db, "alice")).canSync, false);
assert.equal(await entitlement.premiumForUser(db, "alice", { isPremium: true }), false);
db.documents.delete("premiumTrialClaims/alice");
db.documents.delete("testerPremium/alice");
db.failNextBatch();
await assert.rejects(backend.deletePersonalCloudCopy(db, "alice"), /NETWORK_CUT/);
assert.equal(db.documents.get("users/alice").accountDeletionPending, true);
assert.equal(db.documents.get("premiumTrialClaims/alice").deletionPending, true);
assert.ok(db.documents.has("users/alice/history/1"), "un corte deja el historial reintentable y bloqueado");
assert.equal((await backend.getCloudAccess(db, "alice")).canSync, false);
await backend.deletePersonalCloudCopy(db, "alice");
assert.equal(db.documents.has("users/alice"), false);
assert.equal(db.documents.has("users/alice/history/1"), false);
assert.ok(db.documents.has("users/bob/history/1"), "la limpieza nunca toca otra cuenta");
assert.equal(db.documents.get("premiumTrialClaims/alice").deletionPending, true, "no reabre la prueba antes de borrar Auth");
db.documents.set("cajas/alice", {});
db.documents.set("negocios/alice", {});
await backend.cleanupDeletedCloudAccount(db, "alice");
for (const path of ["cajas/alice", "negocios/alice", "premiumTrialClaims/alice"]) assert.equal(db.documents.has(path), false);

// Ejecuta las envolturas onCall reales aislando exclusivamente los SDK.
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const handlers = {};
const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: handler => { handlers.authDelete = handler; return handler; } }) } };
let authExists = true;
const indexScope = { module: { exports: {} }, Date, console,
  require: name => {
    if (name === "firebase-functions/v2/https") return { onCall: (opts, handler) => { handler.options = opts; return handler; }, onRequest: (_opts, handler) => handler, HttpsError };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: (_opts, handler) => handler };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_opts, handler) => handler };
    if (name === "firebase-functions/params") return { defineSecret: () => ({ value: () => "unused" }) };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-admin/firestore") return { getFirestore: () => db };
    if (name === "firebase-admin/auth") return { getAuth: () => ({ getUser: async () => {
      if (!authExists) { const error = new Error("Gone"); error.code = "auth/user-not-found"; throw error; }
      return { emailVerified: true, disabled: false };
    } }) };
    if (name === "./src/cloud-access") return backend;
    return requireProject(name);
  } };
indexScope.exports = indexScope.module.exports;
vm.runInNewContext(read("functions/index.js"), indexScope);
const api = indexScope.module.exports;
assert.equal(api.deletePersonalCloudCopy.options.timeoutSeconds, 540, "un historial grande no usa el límite corto por defecto");
assert.equal(api.finalizeLinkedSpaceDeletion.options.timeoutSeconds, 540, "la limpieza de grupos conserva tiempo para varias páginas");
await assert.rejects(api.finalizeLinkedSpaceDeletion({ auth: { uid: "alice", token: { email_verified: true, auth_time: 1 } },
  data: { kind: "family", spaceId: "f" } }), error => error.code === "failed-precondition", "finalizar el borrado exige identidad reciente");
await api.cleanupDeletedCloudAccount({ uid: "bob" });
assert.equal(db.documents.has("users/bob"), true, "un evento viejo no elimina un UID que ahora pertenece a una cuenta activa");
for (const auth of [undefined, { uid: "alice", token: { email_verified: false } }]) {
  assert.throws(() => api.getCloudAccess({ auth }), error => error.code === "unauthenticated");
}
const verified = { uid: "alice", token: { email_verified: true, auth_time: Date.now() / 1000 } };
assert.equal((await api.getCloudAccess({ auth: verified, data: { uid: "bob" } })).uid, "alice", "el UID siempre sale de Auth, no de un campo manipulable");
assert.throws(() => api.deletePersonalCloudCopy({ auth: { ...verified, token: { email_verified: true, auth_time: 1 } } }),
  error => error.code === "failed-precondition", "el borrado pide identidad reciente incluso sin Pro");
authExists = false;
await assert.rejects(api.activatePremiumTrial({ auth: verified, data: { hasLocalSetup: true } }), error => error.code === "auth/user-not-found",
  "un token anterior no recrea una cuenta ya borrada de Auth");
await api.cleanupDeletedCloudAccount({ uid: "bob" });
assert.equal(db.documents.has("users/bob"), false, "el evento de Auth completa la limpieza por UID");

// Cliente real: consulta el permiso, no el documento financiero de Gratis.
const clientAst = ts.createSourceFile("cloud.ts", read("utils/cloudSync.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let loadSource, errorSource;
function find(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "loadCloudData") loadSource = node.getText(clientAst);
  if (ts.isClassDeclaration(node) && node.name?.text === "CloudPremiumRequiredError") errorSource = node.getText(clientAst);
  ts.forEachChild(node, find);
}
find(clientAst);
let reads = 0;
const clientScope = { getCloudAccountAccess: async () => access, getDoc: async () => { reads++; throw new Error("NO_READ"); },
  UnsupportedHistoryFormatError: class extends Error {} };
vm.createContext(clientScope);
vm.runInContext(ts.transpile(`${errorSource.replace(/^export\s+/, "")}\n${loadSource.replace(/^export\s+/, "")}`, { target: ts.ScriptTarget.ES2022 }), clientScope);
await assert.rejects(clientScope.loadCloudData("alice"), error => error.name === "CloudPremiumRequiredError");
assert.equal(reads, 0, "Gratis nunca intenta descargar fotos ni movimientos");
clientScope.getCloudAccountAccess = async () => ({ ...access, hasCloudCopy: false });
assert.equal(await clientScope.loadCloudData("alice"), null);
assert.equal(reads, 0, "no inventa una copia para una cuenta nueva");

const callerAuth = { currentUser: { uid: "alice", emailVerified: true } };
let finishAccess;
let rpcCalls = 0;
const accessScope = { module: { exports: {} }, exports: {}, require: name => {
  if (name === "@/utils/firebase") return { auth: callerAuth, functions: {} };
  if (name === "firebase/functions") return { httpsCallable: (_functions, name, options) => () => {
    if (name === "deletePersonalCloudCopy") assert.equal(options.timeout, 600_000);
    rpcCalls++;
    return new Promise(resolve => { finishAccess = resolve; });
  } };
  throw new Error(name);
} };
accessScope.exports = accessScope.module.exports;
vm.runInNewContext(ts.transpile(read("utils/cloudAccountAccess.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), accessScope);
const permissionApi = accessScope.module.exports;
const first = permissionApi.getCloudAccountAccess("alice");
assert.equal(permissionApi.getCloudAccountAccess("alice"), first, "dos consumidores comparten solo la consulta en vuelo");
assert.equal(rpcCalls, 1);
callerAuth.currentUser = { uid: "bob", emailVerified: true };
const oldResponse = assert.rejects(first, /cloud-account-changed/);
finishAccess({ data: access });
await oldResponse;
await assert.rejects(permissionApi.getCloudAccountAccess("alice"), /cloud-account-changed/);
const second = permissionApi.getCloudAccountAccess("bob");
assert.equal(rpcCalls, 2, "no reutiliza el permiso de otra cuenta ni conserva una autorización duradera");
finishAccess({ data: { ...access, uid: "bob", canSync: true, isPremium: true } });
assert.equal((await second).uid, "bob");
const malformed = permissionApi.getCloudAccountAccess("bob");
finishAccess({ data: { ...access, uid: "bob", canSync: "true" } });
await assert.rejects(malformed, /cloud-access-invalid-response/);
const deletion = permissionApi.deletePersonalCloudCopy("bob");
finishAccess({ data: { ok: true } });
await deletion;
const cajas = read("screens/Cajas.tsx");
assert.match(cajas, /uid && isPremium/);
assert.match(cajas, /!cloudReady \|\| !uid \|\| !isPremium/);
// Ejecuta los filtros reales de Cajas: un borrado explícito funciona también
// en Gratis, pero una ausencia por no poder consultar nube nunca borra dinero.
const cajasAst = ts.createSourceFile("Cajas.tsx", cajas, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function collectCaja(node) {
  if (ts.isVariableDeclaration(node) && ["borradosExplicitos", "cajasActivas", "orphanIds"].includes(node.name.getText(cajasAst))) {
    declarations.set(node.name.getText(cajasAst), `const ${node.getText(cajasAst)};`);
  }
  ts.forEachChild(node, collectCaja);
}
collectCaja(cajasAst);
function deletedCounterparts(pro, confirmed, deletedIds) {
  const scope = { isPremium: pro, nubeConfirmadaPara: { current: confirmed ? "alice" : null },
    auth: { currentUser: { uid: "alice" } }, datos: { cajas: [{ id: "caja-local" }], movimientosBorrados: deletedIds }, movimientosPorId: new Map(),
    transactions: [{ id: 10, internalTransfer: "box", internalTransferLink: "mov-local", internalTransferSpaceId: "caja-local" },
      { id: 20, internalTransfer: "box", internalTransferLink: "shared-movement", internalTransferSpaceId: "shared-box" }] };
  vm.runInNewContext(ts.transpile([...declarations.values()].join("\n") + "\nresult = orphanIds;", { target: ts.ScriptTarget.ES2022 }), scope);
  return Array.from(scope.result);
}
assert.deepEqual(deletedCounterparts(false, false, []), [], "Gratis no borra por una ausencia sin confirmar");
assert.deepEqual(deletedCounterparts(false, false, ["mov-local"]), [10], "un borrado local explícito sí retira su contraparte");
assert.deepEqual(deletedCounterparts(true, false, []), [], "un error Pro conserva el movimiento Personal");
assert.deepEqual(deletedCounterparts(true, true, []), [], "confirmar una copia antigua no demuestra que se borró dinero");
assert.deepEqual(deletedCounterparts(true, true, ["mov-local"]), [10], "la marca explícita concilia el borrado privado, sin tocar movimientos compartidos");

// Una consulta de permisos lenta no puede desactivar la prueba recién
// concedida; una activación de la cuenta anterior tampoco cambia la actual.
const providerAst = ts.createSourceFile("Provider.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let refreshDeclaration, activationDeclaration;
function collectPermissionFlow(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(providerAst) === "refresh") refreshDeclaration = `const ${node.getText(providerAst)};`;
  if (ts.isFunctionDeclaration(node) && node.name?.text === "activarPruebaPremium") activationDeclaration = node.getText(providerAst);
  ts.forEachChild(node, collectPermissionFlow);
}
collectPermissionFlow(providerAst);
let finishRefresh, finishTrial;
const permissionWrites = [];
const providerScope = { alive: true, uid: "alice", version: 0, localSessionVersion: { current: 0 },
  cloudAccessRevision: { current: 0 }, auth: { currentUser: { uid: "alice" } }, hasOnboarded: true, pruebaInicio: null,
  pruebaYaUsada: () => false,
  getCloudAccountAccess: () => new Promise(resolve => { finishRefresh = resolve; }),
  activatePremiumTrialCloud: () => new Promise(resolve => { finishTrial = resolve; }),
  setIsPremium: value => permissionWrites.push(["paid", value]), setPruebaInicio: value => permissionWrites.push(["trial", value]),
  savePrueba: value => permissionWrites.push(["saved", value]), setAhora: value => permissionWrites.push(["clock", value]),
  setRespaldoFallo: value => permissionWrites.push(["error", value]) };
vm.runInNewContext(ts.transpile(`${refreshDeclaration}\n${activationDeclaration}\nflow = { refresh, activarPruebaPremium };`, { target: ts.ScriptTarget.ES2022 }), providerScope);
const staleRefresh = providerScope.flow.refresh();
const newTrial = providerScope.flow.activarPruebaPremium();
finishTrial({ activated: true, startedAt: 100_000 });
assert.equal(await newTrial, true);
assert.deepEqual(permissionWrites, [["trial", 100_000], ["saved", 100_000], ["clock", 100_000]]);
finishRefresh({ isPremium: false });
await staleRefresh;
assert.equal(permissionWrites.length, 3, "la respuesta anterior no retira la prueba recién concedida");
const oldAccountTrial = providerScope.flow.activarPruebaPremium();
providerScope.auth.currentUser = { uid: "bob" };
finishTrial({ activated: true, startedAt: 100_001 });
assert.equal(await oldAccountTrial, false);
assert.equal(permissionWrites.length, 3, "una activación anterior no toca la cuenta nueva");
console.log("Nube Pro: permiso separado, Gratis sin descarga, borrado sin Pro, identidad y prueba única comprobados.");
