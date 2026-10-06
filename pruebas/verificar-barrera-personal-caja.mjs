import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";
import ts from "typescript";
import vm from "node:vm";
const root = process.cwd(), require = createRequire(import.meta.url);
const baseline = process.env.FINO_TEST_BOX_BARRIER_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const clone = value => structuredClone(value);
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 2 };
const movement = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 3, updatedAt: 4, personalTransactionId: 10 };
const personal = { id: 10, type: "expense", amount: 80, category: "otros", date: movement.fecha, description: "Viaje", method: "transfer", notes: "", internalTransfer: "box", internalTransferLink: movement.id, internalTransferSpaceId: box.id, updatedAt: 110 };
const review = { id: "money-operation-0001", uid: "A", currency: "PEN", box, local: { personal, movement }, remote: { personal: { ...personal, amount: 100 }, movement }, chosen: "local-personal", createdAt: 200, version: 200, estado: "pendiente" };
const boxes = { cajas: [box], movimientos: [movement], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2 };
const personalData = rows => ({ hasOnboarded: true, userName: "Ana", userPhoto: null, userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, transactions: rows, goals: [], isPremium: true, syncFormat: 2 });
const sdk = `
  const e = globalThis.__barrierEnv;
  export class Timestamp { constructor(seconds = 1, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; } }
  export const serverTimestamp = () => new Timestamp(++e.clock);
  export const doc = (_db, ...parts) => ({ path: parts.join("/") });
  export const collection = doc;
  export const where = (...args) => args, orderBy = (...args) => args, limit = (...args) => args;
  export const query = (ref, ...filters) => ({ ...ref, filters });
  function snapshot(ref) { const value = e.docs.get(ref.path); return { id: ref.path.split("/").pop(), exists: () => value !== undefined, data: () => { const copy = structuredClone(value); if(value?.syncAt) copy.syncAt = new Timestamp(value.syncAt.seconds, value.syncAt.nanoseconds); return copy; }, metadata: { fromCache: false, hasPendingWrites: false } }; }
  export async function getDoc(ref) { e.reads++; if (e.readGate) await e.readGate.promise; return snapshot(ref); }
  export const getDocFromServer = getDoc;
  export async function getDocs(ref) {
    e.reads++; return { docs: [...e.docs.keys()].filter(key => key.startsWith(ref.path + "/") && key.split("/").length === ref.path.split("/").length + 1).map(key => snapshot({ path: key })) };
  }
  export async function runTransaction(_db, work) {
    e.transactions++; const staged = [];
    const result = await work({ get: getDoc, set: (ref, value) => staged.push([ref.path, structuredClone(value)]), update: (ref, value) => staged.push([ref.path, { ...e.docs.get(ref.path), ...structuredClone(value) }]) });
    e.prepared?.resolve(); if (e.commitGate) await e.commitGate.promise;
    for (const [key, value] of staged) { e.writes++; e.docs.set(key, value); }
    return result;
  }
  export const deleteDoc = async ref => { e.docs.delete(ref.path); };
  export const writeBatch = () => ({ delete() {}, commit: async () => {} });
`;
const bundle = (await esbuild.build({ stdin: { contents: `
  export * from "@/utils/cloudSync";
  export * from "@/utils/cloudCajas";
  export * from "@/utils/cloudHistoryV2";
  export * from "@/utils/privateBoxSync";
  export { Timestamp } from "firebase/firestore";
`, loader: "ts", resolveDir: root }, bundle: true, platform: "node", format: "cjs", write: false, alias: { "@": root }, logLevel: "silent", plugins: [{ name: "isolated-native-network", setup(build) {
  const mocks = {
    "firebase/firestore": sdk,
    "@/utils/firebase": `const e = globalThis.__barrierEnv; export const db = {}; export const auth = { get currentUser() { return e.uid ? { uid: e.uid } : null; } };`,
    "@/utils/storage": `const e = globalThis.__barrierEnv; export const STORAGE_KEYS = { cajasDinero: "cajas" }; export const getAccountStorageSession = () => e.session; export const hasUnreadableLocalData = () => e.unreadable; export const loadJSON = async (_key, fallback) => { e.localReads++; if(e.diskFailure) { e.unreadable = true; return fallback; } return structuredClone(e.local ?? fallback); };`,
    "@/utils/cloudAccountAccess": `const e = globalThis.__barrierEnv; export const getCloudAccountAccess = async () => ({ hasCloudCopy: true, canSync: e.pro, isPremium: e.pro }); export const deletePersonalCloudCopy = async () => {};`,
    // No se carga, revisa ni ejecuta el módulo excluido de tarjetas.
    "@/utils/creditCloud": `export const deleteCreditCloudAccount = async () => {};`,
    "@/utils/cloudNegocio": `export const borrarNegocioDeLaNube = async () => {};`,
    "@/utils/cloudFamilia": `export const borrarVinculoFamiliaDeCuenta = async () => {}; export const validarBorradoFamiliasDeCuenta = async () => {};`,
    "@/utils/cloudCajasCompartidas": `export const borrarCajasCompartidasDeCuenta = async () => {}; export const validarBorradoCajasCompartidasDeCuenta = async () => {};`,
  };
  build.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: "barrier-stubs" } : undefined);
  build.onLoad({ filter: /.*/, namespace: "barrier-stubs" }, args => ({ contents: mocks[args.path], loader: "ts" }));
  if (baseline) build.onLoad({ filter: /[\\/]utils[\\/](cloudSync|cloudCajas|cloudHistoryV2)\.ts$/ }, args => ({ contents: execFileSync("git", ["show", `${baseline}:${path.relative(root, args.path).replaceAll("\\", "/")}`], { encoding: "utf8" }), loader: "ts" }));
} }] })).outputFiles[0].text;
function harness() {
  const e = { uid: "A", session: 1, pro: true, unreadable: false, local: clone(boxes), localReads: 0, reads: 0, writes: 0, transactions: 0, clock: 1,
    docs: new Map([["users/A", personalData([{ ...personal, amount: 100, updatedAt: 100 }])], ["cajas/A", clone(boxes)]]) };
  const loaded = { exports: {} };
  new Function("module", "exports", "require", "globalThis", bundle)(loaded, loaded.exports, require, { __barrierEnv: e });
  return { e, api: loaded.exports };
}
{
  const { e, api } = harness(); e.local.revisionesImporte = [clone(review)];
  const result = await api.saveCloudData("A", personalData([personal]));
  // Regresión: antes podía subir S/80 a Personal mientras Caja seguía en S/100.
  assert.equal(result.ok, false, "el respaldo ordinario no puede corregir solo Personal cuando la elección está pendiente");
  assert.equal(e.docs.get("users/A").transactions[0].amount, 100); assert.equal(e.writes, 0); assert.equal(e.reads, 0);
  assert.equal(result.motivo, "revision-caja-pendiente");
  await assert.rejects(api.loadCloudData("A"), /private-box-review-pending/);
  await assert.rejects(api.loadHistoryV2("A"), /private-box-review-pending/);
  await assert.rejects(api.saveHistoryV2("A", [personal], []), /private-box-review-pending/);
  assert.equal(await api.subirCajas("A", boxes), false, "una copia de Caja capturada antes de guardar la revisión también se bloquea");
  assert.equal(e.reads, 0); assert.equal(e.writes, 0); assert.equal(e.local.revisionesImporte[0].local.personal.amount, 80);
}
if (baseline) throw Error("La regresión anterior debía fallar antes.");
for (const failure of ["unreadable", "diskFailure", "invalid", "null-session", "other-uid"]) {
  const { e, api } = harness();
  if (failure === "invalid") e.local = { cajas: "ilegible" };
  else if (failure === "null-session") e.session = null;
  else if (failure === "other-uid") e.uid = "B";
  else e[failure] = true;
  const result = await api.saveCloudData("A", personalData([personal]));
  assert.equal(result.ok, false, failure); assert.equal(e.reads, 0); assert.equal(e.writes, 0);
}
for (const format of [1, 2]) {
  const { e, api } = harness();
  if (format === 2) {
    const root = e.docs.get("users/A"); root.historyFormat = 2; delete root.transactions;
    e.docs.set("users/A/history/10", { id: 10, deleted: false, transaction: { ...personal, amount: 100, updatedAt: 100 }, syncAt: new api.Timestamp() });
  }
  const result = await api.saveCloudData("A", { ...personalData([personal]), isPremium: false });
  assert.equal(result.ok, true, `formato ${format}`); assert.equal(api.privateBoxCloudResponseCurrent("A", result.data), true);
  assert.equal(e.docs.get("users/A").isPremium, true, "el respaldo original aplica realmente la concesión del servidor");
  const loaded = await api.loadCloudData("A"); assert.equal(loaded.transactions[0].amount, 80);
  assert.equal(api.privateBoxCloudResponseCurrent("A", loaded), true); assert.equal(api.privateBoxCloudResponseCurrent("B", loaded), false);
  await api.withPrivateBoxMoneyReview("A", async lease => { lease.assertCurrent(); e.local.revisionesImporte = [clone(review)]; });
  assert.equal(api.privateBoxCloudResponseCurrent("A", loaded), false, "una respuesta anterior no se aplica tras iniciar la revisión");
  assert.equal((await api.saveCloudData("A", personalData([personal]))).ok, false);
}
for (const cutoff of ["before-write", "after-prepared"]) {
  const { e, api } = harness();
  const gate = deferred(); e.prepared = deferred();
  if (cutoff === "before-write") e.readGate = gate; else e.commitGate = gate;
  const saving = api.saveCloudData("A", personalData([personal]));
  if (cutoff === "after-prepared") await e.prepared.promise; else await tick();
  let started = false;
  const reviewing = api.withPrivateBoxMoneyReview("A", async lease => { started = true; lease.assertCurrent(); e.local.revisionesImporte = [clone(review)]; });
  await tick(); assert.equal(started, false, "espera a que termine la petición en vuelo, incluso tras preparar la escritura");
  gate.resolve(); const saved = await saving; await reviewing;
  assert.equal(saved.ok, false, "no entrega una confirmación vieja");
  assert.equal(e.writes, cutoff === "before-write" ? 0 : 1, "no promete cancelar una escritura ya enviada; espera su desenlace");
  assert.equal(e.local.revisionesImporte.length, 1);
}
{
  const { e, api } = harness(); e.readGate = deferred();
  const saving = api.saveCloudData("A", personalData([personal])); await tick();
  const boxesSaving = api.subirCajas("A", boxes); await tick();
  assert.equal(e.transactions, 0, "Caja espera la consulta inicial de Personal");
  e.readGate.resolve(); assert.equal((await saving).ok, true); assert.equal(await boxesSaving, true);
}
{
  const { e, api } = harness(); const old = await api.loadCloudData("A");
  let escaped;
  await api.withPrivateBoxCloudOperation("A", async lease => { escaped = lease; return null; });
  assert.throws(() => escaped.assertCurrent(), /review-changed/, "no reutiliza una autorización fuera de su operación");
  await assert.rejects(async () => api.withPrivateBoxCloudLease("A", escaped, async () => true), /review-changed/);
  await assert.rejects(api.withPrivateBoxCloudLease("B", escaped, async () => true), /review-changed/);
  await assert.rejects(api.withPrivateBoxCloudLease("A", { assertCurrent() {} }, async () => true), /review-changed/);
  await api.withPrivateBoxMoneyReview("A", async lease => {
    const preview = lease.remember({ transactions: [personal] });
    assert.equal(api.privateBoxCloudResponseCurrent("A", preview), false, "una vista de revisión no autoriza la recepción ordinaria");
    await assert.rejects(api.withPrivateBoxCloudLease("A", lease, async () => true), /review-changed/);
    await assert.rejects(api.saveHistoryV2("A", [personal], []), /review-pending/, "una llamada anidada no se queda esperando a sí misma");
  });
  assert.equal(api.privateBoxCloudResponseCurrent("A", old), false);
  await assert.rejects(api.withPrivateBoxCloudOperation("A", async lease => lease.remember(old)), /review-changed/, "no rejuvenece el sello de una respuesta vieja");
  e.uid = "B"; e.session = 2; e.uid = "A"; e.session = 3;
  assert.equal(api.privateBoxCloudResponseCurrent("A", old), false);
  assert.equal((await api.saveCloudData("A", personalData([personal]))).ok, true, "una sesión nueva legítima no hereda el bloqueo en memoria");
}
{
  const { e, api } = harness(); e.readGate = deferred(); const reading = api.loadCloudData("A");
  await tick(); e.uid = "B"; e.session = 2; e.uid = "A"; e.session = 3; e.readGate.resolve();
  await assert.rejects(reading, error => error.message === "cloud-read-failed" && error.cause?.message === "account-task-obsolete"); assert.equal(e.writes, 0);
}
// Manejadores originales: ningún dato se aplica si el sello ya no es válido.
function ownFunction(name) {
  const file = fs.readFileSync("contexts/AppDataContext.tsx", "utf8"), ast = ts.createSourceFile("ctx.tsx", file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let code; const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) code = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) code = `const ${name} = ${node.initializer.arguments[0].getText(ast)};`;
    ts.forEachChild(node, visit); }; visit(ast); assert.ok(code); return ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
}
{
  const { e, api } = harness(), old = await api.loadCloudData("A");
  await api.withPrivateBoxMoneyReview("A", async () => { e.local.revisionesImporte = [clone(review)]; });
  const scope = { ...api, auth: { currentUser: { uid: "A" } }, cloudFieldsRef: { current: personalData([personal]) },
    localSessionVersion: { current: 1 }, tRef: { current: key => key }, setRespaldoFallo() {},
    loadCloudData: async () => old, isPremiumDeLaCuenta: true };
  vm.createContext(scope); vm.runInContext(ownFunction("applyNewerCloudFields") + "\nglobalThis.apply = applyNewerCloudFields;", scope);
  assert.equal(scope.apply(old), false, "el contexto no aplica perfil, moneda ni movimientos de una respuesta atrasada");
  vm.runInContext(ownFunction("hydrateFromCloud"), scope);
  assert.equal(await scope.hydrateFromCloud("A"), "review-pending");
  scope.cloudFieldsRef.current = null;
  await assert.rejects(scope.hydrateFromCloud("A"), /settings.backupBoxReview/, "no confunde una revisión sin perfil con una cuenta vacía");
}
console.log("Barrera Personal/Caja: archivo pendiente, cola, subidas en vuelo, respuesta antigua, sesión, historial anidado y guardias originales comprobados; pantalla monetaria aún sin conectar.");
