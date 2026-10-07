import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as esbuild from "esbuild";

const root = process.cwd(), require = createRequire(import.meta.url), clone = value => structuredClone(value);
const baseline = process.env.FINO_TEST_MONEY_BATCH_BASELINE;
const recoveryBaseline = process.env.FINO_TEST_MONEY_RECOVERY_BASELINE;
if (recoveryBaseline && !/^[a-f0-9]{7,40}$/.test(recoveryBaseline)) throw Error("Se requiere hash Git.");
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function declaration(file, name) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(tree) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, `${name}: contrato de guardado monetario ausente`);
  return ts.isVariableDeclaration(found) ? `const ${found.getText(tree)};` : found.getText(tree);
}
const context = "contexts/AppDataContext.tsx";
// Falla en ddde38d por API nueva ausente, sin afirmar un bug de usuarios.
const commit = declaration(context, "commitPrivateBoxMoney");
if (baseline) throw Error("La revisión anterior debía fallar por guardado monetario ausente.");
const callbacks = ["setTransactions", "setDeletedTransactionIds", "setUserCurrency"].map(name => declaration(context, name)).join("\n");
const source = `
  import { auth } from '@/utils/firebase';
  import { captureAccountTask } from '@/utils/accountTask';
  import { withLocalAccountOperation } from '@/utils/localAccountVault';
  import { hasUnreadableLocalData, loadJSON, saveJSONBatchNow, flushPendingSaves, STORAGE_KEYS } from '@/utils/storage';
  import { validarCajas } from '@/utils/cajas';
  import { confirmarRevisionImporteLocal, conservarOriginalesImporte } from '@/utils/privateBoxMoneyReview';
  import { assertPrivateBoxMoneyReviewLease } from '@/utils/privateBoxSync';
  import { assertPrivateBoxMoneyReceipt } from '@/utils/cloudPrivateBoxMoney';
  import { assertPrivateBoxMoneyLocalIdle, assertPrivateBoxMoneyLocalMutation, reservePrivateBoxMoneyLocalWrite } from '@/utils/privateBoxMoneyLocalWrite';
  import { guardarCajasEnMemoria } from '@/utils/cajasMemoria';
  import { canonical } from '../functions/src/private-box-money-shared.js';
  export * from '@/utils/storage'; export * from '@/utils/cloudPrivateBoxMoney';
  export * from '@/utils/privateBoxSync'; export * from '@/utils/privateBoxMoneyLocalWrite';
  export * from '@/utils/cajasMemoria'; export * from '@/utils/localAccountVault';
  export * from '@/utils/privateBoxMoneyFlow';
  export function createContext() {
    const e = globalThis.env, ready=true, hasOnboarded=true, Platform={get OS(){return e.platform}};
    const useCallback=callback=>callback;
    const transactionsLive=e.rows, deletedTransactionIdsRef=e.deleted, currencyForReturn=e.currency, localSessionVersion=e.version;
    const setRenderedTransactions=rows=>{e.renderedRows=rows;};
    const setRenderedDeletedTransactionIds=ids=>{e.renderedDeleted=ids;};
    const setRenderedUserCurrency=currency=>{e.renderedCurrency=currency;};
    ${callbacks}
    ${declaration(context, "readPrivateBoxMoneyLocal")}
    ${declaration(context, "stagePrivateBoxMoney")}
    ${commit}
    return { commitPrivateBoxMoney, stagePrivateBoxMoney, readPrivateBoxMoneyLocal, setTransactions, setDeletedTransactionIds, setUserCurrency };
  }
  export function createScreen() {
    const e=globalThis.env, useCallback=callback=>callback, cuentaActual=()=>e.active, datosActuales=e.screen;
    const setRenderedDatos=next=>{e.renderedBoxes=next;};
    ${declaration("screens/Cajas.tsx", "setDatos")}
    return setDatos;
  }
`;
const mocks = {
  "@/utils/firebase": `const e=globalThis.env; export const db=e.realClient?.db??{}, functions=e.realClient?.functions??{}; export const auth={get currentUser(){return e.realClient?.auth.currentUser??(e.uid?{uid:e.uid,emailVerified:true}:null)}};`,
  "firebase/firestore": `
    export const doc=(db,...parts)=>globalThis.env.realClient?globalThis.sdkFirestore.doc(db,...parts):parts.join('/');
    export const collection=(...args)=>globalThis.env.realClient?globalThis.sdkFirestore.collection(...args):doc(...args);
    export const limit=n=>globalThis.env.realClient?globalThis.sdkFirestore.limit(n):({limit:n});
    export const where=(...args)=>globalThis.env.realClient?globalThis.sdkFirestore.where(...args):({where:args});
    export const query=(ref,...clauses)=>globalThis.env.realClient?globalThis.sdkFirestore.query(ref,...clauses):({ref,clauses});
    export const getDocFromServer=async ref=>{const e=globalThis.env;e.sourceReads=(e.sourceReads??0)+1;await e.sourceGate?.();return e.realClient?globalThis.sdkFirestore.getDocFromServer(ref):e.snapshot(e.sources.get(ref));};
    export const getDocsFromServer=async ref=>{const e=globalThis.env;return e.realClient?globalThis.sdkFirestore.getDocsFromServer(ref):{metadata:{fromCache:false,hasPendingWrites:false},docs:e.links??[]};};`,
  "firebase/functions": `export const httpsCallable=(...args)=>async payload=>{const e=globalThis.env;e.calls++;(e.endpoints??=[]).push(args[1]);if(e.realClient)return globalThis.sdkFunctions.httpsCallable(...args)(payload);if(e.send)return e.send(payload,args[1]);return {data:globalThis.ack(payload)}};`,
  "@react-native-async-storage/async-storage": `export default globalThis.env.adapter;`,
  "@/utils/encryption": `export const encryptText=async text=>{const e=globalThis.env; if(e.encryptGate){e.encryptStarted.resolve();await e.encryptGate.promise;}if(e.encryptFailure)throw Error('encrypt-failed');return 'v2:'+text;}; export const decryptText=async text=>text.slice(3);`,
  "expo-crypto": `export const randomUUID=()=> 'test-uuid';`,
};
const built = await esbuild.build({ stdin: { contents: source, loader: "ts", resolveDir: path.join(root, "utils") }, bundle: true,
  platform: "node", format: "cjs", write: false, alias: { "@": root }, logLevel: "silent",
  plugins: [{ name: "native-and-sdk-only", setup(build) {
    build.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: "batch-mocks" } : undefined);
    build.onLoad({ filter: /.*/, namespace: "batch-mocks" }, args => ({ contents: mocks[args.path], loader: "ts" }));
    if(recoveryBaseline)build.onLoad({filter:/[\\/]utils[\\/]privateBoxMoneyFlow\.ts$/},()=>({contents:execFileSync("git",["show",`${recoveryBaseline}:utils/privateBoxMoneyFlow.ts`],{encoding:"utf8"}),loader:"ts"}));
  } }] });
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const { moneyAcknowledgement } = require("../functions/src/private-box-money-shared.js");
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 2 };
const movement = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 3, updatedAt: 4, personalTransactionId: 10 };
const personal = { id: 10, type: "expense", amount: 80, category: "otros", date: movement.fecha, description: "Viaje", method: "transfer", notes: "Mi nota", internalTransfer: "box", internalTransferLink: movement.id, internalTransferSpaceId: box.id, updatedAt: 4 };
const other = { id: 11, type: "income", amount: 500, category: "otros", date: "2026-10-05", updatedAt: 4 };
const entry = { id: "money-operation-0001", uid: "A", currency: "PEN", box, local: { personal, movement }, remote: { personal: { ...personal, amount: 100 }, movement }, chosen: "remote-box", createdAt: 200, version: 200, estado: "pendiente" };
const original = { cajas: [box, { id: "caja-b", nombre: "Otra", creadaEn: 1 }], movimientos: [movement], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2, revisionesImporte: [entry] };
const instances=[];
export function createMoneyBatchHarness(realClient=null,review=entry,initial=original,personalRows=[personal,other]) {
  const db=new DatabaseSync(":memory:"); instances.push(db); db.exec("CREATE TABLE store (key TEXT PRIMARY KEY,value TEXT)");
  const e={ db, realClient, uid:review.uid, platform:"android", active:true, calls:0, writes:0, failure:null,
    rows:{current:clone(personalRows)}, deleted:{current:[99]}, currency:{current:review.currency}, version:{current:1}, screen:{current:clone(initial)}, applied:[] };
  const get=key=>db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value??null;
  const put=(key,value)=>db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key,value);
  e.adapter={ getItem:async key=>get(key), setItem:async(key,value)=>{put(key,value);},
    multiGet:async keys=>{if(e.failure==="verify"&&e.writes)throw Error("native-read-failed");return keys.map(key=>[key,get(key)]);},
    multiSet:async entries=>{
      e.writes++;e.nativeStarted?.resolve();if(e.nativeGate)await e.nativeGate.promise;
      db.exec("BEGIN IMMEDIATE");try{for(const [key,value]of entries){put(key,value);if(e.failure==="rollback")throw Error("native-write-failed");}db.exec("COMMIT");}
      catch(error){db.exec("ROLLBACK");throw error;} if(e.failure==="lost-ack")throw Error("lost-native-response");
    }, multiRemove:async keys=>{for(const key of keys)db.prepare("DELETE FROM store WHERE key=?").run(key);},
    getAllKeys:async()=>db.prepare("SELECT key FROM store").all().map(row=>row.key) };
  const module={exports:{}};
  new Function("module","exports","require","globalThis",built.outputFiles[0].text)(module,module.exports,require,{env:e,ack:moneyAcknowledgement,sdkFunctions:realClient?require("firebase/functions"):null,sdkFirestore:realClient?require("firebase/firestore"):null});
  const api=module.exports;api.setAccountStorageAvailable(true);
  for(const [key,value]of [[api.STORAGE_KEYS.transactions,e.rows.current],[api.STORAGE_KEYS.deletedTransactionIds,e.deleted.current],[api.STORAGE_KEYS.cajasDinero,e.screen.current]])put(key,`v2:${JSON.stringify(value)}`);
  const ctx=api.createContext(),setBoxes=api.createScreen();api.guardarCajasEnMemoria(e.screen.current);
  const disk=key=>JSON.parse(get(key).slice(3));
  const request=lease=>api.requestPrivateBoxMoneyReview(review.uid,review,lease,()=>({transactions:e.rows.current,deletedIds:e.deleted.current,currency:e.currency.current}),()=>e.active);
  const commit=(ack,lease)=>{
    const before=e.screen.current;
    return ctx.commitPrivateBoxMoney(before,review,ack,lease,()=>e.active&&e.screen.current===before,next=>{e.applied.push(next);setBoxes(next);});
  };
  const run=()=>api.withPrivateBoxMoneyReview(review.uid,async lease=>commit(await request(lease),lease));
  return {e,api,ctx,disk,get,put,request,commit,run,setBoxes};
}
const harness=()=>createMoneyBatchHarness();
function checkSaved(h) {
  const {e,api,disk}=h, personalSaved=disk(api.STORAGE_KEYS.transactions),boxesSaved=disk(api.STORAGE_KEYS.cajasDinero);
  assert.equal(personalSaved[0].amount,100);assert.equal(boxesSaved.movimientos[0].monto,100);
  assert.equal(personalSaved[0].updatedAt,200);assert.equal(boxesSaved.movimientos[0].updatedAt,200);
  assert.deepEqual(personalSaved[1],other);assert.equal(boxesSaved.cajas[1].nombre,"Otra");assert.deepEqual(disk(api.STORAGE_KEYS.deletedTransactionIds),[99]);
  assert.equal(boxesSaved.revisionesImporte[0].estado,"confirmado");assert.deepEqual(boxesSaved.revisionesImporte[0].local,entry.local);
  assert.deepEqual(boxesSaved.revisionesImporte[0].remote,entry.remote);assert.deepEqual(e.rows.current,personalSaved);
  assert.deepEqual(api.leerCajasEnMemoria(),boxesSaved);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) try {
  for(const failure of [null,"lost-ack","rollback","encrypt"]) {
    const h=harness();if(failure==="encrypt")h.e.encryptFailure=true;else h.e.failure=failure;
    const ok=await h.run();assert.equal(ok,failure===null||failure==="lost-ack");
    if(ok){checkSaved(h);assert.equal(h.e.applied.length,1);await h.api.flushPendingSaves();checkSaved(h);}
    else {assert.equal(h.e.applied.length,0);assert.equal(h.e.rows.current[0].amount,80);assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero),original);}
    h.api.assertPrivateBoxMoneyLocalMutation("currency","USD"); // Reserva liberada en ambos desenlaces.
  }
  {
    const h=harness();await h.api.withPrivateBoxMoneyReview("A",async lease=>{
      const ack=await h.request(lease);await assert.rejects(h.commit({...ack},lease),/unconfirmed/);
      assert.equal(h.e.writes,0);assert.equal(await h.commit(ack,lease),true);checkSaved(h);
      assert.equal(await h.commit(ack,lease),false);assert.equal(h.e.writes,1,"no confirma/escribe la misma revisión dos veces localmente");
    });
  }
  for(const change of ["choice","disk","newer-row","deleted","currency","platform","screen"]) {
    const h=harness();await h.api.withPrivateBoxMoneyReview("A",async lease=>{
      const ack=await h.request(lease);
      if(change==="choice")h.e.screen.current.revisionesImporte[0].chosen="local-personal";
      if(change==="disk")h.put(h.api.STORAGE_KEYS.cajasDinero,`v2:${JSON.stringify({...original,movimientosBorrados:[movement.id]})}`);
      if(change==="newer-row")h.ctx.setTransactions(rows=>rows.map(row=>row.id===10?{...row,updatedAt:500}:row));
      if(change==="deleted")h.ctx.setDeletedTransactionIds([10,99]);
      if(change==="currency")h.ctx.setUserCurrency("USD");
      if(change==="platform")h.e.platform="ios";
      if(change==="screen")h.e.active=false;
      let ok;try{ok=await h.commit(ack,lease);}catch(error){assert.match(error.message,/changed|android-only|unconfirmed/);}
      assert.notEqual(ok,true);assert.equal(h.e.writes,0);assert.equal(h.e.applied.length,0);
    }).catch(error=>assert.match(error.message,/obsolete/));
  }
  {
    const h=harness();h.e.encryptGate=gate();h.e.encryptStarted=gate();
    const operation=h.run();await h.e.encryptStarted.promise;
    const added={...other,id:12,amount:25};h.ctx.setTransactions(rows=>[...rows,added]);h.e.encryptGate.resolve();
    assert.equal(await operation,true);assert.deepEqual(h.disk(h.api.STORAGE_KEYS.transactions)[2],added,"reprepara el lote sin perder otra edición durante el cifrado");
    assert.equal(h.e.writes,1);assert.equal(h.e.rows.current[0].updatedAt,200);
  }
  for(const failure of [null,"rollback","verify"]) {
    const h=harness();h.e.failure=failure;h.e.nativeGate=gate();h.e.nativeStarted=gate();
    const operation=h.run();await h.e.nativeStarted.promise;
    assert.equal(h.e.applied.length,0);assert.equal(h.e.rows.current[0].amount,80,"no publica éxito antes de SQLite/lectura");
    const oldRows=clone(h.e.rows.current),oldMarks=clone(h.e.deleted.current),oldBoxes=clone(h.e.screen.current);
    assert.throws(()=>h.ctx.setTransactions(rows=>{rows.push({...other,id:12});return rows;}),/source-changed/,"ni siquiera evalúa un updater con efectos laterales durante la reserva");
    assert.throws(()=>h.ctx.setDeletedTransactionIds(ids=>{ids.push(10);return ids;}),/source-changed/);
    assert.throws(()=>h.ctx.setUserCurrency("USD"),/source-changed/);
    assert.throws(()=>h.setBoxes({...oldBoxes,cajas:[]}),/source-changed/);
    assert.throws(()=>h.setBoxes(data=>{data.cajas.splice(0);return data;}),/source-changed/);
    assert.deepEqual(h.e.rows.current,oldRows);assert.deepEqual(h.e.deleted.current,oldMarks);assert.deepEqual(h.e.screen.current,oldBoxes);
    h.api.saveJSON(h.api.STORAGE_KEYS.transactions,oldRows);h.api.saveJSON(h.api.STORAGE_KEYS.cajasDinero,oldBoxes);
    h.e.nativeGate.resolve();
    if(failure==="verify")await assert.rejects(operation,/datos-locales-ilegibles/);
    else assert.equal(await operation,failure===null);
    if(failure===null){await h.api.flushPendingSaves();checkSaved(h);}
    if(failure==="rollback"){assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero),original);assert.deepEqual(h.e.rows.current,oldRows);}
    if(failure==="verify"){assert.equal(h.api.hasUnreadableLocalData(),true);assert.equal(h.e.applied.length,0);}
    h.api.assertPrivateBoxMoneyLocalMutation("currency","USD");
  }
  {
    const h=harness();h.e.nativeGate=gate();h.e.nativeStarted=gate();const operation=h.run();await h.e.nativeStarted.promise;
    h.e.active=false;h.e.nativeGate.resolve();assert.equal(await operation,false);
    checkSaved(h);assert.equal(h.e.applied.length,0,"pantalla cerrada no recibe callbacks, cuenta vigente sí refleja el lote comprobado");
  }
  {
    const h=harness();h.e.nativeGate=gate();h.e.nativeStarted=gate();const operation=h.run();await h.e.nativeStarted.promise;
    h.e.uid="B";h.e.version.current++;h.api.setAccountStorageAvailable(false);h.api.setAccountStorageAvailable(true);h.e.uid="A";
    h.e.nativeGate.resolve();await assert.rejects(operation,/obsolete/);assert.equal(h.e.rows.current[0].amount,80);assert.equal(h.e.applied.length,0);
    h.api.assertPrivateBoxMoneyLocalMutation("currency","USD");
  }
  {
    const h=harness();h.e.nativeGate=gate();h.e.nativeStarted=gate();const operation=h.run();await h.e.nativeStarted.promise;
    let captured=false;
    const background=h.api.withLocalAccountOperation(async()=>{h.ctx.setTransactions(rows=>[...rows,{...other,id:12}]);captured=true;});
    assert.equal(captured,false);h.e.nativeGate.resolve();assert.equal(await operation,true);await background;
    assert.equal(h.e.rows.current[0].amount,100);assert.equal(h.e.rows.current[2].id,12,"la captura en la cola de cuenta espera el lote, no se descarta");
  }
  {
    const rows=[clone(personal),...Array.from({length:10000},(_,index)=>({...other,id:1000+index}))];
    const data={...clone(original),cajas:[clone(box),...Array.from({length:1000},(_,index)=>({id:`large-box-${index}`,nombre:`Otra ${index}`,creadaEn:1}))]};
    const h=createMoneyBatchHarness(null,entry,data,rows);
    assert.equal(await h.run(),true);assert.equal(h.e.rows.current.length,10001);
    assert.deepEqual(h.e.rows.current[10000],rows[10000]);assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).cajas.length,1001);
    assert.equal(h.e.rows.current[0].amount,100);assert.equal(h.e.rows.current[0].updatedAt,200);
  }
  // La pantalla pasa el recibo genuino por el flujo original, nunca un ack calculado.
  assert.match(read("screens/Cajas.tsx"),/confirmarImporteCaja\(comparison, chosen, moneyPort\(\)\)/);
  assert.match(read("screens/Cajas.tsx"),/commitPrivateBoxMoney\(before, entry, ack, lease, current, setDatos\)/);
  assert.doesNotMatch(read("screens/Cajas.tsx"),/moneyAcknowledgement|requestPrivateBoxMoneyReview/);
  console.log("Lote monetario: contexto/setters/cliente/colas/almacén originales, SQLite real, confirmación genuina, reserva corta, versiones, otros movimientos y fallos comprobados. Android físico pendiente.");
} finally {for(const db of instances)db.close();}
