import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";
const require = createRequire(import.meta.url), root = process.cwd();
const fromCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requireCore = name => fromCore(name === "./utf8" ? "./utf8.ts" : name);
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const baseline = process.env.FINO_TEST_MONEY_LOCAL_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
function load(file, resolver = requireCore) {
  const code = baseline && file === "utils/cajas.ts" ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module, exports: module.exports, require: resolver, Error, Date });
  return module.exports;
}
const core = load("utils/cajas.ts");
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 2 };
const movement = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Mi aporte", fecha: "2026-10-06", creadoEn: 3, updatedAt: 4, personalTransactionId: 10, notes: "no borrar", extra: { custom: true } };
const personal = { id: 10, type: "expense", amount: 80, category: "otros", date: movement.fecha, time: "10:00", description: "Viaje", method: "transfer", notes: "mi anotación", tags: ["viaje"], image: "foto-local", internalTransfer: "box", internalTransferLink: movement.id, internalTransferSpaceId: box.id, internalTransferSpaceName: box.nombre, updatedAt: 4 };
const unrelated = { ...personal, id: 20, amount: 20, internalTransferLink: "mov-otro", internalTransferSpaceId: "caja-otra" };
const data = { cajas: [box], movimientos: [movement], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2 };
const entry = { id: "money-operation-0001", uid: "A", currency: "PEN", box, local: { personal, movement }, remote: { personal: { ...personal, amount: 100 }, movement: { ...movement } }, chosen: "local-personal", createdAt: 100, version: 100, estado: "pendiente" };
// Primera aserción: falla en b48e703 porque el normalizador pierde la revisión.
const retained = core.normalizarCajas({ ...data, revisionesImporte: [entry] });
assert.deepEqual(plain(retained.revisionesImporte), [entry], "normalizar/abrir Cajas debe conservar los cuatro originales y la elección");
if (baseline) throw Error("La versión anterior no debía conservar esta revisión.");
const review = load("utils/privateBoxMoneyReview.ts", name => name === "@/utils/cajas" ? core : require(name));
const { moneyAcknowledgement, moneyChoices } = require("../functions/src/private-box-money-shared.js");
const make = (chosen = "local-personal", local = data, rows = [personal, unrelated], remote = data, remoteRows = [entry.remote.personal], currency = "PEN") =>
  review.prepararRevisionImporte(local, rows, [], remote, remoteRows, [], "A", currency, entry.id, movement.id, chosen, 100);
const selected = make();
assert.deepEqual(plain(selected), entry);
assert.equal(moneyChoices(selected).length, 2);
const previousRows = [personal, unrelated];
for (const source of ["local-personal", "local-box", "remote-personal", "remote-box"]) {
  const pick = make(source), saved = core.conservarRevisionImporte(data, pick);
  const result = review.confirmarRevisionImporteLocal(saved, previousRows, [], pick, moneyAcknowledgement(pick), "A", "PEN");
  assert.equal(result.data.movimientos[0].monto, source === "local-personal" ? 80 : 100);
  assert.equal(result.transactions[0].amount, result.data.movimientos[0].monto);
  assert.equal(result.transactions[0].updatedAt, pick.version, "no rejuvenece una mitad con Date.now");
  assert.equal(result.data.movimientos[0].updatedAt, pick.version);
  assert.equal(result.transactions[1], unrelated, "no cambia un movimiento ajeno");
  assert.deepEqual(plain(result.transactions[0].tags), personal.tags); assert.equal(result.transactions[0].notes, personal.notes);
  assert.equal(result.transactions[0].image, personal.image); assert.deepEqual(plain(result.data.movimientos[0].extra), movement.extra);
  assert.equal(result.data.revisionesImporte[0].estado, "confirmado");
  assert.deepEqual(plain(result.data.revisionesImporte[0].local.personal), personal);
  assert.equal(core.conservarRevisionImporte(result.data, pick), result.data, "una copia atrasada no reactiva una revisión confirmada");
  const again = review.confirmarRevisionImporteLocal(result.data, result.transactions, [], result.data.revisionesImporte[0], moneyAcknowledgement(pick), "A", "PEN");
  assert.deepEqual(plain(again), plain(result), "repetir no crea otro movimiento");
  for (const originals of [[personal, movement], [entry.remote.personal, entry.remote.movement]]) {
    const hydrated = { ...saved, movimientos: [originals[1]] };
    const recovered = review.confirmarRevisionImporteLocal(hydrated, [originals[0], unrelated], [], pick, moneyAcknowledgement(pick), "A", "PEN");
    assert.equal(recovered.transactions.length, 2, "acepta solo originales conocidos tras reiniciar/recibir nube");
  }
}
const journal = core.conservarRevisionImporte(data, selected), ack = moneyAcknowledgement(selected);
for (const [source, rows, deleted, response, owner, currency] of [
  [{ ...journal, cajasBorradas: [box.id] }, previousRows, [], ack, "A", "PEN"],
  [{ ...journal, movimientosBorrados: [movement.id] }, previousRows, [], ack, "A", "PEN"],
  [journal, previousRows, [personal.id], ack, "A", "PEN"],
  [journal, [{ ...personal, notes: "edición posterior" }, unrelated], [], ack, "A", "PEN"],
  [journal, [{ ...personal, updatedAt: 101 }, unrelated], [], ack, "A", "PEN"],
  [journal, [{ ...personal, internalTransferSettled: true }, unrelated], [], ack, "A", "PEN"],
  [journal, previousRows, [], { ...ack, amount: 100 }, "A", "PEN"],
  [journal, previousRows, [], ack, "B", "PEN"], [journal, previousRows, [], ack, "A", "USD"],
]) assert.throws(() => review.confirmarRevisionImporteLocal(source, rows, deleted, selected, response, owner, currency), /money-changed/);
for (const malformed of [
  { ...selected, estado: "borrado" }, { ...selected, version: 4 },
  { ...selected, local: { ...selected.local, personal: { ...personal, notes: NaN } } },
  { ...selected, extra: Infinity }, { ...selected, local: { ...selected.local, personal: { ...personal, date: "2026-02-30" } } },
]) assert.throws(() => core.validarCajas({ ...data, revisionesImporte: [malformed] }), /cajas-invalid-data/);
assert.throws(() => core.validarCajas({ ...data, revisionesImporte: [selected, selected] }), /cajas-invalid-data/);
assert.throws(() => core.validarCajas({ ...data, revisionesImporte: [selected, { ...selected, id: "money-operation-0002" }] }), /cajas-invalid-data/);
assert.throws(() => core.validarCajas({ ...data, revisionesImporte: [selected, { ...selected, id: "money-operation-0002", uid: "B", estado: "confirmado" }] }), /cajas-invalid-data/);
const fifty = { ...data, revisionesImporte: Array.from({ length: 50 }, (_, index) => ({ ...selected, id: `money-operation-${index.toString().padStart(4, "0")}`, estado: "confirmado" })) };
assert.throws(() => core.conservarRevisionImporte(fifty, { ...selected, id: "money-operation-0051" }), /history-full/);
assert.equal(fifty.revisionesImporte.length, 50, "el límite no borra ninguna revisión previa");
const sized = (bytes, id) => {
  const value = { ...entry, id, estado: "confirmado", padding: "" };
  const remaining = bytes - Buffer.byteLength(JSON.stringify(value), "utf8");
  value.padding = "🔒".repeat(Math.floor(remaining / 4)) + "a".repeat(remaining % 4);
  assert.equal(Buffer.byteLength(JSON.stringify(value), "utf8"), bytes); return value;
};
assert.doesNotThrow(() => core.validarRevisionImporte(sized(150_000, "money-operation-size-1")));
assert.throws(() => core.validarRevisionImporte(sized(150_001, "money-operation-size-1")), /history-full/);
const boundary = sized(150_000, "money-operation-size-1");
const boundaryPending = { ...boundary, estado: "pendiente" };
assert.equal(Buffer.byteLength(JSON.stringify(boundaryPending), "utf8"), 149_999);
assert.doesNotThrow(() => core.conservarRevisionImporte(core.conservarRevisionImporte(data, boundaryPending), boundary));
const big = [1, 2, 3].map(id => sized(140_000, `money-operation-size-${id}`));
const bigTwo = core.conservarRevisionImporte(core.conservarRevisionImporte(data, big[0]), big[1]);
assert.throws(() => core.conservarRevisionImporte(bigTwo, big[2]), /history-full/);
assert.equal(bigTwo.revisionesImporte.length, 2, "el límite de bytes conserva las copias previas");
assert.throws(() => core.validarCajas({ ...data, revisionesImporte: big }), /invalid-data/);
const exactEntries = [sized(140_000, "money-operation-size-1"), sized(140_000, "money-operation-size-2"), sized(119_996, "money-operation-size-3")];
assert.equal(Buffer.byteLength(JSON.stringify(exactEntries), "utf8"), 400_000);
let exact = data;
for (const item of exactEntries) exact = core.conservarRevisionImporte(exact, item);
assert.doesNotThrow(() => core.validarCajas(exact));
assert.throws(() => core.conservarRevisionImporte(exact, { ...entry, id: "money-operation-size-4", estado: "confirmado" }), /history-full/);
assert.throws(() => core.conservarRevisionImporte(journal, { ...selected, chosen: "local-box" }), /money-changed/);
assert.throws(() => core.conservarRevisionImporte(journal, { ...selected, id: "money-operation-0002" }), /money-pending/);
const detached = core.conservarRevisionImporte(data, selected); selected.local.personal.tags.push("changed"); selected.local.movement.extra.custom = false;
assert.deepEqual(plain(detached.revisionesImporte[0].local.personal.tags), ["viaje"]);
assert.equal(detached.revisionesImporte[0].local.movement.extra.custom, true);
assert.deepEqual(plain(core.fusionarCajas(detached, data).revisionesImporte), plain(detached.revisionesImporte));
assert.throws(() => core.fusionarCajas(detached, { ...data, movimientos: [{ ...movement, monto: 120, updatedAt: 200 }] }), /sync-conflict/);
const invalidMetadata = [{ ...entry.remote.personal, category: "servicios" }];
assert.throws(() => make("local-personal", data, [personal], data, invalidMetadata), /money-invalid-review/);
assert.throws(() => make("local-personal", data, [personal, personal]), /money-changed/);
const spent = { ...movement, id: "mov-gasto", tipo: "gasto", monto: 90, personalTransactionId: undefined };
assert.throws(() => make("local-personal", { ...data, movimientos: [movement, spent] }), /negative-balance/);
for (const [currency, amount] of [["JPY", 80], ["PEN", 80.12], ["KWD", 80.123]]) {
  const c = make("local-personal", data, [{ ...personal, amount }], data, [entry.remote.personal], currency);
  assert.equal(c.local.personal.amount, amount);
}
assert.throws(() => make("local-personal", data, [{ ...personal, amount: 80.1 }], data, [entry.remote.personal], "JPY"), /money-invalid-review/);

// La recuperación heredada real no se adelanta a una decisión pendiente.
const linked = load("utils/linkedTransfers.ts");
const repairs = load("utils/privateBoxRepair.ts", name => name === "@/utils/cajas" ? core : name === "@/utils/linkedTransfers" ? linked : require(name));
const plan = repairs.planPrivateBoxRepair(journal, previousRows, [], "A");
assert.equal(plan.data, journal); assert.equal(plan.upserts.length, 0); assert.equal(plan.conflicts[0].selectable, undefined);

// El uploader original nunca manda originales retenidos ni intenta resolver dinero.
let cloud = plain(data), calls = 0, writes = 0;
const task = { captureAccountTask: () => ({ current: () => true, wait: work => work() }) };
const uploader = load("utils/cloudCajas.ts", name => {
  if (name === "@/utils/cajas") return core;
  if (name === "@/utils/firebase") return { db: {} };
  if (name === "@/utils/accountTask") return task;
  if (name === "@/utils/storage") return { hasUnreadableLocalData: () => false };
  if (name === "firebase/firestore") return { doc: () => ({}), getDocFromServer: async () => ({ exists: () => true, data: () => cloud, metadata: {} }), runTransaction: async (_db, run) => {
    calls++; return run({ get: async () => ({ exists: () => true, data: () => cloud }), set: (_ref, next) => { writes++; cloud = plain(next); } });
  } };
  throw Error(name);
});
assert.equal(await uploader.subirCajas("A", journal), false); assert.equal(calls, 0);
const completed = review.confirmarRevisionImporteLocal(journal, previousRows, [], journal.revisionesImporte[0], ack, "A", "PEN");
assert.equal(await uploader.subirCajas("A", completed.data), true); assert.equal(writes, 1); assert.equal(cloud.revisionesImporte, undefined);
cloud = plain(journal); await assert.rejects(uploader.bajarCajas("A"), /invalid-data/);

// Cifrado/almacenamiento/archivo por cuenta originales, con sustitutos de Android.
const scenario = esbuild.buildSync({ stdin: { contents: `
  import assert from "node:assert/strict";
  import AsyncStorage, { failNextStorageOperation } from "@react-native-async-storage/async-storage";
  import { loadJSON, saveJSONNow, setAccountStorageAvailable, clearAccountData, STORAGE_KEYS } from "@/utils/storage";
  import { archiveLocalAccount, prepareLocalAccount, deleteLocalAccountVault } from "@/utils/localAccountVault";
  import { validarCajas } from "@/utils/cajas";
  export async function run(journal) {
    setAccountStorageAvailable(true);
    await saveJSONNow(STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "a@example.com" });
    await prepareLocalAccount("A", "a@example.com");
    assert.equal(await saveJSONNow(STORAGE_KEYS.cajasDinero, journal), true);
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.cajasDinero);
    assert.ok(raw.startsWith("v2:")); assert.equal(raw.includes("mi anotación"), false);
    assert.deepEqual(validarCajas(await loadJSON(STORAGE_KEYS.cajasDinero, null)).revisionesImporte, journal.revisionesImporte);
    failNextStorageOperation("set", STORAGE_KEYS.cajasDinero);
    assert.equal(await saveJSONNow(STORAGE_KEYS.cajasDinero, { ...journal, revisionesImporte: [] }), false);
    assert.equal(await AsyncStorage.getItem(STORAGE_KEYS.cajasDinero), raw, "fallo de disco conserva originales");
    await assert.rejects(archiveLocalAccount("A", "a@example.com"), /local-account-write/, "no cierra sesión con un guardado fallido pendiente");
    assert.equal(await saveJSONNow(STORAGE_KEYS.cajasDinero, journal), true, "reintento real confirma originales antes de archivar");
    await archiveLocalAccount("A", "a@example.com"); await clearAccountData();
    await prepareLocalAccount("B", "b@example.com");
    assert.equal(await loadJSON(STORAGE_KEYS.cajasDinero, null), null);
    await saveJSONNow(STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "b@example.com" });
    await archiveLocalAccount("B", "b@example.com"); await clearAccountData();
    await prepareLocalAccount("A", "a@example.com");
    assert.deepEqual(validarCajas(await loadJSON(STORAGE_KEYS.cajasDinero, null)).revisionesImporte, journal.revisionesImporte);
    await deleteLocalAccountVault("B");
    assert.ok((await AsyncStorage.getAllKeys()).some(key => key.includes("localAccountVault:v1:A:")));
  }
`, resolveDir: root, sourcefile: "money-journal-scenario.ts", loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", alias: {
  "@": root, "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
  "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"), "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts"),
} });
const loaded = { exports: {} }; new Function("module", "exports", "require", scenario.outputFiles[0].text)(loaded, loaded.exports, require);
await loaded.exports.run(plain(journal));
console.log("Originales de importe: retención cifrada por cuenta, elección exacta, plan conjunto validado y copia ordinaria bloqueada; pantalla/envío aún sin conectar.");
