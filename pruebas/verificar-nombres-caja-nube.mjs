import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requirePure = name => requireCore(name === "./utf8" ? "./utf8.ts" : name);

const baseline = process.env.FINO_TEST_NAME_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, require = requirePure) {
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, require, Error, Date }); return module.exports;
}
const core = load("utils/cajas.ts");
let uid = "a", generation = 1, unreadable = false, gate, lost = false, calls = 0, writes = 0;
const auth = { get currentUser() { return { uid }; } };
const storage = { getAccountStorageSession: () => generation, hasUnreadableLocalData: () => unreadable };
const task = load("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : storage);
const a = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 10 }, b = { ...a, nombre: "Vacaciones" };
const other = { id: "caja-b", nombre: "Casa", creadaEn: 3, updatedAt: 11 };
const row = { id: "mov-a", cajaId: a.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 1 };
const local = { cajas: [a, other], movimientos: [row], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2 };
const remote = { ...plain(local), cajas: [b, other] };
let document = { ...plain(remote), future: { preserve: true } };
const api = load("utils/cloudCajas.ts", name => {
  if (name.endsWith("firebase")) return { db: {}, auth };
  if (name.endsWith("cajas")) return core;
  if (name.endsWith("accountTask")) return task;
  if (name.endsWith("storage")) return storage;
  if (name === "firebase/firestore") return { doc: (_db, collection, owner) => ({ collection, owner }),
    getDocFromServer: async () => ({ exists: () => true, data: () => plain(document), metadata: { fromCache: false, hasPendingWrites: false } }),
    runTransaction: async (_db, callback) => {
      calls++; const result = await callback({ get: async () => { if (gate) await gate; return { exists: () => true, data: () => plain(document) }; },
        set: (_ref, value) => { writes++; document = plain(value); }, update: (_ref, value) => { writes++; document = { ...document, ...plain(value) }; } });
      if (lost) { lost = false; throw Error("lost-response"); } return result;
    } };
  throw Error(name);
});
const entry = core.prepararRevisionNombre ? core.prepararRevisionNombre(local, remote, uid, "op-a", a.id, "local", 100)
  : { id: "op-a", uid, boxId: a.id, local: a, remoto: b, elegido: { ...a, updatedAt: 100 }, creadoEn: 100, estado: "pendiente" };
const result = api.resolverNombreCaja ? await api.resolverNombreCaja(uid, entry) : await api.subirCajas(uid, local);
assert.equal(!!result && document.cajas[0].nombre === a.nombre, true, "una elección explícita debe resolver el nombre, no quedar bloqueada por el empate");
assert.deepEqual(document.movimientos, local.movimientos); assert.deepEqual(document.future, { preserve: true });
assert.equal(document.revisionesNombre, undefined, "la copia de ambos nombres nunca viaja a Firebase");
assert.equal(core.diferenciasNombreCajas(local, remote).length, 1);
const retained = core.conservarRevisionNombre(local, entry);
assert.equal(retained.cajas[0].nombre, a.nombre); assert.equal(retained.revisionesNombre[0].remoto.nombre, b.nombre);
const finished = core.confirmarRevisionNombreLocal(retained, entry, uid);
assert.equal(finished.revisionesNombre[0].estado, "confirmado"); assert.equal(finished.movimientos[0].monto, 100);
assert.equal(core.conservarRevisionNombre(finished, entry), finished, "una copia atrasada no vuelve una elección confirmada a pendiente");
const extendedLocal = { ...local, cajas: [{ ...a, extra: { value: "conservar" } }, other] };
const extendedRemote = { ...remote, cajas: [{ ...b, extra: { value: "conservar" } }, other] };
const detached = core.prepararRevisionNombre(extendedLocal, extendedRemote, uid, "detached", a.id, "local", 120);
extendedLocal.cajas[0].extra.value = "cambió"; extendedRemote.cajas[0].extra.value = "cambió";
assert.equal(detached.local.extra.value, "conservar"); assert.equal(detached.remoto.extra.value, "conservar");
assert.throws(() => core.confirmarRevisionNombreLocal({ ...retained, cajas: [{ ...a, nombre: "Cambió", updatedAt: 200 }, other] }, entry, uid), /name-changed/);
assert.throws(() => core.confirmarRevisionNombreLocal(retained, entry, "b"), /name-changed/);
for (const changed of [{ ...remote, cajas: [{ ...b, creadaEn: 9 }, other] }, { ...remote, cajas: [{ ...b, sharingPending: true }, other] }, { ...remote, cajasBorradas: [a.id] }, { ...remote, cajas: [{ ...b, updatedAt: 11 }, other] }]) {
  assert.equal(core.diferenciasNombreCajas(local, changed).length, 0, "no incluye creación, conversión, borrado ni una versión nueva como empate de nombre");
}
const merged = core.fusionarCajas(finished, { ...plain(remote), cajas: [entry.elegido, other] });
assert.equal(merged.revisionesNombre[0].estado, "confirmado", "sincronizar conserva las copias locales");
await api.subirCajas(uid, merged); assert.equal(document.revisionesNombre, undefined);
let error;
document = plain(remote); await api.subirCajas(uid, local, value => { error = value; });
assert.equal(error.message, "cajas-sync-conflict"); assert.equal(error.cajaRemota.cajas[0].nombre, b.nombre);
const oldWrites = writes; lost = true;
await assert.rejects(api.resolverNombreCaja(uid, entry), /lost-response/);
assert.equal(writes, oldWrites + 1);
await api.resolverNombreCaja(uid, entry); assert.equal(writes, oldWrites + 1, "reintento confirma el resultado sin otra escritura");
document = { ...plain(remote), cajas: [{ ...b, nombre: "Otra edición", updatedAt: 101 }, other] };
await assert.rejects(api.resolverNombreCaja(uid, entry), /name-changed/); assert.equal(document.cajas[0].nombre, "Otra edición");
document = { ...plain(remote), cajas: [b, { ...other, nombre: "Nueva casa", updatedAt: 200 }], future: { preserve: true } };
await api.resolverNombreCaja(uid, entry); assert.equal(document.cajas[1].nombre, "Nueva casa");
document = plain(remote); let release; gate = new Promise(done => { release = done; });
const obsolete = api.resolverNombreCaja(uid, entry); uid = "b"; generation = 2; uid = "a"; generation = 3; release();
await assert.rejects(obsolete, /account-task-obsolete/); assert.equal(document.cajas[0].nombre, b.nombre); gate = undefined; generation = 1;
const beforeCalls = calls; unreadable = true;
await assert.rejects(api.resolverNombreCaja(uid, entry), /name-changed/); assert.equal(calls, beforeCalls); unreadable = false;
const fifty = { ...local, revisionesNombre: Array.from({ length: 50 }, (_value, id) => ({ ...entry, id: `op-${id}` })) };
assert.throws(() => core.conservarRevisionNombre(fifty, { ...entry, id: "op-51" }), /history-full/, "el límite no borra copias antiguas");
assert.throws(() => core.validarCajas({ ...local, revisionesNombre: [{ ...entry, elegido: { ...entry.elegido, creadaEn: 99 } }] }), /invalid-data/);
assert.throws(() => core.validarCajas({ ...local, revisionesNombre: [{ ...entry, local: { ...entry.local, nombre: " " } }] }), /invalid-data/);

// Manejadores originales de la pantalla: no se copia la lógica de guardado.
function pick(file, name) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) { if (!found && ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, name); return found.getText(tree);
}
const choose = pick("screens/Cajas.tsx", "elegirNombreCaja"), retry = pick("screens/Cajas.tsx", "reintentarNombreCaja");
const save = pick("screens/Cajas.tsx", "guardarCambioCaja");
for (const kind of ["ok", "cloud", "cancel", "disk-before", "disk-after", "network", "bad-ack", "source-before", "copies-before", "account-before", "premium-before", "busy-before", "source-after", "account-after", "premium-after", "unreadable-after", "free", "pending"] ) {
  const events = [], dialogs = [], toasts = []; let current = true, commits = 0;
  const s = { ...core, accountUid: uid, ready: true, compartiendo: false, isPremium: kind !== "free", cloudReady: false,
    cuentaActual: () => current, guardandoRef: { current: false }, premiumForSync: { current: kind !== "free" },
    datosActuales: { current: plain(local) }, hasUnreadableLocalData: () => kind === "unreadable-after" && events.includes("rpc"),
    nameCopies: null, nameCopiesActual: { current: null }, nameOptions: core.diferenciasNombreCajas(local, remote),
    nuevoIdCaja: () => "ui-name", captureAccountTask: task.captureAccountTask, t: key => key, Error, Date,
    Alert: { alert: (...args) => dialogs.push(args) }, setGuardando: () => {}, setRefreshVersion: () => {},
    setNameCopies: value => { s.nameCopies = value; s.nameCopiesActual.current = value; },
    showToast: key => toasts.push(key), setDatos: value => { s.datosActuales.current = value; },
    commitPrivateBoxData: async (before, next, upserts, deletes, valid, apply) => {
      commits++; events.push(`disk-${commits}`); assert.equal(before, s.datosActuales.current);
      assert.deepEqual(plain(upserts), []); assert.deepEqual(plain(deletes), []); assert.equal(valid(), true);
      if ((kind === "disk-before" && commits === 1) || (kind === "disk-after" && commits === 2)) return false;
      apply(next); return true;
    },
    resolverNombreCaja: async (_owner, revision) => {
      events.push("rpc"); assert.equal(s.datosActuales.current.revisionesNombre[0].estado, "pendiente");
      assert.equal(s.datosActuales.current.revisionesNombre[0].remoto.nombre, b.nombre, "dos originales guardados antes de la red");
      if (kind === "network") throw Error("offline");
      if (kind === "source-after") s.datosActuales.current = { ...s.datosActuales.current };
      if (kind === "account-after") current = false;
      if (kind === "premium-after") s.premiumForSync.current = false;
      return { uid, id: revision.id, boxId: revision.boxId, nombre: kind === "bad-ack" ? "No elegido" : revision.elegido.nombre, version: revision.elegido.updatedAt };
    } };
  s.nameCopies = { local: s.datosActuales.current, remoto: plain(remote) }; s.nameCopiesActual.current = s.nameCopies;
  vm.runInNewContext(js(`${save}\n${retry}\n${choose}`), s);
  if (kind === "free") { await s.reintentarNombreCaja(entry); assert.equal(events.length, 0); assert.ok(toasts.includes("boxes.nameNeedsPro")); continue; }
  s.elegirNombreCaja(a.id, kind === "cloud" ? "nube" : "local"); assert.equal(dialogs.length, 1);
  if (kind === "cancel") { assert.equal(dialogs[0][2][0].style, "cancel"); assert.equal(events.length, 0); continue; }
  if (kind === "source-before") s.datosActuales.current = { ...s.datosActuales.current };
  if (kind === "copies-before") s.nameCopiesActual.current = { ...s.nameCopies };
  if (kind === "account-before") current = false;
  if (kind === "premium-before") s.premiumForSync.current = false;
  if (kind === "busy-before") s.guardandoRef.current = true;
  if (kind === "pending") s.datosActuales.current.revisionesNombre = [entry];
  await dialogs[0][2][1].onPress();
  if (kind.endsWith("before") && !kind.startsWith("disk") || kind === "pending") { assert.equal(events.length, 0, kind); continue; }
  if (kind === "disk-before") { assert.deepEqual(events, ["disk-1"]); assert.equal(s.datosActuales.current.revisionesNombre, undefined); continue; }
  const success = kind === "ok" || kind === "cloud";
  assert.equal(toasts.includes("boxes.nameResolved"), success, kind);
  assert.equal(s.datosActuales.current.revisionesNombre[0].estado, success ? "confirmado" : "pendiente", kind);
  assert.equal(s.datosActuales.current.cajas[0].nombre, kind === "cloud" ? b.nombre : a.nombre);
  assert.deepEqual(plain(s.datosActuales.current.movimientos), local.movimientos);
  assert.equal(events.includes("disk-2"), success || kind === "disk-after", kind);
}

// Commit y almacenamiento originales, SQLite real; se sustituye el cifrado y Auth.
const patch = load("utils/privateBoxPersonal.ts"), commit = pick("contexts/AppDataContext.tsx", "commitPrivateBoxData");
for (const failure of [null, "rollback", "lost-ack", "obsolete"]) {
  const sqlite = new DatabaseSync(":memory:"); sqlite.exec("CREATE TABLE store (key TEXT PRIMARY KEY,value TEXT)");
  const get = key => sqlite.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => sqlite.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  let current = true, applied;
  const adapter = { getItem: async key => get(key), multiGet: async keys => keys.map(key => [key, get(key)]), setItem: async (key, value) => put(key, value),
    multiSet: async entries => { sqlite.exec("BEGIN IMMEDIATE"); try {
      for (const [key, value] of entries) { put(key, value); if (failure === "rollback") throw Error("disk-full"); }
      sqlite.exec("COMMIT");
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; } if (failure === "lost-ack") throw Error("lost-response"); } };
  const actualStorage = load("utils/storage.ts", name => name.includes("async-storage") ? { default: adapter } : {
    encryptText: async text => { if (failure === "obsolete") current = false; return "v2:" + text; }, decryptText: async text => text.slice(3) });
  actualStorage.setAccountStorageAvailable(true);
  const ctx = { ...core, ...patch, ready: true, hasOnboarded: true, isPremium: true, Platform: { OS: "android" }, auth,
    localSessionVersion: { current: 1 }, transactionsLive: { current: [] }, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null },
    captureAccountTask: () => ({ current: () => current }), withLocalAccountOperation: work => work(), hasUnreadableLocalData: actualStorage.hasUnreadableLocalData,
    saveJSONBatchNow: actualStorage.saveJSONBatchNow, STORAGE_KEYS: actualStorage.STORAGE_KEYS, guardarCajasEnMemoria: () => {}, Error };
  vm.runInNewContext(js(commit), ctx);
  put(actualStorage.STORAGE_KEYS.transactions, "personal-intacto"); put(actualStorage.STORAGE_KEYS.cajasDinero, "v2:" + JSON.stringify(local));
  const ok = await ctx.commitPrivateBoxData(local, retained, [], [], () => current, value => { applied = value; });
  assert.equal(ok, failure === null || failure === "lost-ack", failure);
  assert.equal(!!applied, ok); assert.equal(get(actualStorage.STORAGE_KEYS.transactions), "personal-intacto");
  const persisted = JSON.parse(get(actualStorage.STORAGE_KEYS.cajasDinero).slice(3));
  assert.equal(persisted.revisionesNombre?.[0]?.remoto.nombre, ok ? b.nombre : undefined);
  assert.deepEqual(persisted.movimientos, local.movimientos); sqlite.close();
}
console.log("Nombres de Caja: elección explícita, copias conservadas, reintento sin duplicación y cambios concurrentes protegidos sin alterar dinero.");
