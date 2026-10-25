import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Cliente/almacén/core de servidor originales. Firestore, Auth y cifrado son
// adaptadores sintéticos; dos procesos reales comparten SOLO esta carpeta temporal.
const require = createRequire(import.meta.url);
const { mutateSharedMovement } = require("../functions/src/shared-movements.js");
const { DOCUMENTS } = require("../functions/src/legal-acceptance.js");
const revision = process.env.FINO_TEST_REVISION;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Revisión inválida");
const root = process.cwd(), script = fileURLToPath(import.meta.url);
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const fixture = () => ({ counter: 0, requests: 0, local: {}, records: {
  "users/test-owner": { isPremium: true },
  "legalAcceptances/test-owner": { format: 1, uid: "test-owner", ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 },
  ...Object.fromEntries(["familySpaces/family-a", "boxSpaces/box-a"].flatMap(space => [
    [space, { ownerUid: "test-owner", currency: "PEN" }], [`${space}/members/test-owner`, { rol: "owner" }],
  ])),
} });
const clone = value => JSON.parse(JSON.stringify(value));
const movement = { tipo: "ingreso", monto: 20, descripcion: "Prueba ficticia", fecha: "2026-10-25", method: "cash" };
function database(state, persist) {
  const ref = pathname => ({ path: pathname, id: pathname.split("/").at(-1), collection: name => collection(`${pathname}/${name}`) });
  const collection = pathname => ({ path: pathname, collection: true, doc: id => ref(`${pathname}/${id}`) });
  const snap = pathname => ({ id: pathname.split("/").at(-1), exists: Object.hasOwn(state.records, pathname), data: () => state.records[pathname] === undefined ? undefined : clone(state.records[pathname]), ref: ref(pathname) });
  const get = reference => reference.collection === true ? { docs: Object.keys(state.records).filter(p => p.startsWith(`${reference.path}/`) && !p.slice(reference.path.length + 1).includes("/")).map(snap) } : snap(reference.path);
  return { doc: ref, collection, runTransaction: async work => {
    const writes = [];
    const result = await work({ get: async ref => get(ref), getAll: async (...refs) => refs.filter(ref => typeof ref.path === "string").map(get),
      create: (ref, value) => { assert.equal(Object.hasOwn(state.records, ref.path), false); writes.push(() => state.records[ref.path] = value); },
      set: (ref, value) => writes.push(() => state.records[ref.path] = value),
      update: (ref, value) => writes.push(() => state.records[ref.path] = { ...state.records[ref.path], ...value }),
      delete: ref => writes.push(() => delete state.records[ref.path]),
    });
    writes.forEach(write => write()); persist(); return result;
  } };
}
async function client(state, persist, options = {}) {
  const runtime = { uid: "test-owner", session: 1, failWrites: false, lostReply: false, badReply: false, unreadable: false, gate: null, getGate: null };
  const db = database(state, persist);
  const adapter = {
    getItem: async key => state.local[key] ?? null,
    setItem: async (key, value) => { if (runtime.failWrites) throw Error("disk-full"); state.local[key] = value; persist(); },
    multiGet: async keys => keys.map(key => [key, state.local[key] ?? null]),
    multiRemove: async keys => { for (const key of keys) delete state.local[key]; persist(); },
    multiSet: async entries => { if (runtime.failWrites) throw Error("disk-full"); Object.assign(state.local, Object.fromEntries(entries)); persist(); },
    getAllKeys: async () => Object.keys(state.local),
  };
  const mocks = {
    firebase: `export const db={};export const functions={};export const auth={get currentUser(){return globalThis.__sharedRuntime.uid ? {uid:globalThis.__sharedRuntime.uid} : null}};`,
    firestore: `export const collection=(...args)=>args.slice(args[0]&&typeof args[0]==='object'?1:0).join('/');
      export const doc=(...args)=>args.length===1 ? {id:globalThis.__sharedNextId(),path:args[0]} : {id:args.at(-1),path:args.slice(1).join('/')};
      export const getDocFromServer=async ref=>globalThis.__sharedGet(ref);`,
    functions: `export const httpsCallable=()=>async input=>globalThis.__sharedRequest(input);`,
    asyncStorage: `export default globalThis.__sharedStore;`,
    encryption: `export const encryptText=async text=>'v2:'+text;export const decryptText=async raw=>raw.slice(3);`,
  };
  const aliases = { "@/utils/firebase": "firebase", "firebase/firestore": "firestore", "firebase/functions": "functions",
    "@react-native-async-storage/async-storage": "asyncStorage", "@/utils/encryption": "encryption" };
  const code = await build({ stdin: { contents: `export * from './utils/sharedMovements'; export * as storage from './utils/storage';`, resolveDir: root, sourcefile: "shared-original-test.ts", loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": root }, logLevel: "silent", plugins: [{ name: "synthetic-shared", setup(builder) {
      builder.onResolve({ filter: /.*/ }, argument => aliases[argument.path] ? { path: aliases[argument.path], namespace: "synthetic" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, argument => ({ contents: mocks[argument.path], loader: "js" }));
      if (revision) builder.onLoad({ filter: /[\\/]utils[\\/]sharedMovements\.ts$/ }, () => ({ contents: read("utils/sharedMovements.ts"), loader: "ts", resolveDir: path.join(root, "utils") }));
    } }] });
  globalThis.__sharedRuntime = runtime; globalThis.__sharedStore = adapter;
  globalThis.__sharedNextId = () => `movement-${++state.counter}`;
  globalThis.__sharedGet = async reference => {
    if (runtime.getGate) await runtime.getGate;
    const value = state.records[reference.path];
    return { exists: () => value !== undefined, data: () => clone(value), metadata: { fromCache: false, hasPendingWrites: false } };
  };
  globalThis.__sharedRequest = async input => {
    state.requests++; persist(); if (runtime.gate) await runtime.gate;
    let result;
    try { result = await mutateSharedMovement(db, runtime.uid, input); }
    catch (error) { throw Object.assign(error, { details: { reason: error.reason } }); }
    if (runtime.lostReply) { runtime.lostReply = false; throw Object.assign(Error("response-lost"), { code: "functions/unavailable" }); }
    return { data: runtime.badReply ? { ...result, movementId: "wrong-id" } : result };
  };
  const module = { exports: {} }; new Function("module", "exports", code.outputFiles[0].text)(module, module.exports);
  const api = module.exports; api.storage.setAccountStorageAvailable(true);
  // CaptureAccountTask reads the real session source; changing availability
  // invalidates the session exactly as logout does in the original store.
  const invalidSession = () => { api.storage.setAccountStorageAvailable(false); api.storage.setAccountStorageAvailable(true); };
  const pending = async () => api.storage.loadJSON(api.storage.STORAGE_KEYS.sharedMovementPending, []);
  return { api, runtime, pending, invalidSession, ...options };
}
const count = (state, kind) => Object.keys(state.records).filter(key => key.startsWith(`${kind === "family" ? "familySpaces/family-a" : "boxSpaces/box-a"}/movements/`) && key.split("/").length === 4).length;
const spaceId = kind => kind === "family" ? "family-a" : "box-a";

if (process.argv[2] === "--worker") {
  const [file, phase, kind, linked] = process.argv.slice(3), state = JSON.parse(fs.readFileSync(file, "utf8"));
  const persist = () => fs.writeFileSync(file, JSON.stringify(state));
  const c = await client(state, persist), payload = linked === "yes" ? { ...movement, method: "transfer", personalTransactionId: 77, personalOwnerUid: "test-owner" } : movement;
  if (phase === "lost") {
    c.runtime.lostReply = true;
    const operation = c.api.nuevaOperacionMovimientoCompartido?.(kind, spaceId(kind), "PEN");
    await assert.rejects(c.api.guardarMovimientoCompartido(kind, spaceId(kind), "test-owner", payload, operation), /response-lost/);
  } else if (c.api.recuperarMovimientoCompartido) {
    assert.equal(await c.api.recuperarMovimientoCompartido(kind, spaceId(kind), "test-owner", "PEN", async pending => {
      assert.equal((await c.pending()).length, 1, "la intención sigue presente antes del débito duradero");
      assert.equal(pending.movement.personalTransactionId, 77);
      return c.api.storage.saveJSONNow(c.api.storage.STORAGE_KEYS.transactions, [{ id: 77, type: "expense", amount: 20, date: movement.fecha,
        internalTransfer: kind, internalTransferSpaceId: spaceId(kind), internalTransferLink: pending.movementId }]);
    }), true);
    assert.deepEqual(await c.pending(), []);
  } else await c.api.guardarMovimientoCompartido(kind, spaceId(kind), "test-owner", payload);
  console.log(JSON.stringify({ pid: process.pid, rows: count(state, kind), pending: (await c.pending()).length }));
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fino-shared-restart-"));
  try {
    // Si el proceso muere después de que el servidor guardó, otro proceso
    // vuelve a usar el comprobante del MISMO ID en los dos tipos de espacio.
    for (const kind of ["family", "box"]) for (const linked of ["no", "yes"]) {
      const file = path.join(directory, `${kind}-${linked}.json`); fs.writeFileSync(file, JSON.stringify(fixture()));
      const run = phase => {
        const child = spawnSync(process.execPath, [script, "--worker", file, phase, kind, linked], { cwd: root, encoding: "utf8", timeout: 45000 });
        assert.equal(child.status, 0, child.stderr || child.stdout); return JSON.parse(child.stdout.trim());
      };
      const first = run("lost"), second = run("recover");
      assert.notEqual(first.pid, second.pid); assert.equal(first.rows, 1); assert.equal(second.rows, 1, "reiniciar/reintentar no crea una segunda fila");
      assert.equal(second.pending, 0);
      const state = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.equal(state.requests, 2, "segunda solicitud consulta el mismo comprobante del servidor");
      const personal = JSON.parse(state.local["finzo:transactions"]?.slice(3) || "[]");
      assert.equal(personal.length, linked === "yes" ? 1 : 0);
    }
    if (!revision) {
      const state = fixture(), c = await client(state, () => {}), kind = "family", space = spaceId(kind);
      const operation = () => c.api.nuevaOperacionMovimientoCompartido(kind, space, "PEN");
      for (const invalid of [{ ...movement, fecha: "2026-02-30" }, { ...movement, notes: "x".repeat(301) }, { ...movement, monto: 0 }]) {
        await assert.rejects(c.api.guardarMovimientoCompartido(kind, space, "test-owner", invalid, operation()), /shared-pending-invalid/);
      }
      assert.equal(state.requests, 0);
      c.runtime.failWrites = true;
      await assert.rejects(c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, operation()), /shared-local-save-failed/);
      assert.equal(state.requests, 0, "sin intención confirmada en disco no se envía dinero");
      c.runtime.failWrites = false;
      assert.equal(await c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, operation()) !== "", true);
      await c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, operation());
      assert.equal(count(state, kind), 2, "dos ingresos intencionales iguales siguen siendo dos acciones");
      c.runtime.lostReply = true; const token = operation();
      await assert.rejects(c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, token), /response-lost/);
      assert.equal(await c.api.confirmarMovimientoCompartido(token.movementId, "test-owner"), false, "no retirar un externo sin recibir comprobante");
      const before = state.requests;
      await assert.rejects(c.api.guardarMovimientoCompartido(kind, space, "test-owner", { ...movement, monto: 30 }, operation()), /shared-operation-pending/);
      assert.equal(state.requests, before, "una intención distinta no pisa la que quedó incierta");
      await assert.rejects(c.api.recuperarMovimientoCompartido(kind, space, "test-owner", "USD", async () => true), /shared-currency-mismatch/);
      assert.equal(state.requests, before);
      c.runtime.uid = "other-user"; c.invalidSession();
      await assert.rejects(c.api.recuperarMovimientoCompartido(kind, space, "other-user", "PEN", async () => true), /shared-pending-invalid/);
      assert.equal(state.requests, before, "una cuenta ajena no reenvía la intención");
      c.runtime.uid = "test-owner"; c.invalidSession();
      assert.equal(await c.api.recuperarMovimientoCompartido(kind, space, "test-owner", "PEN", async () => true), true);
      const linked = { ...movement, method: "transfer", personalTransactionId: 88, personalOwnerUid: "test-owner" }, linkedToken = operation();
      await c.api.guardarMovimientoCompartido(kind, space, "test-owner", linked, linkedToken);
      assert.equal(await c.api.confirmarMovimientoCompartido(linkedToken.movementId, "test-owner"), false);
      await assert.rejects(c.api.recuperarMovimientoCompartido(kind, space, "test-owner", "PEN", async () => false), /shared-local-save-failed/);
      assert.equal((await c.pending()).length, 1, "un fallo en Personal mantiene el comprobante pendiente");
      const persisted = [{ id: 88, type: "expense", amount: 20, date: movement.fecha, internalTransfer: kind, internalTransferSpaceId: space, internalTransferLink: linkedToken.movementId }];
      assert.equal(await c.api.recuperarMovimientoCompartido(kind, space, "test-owner", "PEN", async () => c.api.storage.saveJSONNow(c.api.storage.STORAGE_KEYS.transactions, persisted)), true);
      assert.deepEqual(await c.pending(), []);
      const bad = operation(); c.runtime.badReply = true;
      await assert.rejects(c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, bad), /shared-invalid-response/);
      assert.equal((await c.pending()).length, 1, "un comprobante inválido no libera la intención");
      c.runtime.badReply = false;
      assert.equal(await c.api.recuperarMovimientoCompartido(kind, space, "test-owner", "PEN", async () => true), true);
      let confirm;
      c.runtime.gate = new Promise(resolve => { confirm = resolve; });
      const sharedToken = operation(), requestsBefore = state.requests;
      const first = c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, sharedToken);
      const second = c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, sharedToken);
      for (let i = 0; i < 1000 && state.requests === requestsBefore; i++) await Promise.resolve();
      assert.equal(state.requests, requestsBefore + 1, "dos reintentos simultáneos del mismo ID comparten la solicitud");
      confirm(); assert.deepEqual(await Promise.all([first, second]), [sharedToken.movementId, sharedToken.movementId]);
      assert.equal(state.requests, requestsBefore + 1);
      c.runtime.gate = null;
      let release; c.runtime.gate = new Promise(resolve => { release = resolve; });
      const obsolete = c.api.guardarMovimientoCompartido(kind, space, "test-owner", movement, operation());
      for (let i = 0; i < 100; i++) await Promise.resolve();
      c.runtime.uid = "other-user"; c.invalidSession(); release();
      await assert.rejects(obsolete, /account-task-obsolete/);
      c.runtime.gate = null;
    }
    console.log("Cliente/almacén/core originales: ocho procesos prueban respuesta perdida+reinicio en Familia/Caja, débito Personal antes de retirar intención, fallos, cuentas, moneda y altas iguales legítimas. No Android ni Firebase real.");
  } finally {
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
  }
}
