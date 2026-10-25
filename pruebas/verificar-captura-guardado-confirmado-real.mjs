import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Captura, reconocimiento, reparto, IDs y almacenamiento originales. Solo IO
// nativo/cifrado se adaptan; no se usa el emulador ni la cuenta del propietario.
const read = createSourceReader({ revision: process.env.FINO_CAPTURE_STORAGE_BASELINE ?? "" });
const BACKUP = "finzo:capturaPendiente";
const PERSONAL = "finzo:transactions";
const BUSINESS = "finzo:movimientosNegocio";
const LOG = "finzo:autoCaptureLog";
const marker = "v2:synthetic:";
const bundle = await build({
  stdin: {
    contents: `export { capturarEnFondo, guardarPendientes, pendientesDeCaptura } from './utils/capturaEnFondo';
export { setAccountStorageAvailable, flushPendingSaves, saveJSON } from './utils/storage';`,
    sourcefile: "capture-durable-test.ts", resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", write: false,
  alias: { "@": process.cwd() }, logLevel: "silent",
  plugins: [{ name: "capture-native-io", setup(b) {
    const ids = {
      "@react-native-async-storage/async-storage": "storage",
      "@/utils/encryption": "encryption",
      "@/modules/notification-reader": "reader",
      "expo-crypto": "crypto", "@/constants/iconos": "icons",
    };
    const mocks = {
      storage: `export default {
        getItem:async key=>{const s=globalThis.__captureTest;if(s.failRead.has(key))throw Error('synthetic-read-failure');return s.data.get(key)??null},
        setItem:async(key,value)=>{
          const s=globalThis.__captureTest;
          const clear=key==='${BACKUP}'&&JSON.parse(value.slice('${marker}'.length)).length===0;
          if(s.holdKey===key){s.holdStarted();await s.hold}
          if(s.fail.has(key)||(clear&&s.failClear))throw Error('synthetic-write-failure');
          s.data.set(key,value);s.events.push(clear?'backup-cleared':key);
          if(s.writeThenThrow.has(key))throw Error('synthetic-lost-write-response');
        },
        multiGet:async keys=>keys.map(key=>[key,globalThis.__captureTest.data.get(key)??null]),
        getAllKeys:async()=>[...globalThis.__captureTest.data.keys()],
        removeItem:async key=>{globalThis.__captureTest.data.delete(key)},
        multiRemove:async keys=>{keys.forEach(key=>globalThis.__captureTest.data.delete(key))}
      };`,
      encryption: `export const encryptText=async text=>'${marker}'+text;
        export const decryptText=async text=>text.startsWith('${marker}')?text.slice('${marker}'.length):null;`,
      reader: `export const isEnabled=()=>globalThis.__captureTest.enabled;
        export const isPermissionGranted=()=>globalThis.__captureTest.permission;
        export const drain=async()=>{const s=globalThis.__captureTest;s.drains++;return structuredClone(s.native)};
        export const ackDrain=async()=>{const s=globalThis.__captureTest;s.ackAttempts++;
          if(s.failAck)throw Error('synthetic-ack-failure');
          s.onAck?.();s.events.push('native-ack');s.acks++;s.native=[]};`,
      crypto: `export { randomUUID } from 'node:crypto';
        import {webcrypto} from 'node:crypto';export const getRandomValues=a=>webcrypto.getRandomValues(a);`,
      icons: "export const iconoDe=()=>()=>null;",
    };
    b.onResolve({ filter: /.*/ }, a => ids[a.path] ? { path: ids[a.path], namespace: "capture-io" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "capture-io" }, a => ({ contents: mocks[a.path], loader: "js" }));
    b.onLoad({ filter: /[\\/]utils[\\/]capturaEnFondo\.ts$/ }, a => ({
      contents: read("utils/capturaEnFondo.ts"), loader: "ts", resolveDir: path.dirname(a.path),
    }));
  } }],
});

const now = Date.now();
function aviso(id, expense = false, offset = 0) {
  return { captureId: `synthetic-${id}`, package: "com.bcp.innovacxion.yapeapp",
    title: "Confirmación de Pago", postedAt: now - 10000 + offset,
    text: expense ? "Yapeaste S/ 5.00 a PERSONA SINTETICA" : "Yape! PERSONA SINTETICA te envió un pago por S/ 20" };
}
function state(native = [aviso("one")]) {
  return { data: new Map(), native, fail: new Set(), failRead: new Set(), writeThenThrow: new Set(),
    enabled: true, permission: true, failClear: false, failAck: false,
    drains: 0, ackAttempts: 0, acks: 0, events: [] };
}
function seed(s, key, value) { s.data.set(key, marker + JSON.stringify(value)); }
function stored(s, key) { return JSON.parse(s.data.get(key)?.slice(marker.length) ?? "[]"); }
function phone(s) {
  // Nueva ejecución de todos los módulos: las marcas de fallo y los IDs en
  // memoria se pierden, pero el disco y el buzón sintéticos sobreviven.
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: createRequire(import.meta.url),
    console, setTimeout, clearTimeout, TextEncoder, TextDecoder, structuredClone, __captureTest: s };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  module.exports.setAccountStorageAvailable(true);
  return module.exports;
}
function withBusiness(s) {
  seed(s, "finzo:isPremium", true);
  seed(s, "finzo:negocios", [{ id: "synthetic-business", nombre: "Prueba sintética",
    categoria: "Otro", moneda: "PEN", creadoEn: now, activo: true, destinoYapes: "negocio", modo: "simple" }]);
}
let passed = 0;
async function check(name, run) {
  await run(); passed++; console.log(`OK ${name}`);
}

await check("backup fallido conserva el buzón y no registra ni confirma dinero", async () => {
  const s = state(); s.fail.add(BACKUP);
  await assert.rejects(phone(s).capturarEnFondo());
  assert.equal(s.acks, 0); assert.equal(s.native.length, 1);
  assert.equal(stored(s, PERSONAL).length, 0);
});
for (const key of [PERSONAL, LOG]) {
  await check(`fallo ${key}: respaldo y buzón sobreviven hasta el reintento`, async () => {
    const s = state(); s.fail.add(key);
    await assert.rejects(phone(s).capturarEnFondo());
    assert.equal(s.acks, 0); assert.equal(s.native.length, 1);
    assert.equal(stored(s, BACKUP).length, 1);
    s.fail.clear(); await phone(s).capturarEnFondo();
    assert.equal(stored(s, PERSONAL).length, 1); assert.equal(s.acks, 1);
    assert.equal(stored(s, BACKUP).length, 0); assert.equal(s.native.length, 0);
  });
}
await check("éxito confirma los datos y el respaldo antes del ack", async () => {
  const s = state();
  s.onAck = () => {
    assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, LOG).length, 1);
    assert.equal(stored(s, BACKUP).length, 0);
  };
  assert.equal(await phone(s).capturarEnFondo(), 1);
  assert.ok(s.events.indexOf(PERSONAL) < s.events.indexOf("backup-cleared"));
  assert.ok(s.events.indexOf("backup-cleared") < s.events.indexOf("native-ack"));
});
await check("una escritura lenta no permite confirmar antes de persistir", async () => {
  const s = state(); s.holdKey = PERSONAL;
  let release; s.hold = new Promise(resolve => { release = resolve; });
  let started; const entered = new Promise(resolve => { started = resolve; }); s.holdStarted = started;
  const task = phone(s).capturarEnFondo();
  await entered;
  assert.equal(s.acks, 0); assert.equal(stored(s, BACKUP).length, 1);
  release(); assert.equal(await task, 1); assert.equal(s.acks, 1);
});
await check("fallo al limpiar conserva respaldo y reintento no duplica", async () => {
  const s = state(); s.failClear = true;
  await assert.rejects(phone(s).capturarEnFondo());
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, BACKUP).length, 1);
  assert.equal(s.acks, 0); s.failClear = false;
  assert.equal(await phone(s).capturarEnFondo(), 0);
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, LOG).length, 1);
  assert.equal(s.acks, 1); assert.equal(stored(s, BACKUP).length, 0);
});
await check("respuesta de escritura perdida tras persistir no repite dinero al reiniciar", async () => {
  const s = state(); s.writeThenThrow.add(PERSONAL);
  await assert.rejects(phone(s).capturarEnFondo());
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(s.acks, 0);
  s.writeThenThrow.clear(); assert.equal(await phone(s).capturarEnFondo(), 0);
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(s.acks, 1);
});
await check("fallo del ack después de guardar mantiene un reintento seguro", async () => {
  const s = state(); s.failAck = true;
  await assert.rejects(phone(s).capturarEnFondo());
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(s.native.length, 1); assert.equal(s.acks, 0);
  s.failAck = false; assert.equal(await phone(s).capturarEnFondo(), 0);
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(s.acks, 1);
});
for (const failed of [PERSONAL, BUSINESS]) {
  await check(`guardado parcial ${failed}: ambos destinos quedan una sola vez tras reinicio`, async () => {
    const s = state([aviso("income"), aviso("expense", true, 1000)]); withBusiness(s); s.fail.add(failed);
    await assert.rejects(phone(s).capturarEnFondo());
    assert.equal(s.acks, 0); assert.equal(stored(s, BACKUP).length, 2);
    assert.equal(stored(s, failed).length, 0);
    assert.equal(stored(s, failed === PERSONAL ? BUSINESS : PERSONAL).length, 1);
    s.fail.clear(); assert.equal(await phone(s).capturarEnFondo(), 1);
    assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, BUSINESS).length, 1);
    assert.equal(stored(s, PERSONAL)[0].amount, 5); assert.equal(stored(s, BUSINESS)[0].monto, 20);
    assert.equal(s.acks, 1); assert.equal(stored(s, BACKUP).length, 0);
  });
}
await check("respaldo anterior y lote nuevo se conservan juntos", async () => {
  const s = state([aviso("new", false, 1000)]); seed(s, BACKUP, [aviso("old")]);
  assert.equal(await phone(s).capturarEnFondo(), 2);
  assert.equal(stored(s, PERSONAL).length, 2); assert.equal(s.acks, 1);
});
await check("respaldo sin lote nativo todavía se recupera", async () => {
  const s = state([]); seed(s, BACKUP, [aviso("only-backup")]);
  assert.equal(await phone(s).capturarEnFondo(), 1);
  assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, BACKUP).length, 0);
});
await check("mismo aviso en respaldo y buzón se registra una vez", async () => {
  const n = aviso("same"), s = state([n, { ...n }]); seed(s, BACKUP, [n]);
  assert.equal(await phone(s).capturarEnFondo(), 1); assert.equal(stored(s, PERSONAL).length, 1);
});
await check("dato ilegible no se sustituye por una lista vacía ni se confirma", async () => {
  const s = state(); seed(s, PERSONAL, [{ id: 10, amount: 12 }]); const before = s.data.get(PERSONAL);
  s.failRead.add(PERSONAL); await assert.rejects(phone(s).capturarEnFondo());
  assert.equal(s.data.get(PERSONAL), before); assert.equal(s.acks, 0); assert.equal(s.native.length, 1);
});
await check("el diagnóstico queda acotado a cuarenta avisos", async () => {
  const s = state(); seed(s, LOG, Array.from({ length: 45 }, (_, i) => ({ at: now - 100000 + i, text: `Sintético ${i}`, result: "notMoney" })));
  await phone(s).capturarEnFondo(); assert.equal(stored(s, LOG).length, 40);
  assert.equal(stored(s, PERSONAL).length, 1);
});
await check("un manual previo en cola se conserva al añadir la captura", async () => {
  const s = state(), api = phone(s);
  const manual = { id: 100, type: "expense", amount: 3, category: "otros", date: new Date(now).toISOString().slice(0, 10),
    time: "10:00", method: "cash", description: "Manual sintético previo", notes: "", origin: "manual" };
  api.saveJSON(PERSONAL, [manual]);
  assert.equal(await api.capturarEnFondo(), 1);
  assert.equal(stored(s, PERSONAL).length, 2);
  assert.ok(stored(s, PERSONAL).some(row => row.id === 100 && row.amount === 3));
  assert.equal(s.acks, 1);
});
for (const failed of [PERSONAL, LOG, BUSINESS]) {
  await check(`el mismo proceso se recupera de un fallo en ${failed} sin repetir dinero`, async () => {
    const s = state([aviso("same-process-income"), aviso("same-process-expense", true, 1000)]);
    withBusiness(s); const api = phone(s); s.fail.add(failed);
    await assert.rejects(api.capturarEnFondo());
    assert.equal(s.acks, 0); assert.equal(stored(s, BACKUP).length, 2);
    s.fail.clear(); await api.capturarEnFondo();
    assert.equal(stored(s, PERSONAL).length, 1); assert.equal(stored(s, BUSINESS).length, 1);
    assert.equal(stored(s, PERSONAL)[0].amount, 5); assert.equal(stored(s, BUSINESS)[0].monto, 20);
    assert.equal(s.acks, 1); assert.equal(stored(s, BACKUP).length, 0);
  });
}
await check("un manual cuyo guardado falló se reintenta antes de añadir la captura", async () => {
  const s = state(), api = phone(s);
  const manual = { id: 101, type: "expense", amount: 7, category: "otros", date: new Date(now).toISOString().slice(0, 10),
    time: "10:00", method: "cash", description: "Manual sintético fallido", notes: "", origin: "manual" };
  api.saveJSON(PERSONAL, [manual]); s.fail.add(PERSONAL);
  await assert.rejects(api.capturarEnFondo());
  assert.equal(s.acks, 0); assert.equal(stored(s, PERSONAL).length, 0);
  s.fail.clear(); assert.equal(await api.capturarEnFondo(), 1);
  assert.equal(stored(s, PERSONAL).length, 2);
  assert.ok(stored(s, PERSONAL).some(row => row.id === 101 && row.amount === 7));
  assert.equal(s.acks, 1);
});
await check("captura apagada o sin permiso no drena ni cambia datos", async () => {
  for (const flag of ["enabled", "permission"]) {
    const s = state(); s[flag] = false; seed(s, BACKUP, [aviso("old")]);
    const before = [...s.data]; assert.equal(await phone(s).capturarEnFondo(), 0);
    assert.deepEqual([...s.data], before); assert.equal(s.drains, 0); assert.equal(s.acks, 0);
  }
});
for (const business of [false,true]) for (const amount of ["6.50","6.5.","6.50.","6,50."]) {
  await check(`céntimos ${amount} guardados en ${business?"Negocio":"Personal"} también con la app cerrada`, async () => {
    const n={...aviso(`centimos-${business}-${amount}`),text:`PERSONA SINTETICA te envió un pago por S/ ${amount}`};
    const s=state([n]);if(business)withBusiness(s);
    const destination=business?BUSINESS:PERSONAL,field=business?"monto":"amount";
    s.onAck=()=>{assert.equal(stored(s,destination).length,1);assert.equal(stored(s,destination)[0][field],6.5);assert.equal(stored(s,LOG)[0].amount,6.5)};
    s.failAck=true;await assert.rejects(phone(s).capturarEnFondo());
    assert.equal(stored(s,destination)[0][field],6.5);s.failAck=false;
    assert.equal(await phone(s).capturarEnFondo(),0,"reiniciar/reintentar no vuelve a guardar el mismo Yape");
    assert.equal(stored(s,destination).length,1);assert.equal(s.acks,1);
    assert.equal(stored(s,business?PERSONAL:BUSINESS).length,0);
  });
}
console.log(`${passed} escenarios: captura/almacenamiento originales, IO sintético; ningún dato real ni Android modificado`);
