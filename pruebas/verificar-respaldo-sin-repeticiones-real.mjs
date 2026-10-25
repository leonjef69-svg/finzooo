import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { createSourceReader } from './helpers/source-reader.mjs';
const require = createRequire(import.meta.url);
const { canonical } = require('../functions/src/private-box-money-shared.js');
const read = createSourceReader({revision:process.env.FINO_BACKUP_LOOP_BASELINE || ''});
const source = read('contexts/AppDataContext.tsx');
const ast = ts.createSourceFile('context.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let apply;
const effects = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast)==='applyNewerCloudFields') apply=node.initializer.arguments[0].getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast)==='useEffect') {
    const code=node.arguments[0]?.getText(ast)||'';
    if(code.includes('void saveCloudData(uid, datosParaLaNube('))effects.personal=code;
    if(code.includes('void subirNegocio(uid, datosNegocio,'))effects.business=code;
  }
  ts.forEachChild(node,visit);
}
visit(ast);
const compile=(code,scope)=>vm.runInNewContext(ts.transpile(`(${code})`,{target:ts.ScriptTarget.ES2022}),scope);
const output=buildSync({stdin:{contents:'export * from "./utils/recordMerge";export * from "./utils/cloudFieldMerge";',resolveDir:process.cwd(),sourcefile:'original-backup-merge.ts'},bundle:true,platform:'node',format:'cjs',write:false,alias:{'@':process.cwd()}}).outputFiles[0].text;
const module={exports:{}};
new Function('module','exports','require',output)(module,module.exports,require);
const originals=module.exports;
const clone=v=>JSON.parse(JSON.stringify(v));
const reverse=v=>Array.isArray(v)?v.map(reverse):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverse(x)])):v;
{
  const data={syncFormat:2,hasOnboarded:true,userName:'Prueba',userPhoto:null,userCurrency:'PEN',userLanguage:'es',isPremium:true,
    budgets:{'2026-10':50},categoryBudgets:{},transactions:[],deletedTransactionIds:[],deletedGoalIds:[],
    goals:[{id:1,creationId:'meta-prueba',name:'Laptop',target:50,saved:10,funding:{format:1,base:10,changes:{},changeTypes:{},cancelledExpenses:{}}}],
    pagosProgramados:[],merchantLearned:{},categoryOverrides:{},categoriasPropias:[],carryoverCleared:[],iconosFavoritos:[],syncUpdatedAt:{}};
  const writes=[];
  const scope={...originals,canonical,auth:{currentUser:{uid:'A'}},privateBoxCloudResponseCurrent:()=>scope.valid,
    valid:true,cloudFieldsRef:{current:data},transactionsLive:{current:data.transactions},goalsLive:{current:data.goals},
    deletedTransactionIdsRef:{current:[]},deletedGoalIdsRef:{current:[]},cloudSyncMetaRef:{current:{}},
    goalWriteReserved:{current:false},paymentWriteReserved:{current:null},pagosProgramadosLive:{current:[]},
    assertPrivateBoxMoneyLocalMutation(){},STORAGE_KEYS:{},saveJSON(){},saveOverrides(){},savePropias(){},saveFavoritos(){},getFavoritos:()=>[],userEmail:'',userCountry:'PE',
    setRespaldoFallo:error=>{throw Error('Unexpected validation failure '+error);}};
  for(const name of ['UserName','UserPhoto','UserCurrency','UserLanguage','Budgets','CategoryBudgets','PagosProgramados','MerchantLearned','CategoryOverridesState','CategoriasPropiasState','CarryoverCleared','IconosFavoritosState','CloudSyncMeta'])scope['set'+name]=()=>writes.push(name);
  for(const [name,ref] of [['Transactions','transactionsLive'],['Goals','goalsLive'],['DeletedTransactionIds','deletedTransactionIdsRef'],['DeletedGoalIds','deletedGoalIdsRef']])scope['set'+name]=v=>{scope[ref].current=v;writes.push(name);};
  const receive=compile(apply,scope);
  receive(clone(data));
  writes.length=0;
  for(let i=0;i<60;i++){
    // La copia local también puede venir con claves reordenadas al cargarla;
    // la unión normaliza funding y antes se confundía con otra edición.
    scope.goalsLive.current=reverse(scope.goalsLive.current);
    scope.cloudFieldsRef.current={...scope.cloudFieldsRef.current,goals:scope.goalsLive.current};
    receive(reverse(scope.cloudFieldsRef.current));
  }
  assert.deepEqual(writes,[],'las mismas metas/campos devueltos con otro orden de claves no reinician el guardado');
  const incoming=clone(scope.cloudFieldsRef.current);
  incoming.transactions=[{id:22,creationId:'nuevo-aviso',type:'income',amount:6.5,date:'2026-10-25',category:'otros',description:'Yape',method:'transfer',notes:'',origin:'manual'}];
  receive(incoming);
  assert.ok(writes.includes('Transactions'),'un movimiento realmente nuevo sí se incorpora');
  writes.length=0;scope.valid=false;
  assert.equal(receive(incoming),false,'una respuesta de otra revisión/cuenta no se aplica');
  assert.deepEqual(writes,[]);
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
async function flush(){for(let i=0;i<25;i++)await Promise.resolve();}
function backup(kind){
  const tasks=new Map(),jobs=[],statuses=[];let now=0,next=0;
  const business={negocios:[],productos:[],ventas:[],movimientos:[],syncFormat:2,deleted:{negocios:[],productos:[],ventas:[],movimientos:[]}};
  const scope={ready:true,hasOnboarded:true,uid:'A',isPremium:true,cloudBackupEnabled:true,
    localSessionVersion:{current:1},auth:{currentUser:{uid:'A'}},cloudBackupPreference:{current:{enabled:true,revision:1}},
    setRespaldoFallo:v=>statuses.push(v),setRespaldoNegocioFallo:v=>statuses.push(v),
    setTimeout:(fn,delay)=>{const id=++next;tasks.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>tasks.delete(id),
    datosParaLaNube:()=>({transactions:[]}),datosNegocio:business,datosNegocioLive:{current:business},
    mergeBusinessData:()=>reverse(business),canonical,setDatosNegocio:()=>{scope.applied++;},
    privateBoxCloudResponseCurrent:()=>true,applyNewerCloudFields:()=>{scope.applied++;},applied:0,
    saveCloudData:()=>{const job=deferred();jobs.push(job);return job.promise;},subirNegocio:()=>{const job=deferred();jobs.push(job);return job.promise;}};
  const cleanup=compile(effects[kind],scope)();
  const tick=async ms=>{const until=now+ms;for(let turn=0;turn<100;turn++){const first=[...tasks.entries()].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;tasks.delete(first[0]);first[1].fn();await flush();}now=until;await flush();};
  return {scope,jobs,statuses,tick,cleanup,success:()=>kind==='personal'?{ok:true,data:{}}:reverse(business),fail:()=>{const job=jobs.at(-1);kind==='personal'?job.resolve({ok:false,motivo:'sin-internet'}):job.reject(Object.assign(Error('offline'),{code:'unavailable'}));}};
}
for(const kind of ['personal','business']){
  {
    const h=backup(kind);await h.tick(1500);await h.tick(15_000);
    assert.equal(h.statuses.at(-1),'demora',kind+': una respuesta lenta no queda anunciada como guardado normal indefinidamente');
    assert.equal(h.jobs.length,1,'no se lanza una segunda copia mientras no se conoce el resultado');
    h.jobs[0].resolve(h.success());await flush();assert.equal(h.statuses.at(-1),null,'la confirmación tardía vigente sí completa el respaldo');
    if(kind==='business')assert.equal(h.scope.applied,0,'el orden de claves de Negocio tampoco vuelve a guardar datos idénticos');
    await h.tick(60_000);assert.equal(h.jobs.length,1);h.cleanup();
  }
  {
    const h=backup(kind);await h.tick(1500);h.fail();await flush();
    await h.tick(5_000);assert.equal(h.jobs.length,2,'primer reintento de red');h.fail();await flush();
    await h.tick(15_000);assert.equal(h.jobs.length,3,'segundo reintento de red');h.fail();await flush();
    await h.tick(120_000);assert.equal(h.jobs.length,3,'se detiene después de dos reintentos; no crea un bucle');
    assert.equal(h.statuses.at(-1),'sin-internet');h.cleanup();
  }
  {
    const h=backup(kind);await h.tick(1500);
    kind==='personal'?h.jobs[0].resolve({ok:false,motivo:'permisos'}):h.jobs[0].reject(Object.assign(Error('permission-denied'),{code:'permission-denied'}));
    await flush();await h.tick(120_000);assert.equal(h.jobs.length,1,'un rechazo de permisos no se reintenta automáticamente');h.cleanup();
  }
  for(const mode of ['pause','new-choice','session','cleanup']){
    const h=backup(kind);await h.tick(1500);
    if(mode==='pause')h.scope.cloudBackupPreference.current.enabled=false;
    if(mode==='new-choice')h.scope.cloudBackupPreference.current.revision++;
    if(mode==='session')h.scope.auth.currentUser={uid:'B'};
    if(mode==='cleanup')h.cleanup();
    h.jobs[0].resolve(h.success());await flush();await h.tick(120_000);
    assert.equal(h.scope.applied,0,'una respuesta obsoleta no modifica la cuenta');
    assert.equal(h.jobs.length,1,'una operación obsoleta no programa otra copia');h.cleanup();
  }
  {
    const h=backup(kind);await h.tick(1500);h.fail();await flush();h.cleanup();
    await h.tick(120_000);assert.equal(h.jobs.length,1,'salir cancela un reintento pendiente');
  }
}
console.log('Respaldo original: 60 recepciones equivalentes sin nuevas escrituras; cambios reales, espera sin duplicados, confirmación tardía, dos reintentos de red, permisos y cancelación/cuenta comprobados con IO y reloj adaptados.');
