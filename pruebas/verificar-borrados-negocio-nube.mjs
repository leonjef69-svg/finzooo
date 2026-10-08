import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lists = ["negocios", "productos", "ventas", "movimientos"];
const row = id => ({ id, negocioId: "n1", monto: 50, updatedAt: 10 });
const original = { negocios: [{ id: "n1", nombre: "Tienda", updatedAt: 10 }], productos: [row("p1")], ventas: [row("v1")], movimientos: [row("m1")] };
const fixture = { cloud: structuredClone(original), writes: 0 };
globalThis.__businessSyncFixture = fixture;
const mocks = {
  "@/utils/firebase": "export const db={};",
  "@/utils/storage": "export function hasUnreadableLocalData(){return false;}",
  "firebase/firestore": `export function doc(){return {};}
    const snap=()=>({exists:()=>true,data:()=>structuredClone(globalThis.__businessSyncFixture.cloud)});
    export async function getDoc(){return snap();}
    export async function deleteDoc(){}
    export async function runTransaction(_db,action){const writes=[];const result=await action({get:async()=>{if(globalThis.__businessSyncFixture.afterRead)globalThis.__businessSyncFixture.afterRead();return snap();},set:(_ref,data)=>writes.push(data)});for(const data of writes){globalThis.__businessSyncFixture.cloud=structuredClone(data);globalThis.__businessSyncFixture.writes++;}return result;}`,
};
const result = await build({ entryPoints: ["utils/cloudNegocio.ts"], bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  plugins: [{ name: "io-only", setup(b) {
    b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: "io" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "io" }, args => ({ contents: mocks[args.path], loader: "js" }));
  } }],
});
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
const { subirNegocio, bajarNegocio } = module.exports;
try {
  const deleted = Object.fromEntries(lists.map(name => [name, []]));
  const removed = { ...structuredClone(original), ventas: [], deleted: { ...deleted, ventas: ["v1"] }, syncFormat: 2 };
  await subirNegocio("test", removed);
  assert.equal(fixture.cloud.ventas.length, 0, "Subir no debe recuperar una venta borrada");
  const confirmed = await subirNegocio("test", original);
  assert.equal(fixture.cloud.ventas.length, 0, "Un cliente atrasado no revive la venta");
  assert.equal(confirmed.ventas.length, 0, "La confirmación devuelve la lista conciliada al teléfono");
  assert.ok((await bajarNegocio("test")).deleted.ventas.includes("v1"), "La descarga conserva el borrado");
  for (const name of lists) {
    fixture.cloud = structuredClone(original);
    await subirNegocio("test", { ...structuredClone(original), [name]: [], deleted: { ...deleted, [name]: original[name].map(item => item.id) }, syncFormat: 2 });
    assert.equal(fixture.cloud[name].length, 0, `Borrado de ${name}`);
  }
  fixture.cloud = structuredClone(original);
  await subirNegocio("test", { ...structuredClone(original), productos: [{ ...row("p1"), monto: 70, updatedAt: 20 }] });
  await subirNegocio("test", original);
  assert.equal(fixture.cloud.productos[0].monto, 70, "Copia vieja no reemplaza edición reciente");
  const before = structuredClone(fixture.cloud);
  let current = true;
  fixture.afterRead = () => { current = false; };
  await assert.rejects(subirNegocio("test", removed, () => current), /negocio-session-changed/);
  assert.deepEqual(fixture.cloud, before);
} finally {
  delete globalThis.__businessSyncFixture;
}
console.log("Respaldo original de Negocio: borrados y ediciones no reaparecen por clientes atrasados; sesión cambiada no escribe.");
