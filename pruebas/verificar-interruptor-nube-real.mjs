import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";
const { canonical } = createRequire(import.meta.url)("../functions/src/private-box-money-shared.js");

const source = createSourceReader({ revision: process.env.FINO_CLOUD_TOGGLE_BASELINE ?? "" })("contexts/AppDataContext.tsx");
const saved = [], state = [], failures = [];
function operation({ premium = true, save = true } = {}) {
  const deps = {
    isPremium: premium,
    cloudBackupEnabled: true,
    cloudBackupPreference: { current: { enabled: true, saved: true, revision: 0 } },
    localSessionVersion: { current: 0 }, auth: { currentUser: { uid: "A" } },
    captureAccountTask: (_uid, current) => ({ current }),
    STORAGE_KEYS: { cloudBackupEnabled: "cloudBackupEnabled" },
    tRef: { current: key => key },
    saveJSONNow: async (key, value) => { saved.push([key, value]); return save; },
    setCloudBackupEnabledState: value => state.push(value),
    setRespaldoFallo: value => failures.push(value),
    setRespaldoNegocioFallo() {}, setCloudBackupRevision() {},
  };
  return handlerOriginal("contexts/AppDataContext.tsx", "changeCloudBackupEnabled", deps, source);
}

await operation()(false);
assert.deepEqual(saved.at(-1), ["cloudBackupEnabled", false], "pausar queda guardado localmente");
assert.equal(state.at(-1), false, "la app refleja la pausa después de guardarla");
await operation()(true);
assert.deepEqual(saved.at(-1), ["cloudBackupEnabled", true], "reactivar también persiste la elección");
assert.equal(state.at(-1), true, "la app refleja la reactivación confirmada");
assert.equal(failures.at(-1), "pendiente", "reactivar no anuncia copia al día antes de recibir confirmación");

const before = saved.length;
await assert.rejects(operation({ premium: false })(true), /settings\.backupNeedsPaid/);
assert.equal(saved.length, before, "una cuenta sin acceso de pago no enciende respaldo");

const writesBeforeFailure = saved.length;
const stateBeforeFailure = state.length;
await assert.rejects(operation({ save: false })(false), /toast\.localSaveFailed/);
assert.equal(saved.length, writesBeforeFailure + 1, "se intentó persistir la pausa");
assert.equal(state.length, stateBeforeFailure + 2, "un error de disco revierte la presentación inmediata");
assert.equal(state.at(-2), false); assert.equal(state.at(-1), true);

function deferred() { let resolve;const promise=new Promise(accept=>{resolve=accept;});return {promise,resolve}; }
function immediate() {
  const jobs=[],s={isPremium:true,cloudBackupEnabled:true,cloudBackupPreference:{current:{enabled:true,saved:true,revision:0}},localSessionVersion:{current:1},auth:{currentUser:{uid:'A'}},
    STORAGE_KEYS:{cloudBackupEnabled:'cloudBackupEnabled'},tRef:{current:key=>key},setRespaldoFallo(){},setRespaldoNegocioFallo(){},setCloudBackupRevision(){},
    setCloudBackupEnabledState:value=>{s.enabled=value;},saveJSONNow:(_key,value)=>{const job=deferred();jobs.push({...job,value});return job.promise;},
    captureAccountTask:(_uid,current)=>{const version=s.localSessionVersion.current;return {current:()=>current()&&s.localSessionVersion.current===version};},enabled:true};
  return {s,jobs,run:handlerOriginal('contexts/AppDataContext.tsx','changeCloudBackupEnabled',s,source)};
}
{
 const h=immediate(),first=h.run(false);
 assert.equal(h.s.enabled,false,'el interruptor responde al toque, antes de cifrar o guardar');
 assert.equal(h.s.cloudBackupPreference.current.enabled,false,'la pausa frena callbacks antes del próximo dibujado');
 const second=h.run(true),third=h.run(false);
 h.jobs[0].resolve(false);await first;assert.equal(h.s.enabled,false,'un fallo antiguo no revierte el último toque');
 h.jobs[1].resolve(true);await second;assert.equal(h.s.enabled,false);
 h.jobs[2].resolve(true);await third;assert.equal(h.s.cloudBackupPreference.current.saved,false);
}
{
 const h=immediate(),first=h.run(false),second=h.run(true);
 h.jobs[0].resolve(true);await first;h.jobs[1].resolve(false);
 await assert.rejects(second,/toast.localSaveFailed/);assert.equal(h.s.enabled,false,'fallo vigente vuelve a la última elección realmente guardada');
}
{
 const h=immediate(),pending=h.run(false);h.s.localSessionVersion.current++;
 h.jobs[0].resolve(false);await pending;assert.equal(h.s.enabled,false,'respuesta de la sesión anterior no publica un rebote ni un aviso en otra cuenta');
}
{
 const ast=ts.createSourceFile('context.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 function visit(node){if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='respaldoAlDia')expression=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);
 const scope={uid:'A',isPremium:true,cloudBackupEnabled:true,respaldoFallo:null,respaldoNegocioFallo:'negocio'};
 assert.equal(vm.runInNewContext(expression,scope),false,'éxito Personal no oculta un fallo del respaldo de Negocio');
 scope.respaldoNegocioFallo=null;assert.equal(vm.runInNewContext(expression,scope),true);
 scope.respaldoFallo='pendiente';assert.equal(vm.runInNewContext(expression,scope),false,'encender no equivale a confirmar la copia');
}

{
 const ast=ts.createSourceFile('context.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),effects={};
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
  const callback=node.arguments[0]?.getText(ast)??'';
  if(callback.includes('void saveCloudData(uid, datosParaLaNube('))effects.personal=callback;
  if(callback.includes('void subirNegocio(uid, datosNegocio,'))effects.business=callback;
 }ts.forEachChild(node,visit);}visit(ast);
 for(const kind of ['personal','business'])for(const mode of ['before-timer','late-pause','new-choice','valid']) {
  const pending=deferred(),statuses=[],business={},state={starts:0,applied:0};let timer;
  const scope={ready:true,hasOnboarded:true,uid:'A',isPremium:true,cloudBackupEnabled:true,
   localSessionVersion:{current:1},auth:{currentUser:{uid:'A'}},cloudBackupPreference:{current:{enabled:true,revision:1}},
   setRespaldoFallo:value=>statuses.push(value),setRespaldoNegocioFallo:value=>statuses.push(value),
   setTimeout:callback=>{timer=callback;return 1;},clearTimeout(){},datosParaLaNube:()=>({}),
   saveCloudData:()=>{state.starts++;return pending.promise;},subirNegocio:()=>{state.starts++;return pending.promise;},
   datosNegocio:business,datosNegocioLive:{current:business},mergeBusinessData:()=>business,canonical,setDatosNegocio:()=>{state.applied++;},
   privateBoxCloudResponseCurrent:()=>true,applyNewerCloudFields:()=>{state.applied++;}};
  vm.runInNewContext(ts.transpile(`globalThis.run=(${effects[kind]});`,{target:ts.ScriptTarget.ES2022}),scope);scope.run();
  assert.equal(statuses.at(-1),'pendiente','programar la copia no equivale a confirmarla');
  if(mode==='before-timer')scope.cloudBackupPreference.current.enabled=false;
  timer();assert.equal(state.starts,mode==='before-timer'?0:1);
  if(mode==='late-pause')scope.cloudBackupPreference.current.enabled=false;
  if(mode==='new-choice')scope.cloudBackupPreference.current.revision++;
  pending.resolve(kind==='personal'?{ok:true,data:{}}:business);
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.deepEqual(statuses,mode==='valid'?['pendiente',null]:['pendiente'],'solo la elección vigente acepta el resultado del respaldo');
  assert.equal(state.applied,kind==='personal'&&mode==='valid'?1:0,'pausar o volver a tocar no acepta datos tardíos');
 }
}
console.log("Interruptor original inmediato: último toque, persistencia/rollback, respuestas/timers viejos, sesión, Pro y confirmación Personal/Negocio comprobados.");
