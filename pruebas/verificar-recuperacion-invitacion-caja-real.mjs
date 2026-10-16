import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const baseline = process.env.FINO_TEST_BOX_RECOVERY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error('Hash inválido');
const read = file => baseline ? execFileSync('git', ['show', `${baseline}:${file}`], {encoding:'utf8'}) : fs.readFileSync(file,'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
let duringHash = () => {};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports:{}}; modules.set(file,module);
  const imports = name => {
    if (name === 'expo-crypto') return {CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async (_algorithm,text) => {duringHash(); return createHash('sha256').update(text).digest('hex');}};
    if (name === 'firebase/functions') return {};
    if (name === '@/utils/firebase') return {};
    if (name === '@/utils/accountTask') return {};
    if (name.startsWith('@/')) return load(name.slice(2)+(name.endsWith('.js')?'':name.startsWith('@/functions/')?'.js':'.ts'));
    if (name === './utf8') return load('utils/utf8.ts');
    return createRequire(new URL('../'+file,import.meta.url))(name);
  };
  // El auxiliar nuevo solo se invoca en la versión nueva. La regresión se
  // decide ejecutando la lectura/pantalla anterior, no por un import ausente.
  const code=fs.readFileSync(file,'utf8');
  vm.runInNewContext(ts.transpile(code,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),{module,exports:module.exports,require:imports});
  return module.exports;
}
const cajas=load('utils/cajas.ts'), migration=load('utils/boxMigration.ts'), recovery=load('utils/boxConversionRecovery.ts'), personal=load('utils/privateBoxPersonal.ts');
const box={id:'source-a',nombre:'A',creadaEn:1,sharingPending:true,sharingAttempt:'intent-a-123456789'};
const other={id:'source-b',nombre:'A',creadaEn:2}; // Mismo nombre NO significa duplicado.
const row={id:'movement-a',cajaId:box.id,tipo:'ingreso',monto:11111111,descripcion:'Aporte',fecha:'2026-10-16',creadoEn:3,personalTransactionId:10};
const tx={id:10,type:'expense',amount:row.monto,internalTransfer:'box',internalTransferSpaceId:box.id,internalTransferLink:row.id};
const local={cajas:[box,other],movimientos:[row],cajasBorradas:[],movimientosBorrados:[]};
const receipt={uid:'owner',sourceId:box.id,targetId:'owner_'+box.id,name:box.nombre,currency:'PEN',createdAt:1,completedAt:4,
  digest:await migration.huellaCaja(box,[row],'PEN'),links:[{personalId:10,movementId:row.id}]};
const remote=migration.retirarCajaConvertida(local,receipt);
// Cambiar OTRA Caja mientras SHA espera no invalida el origen ni pierde la
// edición ajena. Cambiar la Caja convertida o sus enlaces sí lo invalida.
{
 let live={data:plain(local),rows:[plain(tx)]};
 duringHash=()=>{live={...live,data:{...live.data,cajas:live.data.cajas.map(b=>b.id===other.id?{...b,nombre:'Editada'}:b)}};};
 const plan=await recovery.prepararRetiroCajaConfirmada(receipt,'owner','PEN',()=>live);
 assert.equal(plan.before,live.data); assert.equal(plan.data.cajas.length,1); assert.equal(plan.data.cajas[0].nombre,'Editada');
 assert.equal(plan.upserts[0].amount,tx.amount); assert.equal(plan.upserts[0].internalTransferSpaceId,receipt.targetId);
 personal.validatePrivateBoxPatch(plan.before,plan.data,live.rows,plan.upserts,[],'owner');
 assert.equal(personal.patchPrivateBoxPersonal(live.rows,[],plan.upserts,[]).transactions[0].amount,tx.amount);
 duringHash=()=>{live={data:{...plain(local),movimientos:[{...row,monto:123}]},rows:[tx]};};
 live={data:plain(local),rows:[tx]};
 await assert.rejects(recovery.prepararRetiroCajaConfirmada(receipt,'owner','PEN',()=>live),/cajas-sync-conflict/);
 assert.equal(live.data.movimientos[0].monto,123);
 duringHash=()=>{};
 await assert.rejects(recovery.prepararRetiroCajaConfirmada(receipt,'other-owner','PEN',()=>({data:local,rows:[tx]})),/cajas-sync-conflict/);
 await assert.rejects(recovery.prepararRetiroCajaConfirmada(receipt,'owner','USD',()=>({data:local,rows:[tx]})),/cajas-sync-conflict/);
 await assert.rejects(recovery.prepararRetiroCajaConfirmada(receipt,'owner','PEN',()=>({data:local,rows:[{...tx,amount:1}]})),/cajas-sync-conflict/);
 await assert.rejects(recovery.prepararRetiroCajaConfirmada({...receipt,links:[]},'owner','PEN',()=>({data:local,rows:[tx]})),/cajas-sync-conflict/);
 const done=await recovery.prepararRetiroCajaConfirmada(receipt,'owner','PEN',()=>({data:remote,rows:[{...tx,internalTransferSpaceId:receipt.targetId}]}));
 assert.equal(done.data,remote); assert.equal(done.upserts.length,0,'repetir la recuperación no devuelve ni duplica dinero');
}
const screen=read('screens/Cajas.tsx'), tree=ts.createSourceFile('Cajas.tsx',screen,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
// El detalle ya no puede reaparecer como la lista/formulario de unión antiguo.
{
 const code=read('screens/SharedBoxes.tsx'), ast=ts.createSourceFile('SharedBoxes.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fallback;
 function find(node) {if(ts.isConditionalExpression(node)&&node.condition.getText(ast)==='!caja || cajasOcultas.has(caja.id)') fallback=node;ts.forEachChild(node,find);}
 find(ast);assert.ok(fallback);
 const s={caja:null,cajasOcultas:new Set(),onAllBoxes:undefined,cajas:[],busy:false,t:key=>key,boton:()=>({type:'legacy-join'}),
  React:{createElement:(type,props,...children)=>({type,props,children}),Fragment:'fragment'},View:'View'};
 const result=vm.runInNewContext(ts.transpile(`(${fallback.getText(ast)})`,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}),s);
 assert.equal(result,null,'sin Caja elegida no reaparece una segunda lista ni formulario antiguo');
}
let focus;
function visit(node) {
 if (ts.isCallExpression(node)&&node.expression.getText(tree)==='useFocusEffect'&&node.arguments[0]?.getText(tree).includes('bajarCajas(uid)')) focus=node.arguments[0].arguments[0].getText(tree);
 ts.forEachChild(node,visit);
}
visit(tree); assert.ok(focus,'ejecutar la lectura original de Cajas');
// Ejecutar la fuente real de la colección pintada, no deduplicar por nombre
// ni sumar dos veces el mismo dinero cuando el índice remoto llega primero.
{
 let painted, initializer;
 function find(node) {
  if(ts.isCallExpression(node)&&node.expression.getText(tree).endsWith('.map')&&node.arguments[0]?.getText(tree).includes('key={`shared:')) painted=node.expression.expression.getText(tree);
  if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='compartidasEnLista') initializer=node.initializer.getText(tree);
  ts.forEachChild(node,find);
 }
 find(tree);assert.ok(painted);
 const shared=[{id:receipt.targetId,nombre:box.nombre},{id:'another-owner_'+box.id,nombre:box.nombre}];
 const scope={datos:local,accountUid:'owner',compartidas:shared};
 const code=initializer?`const compartidasEnLista=${initializer}; ${painted};`:painted;
 const result=vm.runInNewContext(ts.transpile(code,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}),scope);
 assert.equal(result.length,1,'no pintar la misma conversión como otra Caja');
 assert.equal(result[0].id,shared[1].id,'una Caja del mismo nombre, pero distinta identidad, se conserva');
 assert.equal(local.cajas.length,2,'el filtro visual no borra ni modifica ninguna fuente');
}
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
function harness() {
 const s={personalReady:true,hasOnboarded:true,accountUid:'owner',userCurrency:'PEN',isPremium:true,premiumForSync:{current:true},
  refreshVersion:1,requestedRefresh:{current:1},conversionEnCurso:{current:false},recuperacionConversionEnCurso:{current:false},guardandoRef:{current:false},
  datosActuales:{current:plain(local)},personalActuales:{current:[plain(tx)]},borradosActuales:{current:[]},nubeConfirmadaPara:{current:null},
  cuentaActual:()=>true,hasUnreadableLocalData:()=>false,revisionCajasEnMemoria:()=>1,leerCajasEnMemoria:()=>s.datosActuales.current,
  loadJSON:async()=>s.datosActuales.current,STORAGE_KEYS:{cajasDinero:'boxes'},CAJAS_VACIAS:cajas.CAJAS_VACIAS,validarCajas:cajas.validarCajas,
  fusionarCajasProtegidas:cajas.fusionarCajasProtegidas,planPrivateBoxRepair:()=>({conflicts:[]}),prepararRetiroCajaConfirmada:recovery.prepararRetiroCajaConfirmada,
  setCloudReady:value=>{s.cloudReady=value;},setNameCopies:()=>{},setReady:()=>{},guardarCajasEnMemoria:()=>{},saveJSON:async()=>{},
  setDatos:value=>{s.datosActuales.current=value;},setSyncIssue:value=>{s.issue=value;},reportSyncError:error=>{s.issue=error.message;},
  privateBoxCloudResponseCurrent:()=>true,reads:0,bajarCajas:async()=>{s.reads++;return remote;},
  captureAccountTask:(_uid,valid)=>({current:valid,wait:async work=>{if(!valid())throw Error('stale');const value=await work();if(!valid())throw Error('stale');return value;}}),
  guardarCambioCaja:async(next,upserts)=>{
   personal.validatePrivateBoxPatch(s.datosActuales.current,next,s.personalActuales.current,upserts,[],'owner');
   s.personalActuales.current=personal.patchPrivateBoxPersonal(s.personalActuales.current,[],upserts,[]).transactions;
   s.datosActuales.current=next;return true;
  }};
 const run=()=>vm.runInNewContext(ts.transpile(`(${focus})()`,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}),s);
 return {s,run};
}
{
 const {s,run}=harness();run();await tick();
 assert.equal(s.issue,null,'un recibo exacto recupera la conversión tras reabrir, no anuncia dos versiones');
 assert.equal(s.cloudReady,true);assert.equal(s.datosActuales.current.cajas.length,1);
 assert.equal(s.datosActuales.current.cajas[0].id,other.id);assert.equal(s.personalActuales.current[0].amount,row.monto);
 assert.equal(s.personalActuales.current[0].internalTransferSpaceId,receipt.targetId);
 run();await tick();assert.equal(s.datosActuales.current.cajas.length,1,'volver a consultar no duplica ni borra otra Caja');
}
{
 const {s,run}=harness();s.conversionEnCurso.current=true;run();await tick();
 assert.equal(s.reads,0,'no releer la fuente antigua mientras se está compartiendo');
 assert.equal(s.datosActuales.current.cajas.length,2);
}
{
 const {s,run}=harness();s.datosActuales.current={...plain(local),movimientos:[{...row,monto:123}]};run();await tick();
 assert.equal(s.issue,'cajas-sync-conflict');assert.equal(s.datosActuales.current.movimientos[0].monto,123);
 assert.equal(s.personalActuales.current[0].internalTransferSpaceId,box.id,'datos distintos nunca se descartan como si fueran la copia confirmada');
}
console.log('Invitación Caja: recuperación exacta, cambios ajenos conservados, saldo intacto y lectura simultánea evitada.');
