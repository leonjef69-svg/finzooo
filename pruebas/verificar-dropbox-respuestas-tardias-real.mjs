// Original coordinator; browser, account, credential store and HTTP are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';

const baseline=process.env.FINO_LATE_SETTINGS_BASELINE;
const source=baseline
  ?execFileSync('git',['show',`${baseline}:utils/dropbox.ts`],{encoding:'utf8'})
  :fs.readFileSync('utils/dropbox.ts','utf8');
const mocks={
  crypto:`export const getRandomBytesAsync=async n=>new Uint8Array(n).fill(1);export const digestStringAsync=async()=> 'test-hash';export const CryptoDigestAlgorithm={SHA256:'sha256'};export const CryptoEncoding={BASE64:'base64'};`,
  secure:`export const getItemAsync=k=>globalThis.__lateDropbox.read(k);export const setItemAsync=(k,v)=>globalThis.__lateDropbox.write(k,v);export const deleteItemAsync=k=>globalThis.__lateDropbox.remove(k);`,
  browser:`export const openAuthSessionAsync=async()=>{globalThis.__lateDropbox.browserCalls++;return {type:'success',url:'finzo://dropbox?code=test-code'}};`,
  file:`export const uploadAsync=(...a)=>globalThis.__lateDropbox.upload(...a);export const FileSystemUploadType={BINARY_CONTENT:0};`,
  firebase:`export const auth={get currentUser(){return globalThis.__lateDropbox.user}};`,
  storage:`export const getAccountStorageSession=()=>globalThis.__lateDropbox.session;`,
};
const ids={'expo-crypto':'crypto','expo-secure-store':'secure','expo-web-browser':'browser','expo-file-system/legacy':'file','@/utils/firebase':'firebase','@/utils/storage':'storage'};
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd()+'/utils',sourcefile:'dropbox.ts',loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':process.cwd()},logLevel:'silent',plugins:[{name:'synthetic-only',setup(b){b.onResolve({filter:/.*/},a=>ids[a.path]?{path:ids[a.path],namespace:'case'}:undefined);b.onLoad({filter:/.*/,namespace:'case'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
const response=(token='test-refresh')=>({ok:true,status:200,json:async()=>({refresh_token:token,access_token:'test-access'})});
const outcome=p=>p.then(()=>null,e=>e);
const originalFetch=globalThis.fetch;
function fresh(){
  const store=new Map();
  const io={store,user:{uid:'test-user-a'},session:1,browserCalls:0,
    read:async key=>store.get(key)??null,
    write:async(key,value)=>{store.set(key,value)},
    remove:async key=>{store.delete(key)},
    fetch:async()=>response(),
    upload:async()=>({status:200,body:JSON.stringify({name:'test-result.pdf'})}),
  };
  globalThis.__lateDropbox=io;
  globalThis.fetch=(...args)=>io.fetch(...args);
  const mod={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(mod,mod.exports);
  return {api:mod.exports,io};
}
let passed=0;
async function check(name,test){await test();passed++;console.log(`OK ${name}`)}
try{
  await check('Desconectar invalida una respuesta de conexión pendiente',async()=>{
    const {api,io}=fresh(),started=deferred(),token=deferred();
    io.fetch=async()=>{started.resolve();return token.promise};
    const pending=outcome(api.conectarDropbox());await started.promise;
    await api.desconectarDropbox();assert.equal(await api.dropboxConectado(),false);
    token.resolve(response());assert.ok(await pending);assert.equal(await api.dropboxConectado(),false);
  });
  await check('Cambiar de cuenta invalida el permiso de la cuenta anterior',async()=>{
    const {api,io}=fresh(),started=deferred(),token=deferred();
    io.fetch=async()=>{started.resolve();return token.promise};
    const pending=outcome(api.conectarDropbox());await started.promise;
    io.user={uid:'test-user-b'};io.session=2;token.resolve(response());
    assert.ok(await pending);assert.equal(io.store.size,0);
  });
  await check('Otra sesión del mismo usuario no acepta respuestas de la sesión anterior',async()=>{
    const {api,io}=fresh(),started=deferred(),token=deferred();
    io.fetch=async()=>{started.resolve();return token.promise};
    const pending=outcome(api.conectarDropbox());await started.promise;
    io.session=2;token.resolve(response());assert.ok(await pending);assert.equal(io.store.size,0);
  });
  await check('Desconectar también gana si la escritura segura ya había empezado',async()=>{
    const {api,io}=fresh(),started=deferred(),write=deferred();
    io.write=async(key,value)=>{started.resolve();await write.promise;io.store.set(key,value)};
    const pending=outcome(api.conectarDropbox());await started.promise;
    const disconnect=api.desconectarDropbox();write.resolve();
    await Promise.all([pending,disconnect]);assert.equal(io.store.size,0);
  });
  await check('Una conexión nueva se conserva cuando termina una conexión vieja',async()=>{
    const {api,io}=fresh(),started=deferred(),old=deferred();let requests=0;
    io.fetch=async()=>++requests===1?(started.resolve(),old.promise):response('test-new-refresh');
    const pending=outcome(api.conectarDropbox());await started.promise;
    await api.conectarDropbox();old.resolve(response('test-old-refresh'));await pending;
    assert.equal(io.store.get('finzo.dropbox.refresh'),'test-new-refresh');
  });
  await check('Un permiso viejo revocado no desconecta una conexión nueva',async()=>{
    const {api,io}=fresh(),started=deferred(),old=deferred();
    io.store.set('finzo.dropbox.refresh','test-old-refresh');
    io.fetch=async(_url,options)=>String(options.body).includes('grant_type=refresh_token')?(started.resolve(),old.promise):response('test-new-refresh');
    const upload=outcome(api.subirADropbox('file:///test.pdf','test.pdf'));await started.promise;
    await api.conectarDropbox();old.resolve({ok:false,status:401});await upload;
    assert.equal(io.store.get('finzo.dropbox.refresh'),'test-new-refresh');
  });
  await check('Conexión y subida normales siguen funcionando con el mismo formato seguro',async()=>{
    const {api,io}=fresh();await api.conectarDropbox();assert.equal(await api.dropboxConectado(),true);
    assert.equal(await api.subirADropbox('file:///test.pdf','test.pdf'),'test-result.pdf');
    assert.equal(io.browserCalls,1);await api.desconectarDropbox();assert.equal(await api.dropboxConectado(),false);
  });
  console.log(`${passed} casos con coordinador real; sin Android, cuentas ni HTTP reales.`);
}finally{globalThis.fetch=originalFetch;delete globalThis.__lateDropbox}
