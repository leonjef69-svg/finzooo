import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { handlerOriginal } from './helpers/handler-original.mjs';
import { createSourceReader } from './helpers/source-reader.mjs';
const require=createRequire(import.meta.url),read=createSourceReader({revision:process.env.FINO_CLOUD_LEGACY_BASELINE??''});
const load=file=>{const module={exports:{}};const output=buildSync({entryPoints:[file],bundle:true,platform:'node',format:'cjs',write:false,alias:{'@':process.cwd()}}).outputFiles[0].text;vm.runInNewContext(output,{module,exports:module.exports,require,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer});return module.exports;};
const records=load('utils/recordMerge.ts'),fields=load('utils/cloudFieldMerge.ts'),migration=load('utils/cloudHistoryMigration.ts'),legacy=load('utils/cloudLegacyTransfers.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const base=(id,kind,space,amount,type='expense')=>({id,creationId:'uuid-'+id,type,amount,date:'2026-10-13',time:'5:00 a.m.',category:'otros',description:'Aporte',method:'transfer',notes:'',origin:'manual',internalTransfer:kind,internalTransferLink:'link-'+id,internalTransferSpaceId:space,updatedAt:10});
function fixture() {
 let meta={};const local=[];
 for(const tx of [base(10,'box','private',100),base(11,'box','private',100,'income')]) {
  const next=records.rebindVerifiedTransaction(meta,tx,{...tx,internalTransferSpaceId:'shared',internalTransferSettled:true,...(tx.type==='income'?{internalTransferAllocations:[{transactionId:10,amount:100}]}:{internalTransferConsumedAmount:0})},'generation-'+tx.id);
  meta=next.metadata;local.push({...next.record,updatedAt:20});
 }
 local.push(base(12,'family','family',400));
 const remote=local.map(tx=>{const old={...tx,time:'12:00 a.m.'};for(const key of ['creationId','internalTransferSpaceId','updatedAt','restorationId','restorationParent','internalTransferAllocations','internalTransferConsumedAmount'])delete old[key];old.internalTransferSettled=false;return old;});
 const lone=id=>({id,creationId:'uuid-'+id,type:'income',amount:1,date:'2026-10-13',category:'otros',description:'Independiente',method:'cash'});
 local.push(lone(100));remote.push(lone(200));
 const data={hasOnboarded:true,userName:'A',userPhoto:null,userCurrency:'PEN',userLanguage:'es',budgets:{'2026-10':1000},categoryBudgets:{},goals:[],isPremium:true,transactions:local,deletedTransactionIds:[999],syncUpdatedAt:meta};
 const remoteRoot={...plain(data),transactions:remote,deletedTransactionIds:[998],syncUpdatedAt:{},historyFormat:1,recordIdentityFormat:1};
 const docs=new Map([['users/A',remoteRoot]]);
 for(const tx of local.filter(tx=>tx.internalTransfer)) {
  const root=tx.internalTransfer==='family'?'familySpaces':'boxSpaces';
  docs.set(`${root}/${tx.internalTransferSpaceId}`,{currency:'PEN',closed:tx.internalTransfer==='box'});
  docs.set(`${root}/${tx.internalTransferSpaceId}/movements/${tx.internalTransferLink}`,{personalOwnerUid:'A',personalTransactionId:tx.id,fecha:tx.date,tipo:tx.type==='income'?'gasto':'ingreso',monto:tx.amount,...(tx.type==='income'?{personalReturnAmount:tx.amount}:{})});
 }
 const state={writes:[],reads:[],active:true,retry:false,readHook:()=>{}};
 const snap=ref=>({exists:()=>docs.has(ref.path),data:()=>docs.get(ref.path)});
 const deps={...records,...fields,...migration,...legacy,db:{},doc:(_db,...parts)=>({path:parts.join('/')}),getDoc:async ref=>snap(ref),serverTimestamp:()=>123,
  hasUnreadableLocalData:()=>false,withPrivateBoxCloudOperation:async(_uid,work)=>work({wait:work=>work(),assertCurrent(){},remember:value=>value}),
  runTransaction:async(_db,work)=>{let writes=[];const tx={get:async ref=>{state.reads.push(ref.path);state.readHook(ref.path);return snap(ref);},set:(ref,value)=>writes.push({ref:ref.path,value})};await work(tx);if(state.retry){writes=[];state.retry=false;docs.get('boxSpaces/shared/movements/link-10').monto=90;await work(tx);}state.writes.push(...writes);},
  pesa:value=>Buffer.byteLength(JSON.stringify(value)),sinFotos:value=>value,TOPE_SEGURO:800000,LIMITE_FIRESTORE:1000000,
  saveCloudDataV2:()=>{throw Error('not-legacy');},
 };
 deps.conservarPremiumManual=handlerOriginal('utils/cloudSync.ts','conservarPremiumManual',{},read('utils/cloudSync.ts'));
 deps.motivoLegible=handlerOriginal('utils/cloudSync.ts','motivoLegible',{},read('utils/cloudSync.ts'));
 const save=handlerOriginal('utils/cloudSync.ts','saveCloudData',deps,read('utils/cloudSync.ts'));
 return {data,remoteRoot,docs,state,save:()=>save('A',data,()=>state.active)};
}
{
 const h=fixture(),before=plain(h.data),result=await h.save();
 assert.equal(result.ok,true,'la copia antigua de los mismos aportes confirmados no bloquea todo el respaldo');
 assert.equal(h.state.writes.length,1);assert.deepEqual(plain(h.data),before,'el guardado nunca modifica originales locales');
 assert.deepEqual(new Set(result.data.transactions.map(tx=>tx.id)),new Set([10,11,12,100,200]));
 assert.deepEqual(plain(result.data.deletedTransactionIds),[999,998]);
 for(const tx of before.transactions) {const saved=result.data.transactions.find(row=>row.id===tx.id);assert.equal(saved.amount,tx.amount);assert.equal(saved.type,tx.type);assert.equal(saved.internalTransferSpaceId,tx.internalTransferSpaceId);}
 assert.ok(h.state.reads.includes('familySpaces/family/movements/link-12'));assert.ok(h.state.reads.includes('boxSpaces/shared/movements/link-10'));
}
for(const kind of ['missing','amount','owner','date','currency','open','allocation','remote-identified','remote-space','edited-note','newer-remote','source-changed','pause','network','old-consumed','old-settled','old-allocation']) {
 const h=fixture(),source=h.docs.get('boxSpaces/shared/movements/link-10');
 if(kind==='missing')h.docs.delete('boxSpaces/shared/movements/link-10');
 if(kind==='amount')source.monto=99;
 if(kind==='owner')source.personalOwnerUid='B';
 if(kind==='date')source.fecha='2026-10-14';
 if(kind==='currency')h.docs.get('boxSpaces/shared').currency='USD';
 if(kind==='open')h.docs.get('boxSpaces/shared').closed=false;
 if(kind==='allocation')h.data.transactions[1].internalTransferAllocations[0].transactionId=200;
 if(kind==='remote-identified')h.remoteRoot.transactions[0].creationId='another-creation';
 if(kind==='remote-space')h.remoteRoot.transactions[0].internalTransferSpaceId='other-space';
 if(kind==='edited-note')h.remoteRoot.transactions[0].notes='Otra elección';
 if(kind==='newer-remote')h.remoteRoot.transactions[0].updatedAt=500;
 if(kind==='old-consumed')h.remoteRoot.transactions[0].internalTransferConsumedAmount=1;
 if(kind==='old-settled') {h.remoteRoot.transactions[2].internalTransferSettled=true;h.data.transactions[2].internalTransferSettled=false;}
 if(kind==='old-allocation')h.remoteRoot.transactions[1].internalTransferAllocations=[{transactionId:10,amount:90}];
 if(kind==='source-changed')h.state.retry=true;
 if(kind==='pause')h.state.readHook=path=>{if(path.includes('/movements/'))h.state.active=false;};
 if(kind==='network')h.state.readHook=path=>{if(path.includes('/movements/'))throw Object.assign(Error('unavailable'),{code:'unavailable'});};
 const before=plain(h.data),result=await h.save();
 assert.equal(result.ok,false,kind+': no adivinar ni relajar el control general');assert.equal(h.state.writes.length,0,kind);assert.deepEqual(plain(h.data),before,kind);
}
for(const mode of ['before-loop','before-write','between-rows','enabled']) {
 const row=id=>({id,creationId:'history-'+id,type:'income',amount:10,date:'2026-10-16',category:'otros',description:'Historial',method:'cash'});
 let active=true;const entries=new Map(),writes=[];
 const approved={wait:work=>work(),assertCurrent(){},remember:value=>value};
 const deps={...migration,db:{},withPrivateBoxCloudLease:(_uid,_lease,work)=>work(approved),exclusive:(_uid,work)=>work(),
  refresh:async()=>{if(mode==='before-loop')active=false;return {entries:[...entries.values()],checkpoint:null};},
  caches:new Map(),asLists:migration.historyEntryLists,assertMatchingAccountCurrencies(){},serverTimestamp:()=>123,
  doc:(_db,...parts)=>({path:parts.join('/')}),parseEntry:value=>value,
  runTransaction:async(_db,work)=>work({get:async ref=>{if(ref.path.includes('/history/')){if(mode==='before-write')active=false;return {exists:()=>false};}return {exists:()=>true,data:()=>({historyFormat:2,hasOnboarded:true,userCurrency:'PEN'})};},
   set:(ref,value)=>{writes.push(ref.path);entries.set(value.id,value);if(mode==='between-rows')active=false;}}),
 };
 const save=handlerOriginal('utils/cloudHistoryV2.ts','saveHistoryV2',deps,read('utils/cloudHistoryV2.ts'));
 const job=save('A',[row(1),row(2)],[],undefined,'PEN',{},{},()=>active);
 if(mode==='enabled') {await job;assert.equal(writes.length,2);}
 else {await assert.rejects(job,/cloud-copy-paused/);assert.equal(writes.length,mode==='between-rows'?1:0,'la pausa no permite iniciar otra escritura del historial v2');}
}
console.log('Nube original: tres aportes v1 comprobados dentro de transacción; montos/originales/listas/borrados conservados, 17 rechazos seguros y pausa v1/v2 antes de escribir y entre filas.');
