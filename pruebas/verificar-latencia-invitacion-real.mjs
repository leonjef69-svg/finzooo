import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Ejecuta las funciones originales. FINO_TEST_BASELINE=6aa8de59 falla porque
// antes cada invitación exigía renovar el recibo remoto ANTES de escribir.
const read = createSourceReader();
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function environment() {
  const auth = { currentUser: { uid: "A" } }, calls = [];
  let session = 1, accepted = true;
  const entry = { exports: {} };
  const source = ts.transpileModule(read("utils/legalAcceptance.ts"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const dependencies = {
    "@react-native-async-storage/async-storage": { default: { getItem: async () => accepted ? "v2:receipt" : null } },
    "expo-crypto": { CryptoDigestAlgorithm: { SHA256: "sha" }, digestStringAsync: async (_algorithm, text) => text === "terms" ? "a".repeat(64) : "b".repeat(64) },
    "@/constants/legal": { TERMS_AND_CONDITIONS: "terms", PRIVACY_POLICY: "privacy" },
    "@/utils/encryption": { decryptText: async () => JSON.stringify({ format: 1, uid: "A", termsAccepted: true, privacyRead: true, termsHash: "a".repeat(64), privacyHash: "b".repeat(64), acceptedAt: 1 }) },
    "@/utils/firebase": { auth }, "@/utils/storage": { getAccountStorageSession: () => session },
    "@/utils/legalAcceptanceRemote": { confirmLegalAcceptance: async () => { calls.push("confirm"); }, forgetLegalAcceptanceConfirmation: () => calls.push("forget") },
  };
  vm.runInNewContext(source, { exports: entry.exports, module: entry, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { ...entry.exports, auth, calls, setSession: value => { session = value; }, setAccepted: value => { accepted = value; } };
}
for (const [file, name] of [["utils/cloudFamilia.ts", "crearInvitacionFamilia"], ["utils/cloudCajasCompartidas.ts", "crearInvitacionCaja"]]) {
  const e = environment(), saved = [];
  const fn = handlerOriginal(file, name, { ...e, db: {}, reusableInvitation:(_uid,_space,create)=>create(), crearCodigoFamilia: () => "ABCDEFGH",
    doc: (_db, kind, code) => ({ kind, code }), serverTimestamp: () => 1,
    setDoc: async (ref, data) => { saved.push({ ref, data }); e.calls.push("write-ack"); } }, read(file));
  assert.equal(await fn("A", "space"), "ABCDEFGH");
  assert.deepEqual(e.calls, ["write-ack"], "el ACK protegido por reglas evita renovar previamente un recibo ya válido");
  assert.equal(saved.length, 1); assert.equal(saved[0].data.createdBy, "A");
}
// Sin aceptación explícita no se intenta ni la primera escritura.
{
  const e = environment(); e.setAccepted(false);
  await assert.rejects(e.writeWithAcceptedSharedContent("A", async () => e.calls.push("write")), /legal-acceptance-required/);
  assert.deepEqual(e.calls, []);
}
// Un permiso denegado no guardó nada: confirmar una vez y reintentar la MISMA operación.
{
  const e = environment(); let writes = 0;
  await e.writeWithAcceptedSharedContent("A", async () => { e.calls.push("write"); if (++writes === 1) throw Object.assign(Error("denied"), { code: "permission-denied" }); return "ok"; });
  assert.deepEqual(e.calls, ["write", "forget", "confirm", "write"]);
}
for (const code of ["unavailable", "deadline-exceeded", "cancelled"]) {
  const e = environment();
  await assert.rejects(e.writeWithAcceptedSharedContent("A", async () => { e.calls.push("write"); throw Object.assign(Error(code), { code }); }), new RegExp(code));
  assert.deepEqual(e.calls, ["write"], "no reintenta un resultado de escritura incierto");
}
{
  const e = environment(); let writes = 0;
  await assert.rejects(e.writeWithAcceptedSharedContent("A", async () => { writes++; throw Object.assign(Error("still denied"), { code: "permission-denied" }); }), /still denied/);
  assert.equal(writes, 2, "sin bucle si no es dueño, perdió Pro o el espacio está cerrado");
}
for (const change of ["account", "same-uid-object", "session"]) {
  const e = environment(), gate = deferred();
  const work = e.writeWithAcceptedSharedContent("A", () => gate.promise);
  const rejected = assert.rejects(work, /legal-account-changed/); await tick();
  if (change === "session") e.setSession(2);
  else e.auth.currentUser = { uid: change === "account" ? "B" : "A" };
  gate.resolve("late-code"); await rejected; assert.deepEqual(e.calls, []);
}
// El cierre se comprueba DESPUÉS del historial: hacerlo antes podría confundir
// el historial purgado por cierre con un aporte borrado y devolver dinero falso.
{
  const history = deferred(), space = deferred(), started = [];
  const fn = handlerOriginal("utils/cloudFamilia.ts", "listarMovimientosFamilia", {
    db: {}, collection: () => ({}), doc: () => ({}), query: value => value, orderBy: () => ({}),
    getDocsFromServer: () => { started.push("history"); return history.promise; },
    getDocFromServer: () => { started.push("space"); return space.promise; }, alNumero: Number,
  }, read("utils/cloudFamilia.ts"));
  const work = fn("family", true); await tick();
  assert.deepEqual(started, ["history"], "comprobar cierre antes de recibir el historial sería inseguro");
  history.resolve({ metadata: { fromCache: false, hasPendingWrites: false }, docs: [] });
  await tick(); assert.deepEqual(started, ["history", "space"]);
  space.resolve({ exists: () => true, data: () => ({ closed: true }), metadata: { fromCache: false, hasPendingWrites: false } });
  await assert.rejects(work, /family-unconfirmed/);
}
console.log("Invitación original: ACK sin llamada previa redundante, elección local obligatoria, rechazo único, errores inciertos y sesión protegidos; cierre se confirma después del historial. IO adaptado, no acredita Android ni reglas publicadas.");
