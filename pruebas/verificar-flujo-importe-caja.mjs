import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";
import * as esbuild from "esbuild";

// El contrato completo no existía en cbe2b08. No se describe como fallo publicado.
const baseline=process.env.FINO_TEST_MONEY_FLOW_BASELINE;
if(baseline){
  assert.match(baseline,/^[a-f0-9]{7,40}$/);
  const old=execFileSync("git",["show",`${baseline}:contexts/AppDataContext.tsx`],{encoding:"utf8"});
  assert.ok(/async function stagePrivateBoxMoney\(/.test(old),"Falta conservar originales antes del envío desde la pantalla");
  throw Error("La revisión anterior debía fallar por flujo ausente.");
}
const {createMoneyBatchHarness}=await import("./verificar-lote-importe-caja.mjs");
const require=createRequire(import.meta.url),clone=value=>structuredClone(value);
const {canonical,moneyResult,moneyAcknowledgement}=require("../functions/src/private-box-money-shared.js");
const box={id:"caja-a",nombre:"Viaje",creadaEn:1,updatedAt:2};
const m={id:"mov-a",cajaId:box.id,tipo:"ingreso",monto:100,descripcion:"Aporte",fecha:"2026-10-06",creadoEn:3,updatedAt:4,personalTransactionId:10};
const p={id:10,type:"expense",amount:80,date:m.fecha,category:"otros",method:"transfer",description:"Viaje",notes:"Conservar",internalTransfer:"box",internalTransferLink:m.id,internalTransferSpaceId:box.id,updatedAt:4};
const other={id:11,type:"income",amount:500,date:"2026-10-05",category:"otros"};
const remoteP={...p,amount:90,date:"2026-10-04"},remoteM={...m,monto:120,fecha:"2026-10-03"};
const review={id:"money-operation-example",uid:"A",currency:"PEN",box,local:{personal:p,movement:m},remote:{personal:remoteP,movement:remoteM},chosen:"remote-box",createdAt:200,version:200,estado:"pendiente"};
const data={cajas:[box,{id:"caja-b",nombre:"Otra",creadaEn:1}],movimientos:[m],cajasBorradas:[],movimientosBorrados:[],syncFormat:2};
const metadata={fromCache:false,hasPendingWrites:false};
const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const all=[];
function setup(initial=data,rows=[p,other]){
  const h=createMoneyBatchHarness(null,review,initial,rows);all.push(h);
  h.e.premium=true;h.e.remoteWrites=0;
  h.e.sources=new Map([["users/A",{hasOnboarded:true,userCurrency:"PEN",transactions:[clone(remoteP)],deletedTransactionIds:[]}],
    ["cajas/A",{...clone(data),movimientos:[clone(remoteM)]}]]);
  h.e.snapshot=value=>({metadata,exists:()=>value!==undefined,data:()=>clone(value)});
  h.e.send=async (entry,endpoint)=>{
    const saved=h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte.find(row=>row.id===entry.id);
    assert.deepEqual(saved,{...entry,estado:"pendiente"},"Nunca envía antes de confirmar los cuatro originales cifrados en disco");
    const result=moneyResult(entry),user=h.e.sources.get("users/A"),boxes=h.e.sources.get("cajas/A");
    const replay=canonical(user.transactions[0])===canonical(result.personal)&&canonical(boxes.movimientos[0])===canonical(result.movement);
    if(endpoint==="recoverPrivateBoxMoney"&&!replay)throw {details:{reason:"money-not-confirmed"}};
    if(!replay){
      assert.deepEqual(user.transactions[0],entry.remote.personal);assert.deepEqual(boxes.movimientos[0],entry.remote.movement);
      user.transactions[0]=clone(result.personal);boxes.movimientos[0]=clone(result.movement);h.e.remoteWrites++;
    }
    return {data:moneyAcknowledgement(entry)};
  };
  h.port={current:()=>h.e.active,premium:()=>h.e.premium,boxes:()=>h.e.screen.current,local:h.ctx.readPrivateBoxMoneyLocal,
    stage:(before,entry,lease,current)=>h.ctx.stagePrivateBoxMoney(before,entry,lease,current,next=>{h.e.applied.push(next);h.setBoxes(next);}),
    commit:(before,entry,ack,lease,current)=>h.ctx.commitPrivateBoxMoney(before,entry,ack,lease,current,next=>{h.e.applied.push(next);h.setBoxes(next);})};
  h.compare=()=>h.api.compararImporteCaja("A",m.id,h.port);
  h.confirm=(comparison,chosen="remote-box")=>h.api.confirmarImporteCaja(comparison,chosen,h.port);
  h.pending=()=>h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0];
  h.retry=()=>h.api.reintentarImporteCaja("A",h.pending(),h.port);
  return h;
}
try{
  {
    const h=setup(),comparison=await h.compare();
    assert.deepEqual(comparison.choices.map(row=>[row.source,row.amount,row.date,row.usable]),[
      ["local-personal",80,p.date,true],["local-box",100,m.fecha,true],["remote-personal",90,remoteP.date,true],["remote-box",120,remoteM.fecha,true]]);
    assert.equal(h.e.sourceReads,2);assert.equal(h.e.calls,0);assert.equal(h.e.writes,0);
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero),data,"ver el formulario no decide ni guarda dinero");
    assert.equal(await h.confirm(comparison),true);assert.equal(h.e.writes,2);assert.equal(h.e.calls,1);assert.equal(h.e.remoteWrites,1);
    const entry=h.pending();assert.equal(entry.estado,"confirmado");assert.equal(entry.chosen,"remote-box");
    assert.deepEqual(entry.local,review.local);assert.deepEqual(entry.remote,review.remote);
    assert.equal(h.e.rows.current[0].amount,120);assert.equal(h.e.rows.current[0].date,remoteM.fecha);
    assert.equal(h.e.rows.current[0].updatedAt,entry.version);assert.equal(h.e.screen.current.movimientos[0].updatedAt,entry.version);
    assert.deepEqual(h.e.rows.current[1],other);assert.deepEqual(h.e.deleted.current,[99]);assert.equal(h.e.screen.current.cajas.length,2);
    await h.api.flushPendingSaves();assert.equal(h.pending().estado,"confirmado");
  }
  for(const change of ["remote","personal","boxes","currency","comparison","displayed-choice","choice","pro","account"]){
    const h=setup(),comparison=await h.compare();
    if(change==="remote")h.e.sources.get("users/A").transactions[0].updatedAt=500;
    if(change==="personal")h.ctx.setTransactions(rows=>rows.map(row=>row.id===10?{...row,amount:70}:row));
    if(change==="boxes")h.setBoxes({...h.e.screen.current,cajas:[{...box,nombre:"Nuevo"}]});
    if(change==="currency")h.ctx.setUserCurrency("USD");
    if(change==="comparison")comparison.remote.transactions[0].amount=700;
    if(change==="displayed-choice")comparison.choices[3].amount=700;
    if(change==="pro")h.e.premium=false;
    if(change==="account")h.e.active=false;
    await assert.rejects(h.confirm(comparison,change==="choice"?"invalid":"remote-box"),/changed|needs-pro|obsolete/);
    assert.equal(h.e.calls,0);assert.equal(h.e.writes,0);assert.equal(h.e.remoteWrites,0);
  }
  {
    const h=setup();h.e.snapshot=value=>({metadata:{...metadata,fromCache:true},exists:()=>true,data:()=>value});
    await assert.rejects(h.compare(),/unconfirmed/);assert.equal(h.e.calls,0);assert.equal(h.e.writes,0);
  }
  for(const issue of ["offline","stage-rollback","stage-encryption","final-rollback","lost-http","pro-after-stage"]){
    const h=setup(),comparison=await h.compare(),send=h.e.send;
    if(issue==="offline")h.e.send=async()=>{throw Error("functions/unavailable");};
    if(issue==="stage-rollback")h.e.failure="rollback";
    if(issue==="stage-encryption")h.e.encryptFailure=true;
    if(issue==="final-rollback")h.e.send=async entry=>{const ack=await send(entry);h.e.failure="rollback";return ack;};
    if(issue==="lost-http")h.e.send=async entry=>{await send(entry);throw Error("functions/unavailable");};
    if(issue==="pro-after-stage"){const stage=h.port.stage;h.port.stage=async(...args)=>{const ok=await stage(...args);h.e.premium=false;return ok;};}
    let ok;try{ok=await h.confirm(comparison);}catch(error){assert.match(error.message,/unavailable|needs-pro/);}
    assert.notEqual(ok,true);assert.equal(h.e.rows.current[0].amount,80);
    if(issue.startsWith("stage-")){assert.equal(h.e.calls,0);assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero),data);continue;}
    const before=clone(h.pending());assert.equal(before.estado,"pendiente");assert.deepEqual(before.local,review.local);assert.deepEqual(before.remote,review.remote);
    if(issue==="pro-after-stage"){
      await assert.rejects(h.retry(),/needs-pro/);assert.deepEqual(h.pending(),before);assert.equal(h.e.calls,1);
      assert.deepEqual(h.e.endpoints,["recoverPrivateBoxMoney"],"sin Pro solo consulta resultado, no inicia una corrección");
    }
    h.e.failure=null;h.e.premium=true;h.e.send=send;
    assert.equal(await h.retry(),true);assert.equal(h.e.remoteWrites,1);assert.equal(h.pending().estado,"confirmado");
    assert.equal(h.pending().id,before.id);assert.equal(h.pending().version,before.version);assert.equal(h.pending().chosen,before.chosen);
  }
  {
    const h=setup(),comparison=await h.compare(),send=h.e.send;
    h.e.send=async entry=>{const ack=await send(entry);h.e.premium=false;return ack;};
    assert.equal(await h.confirm(comparison),true,"termina local si Pro vence después de HTTP genuino");
    assert.equal(h.pending().estado,"confirmado");assert.equal(h.e.calls,1);
  }
  {
    const h=setup(),comparison=await h.compare();
    h.put(h.api.STORAGE_KEYS.transactions,`v2:${JSON.stringify([{...p,amount:70},other])}`);
    h.api.saveJSON(h.api.STORAGE_KEYS.transactions,[{...p,amount:70},other]);
    h.e.send=async()=>{throw Error("functions/unavailable");};
    await assert.rejects(h.confirm(comparison),/unavailable/);await h.api.flushPendingSaves();
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.transactions),[p,other],"el diario conserva juntas la fuente viva Personal y Caja, no solo una referencia visual");
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.deletedTransactionIds),[99]);
    assert.equal(h.pending().estado,"pendiente");assert.equal(h.pending().local.personal.amount,80);
  }
  {
    const h=setup(),comparison=await h.compare();
    h.put(h.api.STORAGE_KEYS.cajasDinero,`v2:${JSON.stringify({...data,syncFormat:undefined})}`);
    h.api.saveJSON(h.api.STORAGE_KEYS.cajasDinero,clone(data));
    assert.equal(await h.confirm(comparison),true,"confirma el guardado agrupado de la copia visible antes de conservar originales");
    assert.equal(h.pending().estado,"confirmado");assert.equal(h.e.calls,1);
  }
  {
    const h=setup(),comparison=await h.compare();h.e.send=async()=>{throw Error("functions/unavailable");};
    await assert.rejects(h.confirm(comparison),/unavailable/);
    const before=clone(h.pending());h.ctx.setTransactions(rows=>rows.map(row=>row.id===10?{...row,updatedAt:500}:row));
    const calls=h.e.calls;await assert.rejects(h.retry(),/changed/);assert.equal(h.e.calls,calls);assert.deepEqual(h.pending(),before);
  }
  {
    const h=setup(),comparison=await h.compare(),send=h.e.send;h.e.send=async entry=>{await send(entry);throw Error("functions/unavailable");};
    await assert.rejects(h.confirm(comparison),/unavailable/);
    const pending=clone(h.pending()),saved=clone(h.disk(h.api.STORAGE_KEYS.cajasDinero)),sources=clone(h.e.sources);
    const reopened=setup(saved,clone(h.e.rows.current));reopened.e.sources=sources;
    assert.equal(await reopened.retry(),true);assert.equal(reopened.e.remoteWrites,0,"reinicio y respuesta perdida no duplica escritura remota");
    assert.equal(reopened.pending().id,pending.id);assert.equal(reopened.pending().version,pending.version);assert.equal(reopened.e.writes,1);
  }
  {
    const expense={id:"expense-a",cajaId:box.id,tipo:"gasto",monto:110,descripcion:"Gasto",fecha:m.fecha,creadoEn:5};
    const h=setup({...clone(data),movimientos:[{...m,monto:120},expense]});
    h.e.sources.get("cajas/A").movimientos.push(clone(expense));
    const comparison=await h.compare();
    assert.deepEqual(comparison.choices.map(row=>row.usable),[false,true,false,true]);
    await assert.rejects(h.confirm(comparison,"local-personal"),/changed/);assert.equal(h.e.writes,0);
  }
  {
    const h=setup(),comparison=await h.compare(),started=gate(),finish=gate();
    h.e.nativeStarted=started;h.e.nativeGate=finish;
    const operation=h.confirm(comparison);await started.promise;
    h.e.active=false;finish.resolve();assert.equal(await operation,false);
    assert.equal(h.e.calls,0);assert.equal(h.pending().estado,"pendiente","cerrar pantalla tras SQLite conserva elección, pero no envía");
  }
  {
    const h=setup(),comparison=await h.compare();let announced=0,last;
    const stop=h.api.observarCajasEnMemoria(()=>{announced++;last=h.api.leerCajasEnMemoria();});
    const revision=h.api.revisionCajasEnMemoria();assert.equal(await h.confirm(comparison),true);
    assert.equal(announced,2);assert.equal(last.revisionesImporte[0].estado,"confirmado");assert.ok(h.api.revisionCajasEnMemoria()>revision);
    stop();h.api.limpiarCajasEnMemoria();assert.equal(announced,2);assert.equal(h.api.leerCajasEnMemoria(),null);
  }
}catch(error){error.message+=` (caso ${all.length})`;throw error;}finally{for(const h of all)h.e.db.close();}

// Se renderiza el componente original con primitivas nativas sustituidas;
// no es una prueba visual de Android. Incluye los textos y eventos reales.
const bundle=await esbuild.build({entryPoints:["components/PrivateBoxMoneyReview.tsx"],bundle:true,platform:"node",format:"cjs",jsx:"automatic",write:false,alias:{"@":process.cwd()},logLevel:"silent",plugins:[{name:"render-only",setup(b){
  b.onResolve({filter:/^(react|react-native|react\/jsx-runtime)$/},args=>({path:args.path,namespace:"ui"}));
  b.onLoad({filter:/.*/,namespace:"ui"},args=>({contents:args.path==="react"?"export const useState=()=>[globalThis.history,()=>{}];":args.path==="react/jsx-runtime"?"export const Fragment='Fragment',jsx=(type,props)=>({type,props}),jsxs=jsx;":"export const Text='Text', View='View', TouchableOpacity='Button';",loader:"js"}));
}}]});
const module={exports:{}};new Function("module","exports","require","globalThis",bundle.outputFiles[0].text)(module,module.exports,require,{history:true});
const {default:Component,originalesImporte,MONEY_SOURCE_LABELS}=module.exports;
assert.equal(originalesImporte(review).length,4);assert.equal(Object.keys(MONEY_SOURCE_LABELS).length,4);
const tree=Component({comparison:null,reviews:[{...review,estado:"confirmado"},review],candidates:[],message:null,busy:false,premium:false,t:key=>key,compare(){},choose(){},retry(){},cancel(){}});
const nodes=[];function walk(node){if(Array.isArray(node)){node.forEach(walk);return;}if(node&&typeof node==="object"&&node.props){nodes.push(node);walk(node.props.children);}}walk(tree);
const texts=nodes.flatMap(node=>node.type==="Text"?[JSON.stringify(node.props.children)]:[]).join("\n");
for(const label of Object.values(MONEY_SOURCE_LABELS))assert.match(texts,new RegExp(label));
for(const date of [p.date,remoteP.date,remoteM.fecha])assert.ok(texts.includes(date));
assert.ok(texts.includes("boxes.moneyRecoveryHelp"));assert.ok(texts.includes("boxes.moneyChosen"));
assert.ok(nodes.some(node=>node.type==="Button"&&node.props.disabled===false&&JSON.stringify(node.props.children).includes("boxes.moneyRecover")),"Gratis puede comprobar el resultado pendiente, sin habilitar una corrección nueva");

// La pantalla conserva la confirmación explícita; no acepta botones de avisos antiguos.
const screen=fs.readFileSync("screens/Cajas.tsx","utf8"),ast=ts.createSourceFile("Cajas.tsx",screen,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let select;function find(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==="elegirImporteCaja")select=node.getText(ast);ts.forEachChild(node,find);}find(ast);
let comparisonSetter;function findSetter(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="setMoneyComparison")comparisonSetter=node.getText(ast);ts.forEachChild(node,findSetter);}findSetter(ast);
{
  const reference={current:{}},renders=[];
  const js=ts.transpileModule(`const ${comparisonSetter};globalThis.set=setMoneyComparison;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const bindings={};new Function("moneyComparisonActual","setRenderedMoneyComparison","useCallback","globalThis",js)(reference,value=>renders.push(value),callback=>callback,bindings);
  bindings.set(null);assert.equal(reference.current,null,"cancelar invalida el aviso inmediatamente, sin esperar a que React pinte");
  assert.deepEqual(renders,[null]);
}
let prompt,sends=0,current=true;const comparison={choices:[{source:"remote-box",amount:120,date:remoteM.fecha,usable:true}]};
const src=ts.transpileModule(`${select};globalThis.choose=elegirImporteCaja;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const scope={moneyComparisonActual:{current:comparison},guardandoRef:{current:false},cuentaActual:()=>current,Alert:{alert:(...args)=>prompt=args},t:key=>key,fmt:String,
  trabajarImporteCaja:async work=>work(),confirmarImporteCaja:()=>{sends++;return true;},moneyPort:()=>({})};
new Function(...Object.keys(scope),"globalThis",src)(...Object.values(scope),scope);
scope.choose("remote-box");assert.equal(sends,0);assert.equal(prompt[2][0].style,"cancel");
scope.moneyComparisonActual.current=null;prompt[2][1].onPress();assert.equal(sends,0);
scope.moneyComparisonActual.current=comparison;scope.choose("remote-box");prompt[2][1].onPress();assert.equal(sends,1);
current=false;scope.choose("remote-box");assert.equal(sends,1);

// Se ejecuta el bloqueo/cierre/errores original de pantalla, no una copia de su lógica.
let worker;function workerFind(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==="trabajarImporteCaja")worker=node.getText(ast);ts.forEachChild(node,workerFind);}workerFind(ast);
const workerJS=ts.transpileModule(`${worker};globalThis.work=trabajarImporteCaja;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function screenWorker(){
  const events=[],ref={current:false},state={current:true,premium:true};
  const bindings={cuentaActual:()=>state.current,ready:true,personalReady:true,hasOnboarded:true,guardandoRef:ref,compartiendo:false,cargandoUnion:false,
    premiumForSync:{get current(){return state.premium;}},Platform:{OS:"android"},t:key=>key,
    setGuardando:value=>events.push(["busy",value]),setMoneyBusy:value=>events.push(["modal",value]),setMoneyMessage:value=>events.push(["message",value]),
    setMoneyComparison:value=>events.push(["comparison",value]),showToast:value=>events.push(["toast",value]),setRefreshVersion:()=>events.push(["refresh"])};
  new Function(...Object.keys(bindings),"globalThis",workerJS)(...Object.values(bindings),bindings);
  return {state,events,ref,work:bindings.work};
}
{
  const h=screenWorker(),started=gate(),finish=gate();let calls=0;
  const operation=h.work(async()=>{calls++;started.resolve();await finish.promise;return true;});await started.promise;
  await h.work(async()=>{calls++;return true;});assert.equal(calls,1,"dos toques no lanzan dos revisiones");
  h.state.current=false;finish.resolve();await operation;
  assert.ok(!h.events.some(([event])=>event==="toast"));assert.equal(h.ref.current,false);
}
for(const [reason,message]of [["money-source-changed","boxes.moneyChanged"],["money-premium-required","boxes.moneyNeedsPro"],["unavailable","boxes.moneyPending"]]){
  const h=screenWorker();await h.work(async()=>{throw {details:{reason}};});
  assert.ok(h.events.some(([event,value])=>event==="message"&&value===message));
  assert.ok(!h.events.some(([event])=>event==="toast"));assert.equal(h.ref.current,false);
}
console.log("Flujo monetario original: cuatro fuentes, confirmación explícita, originales antes del envío, reconsulta, fallos, reintento/reinicio, Pro, saldo, caché y componente original comprobados. Android visual pendiente.");
