import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Recibo, cifrado, almacén y bóveda ORIGINALES. IO Android/Auth sustituido,
// SHA-256 y AES/HMAC reales; no conecta a Firebase ni acredita consentimiento legal.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_LEGAL_ACCOUNT_BASELINE ?? "" });
function environment() {
  const result = buildSync({ stdin: { contents: `
    export * from '@/utils/legalAcceptance';
    export { auth } from '@/utils/firebase';
    export { default as disk, failNextStorageOperation } from '@react-native-async-storage/async-storage';
    export { encryptText, decryptText } from '@/utils/encryption';
    export { setAccountStorageAvailable, clearAccountData, getAccountStorageSession } from '@/utils/storage';
    export { deleteLocalAccountVault } from '@/utils/localAccountVault';
  `, resolveDir: root, sourcefile: "legal-real-dependencies.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": root, "@/utils/firebase": path.join(root, "pruebas/stubs/firebase-local.ts"),
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"),
      "expo-crypto": path.join(root, "pruebas/stubs/crypto-sha256.ts") } });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const key = uid => `finzo:legalAcceptance:v1:${encodeURIComponent(uid)}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
function enter(api, uid) { api.auth.currentUser = { uid }; api.setAccountStorageAvailable(true); }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

{
  const a = environment(); enter(a, "A");
  await a.disk.setItem("financial-untouched", "original-money");
  assert.equal(await a.hasAcceptedLegalDocuments("A"), false);
  await assert.rejects(a.assertSharedContentAccepted("A"), /legal-acceptance-required/);
  const stop = a.subscribeLegalAcceptance(() => { throw new Error("broken-view"); });
  await a.recordLegalAcceptanceForCurrentAccount(); stop();
  assert.equal(await a.hasAcceptedLegalDocuments("A"), true, "un observador roto no invalida el recibo");
  const encrypted = await a.disk.getItem(key("A"));
  assert.ok(!encrypted.includes('"uid"') && !encrypted.includes('"acceptedAt"'), "recibo no guardado en texto plano");
  const receipt = JSON.parse(await a.decryptText(encrypted));
  assert.equal(receipt.uid, "A"); assert.equal(receipt.termsAccepted, true); assert.equal(receipt.privacyRead, true);
  assert.match(receipt.termsHash, /^[a-f\d]{64}$/); assert.match(receipt.privacyHash, /^[a-f\d]{64}$/);
  const parts = encrypted.split(":");
  await a.disk.setItem(key("A"), `${parts[1]}:${parts[2]}`);
  await assert.rejects(a.hasAcceptedLegalDocuments("A"), /legal-receipt-invalid/, "recibo nuevo requiere HMAC, no formato heredado sin autenticación");
  for (const field of ["termsHash", "privacyHash"]) {
    await a.disk.setItem(key("A"), await a.encryptText(JSON.stringify({ ...receipt, [field]: "f".repeat(64) })));
    assert.equal(await a.hasAcceptedLegalDocuments("A"), false, `${field}: nueva versión requiere otra elección`);
  }
  await a.disk.setItem(key("A"), "damaged-not-a-receipt");
  await assert.rejects(a.hasAcceptedLegalDocuments("A"));
  await a.recordLegalAcceptanceForCurrentAccount();
  assert.equal(await a.hasAcceptedLegalDocuments("A"), true, "una elección nueva repara solo el recibo");
  // El borrado activo del logout NO borra el recibo separado por UID.
  a.auth.currentUser = null; await a.clearAccountData();
  enter(a, "B"); assert.equal(await a.hasAcceptedLegalDocuments("B"), false);
  await a.recordLegalAcceptanceForCurrentAccount();
  enter(a, "A"); assert.equal(await a.hasAcceptedLegalDocuments("A"), true);
  await a.deleteLocalAccountVault("A");
  assert.equal(await a.disk.getItem(key("A")), null, "eliminar la cuenta limpia su aceptación, no solo el archivo financiero");
  enter(a, "B"); assert.equal(await a.hasAcceptedLegalDocuments("B"), true, "no borrar aceptación de otra cuenta");
  assert.equal(await a.disk.getItem("financial-untouched"), "original-money");
}
for (const failure of ["set", "get"]) {
  const a = environment(); enter(a, "A");
  a.failNextStorageOperation(failure, key("A"));
  await assert.rejects(a.recordLegalAcceptanceForCurrentAccount(), /test-storage-failure/);
  // La comprobación no finge fallo persistente: si el disco realmente guardó
  // antes del error de lectura, otro intento puede verificarlo.
  await a.recordLegalAcceptanceForCurrentAccount(); assert.equal(await a.hasAcceptedLegalDocuments("A"), true);
}
{
  const a = environment(); enter(a, "A");
  await a.disk.setItem(key("A"), "x".repeat(4097));
  await assert.rejects(a.hasAcceptedLegalDocuments("A"), /legal-receipt-invalid/);
  const get = a.disk.getItem;
  a.disk.getItem = async name => name === key("A") ? "readback-does-not-match" : get(name);
  await assert.rejects(a.recordLegalAcceptanceForCurrentAccount(), /legal-save-failed/);
}
for (const change of ["account", "session", "delete"]) {
  const a = environment(); enter(a, "A"); const gate = deferred(), started = deferred();
  const set = a.disk.setItem;
  a.disk.setItem = async (name, value) => {
    if (name === key("A")) { started.resolve(); await gate.promise; }
    return set(name, value);
  };
  const write = a.recordLegalAcceptanceForCurrentAccount();
  const rejected = assert.rejects(write, /legal-account-changed/);
  await started.promise;
  let removal;
  if (change === "account") { enter(a, "B"); await a.recordLegalAcceptanceForCurrentAccount(); enter(a, "A"); }
  if (change === "session") { a.setAccountStorageAvailable(false); a.setAccountStorageAvailable(true); }
  if (change === "delete") removal = a.deleteLegalAcceptance("A");
  gate.resolve(); await rejected;
  if (removal) {
    await removal;
    assert.equal(await a.disk.getItem(key("A")), null, "barrera borra escritura tardía");
    await assert.rejects(a.recordLegalAcceptanceForCurrentAccount(), /legal-account-changed/);
  }
}
{
  const a = environment(); enter(a, "A");
  const gate = deferred(), started = deferred(), get = a.disk.getItem;
  a.disk.getItem = async name => { if (name === key("A")) { started.resolve(); await gate.promise; } return get(name); };
  const readPending = a.hasAcceptedLegalDocuments("A"), rejected = assert.rejects(readPending, /legal-account-changed/);
  await started.promise; enter(a, "B");
  await a.recordLegalAcceptanceForCurrentAccount(); // A bloqueada no retiene B.
  gate.resolve(); await rejected;
  assert.equal(await a.hasAcceptedLegalDocuments("B"), true);
}

// Barreras en funciones originales contra la revisión anterior: sin elección
// no llega a Firestore. IO simulado; NO demuestra reglas/servidor/Android.
const guarded = [
  ["utils/cloudFamilia.ts", "crearFamilia", ["A", "Ana", "Casa"]],
  ["utils/cloudFamilia.ts", "crearInvitacionFamilia", ["A", "space"]],
  ["utils/cloudFamilia.ts", "renombrarFamilia", ["space", "Casa"]],
  ["utils/cloudFamilia.ts", "unirseAFamilia", ["A", "Ana", "CODE"]],
  ["utils/cloudFamilia.ts", "guardarMovimientoFamilia", ["space", "A", { monto: 10 }]],
  ["utils/cloudCajasCompartidas.ts", "crearInvitacionCaja", ["A", "space"]],
  ["utils/cloudCajasCompartidas.ts", "renombrarCajaCompartida", ["space", "Casa"]],
  ["utils/cloudCajasCompartidas.ts", "unirseACaja", ["A", "Ana", "CODE"]],
  ["utils/cloudCajasCompartidas.ts", "guardarMovimientoCajaCompartida", ["space", "A", { monto: 10 }]],
  ["utils/personalContribution.ts", "actualizarAportePersonal", ["family", "space", "row", 10, "Texto"]],
];
for (const [file, name, args] of guarded) {
  const a = environment(); enter(a, "A"); let calls = 0;
  const remote = async () => { calls++; throw new Error("remote-reached"); };
  const deps = { assertSharedContentAccepted: a.assertSharedContentAccepted, db: {},
    doc: () => ({}), collection: () => ({}), crearCodigoFamilia: () => "CODE", isSafeMoneyAmount: () => true,
    getDoc: remote, setDoc: remote, updateDoc: remote, addDoc: remote, runTransaction: remote, serverTimestamp: () => 1,
    functions: {}, httpsCallable: () => remote };
  const fn = handlerOriginal(file, name, deps, read(file));
  await assert.rejects(fn(...args), /legal-acceptance-required/, `${name}: la versión anterior llega al servidor sin elección`);
  assert.equal(calls, 0);
  await a.recordLegalAcceptanceForCurrentAccount();
  await assert.rejects(fn(...args), /remote-reached/); assert.equal(calls, 1, `${name}: aceptación abre el flujo original`);
}
{
  const file = "utils/cloudCajasCompartidas.ts", a = environment(); enter(a, "A");
  let writes = 0, modes = [];
  const done = { targetId: "shared", name: "Casa", createdAt: 1 };
  const deps = { captureAccountTask: () => ({ wait: operation => operation() }),
    huellaCaja: async () => "a".repeat(64),
    confirmarConversionCaja: async (_uid, _id, _hash, _currency, mode) => { modes.push(mode); return mode === "finish" ? done : null; },
    assertSharedContentAccepted: a.assertSharedContentAccepted,
    subirCajas: async () => { writes++; throw new Error("source-written"); } };
  const fn = handlerOriginal(file, "compartirCajaExistente", deps, read(file));
  assert.equal((await fn("A", "Ana", { id: "box" }, [], "PEN", false)).id, "shared");
  assert.deepEqual(modes, ["status", "finish"]); assert.equal(writes, 0, "recuperación previa no exige nueva aceptación");
  await assert.rejects(fn("A", "Ana", { id: "box" }, [], "PEN", true), /legal-acceptance-required/);
  assert.equal(writes, 0, "no respalda/copía una conversión nueva sin aceptar");
}
// Pedir documentos no convierte una Caja normal en una migración pendiente.
{
  const a = environment(); enter(a, "A"); let writes = 0, errors = [];
  const caja = { id: "box", nombre: "Casa" }, data = { cajas: [caja], movimientos: [] };
  const deps = { auth: a.auth, caja, repairBlocked: false, compartiendo: false,
    conversionEnCurso: { current: false }, guardandoRef: { current: false }, isPremium: true,
    movimientos: [], transactions: [], Platform: { OS: "android" },
    privateBoxLinksMatch: () => true, datosActuales: { current: data },
    captureAccountTask: () => ({ current: () => true, wait: operation => operation() }),
    accountUid: "A", cuentaActual: () => true, ready: true, hasUnreadableLocalData: () => false,
    setCompartiendo() {}, assertSharedContentAccepted: a.assertSharedContentAccepted,
    guardarCambioCaja: async () => { writes++; return true; }, nuevoIntentoCaja: () => "attempt",
    compartirCajaExistente: async () => { throw new Error("legal-acceptance-required"); },
    showToast: value => errors.push(value), t: key => key, spaceErrorKey: () => "legal.sharedRequired" };
  await handlerOriginal("screens/Cajas.tsx", "compartirCaja", deps, read("screens/Cajas.tsx"))();
  assert.equal(writes, 0, "sin aceptar no guardar sharingPending ni inmovilizar la Caja privada");
  assert.deepEqual(errors, ["legal.sharedRequired"]);
  assert.equal(deps.conversionEnCurso.current, false);
}
// Acciones de salida originales no dependen de aceptación.
for (const [file, name, args, dependency] of [
  ["utils/cloudFamilia.ts", "borrarMovimientoFamilia", ["space", "row"], "deleteDoc"],
  ["utils/cloudCajasCompartidas.ts", "borrarMovimientoCajaCompartida", ["space", "row"], "deleteDoc"],
  ["utils/personalContribution.ts", "borrarAportePersonal", ["family", "space", "row"], "httpsCallable"],
  ["utils/personalContribution.ts", "cerrarEspacioCompartido", ["family", "space"], "httpsCallable"],
  ["utils/personalContribution.ts", "salirEspacioCompartido", ["family", "space"], "httpsCallable"],
]) {
  let calls = 0;
  await handlerOriginal(file, name, { db: {}, functions: {}, doc: () => ({}),
    assertSharedContentAccepted: () => { throw new Error("must-not-require-acceptance"); },
    [dependency]: dependency === "httpsCallable" ? () => async () => { calls++; } : async () => { calls++; } }, read(file))(...args);
  assert.equal(calls, 1, `${name}: salida financiera sigue disponible`);
}

// Manejador de la casilla existente original, no montaje React.
const file = "components/LegalAcceptancePanel.tsx";
{
  const a = environment(); enter(a, "A"); let busy = false, status = "required";
  const gate = deferred(), lock = { current: false }, epoch = { current: 0 };
  let calls = 0;
  const deps = { checked: false, lock, epoch, current: () => a.auth.currentUser?.uid === "A",
    setBusy: value => { busy = value; }, setStatus: value => { status = value; }, withTimeout: promise => promise,
    recordLegalAcceptanceForCurrentAccount: async () => { calls++; await gate.promise; await a.recordLegalAcceptanceForCurrentAccount(); } };
  await handlerOriginal(file, "accept", deps)(); assert.equal(calls, 0);
  deps.checked = true; const fn = handlerOriginal(file, "accept", deps);
  const pending = fn(); await tick(); await fn(); assert.equal(calls, 1); assert.equal(busy, true);
  gate.resolve(); await pending; assert.equal(status, "accepted"); assert.equal(busy, false);
  assert.equal(await a.hasAcceptedLegalDocuments("A"), true);
  deps.recordLegalAcceptanceForCurrentAccount = async () => { throw new Error("disk-error"); };
  await handlerOriginal(file, "accept", deps)(); assert.equal(status, "failed"); assert.equal(lock.current, false);
}
for (const file of ["screens/Family.tsx", "screens/SharedBoxes.tsx"]) {
  const text = readFileSync(file, "utf8");
  assert.ok(text.indexOf("<LegalAcceptancePanel />") > text.indexOf("<ScrollView"), "aviso dentro de contenido desplazable, contrato estático");
}
console.log("Originales recibo/cifrado/almacén/bóveda y manejadores: separación A/B, versiones, daños/fallos, logout/borrado, respuestas tardías, diez barreras compartidas y conversión sin bloqueo anticipado; recuperación intacta. IO adaptado, sin servidor/consentimiento jurídico/Android.");
