import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const item = { id: "m1", tipo: "gasto", monto: 15, descripcion: "Almuerzo", category: "comida", notes: "Compartido", fecha: "2026-10-07", creadoEn: 1791403200000, method: "cash" };
const fixture = {
  auth: { currentUser: { uid: "test" } },
  local: { cajas: [{ id: "c1", nombre: "Local" }], movimientos: [{ ...item, cajaId: "c1" }] },
  family: { id: "f1", nombre: "Familia", currency: "USD" },
  familyMovements: [{ ...item }, { ...item, id: "m2", category: undefined, notes: undefined },
    { ...item, id: "aporte", tipo: "ingreso", monto: 100, personalTransactionId: 12 }],
  shared: [{ id: "s1", nombre: "Caja", currency: "EUR" }],
  sharedMovements: [{ ...item }],
};
globalThis.__finoExportFixture = fixture;
const mocks = {
  "@/utils/firebase": "export const auth = globalThis.__finoExportFixture.auth;",
  "@/utils/cajas": "export const CAJAS_VACIAS = {cajas:[],movimientos:[]};",
  "@/utils/storage": "export const STORAGE_KEYS={cajasDinero:'cajas'}; export async function loadJSON(){return globalThis.__finoExportFixture.local;}",
  "@/utils/cloudFamilia": `export async function cargarFamiliaActiva(){return globalThis.__finoExportFixture.family;}
    export async function listarMovimientosFamilia(){if(globalThis.__finoExportFixture.failFamily) throw Error('offline');return globalThis.__finoExportFixture.familyMovements;}`,
  "@/utils/cloudCajasCompartidas": `export async function listarCajasCompartidas(){return globalThis.__finoExportFixture.shared;}
    export async function listarMovimientosCajaCompartida(){return globalThis.__finoExportFixture.sharedMovements;}`,
};
const result = await build({
  entryPoints: ["utils/exportSpaces.ts"], bundle: true, platform: "node", format: "cjs", write: false,
  plugins: [{ name: "only-io", setup(b) {
    b.onResolve({ filter: /^@\/utils\// }, args => mocks[args.path] ? { path: args.path, namespace: "io" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "io" }, args => ({ contents: mocks[args.path], loader: "js" }));
  } }],
});
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
const { cargarEspaciosExportables, resumenFinanciero } = module.exports;
try {
  const spaces = await cargarEspaciosExportables([], "PEN", "Personal", "Familia", "Caja");
  const family = spaces.find(s => s.kind === "family");
  assert.equal(family.currency, "USD", "No reetiquetar dólares como soles personales");
  for (const kind of ["family", "box", "sharedBox"]) {
    const tx = spaces.find(s => s.kind === kind).transactions[0];
    assert.equal(tx.category, "comida", kind);
    assert.equal(tx.notes, "Compartido", kind);
    assert.equal(tx.amount, 15);
    assert.equal(tx.method, "cash");
  }
  assert.equal(spaces.find(s => s.kind === "sharedBox").currency, "EUR");
  assert.equal(family.transactions[1].category, "otros");
  assert.equal(family.transactions[1].notes, "");
  assert.equal(family.transactions[2].internalTransfer, "family");
  assert.equal(resumenFinanciero(family, "2026-10", {}, []).income, 0);
  fixture.failFamily = true;
  assert.ok(!(await cargarEspaciosExportables([], "PEN", "P", "F", "C")).some(s => s.kind === "family"));
} finally {
  delete globalThis.__finoExportFixture;
}
console.log("Exportación real de espacios: moneda, categorías y notas conservadas; transferencias y fallos remotos comprobados.");
