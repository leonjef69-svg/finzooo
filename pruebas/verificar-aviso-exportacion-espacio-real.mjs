// Ejecuta el efecto original; navegación y entrega del aviso son sintéticas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {handlerOriginal} from './helpers/handler-original.mjs';

const baseline=process.env.FINO_LATE_SETTINGS_BASELINE;
const source=baseline
  ?execFileSync('git',['show',`${baseline}:app/_layout.tsx`],{encoding:'utf8'})
  :fs.readFileSync('app/_layout.tsx','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(config,{cold=false,mounted=true,screen='export'}={}){
  const queued=[],routes=[],cleanup=[];
  let listener,removed=0,marked=0;
  const notification={notification:{date:123,request:{content:{data:{screen}}}}};
  const effect=handlerOriginal('app/_layout.tsx','ScheduledExportEffect',{
    useAppData:()=>({ready:true,hasOnboarded:true,isPremium:true,t:key=>key}),
    useAppLocked:()=>false,useNavigationContainerRef:()=>({}),
    useRef:value=>({current:value}),useEffect:work=>cleanup.push(work()),
    retirarRecordatorioDeExportacionAnterior:async()=>{},
    isNavigationMounted:()=>mounted,
    loadSchedule:async()=>({...config}),
    Notifications:{
      addNotificationResponseReceivedListener:fn=>{listener=fn;return{remove:()=>removed++}},
      getLastNotificationResponseAsync:async()=>cold?notification:null,
    },
    alreadyHandledTap:async()=>false,markTapHandled:()=>marked++,
    queueExport:value=>{queued.push(value);return 'synthetic-export-intent'},
    irUnaVez:route=>routes.push(route),
    monthForSchedule:()=> '2026-10',buildFileName:()=> 'synthetic.pdf',
    typeLabelFor:type=>type,toDateKey:()=> '2026-10-24',
    isAutoRunDue:()=>false,claveDeEjecucion:()=> 'not-used',
  },source);
  effect();
  return {queued,routes,get marked(){return marked},get removed(){return removed},
    tap:()=>listener(notification),close:()=>cleanup.forEach(fn=>fn?.())};
}
let passed=0;
for(const spaceId of ['personal','family:test-family','box:test-box']){
  for(const cold of [false,true]){
    const config={spaceId,charts:true,format:'pdf',type:'income',destination:'dropbox',fileNameMode:'auto',fileName:''};
    const ui=fixture(config,{cold});
    if(!cold)ui.tap();
    await tick();
    assert.equal(ui.queued.length,1);
    assert.equal(ui.queued[0].spaceId,spaceId,'El aviso debe conservar el espacio elegido');
    assert.equal(ui.queued[0].charts,true,'El aviso debe conservar los gráficos elegidos');
    assert.equal(ui.queued[0].month,'2026-10');
    assert.equal(ui.queued[0].type,'income');
    assert.equal(ui.queued[0].destination,'dropbox');
    assert.equal(ui.queued[0].format,'pdf');
    assert.deepEqual(ui.routes,[{pathname:'/export-pdf',params:{intent:'synthetic-export-intent'}}]);
    assert.equal(ui.marked,cold?1:0);
    ui.close();assert.equal(ui.removed,1);passed++;
  }
}
{
  const ui=fixture({charts:false,format:'pdf',type:'all',destination:'folder'});
  ui.tap();await tick();
  assert.equal(ui.queued[0].spaceId,'personal');assert.equal(ui.queued[0].charts,false);ui.close();passed++;
}
{
  const ui=fixture({spaceId:'family:test',charts:true},{screen:'export-result'});
  ui.tap();await tick();assert.equal(ui.queued.length,0);assert.deepEqual(ui.routes,['/scheduled-export']);ui.close();passed++;
}
{
  const ui=fixture({spaceId:'box:test',charts:true},{mounted:false});
  ui.tap();await tick();assert.equal(ui.queued.length,0);assert.equal(ui.routes.length,0);ui.close();passed++;
}
{
  const file='screens/ScheduledExportSettings.tsx';
  const source=baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
  for(const available of [true,false]){
    const queued=[],routes=[];
    const run=handlerOriginal(file,'probarAhora',{
      espacio:available?{id:'family:test',transactionsLoaded:true}:undefined,probando:false,
      schedule:{spaceId:'family:test',charts:true,format:'pdf',type:'income',destination:'folder',frequency:'monthly'},
      testMonth:'2026-09',saleSolo:false,nombreArchivo:'synthetic.pdf',
      monthForSchedule:()=> 'not-selected',queueExport:value=>{queued.push(value);return 'synthetic-test-intent'},
      irUnaVez:route=>routes.push(route),
    },source);
    await run();
    assert.equal(queued.length,available?1:0,'Probar no toma un catálogo sin historial como un libro vacío');
    if(available){
      assert.equal(queued[0].spaceId,'family:test');assert.equal(queued[0].charts,true);
      assert.equal(queued[0].month,'2026-09');assert.equal(routes.length,1);
    }
    passed++;
  }
}
console.log(`${passed} casos: aviso abierto/cerrado conserva espacio, gráficos, formato y destino; sin cuentas ni archivos reales.`);
