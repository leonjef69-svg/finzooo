import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as esbuild from "esbuild";
import { createMoneyBatchHarness } from "./verificar-lote-importe-caja.mjs";
const require=createRequire(import.meta.url),clone=value=>structuredClone(value);
const {moneyResult,moneyAcknowledgement,canonical}=require("../functions/src/private-box-money-shared.js");
const all=[];
function setup(){
  const h=createMoneyBatchHarness();all.push(h);h.old=clone(h.e.screen.current.revisionesImporte[0]);h.e.premium=true;
  const remoteP={...h.old.remote.personal,amount:90,updatedAt:9},remoteM={...h.old.remote.movement,monto:120,updatedAt:9};
  const remote={...clone(h.e.screen.current),movimientos:[remoteM]};delete remote.revisionesImporte;
  h.e.sources=new Map([["users/A",{hasOnboarded:true,userCurrency:"PEN",transactions:[remoteP],deletedTransactionIds:[]}],["cajas/A",remote]]);
  h.e.snapshot=value=>({metadata:{fromCache:false,hasPendingWrites:false},exists:()=>value!==undefined,data:()=>clone(value)});
  h.e.send=async(payload,endpoint)=>{
    assert.equal(endpoint,"resolvePrivateBoxMoney");assert.equal(payload.reemplaza,undefined);assert.equal(payload.reemplazadaPor,undefined);
    const disk=h.disk(h.api.STORAGE_KEYS.cajasDinero),old=disk.revisionesImporte.find(value=>value.id===h.old.id),next=disk.revisionesImporte.find(value=>value.id!==h.old.id);
    assert.equal(old.estado,"sustituido");assert.equal(old.reemplazadaPor,next.id);assert.equal(next.estado,"pendiente");assert.equal(next.reemplaza,old.id);
    assert.deepEqual({...old,estado:"pendiente",reemplazadaPor:undefined},{...h.old,reemplazadaPor:undefined},"los originales y la elección vieja nunca se reemplazan");
    assert.deepEqual(next.local,h.old.local);assert.deepEqual(next.remote,{personal:remoteP,movement:remoteM});
    return {data:moneyAcknowledgement(payload)};
  };
  h.port={current:()=>h.e.active,premium:()=>h.e.premium,boxes:()=>h.e.screen.current,local:h.ctx.readPrivateBoxMoneyLocal,
    stage:(before,entry,lease,current)=>h.ctx.stagePrivateBoxMoney(before,entry,lease,current,h.setBoxes),
    commit:(before,entry,ack,lease,current)=>h.ctx.commitPrivateBoxMoney(before,entry,ack,lease,current,h.setBoxes)};
  h.compare=()=>h.api.compararImporteCaja("A",h.old.local.movement.id,h.port,h.old.id);
  h.confirm=comparison=>h.api.confirmarImporteCaja(comparison,"remote-box",h.port);
  return h;
}
try{
  {
    const h=setup(),comparison=await h.compare();
    assert.equal(comparison.replaces,h.old.id,"la revisión de una pendiente exige vincular la elección anterior");
    assert.equal(h.e.writes,0);assert.equal(h.e.calls,0);assert.equal(h.e.screen.current.revisionesImporte[0].estado,"pendiente");
    assert.equal(await h.confirm(comparison),true);assert.equal(h.e.writes,2);assert.equal(h.e.calls,1);
    const data=h.disk(h.api.STORAGE_KEYS.cajasDinero),old=data.revisionesImporte.find(row=>row.id===h.old.id),next=data.revisionesImporte.find(row=>row.id!==h.old.id);
    assert.equal(old.estado,"sustituido");assert.equal(next.estado,"confirmado");assert.equal(next.reemplaza,old.id);assert.equal(old.reemplazadaPor,next.id);
    assert.equal(h.e.rows.current[0].amount,120);assert.equal(next.version,h.e.rows.current[0].updatedAt);assert.ok(next.version>old.version);
    assert.equal(data.movimientos[0].updatedAt,next.version);assert.equal(data.cajas[1].nombre,"Otra");assert.equal(h.e.rows.current[1].amount,500);
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.deletedTransactionIds),[99]);
    const calls=h.e.calls;await assert.rejects(h.api.reintentarImporteCaja("A",h.old,h.port),/changed/);assert.equal(h.e.calls,calls);
    await h.api.flushPendingSaves();assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte.length,2);
    for(const [a,b]of [[data,{...data,revisionesImporte:[h.old]}],[{...data,revisionesImporte:[h.old]},data]]){
      const merged=h.api.fusionarCajas(a,b);assert.equal(merged.revisionesImporte.find(row=>row.id===old.id).estado,"sustituido");
      assert.equal(merged.revisionesImporte.find(row=>row.id===next.id).estado,"confirmado");
    }
  }
  if(process.env.FINO_TEST_MONEY_SUPERSESSION_BASELINE)throw Error("La versión anterior debía rechazar una nueva revisión por money-pending.");
  for(const change of ["remote","local","pointer","old-choice","pro","account"]){
    const h=setup(),comparison=await h.compare();
    if(change==="remote")h.e.sources.get("users/A").transactions[0].updatedAt=500;
    if(change==="local")h.ctx.setTransactions(rows=>rows.map(row=>row.id===10?{...row,amount:70}:row));
    if(change==="pointer")comparison.replaces="money-another-operation";
    if(change==="old-choice")h.e.screen.current.revisionesImporte[0].chosen="local-personal";
    if(change==="pro")h.e.premium=false;
    if(change==="account")h.e.active=false;
    await assert.rejects(h.confirm(comparison),/changed|needs-pro|obsolete/);assert.equal(h.e.writes,0);assert.equal(h.e.calls,0);
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte,[h.old]);
  }
  for(const failure of ["stage-rollback","stage-encrypt","offline","final-rollback"]){
    const h=setup(),comparison=await h.compare(),send=h.e.send;
    if(failure==="stage-rollback")h.e.failure="rollback";
    if(failure==="stage-encrypt")h.e.encryptFailure=true;
    if(failure==="offline")h.e.send=async()=>{throw Error("offline");};
    if(failure==="final-rollback")h.e.send=async(...args)=>{const result=await send(...args);h.e.failure="rollback";return result;};
    let ok;try{ok=await h.confirm(comparison);}catch(error){assert.match(error.message,/offline/);}
    assert.notEqual(ok,true);assert.equal(h.e.rows.current[0].amount,80);
    const journal=h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte;
    if(failure.startsWith("stage-")){assert.deepEqual(journal,[h.old]);assert.equal(h.e.calls,0);continue;}
    assert.equal(journal.length,2);assert.equal(journal[0].estado,"sustituido");assert.equal(journal[1].estado,"pendiente");
    await assert.rejects(h.api.withPrivateBoxCloudOperation("A",async()=>{throw Error("no debe llegar a la nube ordinaria");}),/pending/);
    const pending=clone(journal[1]),saved=clone(h.disk(h.api.STORAGE_KEYS.cajasDinero));
    const reopened=createMoneyBatchHarness(null,pending,saved,clone(h.e.rows.current));all.push(reopened);
    reopened.e.send=async(payload,endpoint)=>{assert.equal(endpoint,"recoverPrivateBoxMoney");return {data:moneyAcknowledgement(payload)};};
    const port={...h.port,boxes:()=>reopened.e.screen.current,local:reopened.ctx.readPrivateBoxMoneyLocal,
      commit:(before,entry,ack,lease,current)=>reopened.ctx.commitPrivateBoxMoney(before,entry,ack,lease,current,reopened.setBoxes)};
    assert.equal(await reopened.api.reintentarImporteCaja("A",pending,port),true);
    const after=reopened.disk(reopened.api.STORAGE_KEYS.cajasDinero).revisionesImporte;
    assert.equal(after[0].estado,"sustituido");assert.equal(after[1].estado,"confirmado");assert.deepEqual(after[0].local,h.old.local);
  }
  {
    const h=setup(),comparison=await h.compare();h.e.send=async()=>{throw Error("offline");};
    await assert.rejects(h.confirm(comparison),/offline/);
    const before=clone(h.e.screen.current),old=before.revisionesImporte[1];
    const entry=h.api.prepararRevisionImporte(before,h.e.rows.current,h.e.deleted.current,h.e.sources.get("cajas/A"),h.e.sources.get("users/A").transactions,[],"A","PEN","money-third-operation",h.old.local.movement.id,"local-box",1,old.id);
    assert.equal(entry.version,old.version+1,"un reloj atrasado no reutiliza la versión anterior");
    const next=h.api.conservarOriginalesImporte(before,h.e.rows.current,h.e.deleted.current,entry,"A","PEN");
    assert.equal(next.revisionesImporte.length,3);assert.deepEqual(next.revisionesImporte.map(row=>row.estado),["sustituido","sustituido","pendiente"]);
    assert.doesNotThrow(()=>h.api.validarCajas(next));
    const byId=new Map(next.revisionesImporte.map(row=>[row.id,row]));
    assert.equal(byId.get(h.old.id).reemplazadaPor,old.id);assert.equal(byId.get(old.id).reemplazadaPor,entry.id);
    for(const malformed of [
      next.revisionesImporte.slice(1),
      next.revisionesImporte.map(row=>row.id===old.id?{...row,reemplaza:undefined}:row),
      next.revisionesImporte.map(row=>row.id===entry.id?{...row,version:old.version}:row),
      next.revisionesImporte.map(row=>row.id===old.id?{...row,reemplazadaPor:h.old.id}:row),
      next.revisionesImporte.map(row=>row.id===entry.id?{...row,uid:"B"}:row),
    ])assert.throws(()=>h.api.validarCajas({...next,revisionesImporte:malformed}),/invalid-data/);
    assert.throws(()=>h.api.conservarRevisionImporte(before,{...old,estado:"sustituido",reemplazadaPor:entry.id}),/changed/);
    const detached=h.api.sustituirRevisionImporte(before,entry);entry.local.personal.notes="No alterar la copia guardada";
    assert.notEqual(detached.revisionesImporte[2].local.personal.notes,entry.local.personal.notes);
  }
  {
    const h=setup();const old=h.old;
    const fifty={...h.e.screen.current,revisionesImporte:[old,...Array.from({length:49},(_,i)=>({...clone(old),id:`money-confirmed-${String(i).padStart(4,"0")}`,estado:"confirmado"}))]};
    const entry=h.api.prepararRevisionImporte(fifty,h.e.rows.current,h.e.deleted.current,h.e.sources.get("cajas/A"),h.e.sources.get("users/A").transactions,[],"A","PEN","money-next-operation",old.local.movement.id,"remote-box",300,old.id);
    assert.throws(()=>h.api.sustituirRevisionImporte(fifty,entry),/history-full/);assert.equal(fifty.revisionesImporte[0].estado,"pendiente");assert.equal(fifty.revisionesImporte.length,50);
    const huge={...clone(old),padding:""};huge.padding="a".repeat(150000-Buffer.byteLength(JSON.stringify({...huge,estado:"confirmado"}),"utf8"));
    assert.doesNotThrow(()=>h.api.validarCajas({...h.e.screen.current,revisionesImporte:[huge]}));
    assert.throws(()=>h.api.sustituirRevisionImporte({...h.e.screen.current,revisionesImporte:[huge]},entry),/history-full/);
    assert.equal(huge.estado,"pendiente");
  }
  {
    const h=setup();h.e.premium=false;await assert.rejects(h.compare(),/needs-pro/);assert.equal(h.e.sourceReads??0,0);
    h.e.premium=true;h.e.sources.get("users/A").transactions[0].notes="Nota diferente";
    await assert.rejects(h.compare(),/invalid-review/);assert.equal(h.e.writes,0);assert.equal(h.e.screen.current.revisionesImporte.length,1);
  }
  {
    const h=setup();let release,started;
    const gate=new Promise(done=>release=done),sent=new Promise(done=>started=done);
    h.e.sources.get("users/A").transactions=[clone(h.old.remote.personal)];
    h.e.sources.get("cajas/A").movimientos=[clone(h.old.remote.movement)];
    h.e.send=async payload=>{
      if(payload.id===h.old.id){started();await gate;}
      const result=moneyResult(payload);
      h.e.sources.get("users/A").transactions=[clone(result.personal)];h.e.sources.get("cajas/A").movimientos=[clone(result.movement)];
      return {data:moneyAcknowledgement(payload)};
    };
    const old=h.api.withPrivateBoxMoneyReview("A",async lease=>{
      const ack=await h.api.requestPrivateBoxMoneyReview("A",h.old,lease,h.port.local,h.port.current);
      return h.port.commit(h.e.screen.current,h.old,ack,lease,h.port.current);
    }).catch(error=>error);
    await sent;const comparing=h.compare();release();
    assert.match((await old).message,/changed/,"la respuesta de la cola vieja se invalida antes de corregir el celular");
    const comparison=await comparing;assert.equal(comparison.remote.transactions[0].updatedAt,h.old.version);
    assert.equal(h.e.writes,0);assert.equal(h.e.screen.current.revisionesImporte[0].estado,"pendiente");
    assert.equal(await h.confirm(comparison),true);assert.equal(h.e.rows.current[0].updatedAt,h.e.screen.current.revisionesImporte[1].version);
    assert.ok(h.e.rows.current[0].updatedAt>h.old.version);
  }
}finally{for(const h of all)h.e.db.close();}
const bundle=await esbuild.build({entryPoints:["components/PrivateBoxMoneyReview.tsx"],bundle:true,platform:"node",format:"cjs",jsx:"automatic",write:false,alias:{"@":process.cwd()},logLevel:"silent",plugins:[{name:"render-only",setup(b){
  b.onResolve({filter:/^(react|react-native|react\/jsx-runtime)$/},args=>({path:args.path,namespace:"ui"}));
  b.onLoad({filter:/.*/,namespace:"ui"},args=>({contents:args.path==="react"?"export const useState=()=>[true,()=>{}];":args.path==="react/jsx-runtime"?"export const Fragment='Fragment',jsx=(type,props)=>({type,props}),jsxs=jsx;":"export const Text='Text', View='View', TouchableOpacity='Button';",loader:"js"}));
}}]});
const module={exports:{}};new Function("module","exports","require",bundle.outputFiles[0].text)(module,module.exports,require);
const h=createMoneyBatchHarness(),old=h.e.screen.current.revisionesImporte[0];
try{
  const next={...clone(old),id:"money-new-operation",version:old.version+1,reemplaza:old.id};
  const past={...clone(old),estado:"sustituido",reemplazadaPor:next.id};
  const nodes=[];const walk=node=>{if(Array.isArray(node)){node.forEach(walk);return;}if(node&&typeof node==="object"&&node.props){nodes.push(node);walk(node.props.children);}};
  walk(module.exports.default({comparison:null,reviews:[past,next],candidates:[],message:null,busy:false,premium:true,t:key=>key,compare(){},choose(){},retry(){},reviewAgain(){},cancel(){}}));
  const text=nodes.filter(node=>node.type==="Text").map(node=>JSON.stringify(node.props.children)).join("\n");
  assert.ok(text.includes("boxes.moneySuperseded"));assert.ok(text.includes("boxes.moneyReviewAgain"));
  assert.equal(nodes.filter(node=>node.type==="Button"&&JSON.stringify(node.props.children).includes("boxes.moneyRetry")).length,1,"la elección sustituida no tiene botón para reenviarse");
}finally{h.e.db.close();}
const screen=fs.readFileSync("screens/Cajas.tsx","utf8");
assert.match(screen,/comparison\.replaces\s*\?\s*"boxes.moneyReviewAgainConfirm"/);
assert.match(screen,/compararImporteCaja\(accountUid, entry\.local\.movement\.id, moneyPort\(\), entry\.id\)/);
console.log("Sustitución de elección: código/contexto/SQLite originales, originales anteriores/nuevos, lote conjunto, cola pausada, fallos/reinicio/versiones/límites/cadena y componente comprobados. Android pendiente.");
