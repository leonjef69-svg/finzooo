import assert from "node:assert/strict";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta el cliente original; solo Firebase/red se adaptan. Contra c7dd2ae3
// exige status y reescribe el origen aunque begin pueda verificarlo directamente.
const read=createSourceReader();
const copy=value=>JSON.parse(JSON.stringify(value));
const reason=value=>Object.assign(Error(value),{details:{reason:value}});
function harness() {
  const box={id:"synthetic-box",nombre:"Caja ficticia",creadaEn:1,sharingPending:true,sharingAttempt:"synthetic-attempt"};
  const row={id:"synthetic-move",cajaId:box.id,tipo:"ingreso",monto:6.5,descripcion:"Ficticio",fecha:"2026-10-25",creadoEn:2};
  const receipt={uid:"A",sourceId:box.id,targetId:"A_synthetic-box",name:box.nombre,currency:"PEN",createdAt:1,digest:"a".repeat(64),completedAt:3,links:[]};
  const source={cajas:[box],movimientos:[row],cajasBorradas:[],movimientosBorrados:[]};
  const h={box,row,receipt,source,actions:[],events:[],sourceWrites:0,copies:[],finishes:0,active:true,beginCalls:0,
    beginError:null,statusError:null,statusReceipt:null,beginReceipt:null,sourceMatches:true,rootAttempt:box.sharingAttempt,
    legalError:null,dropAfterBegin:false,uploadOk:true,knownSource:true};
  const auth={get currentUser(){return h.active?{uid:"A"}:null}};
  const task=handlerOriginal("utils/accountTask.ts","captureAccountTask",{auth,getAccountStorageSession:()=>1},read("utils/accountTask.ts"));
  const dependencies={captureAccountTask:task,huellaCaja:async()=>receipt.digest,
    assertSharedContentAccepted:async()=>{h.events.push("legal");if(h.legalError)throw h.legalError},
    confirmarConversionCaja:async(_uid,_id,_digest,_currency,action,attempt)=>{
      h.actions.push(action);h.events.push(action);
      if(action==="status"){if(h.statusError)throw h.statusError;return h.statusReceipt}
      if(action==="begin"){
        assert.equal(attempt,box.sharingAttempt);h.beginCalls++;
        if(h.beginError&&h.beginCalls===1)throw h.beginError;
        if(h.dropAfterBegin)h.active=false;return h.beginReceipt;
      }
      if(action==="finish"){h.finishes++;return receipt}
      throw Error("No debe limpiar/cancelar en estos casos");
    },
    origenCajaConfirmado:()=>h.knownSource,
    subirCajas:async()=>{h.sourceWrites++;h.events.push("upload");return h.uploadOk},
    db:{},doc:(_db,...parts)=>parts.join("/"),collection:(_db,...parts)=>parts.join("/"),
    getDocFromServer:async ref=>{h.events.push(ref.startsWith("cajas/")?"read-source":"read-root");return {exists:()=>true,data:()=>ref.startsWith("cajas/")?source:{migrationProtocol:3,migrationAttemptId:h.rootAttempt,migrationCancelled:false,migrationResetting:false}}},
    validarCajas:value=>value,copiaPrivadaCoincide:()=>h.sourceMatches,
    getDocs:async()=>({docs:[]}),copiedBoxMovementMatches:()=>true,
    sharedBoxMovement:(move,uid)=>({...move,creadoPor:uid}),
    writeBatch:()=>({set:(ref,value)=>h.copies.push({ref,value}),commit:async()=>{h.events.push("copy-ack")}}),
    runTransaction:()=>{throw Error("Un intento nuevo no vuelve al protocolo antiguo")},
  };
  h.run=(allowNew=true)=>handlerOriginal("utils/cloudCajasCompartidas.ts","compartirCajaExistente",dependencies,read("utils/cloudCajasCompartidas.ts"))("A","Persona ficticia",box,[row],"PEN",allowNew);
  return h;
}
{
  const h=harness(),result=await h.run();
  assert.deepEqual(h.actions,["begin","finish"],"la copia vigente elimina status redundante; finish sigue siendo obligatorio");
  assert.equal(h.sourceWrites,0,"no reescribe el mismo origen confirmado por begin");
  assert.equal(h.copies.length,1);assert.equal(h.copies[0].value.monto,6.5);assert.equal(h.copies[0].value.migrationAttemptId,h.box.sharingAttempt);
  assert.ok(h.events.indexOf("read-source")<h.events.indexOf("copy-ack"));assert.ok(h.events.indexOf("read-root")<h.events.indexOf("copy-ack"));
  assert.ok(h.events.indexOf("copy-ack")<h.events.indexOf("finish"));assert.equal(result.conversion,h.receipt);
}
for(const why of ["migration-source-missing","migration-source-changed"]){
  const h=harness();h.beginError=reason(why);await h.run();
  assert.deepEqual(h.actions,["begin","status","begin","finish"]);assert.equal(h.sourceWrites,1);
  assert.ok(h.events.indexOf("status")<h.events.indexOf("upload"),"confirmar ausencia del recibo antes de respaldar un origen rechazado");
}
{
  const h=harness();h.beginReceipt=h.receipt;await h.run();
  assert.deepEqual(h.actions,["begin"]);assert.equal(h.sourceWrites,0);assert.equal(h.copies.length,0);
}
{
  const h=harness();h.beginError=reason("migration-source-changed");h.statusError=reason("migration-source-changed");
  await assert.rejects(h.run(),/migration-source-changed/);assert.equal(h.sourceWrites,0);assert.equal(h.copies.length,0);
}
for(const why of ["migration-cancelled","migration-members-conflict","migration-premium-required","migration-not-owner","unavailable","deadline-exceeded"]){
  const h=harness();h.beginError=reason(why);await assert.rejects(h.run(),new RegExp(why));
  assert.deepEqual(h.actions,["begin"]);assert.equal(h.sourceWrites,0);assert.equal(h.copies.length,0,"no escribe tras error o respuesta incierta");
}
for(const what of ["account","source","attempt"]){
  const h=harness();if(what==="account")h.dropAfterBegin=true;if(what==="source")h.sourceMatches=false;if(what==="attempt")h.rootAttempt="different-attempt";
  await assert.rejects(h.run());assert.equal(h.finishes,0);assert.equal(h.copies.length,0);
}
{
  const h=harness();h.legalError=Error("legal-acceptance-required");h.statusReceipt=h.receipt;await h.run();
  assert.deepEqual(h.actions,["status"]);assert.equal(h.sourceWrites,0,"recuperar no exige elegir documentos de nuevo");
}
{
  const h=harness();h.legalError=Error("legal-acceptance-required");await assert.rejects(h.run(),/legal-acceptance-required/);
  assert.deepEqual(h.actions,["status"]);assert.equal(h.sourceWrites,0);assert.equal(h.copies.length,0);
}
{
  const h=harness();await h.run(false);assert.deepEqual(h.actions,["status","finish"]);assert.equal(h.sourceWrites,0);assert.equal(h.copies.length,0);
}
{
  const h=harness();h.knownSource=false;await h.run();
  assert.deepEqual(h.actions,["status","begin","finish"],"una Caja nueva aún no respaldada conserva la ruta directa anterior, sin un sondeo fallido adicional");
  assert.equal(h.sourceWrites,1);
}
// El ACK de begin debe corresponder a ESTE intento antes de saltar el respaldo.
{
  const fn=handlerOriginal("utils/boxMigration.ts","confirmarConversionCaja",{
    captureAccountTask:()=>({wait:work=>work()}),functions:{},
    httpsCallable:()=>async()=>({data:{complete:false,started:true,attemptId:"attempt"}}),validarCajas:()=>{},
  },read("utils/boxMigration.ts"));
  assert.equal(await fn("A","box","a".repeat(64),"PEN","begin","attempt"),null);
}
for(const response of [{complete:false},{complete:false,started:true,attemptId:"other"},{complete:false,started:false,attemptId:"attempt"}]){
  const fn=handlerOriginal("utils/boxMigration.ts","confirmarConversionCaja",{
    captureAccountTask:()=>({wait:work=>work()}),functions:{},httpsCallable:()=>async()=>({data:response}),validarCajas:()=>{throw Error("No recibo completo")},
  },read("utils/boxMigration.ts"));
  await assert.rejects(fn("A","box","a".repeat(64),"PEN","begin","attempt"),/cajas-sync-conflict/);
}
// La pista local solo evita trabajo repetido: no sirve tras cambiar de cuenta,
// revisar importes, editar el origen o proteger esta Caja por una incidencia.
{
  let proof=true,match=true;
  const source={uid:"A",data:{cajas:[],movimientos:[]},protegidas:[]};
  const deps={ultimaCopiaConfirmada:source,privateBoxCloudResponseCurrent:()=>proof,copiaPrivadaCoincide:()=>match};
  const fn=handlerOriginal("utils/cloudCajas.ts","origenCajaConfirmado",deps,read("utils/cloudCajas.ts"));
  assert.equal(fn("A",{id:"box"},[]),true);
  match=false;assert.equal(fn("A",{id:"box"},[]),false);match=true;
  source.protegidas.push("box");assert.equal(fn("A",{id:"box"},[]),false);source.protegidas=[];
  proof=false;assert.equal(fn("A",{id:"box"},[]),false);proof=true;
  assert.equal(fn("A",{id:"box"},[]),false,"una pista invalidada no revive después");
  const other=handlerOriginal("utils/cloudCajas.ts","origenCajaConfirmado",{...deps,ultimaCopiaConfirmada:source},read("utils/cloudCajas.ts"));
  assert.equal(other("B",{id:"box"},[]),false);
}
console.log("Compartir original: begin/finish sin reescribir copia vigente; origen ausente/cambiado, recuperación, Pro/consentimiento, cuenta/intento y resultados inciertos protegidos. IO adaptado; no acredita servidor ni Android.");
