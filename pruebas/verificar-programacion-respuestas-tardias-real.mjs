// Original scheduling coordinator and settings callbacks; only React/device/storage IO adapted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {build} from 'esbuild';

const baseline=process.env.FINO_LATE_SETTINGS_BASELINE;
const read=file=>baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
const coordinator=read('utils/scheduledExport.ts');
const settings=ts.createSourceFile('settings.tsx',read('screens/ScheduledExportSettings.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let update,mount;
function visit(node){
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='update')update=node.getText(settings);
  if(ts.isCallExpression(node)&&node.expression.getText(settings)==='useEffect'&&node.arguments[0]?.getText(settings).includes('loadSchedule().then'))mount=node.arguments[0].getText(settings);
  ts.forEachChild(node,visit);
}visit(settings);assert.ok(update&&mount);
const mocks={
  storage:`export const loadJSON=async(k,d)=>globalThis.__lateSchedule.saved.get(k)??d;export const saveJSON=(k,v)=>globalThis.__lateSchedule.saved.set(k,v);`,
  platform:`export const Platform={OS:'android'};`,
  notifications:`export const AndroidImportance={DEFAULT:3};export const SchedulableTriggerInputTypes={DAILY:'daily',WEEKLY:'weekly',MONTHLY:'monthly'};
    export const getAllScheduledNotificationsAsync=()=>globalThis.__lateSchedule.list();
    export const cancelScheduledNotificationAsync=id=>globalThis.__lateSchedule.cancel(id);
    export const requestPermissionsAsync=()=>globalThis.__lateSchedule.permission();
    export const setNotificationChannelAsync=(...a)=>globalThis.__lateSchedule.channel(...a);
    export const scheduleNotificationAsync=value=>globalThis.__lateSchedule.schedule(value);`,
  scheduler:`export const cancelarExportacion=()=>{globalThis.__lateSchedule.alarm=null};export const programarExportacion=date=>{globalThis.__lateSchedule.alarm=date.getTime()};export const puedeExportarEnFondo=()=>true;export const puedePdfEnFondo=()=>true;`,
};
const ids={'expo-notifications':'notifications','react-native':'platform','@/utils/storage':'storage','@/modules/export-scheduler':'scheduler'};
const entry=`import * as scheduling from '@/utils/scheduledExport';
  const {applySchedule,DEFAULT_SCHEDULE,saveSchedule,loadSchedule,proximaProgramada}=scheduling;
  let schedule={...DEFAULT_SCHEDULE},notifOk=true;
  const updateRequest={current:0},loaded=true,enFondo=false,pdfEnFondo=false,saleSolo=false,HORAS=[9];
  const setSchedule=value=>{schedule=value},setNotifOk=value=>{notifOk=value};
  const t=value=>value,describir=value=>String(value.hour),showToast=value=>globalThis.__lateSchedule.toasts.push(value);
  const carpetaElegida=async()=>'',dropboxConectado=async()=>false,onedriveConectado=async()=>false,ultimoIntentoEnFondo=async()=>null;
  const setHoraPersonal=()=>{},setHoraTexto=()=>{},setMinutoTexto=()=>{},setLoaded=()=>{},setCarpeta=()=>{},setDropbox=()=>{},setOnedrive=()=>{},setUltimo=()=>{},setProxima=()=>{};
  ${update}
  export const mount=()=>(${mount})();
  export const change=patch=>update(patch);
  export const view=()=>({schedule,notifOk});
  export {scheduling};`;
const compiled=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'settings-case.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',alias:{'@':process.cwd()},logLevel:'silent',plugins:[{name:'original-with-synthetic-io',setup(b){
  b.onResolve({filter:/.*/},a=>ids[a.path]?{path:ids[a.path],namespace:'case'}:undefined);
  b.onLoad({filter:/.*/,namespace:'case'},a=>({contents:mocks[a.path],loader:'js'}));
  b.onLoad({filter:/[\\/]utils[\\/]scheduledExport\.ts$/},()=>({contents:coordinator,loader:'ts',resolveDir:path.join(process.cwd(),'utils')}));
}}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}};
function fresh(){
  const io={alarm:null,saved:new Map(),notifications:[],toasts:[],serial:0,
    list:async()=>io.notifications.map(n=>({identifier:n.id,content:n.content})),
    cancel:async id=>{io.notifications=io.notifications.filter(n=>n.id!==id)},
    permission:async()=>({status:'granted'}),channel:async()=>{},
    schedule:async value=>{const id=`test-${++io.serial}`;io.notifications.push({id,...value});return id},
  };
  globalThis.__lateSchedule=io;
  const mod={exports:{}};new Function('module','exports',compiled.outputFiles[0].text)(mod,mod.exports);
  return {api:mod.exports,io,config:{...mod.exports.scheduling.DEFAULT_SCHEDULE,enabled:true,frequency:'daily',hour:9}};
}
const texts={title:'Test export',body:'Synthetic only'};
let passed=0;
async function check(name,test){await test();passed++;console.log(`OK ${name}`)}
try{
  await check('Apagar gana contra una activación que espera permiso',async()=>{
    const {api,io,config}=fresh(),started=deferred(),permission=deferred();
    io.permission=()=>{started.resolve();return permission.promise};
    const old=api.scheduling.applySchedule(config,texts);await started.promise;
    await api.scheduling.applySchedule({...config,enabled:false},texts);
    permission.resolve({status:'granted'});await old;
    assert.equal(io.alarm,null);assert.equal(io.notifications.length,0);assert.equal(io.saved.get('finzo:scheduledExport.proxima'),0);
  });
  await check('Una lectura vieja de avisos no cancela la programación nueva',async()=>{
    const {api,io,config}=fresh(),started=deferred(),list=deferred();let calls=0;
    io.list=async()=>{if(++calls===1){started.resolve();await list.promise}return io.notifications.map(n=>({identifier:n.id,content:n.content}))};
    const old=api.scheduling.applySchedule(config,texts);await started.promise;
    await api.scheduling.applySchedule({...config,hour:18},texts);list.resolve();await old;
    assert.equal(io.notifications.length,1);assert.equal(io.notifications[0].trigger.hour,18);assert.equal(new Date(io.alarm).getHours(),18);
  });
  await check('Un aviso viejo que termina tarde se retira por su propio identificador',async()=>{
    const {api,io,config}=fresh(),started=deferred(),native=deferred();let calls=0;
    io.schedule=async value=>{const id=`test-${++io.serial}`;if(++calls===1){started.resolve();await native.promise}io.notifications.push({id,...value});return id};
    const old=api.scheduling.applySchedule(config,texts);await started.promise;
    await api.scheduling.applySchedule({...config,hour:18},texts);native.resolve();await old;
    assert.equal(io.notifications.length,1);assert.equal(io.notifications[0].trigger.hour,18);assert.equal(new Date(io.alarm).getHours(),18);
  });
  await check('Cerrar sesión invalida una activación pendiente del canal',async()=>{
    const {api,io,config}=fresh(),started=deferred(),channel=deferred();
    io.channel=async()=>{started.resolve();await channel.promise};
    const old=api.scheduling.applySchedule(config,texts);await started.promise;
    await api.scheduling.cancelarProgramacionAlCerrarSesion();channel.resolve();await old;
    assert.equal(io.alarm,null);assert.equal(io.notifications.length,0);assert.equal(io.saved.get('finzo:scheduledExport.proxima'),0);
  });
  await check('Un fallo parcial retira sus avisos incluso si otro termina después',async()=>{
    const {api,io,config}=fresh(),late=deferred(),started=deferred();let calls=0;
    io.schedule=async value=>{const call=++calls,id=`test-${++io.serial}`;if(call===3){started.resolve();await late.promise}if(call===2)throw Error('test-native-error');io.notifications.push({id,...value});return id};
    const running=api.scheduling.applySchedule({...config,frequency:'custom',customDays:[2,4,6]},texts).then(()=>null,e=>e);
    await started.promise;assert.ok(await running);late.resolve();await new Promise(r=>setTimeout(r,0));
    assert.equal(io.notifications.length,0);assert.equal(io.alarm,null);assert.equal(io.saved.get('finzo:scheduledExport.proxima'),0);
  });
  await check('La pantalla conserva la hora nueva si falla una petición anterior',async()=>{
    const {api,io}=fresh(),started=deferred(),oldPermission=deferred();let permissions=0;
    io.permission=()=>++permissions===1?(started.resolve(),oldPermission.promise):Promise.resolve({status:'granted'});
    const old=api.change({enabled:true,hour:9});await started.promise;
    await api.change({enabled:true,hour:18});oldPermission.resolve({status:'denied'});await old;
    assert.equal(api.view().schedule.enabled,true);assert.equal(api.view().schedule.hour,18);assert.equal(api.view().notifOk,true);
    assert.equal(io.saved.get('finzo:scheduledExport').hour,18);assert.equal(io.saved.get('finzo:scheduledExport').enabled,true);
  });
  await check('Salir de la pantalla descarta la respuesta que todavía estaba pendiente',async()=>{
    const {api,io}=fresh(),started=deferred(),permission=deferred();const cleanup=api.mount();await new Promise(r=>setTimeout(r,0));
    io.permission=()=>{started.resolve();return permission.promise};
    const old=api.change({enabled:true,hour:9});await started.promise;cleanup();permission.resolve({status:'denied'});await old;
    assert.equal(api.view().schedule.enabled,true);assert.equal(io.toasts.length,0);
  });
  await check('Un rechazo viejo no apaga la hora nueva ni produce un error sin atender',async()=>{
    const {api,io}=fresh(),started=deferred(),oldPermission=deferred();let permissions=0;
    io.permission=()=>++permissions===1?(started.resolve(),oldPermission.promise):Promise.resolve({status:'granted'});
    const old=api.change({enabled:true,hour:9});await started.promise;
    await api.change({enabled:true,hour:18});oldPermission.reject(Error('synthetic-old-native-error'));await old;
    assert.equal(api.view().schedule.enabled,true);assert.equal(api.view().schedule.hour,18);
    assert.equal(api.view().notifOk,true);assert.equal(io.toasts.length,1);
    assert.equal(io.saved.get('finzo:scheduledExport').enabled,true);assert.equal(new Date(io.alarm).getHours(),18);
  });
  await check('Un fallo actual de Android apaga el ajuste y permite volver a intentarlo',async()=>{
    const {api,io}=fresh();io.channel=async()=>{throw Error('synthetic-current-native-error')};
    await api.change({enabled:true,hour:9});
    assert.equal(api.view().schedule.enabled,false);assert.equal(api.view().notifOk,false);
    assert.equal(io.saved.get('finzo:scheduledExport').enabled,false);assert.equal(io.alarm,null);
    assert.deepEqual(io.toasts,['schedExport.scheduleFailed']);
    io.channel=async()=>{};await api.change({enabled:true,hour:18});
    assert.equal(api.view().schedule.enabled,true);assert.equal(api.view().notifOk,true);assert.equal(new Date(io.alarm).getHours(),18);
  });
  await check('La programación normal y el modo sin recordatorio se conservan',async()=>{
    const {api,io,config}=fresh();
    assert.equal(await api.scheduling.applySchedule({...config,frequency:'custom',customDays:[2,4,6]},texts),true);
    assert.equal(io.notifications.length,3);
    assert.equal(await api.scheduling.applySchedule(config,texts,{notifyAtScheduledTime:false}),true);
    assert.equal(io.notifications.length,0);assert.ok(io.alarm);assert.ok(io.saved.get('finzo:scheduledExport.proxima')>0);
  });
  console.log(`${passed} casos; callbacks/coordinador originales, sin Android ni cuentas reales.`);
}finally{delete globalThis.__lateSchedule}
