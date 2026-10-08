import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const require = createRequire(import.meta.url), root = process.cwd();
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT)");
let failure = null, batches = 0;
const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
globalThis.__businessStorage = {
  getItem: async key => get(key), setItem: async (key, value) => put(key, value),
  multiGet: async keys => keys.map(key => [key, get(key)]),
  getAllKeys: async () => db.prepare("SELECT key FROM store").all().map(row => row.key),
  multiRemove: async keys => keys.forEach(key => db.prepare("DELETE FROM store WHERE key=?").run(key)),
  removeItem: async key => db.prepare("DELETE FROM store WHERE key=?").run(key),
  multiSet: async entries => {
    batches++; db.exec("BEGIN IMMEDIATE");
    try {
      for (const [key, value] of entries) { put(key, value); if (failure === "rollback") throw Error("fallo-nativo"); }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    if (failure === "lost-ack") throw Error("respuesta-perdida");
  },
};
const stub = name => path.join(root, "pruebas/stubs", name);
const result = await build({
  stdin: { contents: `export * from './utils/negocio'; export * from './utils/businessSync';
    export * from './utils/storage'; export * from './utils/negocioCaptura';`, loader: "ts", resolveDir: root },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  alias: { "expo-crypto": stub("crypto.ts"), "expo-secure-store": stub("secure-store.ts"),
    "react-native": stub("rn.ts"), "lucide-react-native": stub("lucide.ts"),
    "expo-font": stub("font.ts"), "@expo/vector-icons": stub("vectoricons.ts") },
  plugins: [{ name: "sqlite-adapter", setup(b) {
    b.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: "storage", namespace: "sql" }));
    b.onLoad({ filter: /.*/, namespace: "sql" }, () => ({ contents: "export default globalThis.__businessStorage;", loader: "js" }));
  } }],
});
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
const api = module.exports;
api.setAccountStorageAvailable(true);
const original = { negocios: [{ id: "n1", nombre: "Tienda", actualizado: true }], productos: [{ id: "p1", negocioId: "n1", precio: 10 }],
  ventas: [{ id: "v1", negocioId: "n1", total: 20 }], movimientos: [{ id: "m1", negocioId: "n1", monto: 20 }] };
const live = { current: structuredClone(original) };
const setDatosNegocio = handlerOriginal("contexts/AppDataContext.tsx", "updateBusinessData", {
  datosNegocioLive: live, markBusinessChanges: api.markBusinessChanges, mergeBusinessData: api.mergeBusinessData, setRenderedDatosNegocio() {},
});
try {
  handlerOriginal("contexts/AppDataContext.tsx", "quitarVenta", { setDatosNegocio })("v1");
  assert.deepEqual(live.current.deleted.ventas, ["v1"]);
  assert.equal(await api.guardarDatosNegocio(live.current), true);
  assert.equal((await api.cargarNegocio()).ventas.length, 0);
  assert.deepEqual((await api.cargarNegocio()).deleted.ventas, ["v1"]);
  const keys = [api.STORAGE_KEYS.negocios, api.STORAGE_KEYS.productos, api.STORAGE_KEYS.ventas,
    api.STORAGE_KEYS.movimientosNegocio, api.STORAGE_KEYS.businessDeleted];
  const before = keys.map(key => get(key));
  failure = "rollback";
  assert.equal(await api.guardarDatosNegocio(api.markBusinessChanges(live.current, { ...live.current, productos: [] })), false);
  assert.deepEqual(keys.map(key => get(key)), before, "Un fallo no guarda lista sin su marca de borrado");
  failure = "lost-ack";
  assert.equal(await api.guardarDatosNegocio(live.current), true, "Respuesta perdida se confirma leyendo lo realmente guardado");
  failure = null;
  const count = batches;
  assert.equal(await api.guardarDatosNegocio(live.current, () => false), false);
  assert.equal(batches, count, "Una copia de otra sesión no escribe");
  const deletedMove = api.markBusinessChanges(live.current, { ...live.current, movimientos: [] });
  assert.equal(await api.guardarDatosNegocio(deletedMove), true);
  assert.deepEqual((await api.cargarNegocio()).movimientos, []);
  assert.deepEqual(api.fusionarMovimientosNegocio([], original.movimientos, ["m1"]), []);
  assert.deepEqual(api.fusionarMovimientosNegocio([], original.movimientos, [], ["n1"]), []);
  const noChanges = [...original.movimientos];
  assert.equal(api.fusionarMovimientosNegocio(noChanges, noChanges), noChanges);
  const confirmed = api.mergeBusinessData(original, { ...original,
    productos: [{ ...original.productos[0], precio: 15, updatedAt: 20 }] });
  assert.equal(JSON.stringify(api.mergeBusinessData(confirmed, confirmed)), JSON.stringify(confirmed),
    "Aplicar la confirmación dos veces no inicia otra subida por cambios de orden");
  const recent = api.markBusinessChanges(confirmed, { ...confirmed,
    productos: [{ ...confirmed.productos[0], precio: 18 }] }, 30);
  assert.equal(api.mergeBusinessData(recent, confirmed).productos[0].precio, 18,
    "Una confirmación atrasada no reemplaza la edición local reciente");
  setDatosNegocio(original, true);
  handlerOriginal("contexts/AppDataContext.tsx", "quitarNegocio", { setDatosNegocio, borrarNegocioYLoSuyo: api.borrarNegocio })("n1");
  const cascade = api.mergeBusinessData(live.current, original);
  for (const name of api.BUSINESS_LISTS) assert.equal(cascade[name].length, 0, name);
  assert.throws(() => api.mergeBusinessData({ ...original, deleted: { ventas: null } }, {}), /negocio-datos-invalidos/);
  assert.throws(() => api.mergeBusinessData({ ...original, productos: [...original.productos, ...original.productos] }, {}), /negocio-datos-invalidos/);
  assert.throws(() => api.mergeBusinessData({ ...original, syncFormat: 3 }, {}), /negocio-datos-invalidos/);
} finally {
  db.close(); delete globalThis.__businessStorage;
}
console.log("Negocio local original: borrados por acciones reales, lote SQLite, reinicio, fallo/respuesta perdida, cascada y datos inválidos comprobados.");
