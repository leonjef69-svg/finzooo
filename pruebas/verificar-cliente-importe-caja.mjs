import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";
const root = process.cwd(), require = createRequire(import.meta.url);
const baseline = process.env.FINO_TEST_MONEY_CLIENT_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const clone = value => structuredClone(value);
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 2 };
const movement = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 3, updatedAt: 4, personalTransactionId: 10 };
const personal = { id: 10, type: "expense", amount: 80, category: "otros", date: movement.fecha, description: "Viaje", method: "transfer", notes: "Mi nota", tags: ["viaje"], image: "foto-local", internalTransfer: "box", internalTransferLink: movement.id, internalTransferSpaceId: box.id, updatedAt: 4 };
const entry = { id: "money-operation-0001", uid: "A", currency: "PEN", box, local: { personal, movement }, remote: { personal: { ...personal, amount: 100 }, movement }, chosen: "local-personal", createdAt: 200, version: 200, estado: "pendiente" };
const boxes = { cajas: [box], movimientos: [movement], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2 };
const sdk = `
  const e = globalThis.env;
  export const doc = (base, ...parts) => ({ path: [base?.path, ...parts].filter(Boolean).join('/') });
  export const collection = doc;
  export const where = (...args) => args, limit = count => count;
  export const query = (ref, ...filters) => ({ ...ref, filters });
  function snapshot(ref) { const value = e.docs.get(ref.path); return { id: ref.path.split('/').pop(), exists: () => value !== undefined, data: () => structuredClone(value), metadata: e.metadata ?? {fromCache:false,hasPendingWrites:false} }; }
  export async function getDocFromServer(ref) { e.reads.push(ref.path); if(e.readGate) await e.readGate.promise; if(e.readFailure) throw Error('offline'); return snapshot(ref); }
  export async function getDocsFromServer(ref) {
    e.reads.push(ref.path + ':query'); if(e.readFailure) throw Error('offline');
    const [where, count] = ref.filters;
    const docs = [...e.docs.keys()].filter(key => key.startsWith(ref.path + '/') && e.docs.get(key)?.transaction?.internalTransferLink === where[2]).slice(0,count).map(key=>snapshot({path:key}));
    return {docs, metadata:e.metadata ?? {fromCache:false,hasPendingWrites:false}};
  }
`;
let missingClient = false;
if (baseline) { try { execFileSync("git", ["cat-file", "-e", `${baseline}:utils/cloudPrivateBoxMoney.ts`], { stdio: "ignore" }); } catch { missingClient = true; } }
const built = await esbuild.build({ stdin: { contents: `export * from "@/utils/privateBoxSync"; export * from "@/utils/cajas"; export * from "@/utils/privateBoxMoneyReview"; export * from "../functions/src/private-box-money-shared.js"; ${missingClient ? "" : 'export * from "@/utils/cloudPrivateBoxMoney";'} `,
  loader: "ts", resolveDir: path.join(root, "utils") }, bundle: true, platform: "node", format: "cjs", write: false, alias: { "@": root }, logLevel: "silent",
  plugins: [{ name: "network-and-android-only", setup(build) {
    const mocks = {
      "firebase/firestore": sdk,
      "firebase/functions": `export const httpsCallable = (_functions,name,options) => async payload => { const e=globalThis.env; e.calls.push({name,options,payload:structuredClone(payload)}); e.sent?.resolve(); if(e.callGate) await e.callGate.promise; if(e.callFailure) throw Error('lost-http-response'); return {data:e.response ?? globalThis.ack(payload)}; };`,
      "@/utils/firebase": `const e=globalThis.env; export const db={}; export const functions={}; export const auth={get currentUser(){return e.uid ? {uid:e.uid,emailVerified:e.verified}:null}};`,
      "@/utils/storage": `const e=globalThis.env; export const getAccountStorageSession=()=>e.session; export const hasUnreadableLocalData=()=>e.unreadable; export const STORAGE_KEYS={cajasDinero:'cajas'}; export const loadJSON=async(_key,fallback)=>{e.diskReads++; if(e.diskFailure){e.unreadable=true;return fallback;} return structuredClone(e.local??fallback);};`,
    };
    build.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: "money-stubs" } : undefined);
    build.onLoad({ filter: /.*/, namespace: "money-stubs" }, args => ({ contents: mocks[args.path], loader: "ts" }));
    if (baseline && !missingClient) build.onLoad({ filter: /[\\/]utils[\\/]cloudPrivateBoxMoney\.ts$/ }, () => ({ contents: execFileSync("git", ["show", `${baseline}:utils/cloudPrivateBoxMoney.ts`], { encoding: "utf8" }), loader: "ts" }));
  } }] });
function harness(format = 1) {
  const e = { uid: "A", verified: true, session: 1, unreadable: false, local: clone({ ...boxes, revisionesImporte: [entry] }), rows: [clone(personal)], currency: "PEN", deleted: [], active: true, calls: [], reads: [], diskReads: 0,
    docs: new Map([["users/A", { hasOnboarded: true, userCurrency: "PEN", ...(format === 2 ? { historyFormat: 2 } : { transactions: [entry.remote.personal], deletedTransactionIds: [] }) }], ["cajas/A", clone(boxes)]]) };
  if (format === 2) e.docs.set("users/A/history/10", { id: 10, deleted: false, transaction: clone(entry.remote.personal) });
  const module = { exports: {} };
  const { moneyAcknowledgement } = require("../functions/src/private-box-money-shared.js");
  new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, require, { env: e, ack: moneyAcknowledgement });
  const api = module.exports;
  const request = lease => api.requestPrivateBoxMoneyReview("A", entry, lease, () => ({ transactions: e.rows, deletedIds: e.deleted, currency: e.currency }), () => e.active);
  return { e, api, request };
}
{
  const { api } = harness();
  // Contrato nuevo ausente en aee6653: no se presenta como bug de usuarios.
  assert.equal(typeof api.assertPrivateBoxMoneyReceipt, "function", "se necesita verificar una confirmación genuina, no solo calcular los mismos campos");
}
if (baseline) throw Error("La revisión anterior debía fallar por la protección del cliente ausente.");
for (const format of [1, 2]) {
  const { e, api, request } = harness(format);
  await api.withPrivateBoxMoneyReview("A", async lease => {
    const sources = await api.loadPrivateBoxMoneySources("A", movement.id, personal.id, "PEN", lease);
    assert.deepEqual(sources.transactions, [entry.remote.personal]); assert.equal(sources.data.movimientos[0].monto, 100);
    assert.ok(!e.reads.includes("users/A/history"), "no descarga el historial entero");
    const ack = await request(lease);
    api.assertPrivateBoxMoneyReceipt("A", entry, ack, lease);
    assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", entry, clone(ack), lease), /unconfirmed/);
    assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", entry, api.moneyAcknowledgement(entry), lease), /unconfirmed/);
    assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", { ...entry, chosen: "remote-box" }, ack, lease), /unconfirmed/);
    assert.equal(Object.isFrozen(ack), true); assert.equal(e.calls[0].name, "resolvePrivateBoxMoney");
    assert.equal(e.calls[0].options.timeout, 120000); assert.equal(e.calls[0].payload.estado, undefined);
    assert.deepEqual(e.calls[0].payload.local.personal.tags, personal.tags); assert.equal(e.calls[0].payload.local.personal.image, personal.image);
    assert.equal(e.local.revisionesImporte[0].estado, "pendiente", "HTTP no confirma un guardado local que aún no ocurrió");
    assert.equal(e.local.movimientos[0].monto, 100); assert.equal(e.rows[0].amount, 80);
    await assert.rejects(api.withPrivateBoxCloudOperation("A", async () => {}), /review-pending/);
  });
}
for (const failure of ["missing-journal", "disk-failure", "unreadable", "other-owner", "changed-choice", "already-confirmed", "changed-currency", "newer-personal", "deleted", "unverified", "inactive", "null-session", "unknown-result", "lost-http"]) {
  const { e, api, request } = harness();
  if (failure === "missing-journal") e.local = clone(boxes);
  if (failure === "disk-failure") e.diskFailure = true;
  if (failure === "unreadable") e.unreadable = true;
  if (failure === "other-owner") e.local.revisionesImporte[0].uid = "B";
  if (failure === "changed-choice") e.local.revisionesImporte[0].chosen = "remote-box";
  if (failure === "already-confirmed") e.local.revisionesImporte[0].estado = "confirmado";
  if (failure === "changed-currency") e.currency = "USD";
  if (failure === "newer-personal") e.rows[0].updatedAt++;
  if (failure === "deleted") e.deleted = [10];
  if (failure === "unverified") e.verified = false;
  if (failure === "inactive") e.active = false;
  if (failure === "null-session") e.session = null;
  if (failure === "unknown-result") e.response = { ...api.moneyAcknowledgement(entry), amount: 90 };
  if (failure === "lost-http") e.callFailure = true;
  await assert.rejects(api.withPrivateBoxMoneyReview("A", request), undefined, failure);
  assert.equal(e.calls.length, ["unknown-result", "lost-http"].includes(failure) ? 1 : 0, failure);
  assert.equal(e.local.movimientos[0].monto, 100); assert.equal(e.rows[0].amount, 80);
}
for (const failure of ["offline", "cached", "pending", "missing-root", "missing-boxes", "duplicate-personal", "duplicate-move", "remote-deleted", "currency", "closing", "remote-journal", "v2-duplicate", "v2-deleted"]) {
  const { e, api } = harness(failure.startsWith("v2-") ? 2 : 1);
  if (failure === "offline") e.readFailure = true;
  if (failure === "cached") e.metadata = { fromCache: true, hasPendingWrites: false };
  if (failure === "pending") e.metadata = { fromCache: false, hasPendingWrites: true };
  if (failure === "missing-root") e.docs.delete("users/A");
  if (failure === "missing-boxes") e.docs.delete("cajas/A");
  if (failure === "duplicate-personal") e.docs.get("users/A").transactions.push({ ...entry.remote.personal, id: 11 });
  if (failure === "duplicate-move") e.docs.get("cajas/A").movimientos.push({ ...movement, id: "another-move" });
  if (failure === "remote-deleted") e.docs.get("users/A").deletedTransactionIds = [10];
  if (failure === "currency") e.docs.get("users/A").userCurrency = "USD";
  if (failure === "closing") e.docs.get("users/A").accountDeletionPending = true;
  if (failure === "remote-journal") e.docs.get("cajas/A").revisionesImporte = [];
  if (failure === "v2-duplicate") e.docs.set("users/A/history/11", { id: 11, deleted: false, transaction: { ...entry.remote.personal, id: 11 } });
  if (failure === "v2-deleted") e.docs.get("users/A/history/10").deleted = true;
  await assert.rejects(api.withPrivateBoxMoneyReview("A", lease => api.loadPrivateBoxMoneySources("A", movement.id, 10, "PEN", lease)), undefined, failure);
  assert.equal(e.calls.length, 0);
}
for (const change of ["uid", "session", "currency", "personal", "disk", "entry", "active"]) {
  const { e, api, request } = harness(); e.sent = gate(); e.callGate = gate();
  const selected = clone(entry);
  const operation = api.withPrivateBoxMoneyReview("A", lease => api.requestPrivateBoxMoneyReview("A", selected, lease,
    () => ({ transactions: e.rows, deletedIds: e.deleted, currency: e.currency }), () => e.active));
  const failure = assert.rejects(operation);
  await e.sent.promise;
  if (change === "uid") e.uid = "B";
  if (change === "session") e.session++;
  if (change === "currency") e.currency = "USD";
  if (change === "personal") e.rows[0].amount = 90;
  if (change === "disk") e.local.revisionesImporte[0].chosen = "remote-box";
  if (change === "entry") selected.chosen = "remote-box";
  if (change === "active") e.active = false;
  e.callGate.resolve(); await failure; assert.equal(e.calls.length, 1);
}
{
  const { e, api, request } = harness();
  let receipt, savedLease;
  await api.withPrivateBoxMoneyReview("A", async lease => { savedLease = lease; receipt = await request(lease); });
  assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", entry, receipt, savedLease), /review-changed/);
  await api.withPrivateBoxMoneyReview("A", async lease => {
    assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", entry, receipt, lease), /unconfirmed/);
    const ack = await request(lease); e.session++; assert.throws(() => api.assertPrivateBoxMoneyReceipt("A", entry, ack, lease), /obsolete/); e.session--;
  }).catch(error => assert.match(error.message, /obsolete/));
  assert.throws(() => api.assertPrivateBoxMoneyReviewLease("A", { assertCurrent() {} }), /review-changed/);
}
{
  const { e, api, request } = harness(); e.local = clone(boxes);
  await api.withPrivateBoxCloudOperation("A", async lease => {
    await assert.rejects(request(lease), /review-changed/);
    await assert.rejects(api.loadPrivateBoxMoneySources("A", movement.id, 10, "PEN", lease), /review-changed/);
    assert.throws(() => api.assertPrivateBoxMoneyReviewLease("B", lease), /review-changed/);
  });
  assert.equal(e.reads.length, 0); assert.equal(e.calls.length, 0);
}
{
  const { e, api, request } = harness();
  e.local = clone(boxes);
  const started = gate(), finish = gate();
  const old = api.withPrivateBoxCloudOperation("A", async () => { started.resolve(); await finish.promise; e.docs.get("users/A").transactions[0].amount = 90; });
  const oldResult = old.catch(error => error);
  await started.promise;
  const operation = api.withPrivateBoxMoneyReview("A", async lease => {
    const sources = await api.loadPrivateBoxMoneySources("A", movement.id, 10, "PEN", lease);
    assert.equal(sources.transactions[0].amount, 90, "consulta después del desenlace de la subida ya enviada");
  });
  await tick(); assert.equal(e.reads.length, 0); finish.resolve(); assert.match((await oldResult).message, /review-changed/); await operation;
  assert.equal(e.calls.length, 0); assert.equal(typeof request, "function");
}
// El contexto puede comprobar una respuesta; no envía peticiones ni habilita UI.
assert.doesNotMatch(fs.readFileSync("screens/Cajas.tsx", "utf8"), /requestPrivateBoxMoneyReview|cloudPrivateBoxMoney|commitPrivateBoxMoney/);
assert.doesNotMatch(fs.readFileSync("contexts/AppDataContext.tsx", "utf8"), /requestPrivateBoxMoneyReview/);
assert.match(fs.readFileSync("contexts/AppDataContext.tsx", "utf8"), /assertPrivateBoxMoneyReceipt/);
console.log("Cliente monetario original: fuentes, respuesta genuina, cola, identidad/reintento y fallos comprobados. Petición/UI sin habilitar.");
