import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createMoneyBatchHarness } from "./verificar-lote-importe-caja.mjs";

const require=createRequire(import.meta.url),clone=value=>structuredClone(value);
const {moneyAcknowledgement,canonical}=require("../functions/src/private-box-money-shared.js");
const all=[];
function setup(){
  const h=createMoneyBatchHarness();all.push(h);
  h.e.premium=false;
  const entry=clone(h.e.screen.current.revisionesImporte[0]);
  h.port={current:()=>h.e.active,premium:()=>h.e.premium,boxes:()=>h.e.screen.current,local:h.ctx.readPrivateBoxMoneyLocal,
    stage(){throw Error("No debe iniciar otro diario para recuperar");},
    commit:(before,chosen,ack,lease,current)=>h.ctx.commitPrivateBoxMoney(before,chosen,ack,lease,current,h.setBoxes)};
  // Sustituto únicamente del servidor/HTTP. Validación del servidor real se
  // comprueba en sus unitarias y en la integración SDK demo por separado.
  h.e.send=async(payload,endpoint)=>{
    assert.equal(endpoint,"recoverPrivateBoxMoney");assert.equal(payload.estado,undefined);
    assert.equal(canonical(payload),canonical({...entry,estado:undefined}));
    return {data:moneyAcknowledgement(payload)};
  };
  h.entry=entry;h.retry=()=>h.api.reintentarImporteCaja(entry.uid,entry,h.port);
  return h;
}
try{
  // También es la regresión: 48e9f95 se detiene por needs-pro antes de HTTP.
  {
    const h=setup(),before=clone(h.e.rows.current);
    assert.equal(await h.retry(),true,"una respuesta ya completada debe recuperarse sin volver a pagar Pro");
    assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney"]);assert.equal(h.e.writes,1);assert.equal(h.e.sourceReads??0,0,"no descarga Firestore ni historial desde el cliente Gratis");
    const disk=h.disk(h.api.STORAGE_KEYS.cajasDinero),entry=disk.revisionesImporte[0];
    assert.equal(entry.estado,"confirmado");assert.deepEqual(entry.local,h.entry.local);assert.deepEqual(entry.remote,h.entry.remote);
    assert.equal(entry.version,h.entry.version);assert.equal(entry.chosen,h.entry.chosen);
    assert.equal(h.e.rows.current[0].amount,100);assert.equal(h.e.rows.current[0].updatedAt,h.entry.version);
    assert.deepEqual(h.e.rows.current[1],before[1]);assert.deepEqual(h.disk(h.api.STORAGE_KEYS.deletedTransactionIds),[99]);
    await h.api.flushPendingSaves();assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado,"confirmado");
    await assert.rejects(h.retry(),/changed/);assert.equal(h.e.calls,1,"marca confirmada no vuelve a pedir una operación");
  }
  if(process.env.FINO_TEST_MONEY_RECOVERY_BASELINE)throw Error("La versión anterior debía fallar por el bloqueo Pro de recuperación.");
  {
    const h=setup();await h.api.withPrivateBoxMoneyReview(h.entry.uid,async lease=>{
      const ack=await h.api.recoverPrivateBoxMoneyReview(h.entry.uid,h.entry,lease,h.port.local,h.port.current);
      const before=h.e.screen.current;
      await assert.rejects(h.ctx.commitPrivateBoxMoney(before,h.entry,{...ack},lease,h.port.current,h.setBoxes),/unconfirmed/);
      assert.equal(h.e.writes,0,"copiar el resultado de recuperación no crea una confirmación genuina");
      assert.equal(await h.ctx.commitPrivateBoxMoney(before,h.entry,ack,lease,h.port.current,h.setBoxes),true);
    });
  }
  {
    const h=setup();h.e.send=async()=>{throw {details:{reason:"money-not-confirmed"}};};
    await assert.rejects(h.retry(),/needs-pro/);assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney"]);
    assert.equal(h.e.writes,0);assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero),h.e.screen.current);
  }
  for(const failure of ["offline","changed","unknown-ack","account-deleting","permission"]){
    const h=setup();h.e.premium=true;
    h.e.send=async payload=>{
      if(failure==="offline")throw Error("offline");
      if(failure==="changed")throw {details:{reason:"money-source-changed"}};
      if(failure==="account-deleting")throw {details:{reason:"money-account-unavailable"}};
      if(failure==="permission")throw {code:"functions/permission-denied"};
      return {data:{...moneyAcknowledgement(payload),version:201}};
    };
    await assert.rejects(h.retry());assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney"],"un fallo/acuse distinto no abre vía de escritura");
    assert.equal(h.e.writes,0);assert.equal(h.e.rows.current[0].amount,80);
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado,"pendiente");
  }
  {
    const h=setup();h.e.premium=true;
    h.e.send=async(payload,endpoint)=>{
      if(endpoint==="recoverPrivateBoxMoney")throw {details:{reason:"money-not-confirmed"}};
      assert.equal(endpoint,"resolvePrivateBoxMoney");return {data:moneyAcknowledgement(payload)};
    };
    assert.equal(await h.retry(),true);assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney","resolvePrivateBoxMoney"]);
    assert.equal(h.e.writes,1);
  }
  {
    const h=setup();h.e.premium=true;
    h.e.send=async()=>{h.e.premium=false;throw {details:{reason:"money-not-confirmed"}};};
    await assert.rejects(h.retry(),/needs-pro/);assert.equal(h.e.calls,1);assert.equal(h.e.writes,0);
  }
  for(const change of ["local-row","currency","choice","disk","account"]){
    const h=setup();const request=h.e.send;
    h.e.send=async(...args)=>{
      const response=await request(...args);
      if(change==="local-row")h.ctx.setTransactions(rows=>rows.map(row=>row.id===10?{...row,updatedAt:999}:row));
      if(change==="currency")h.ctx.setUserCurrency("USD");
      if(change==="choice")h.entry.chosen="local-personal";
      if(change==="disk")h.put(h.api.STORAGE_KEYS.cajasDinero,`v2:${JSON.stringify({...h.e.screen.current,movimientosBorrados:["mov-a"]})}`);
      if(change==="account"){h.e.uid="B";h.e.version.current++;h.api.setAccountStorageAvailable(false);h.api.setAccountStorageAvailable(true);h.e.uid="A";}
      return response;
    };
    await assert.rejects(h.retry(),/changed|obsolete|unconfirmed/);assert.equal(h.e.writes,0);
    assert.equal(h.e.rows.current[0].amount,80);assert.equal(h.e.screen.current.revisionesImporte[0].estado,"pendiente");
  }
  for(const failure of ["rollback","encrypt","lost-ack"]){
    const h=setup();if(failure==="encrypt")h.e.encryptFailure=true;else h.e.failure=failure;
    assert.equal(await h.retry(),failure==="lost-ack");
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado,failure==="lost-ack"?"confirmado":"pendiente");
    if(failure!=="lost-ack"){
      h.e.failure=null;h.e.encryptFailure=false;assert.equal(await h.retry(),true);
      assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney","recoverPrivateBoxMoney"]);
      assert.equal(h.e.rows.current[0].updatedAt,h.entry.version);
    }
  }
  {
    const h=setup(),saved=clone(h.e.screen.current),entry=clone(h.entry);
    h.e.db.close();all.pop();
    const reopened=createMoneyBatchHarness(null,entry,saved);all.push(reopened);
    reopened.e.send=async(payload,endpoint)=>{assert.equal(endpoint,"recoverPrivateBoxMoney");return {data:moneyAcknowledgement(payload)};};
    const port={...h.port,boxes:()=>reopened.e.screen.current,local:reopened.ctx.readPrivateBoxMoneyLocal,
      commit:(before,selected,ack,lease,current)=>reopened.ctx.commitPrivateBoxMoney(before,selected,ack,lease,current,reopened.setBoxes)};
    assert.equal(await reopened.api.reintentarImporteCaja(entry.uid,entry,port),true);
    assert.equal(reopened.e.writes,1);assert.equal(reopened.disk(reopened.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].id,entry.id);
  }
}finally{for(const h of all)h.e.db.close();}

// Camino original del botón: solo recuperar permite entrar sin Pro.
const screen=fs.readFileSync("screens/Cajas.tsx","utf8"),tree=ts.createSourceFile("Cajas.tsx",screen,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let worker,retry;function find(node){if(ts.isFunctionDeclaration(node)){if(node.name?.text==="trabajarImporteCaja")worker=node.getText(tree);if(node.name?.text==="recuperarImporteCaja")retry=node.getText(tree);}ts.forEachChild(node,find);}find(tree);
const js=ts.transpileModule(`${worker};${retry};globalThis.work=trabajarImporteCaja;globalThis.retry=recuperarImporteCaja;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const events=[],ref={current:false};let calls=0;
const scope={accountUid:"A",cuentaActual:()=>true,ready:true,personalReady:true,hasOnboarded:true,guardandoRef:ref,compartiendo:false,cargandoUnion:false,
  premiumForSync:{current:false},Platform:{OS:"android"},t:key=>key,setGuardando:value=>events.push(["busy",value]),setMoneyBusy:value=>events.push(["modal",value]),
  setMoneyMessage:value=>events.push(["message",value]),setMoneyComparison(){},showToast:value=>events.push(["toast",value]),setRefreshVersion(){},moneyPort:()=>({}),
  reintentarImporteCaja:async()=>{calls++;return true;}};
new Function(...Object.keys(scope),"globalThis",js)(...Object.values(scope),scope);
await scope.work(async()=>{calls++;return true;});assert.equal(calls,0,"el botón de nueva corrección continúa limitado a Pro");
await scope.retry({});assert.equal(calls,1);assert.ok(events.some(([event,value])=>event==="toast"&&value==="boxes.moneySaved"));assert.equal(ref.current,false);
console.log("Recuperación sin Pro: respuesta genuina, originales/versiones, reinicio, fallo local, no nueva corrección/descarga Gratis, cambios posteriores y botón original comprobados. Android pendiente.");
