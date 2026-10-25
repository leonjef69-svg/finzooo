import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Solo IO se sustituye. Se ejecutan el cargador y los manejadores reales,
// sin Firebase, Android, archivos generados ni datos del propietario.
const read = createSourceReader({ revision: process.env.FINO_EXPORT_SELECTIVE_BASELINE ?? "" });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const movimiento = (id, amount = 12) => ({ id, tipo: "ingreso", monto: amount, descripcion: `Sintético ${id}`,
  fecha: "2026-10-20", creadoEn: 1792483200000, category: "ventas", method: "cash", notes: "Nota sintética" });
const personal = [{ id: 10, type: "income", amount: 35, description: "Personal sintético", date: "2026-10-20", category: "otros", method: "cash", notes: "" }];
const bundle = await build({ entryPoints: ["utils/exportSpaces.ts"], bundle: true, platform: "node", format: "cjs", write: false,
  alias: { "@": process.cwd() }, logLevel: "silent", plugins: [{ name: "selective-export-io", setup(b) {
    const mocks = {
      "@/utils/firebase": "export const auth=globalThis.__finoSelectiveExportTest.auth;",
      "@/utils/cajas": "export const CAJAS_VACIAS={cajas:[],movimientos:[]};",
      "@/utils/storage": `export const STORAGE_KEYS={cajasDinero:'boxes'};
        export const getAccountStorageSession=()=>globalThis.__finoSelectiveExportTest.session;
        export async function loadJSON(){const h=globalThis.__finoSelectiveExportTest;h.calls.push('local');return structuredClone(h.local);}`,
      "@/utils/cloudFamilia": `export async function cargarFamiliaActiva(){const h=globalThis.__finoSelectiveExportTest;h.calls.push('family-index');return h.family;}
        export async function listarMovimientosFamilia(id){const h=globalThis.__finoSelectiveExportTest;h.calls.push('family:'+id);
          if(h.familyGate){h.entered.resolve();await h.familyGate.promise;}if(h.failFamily)throw Error('synthetic-offline');return structuredClone(h.familyRows);}`,
      "@/utils/cloudCajasCompartidas": `export async function listarCajasCompartidas(){const h=globalThis.__finoSelectiveExportTest;h.calls.push('shared-index');return h.shared;}
        export async function listarMovimientosCajaCompartida(id){const h=globalThis.__finoSelectiveExportTest;h.calls.push('shared:'+id);
          if(h.failShared)throw Error('synthetic-permission-denied');return structuredClone(h.sharedRows[id]??[]);}`,
    };
    b.onResolve({ filter: /^@\/utils\// }, a => mocks[a.path] ? { path: a.path, namespace: "selective-io" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "selective-io" }, a => ({ contents: mocks[a.path], loader: "js" }));
    b.onLoad({ filter: /[\\/]utils[\\/]exportSpaces\.ts$/ }, a => ({ contents: read("utils/exportSpaces.ts"), resolveDir: path.dirname(a.path), loader: "ts" }));
  } }] });
function phone() {
  const h = { auth: { currentUser: { uid: "synthetic-A" } }, session: 1, calls: [],
    local: { cajas: [{ id: "private", nombre: "Caja privada sintética" }], movimientos: [{ ...movimiento("p", 18), cajaId: "private" }] },
    family: { id: "f", nombre: "Familia sintética", currency: "USD" }, familyRows: [movimiento("f", 20)],
    shared: [{ id: "s", nombre: "Caja compartida sintética", currency: "EUR" }], sharedRows: { s: [movimiento("s", 25)] } };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url), __finoSelectiveExportTest: h, structuredClone });
  h.api = module.exports;
  h.load = (id = "personal", catalog = true) => h.api.cargarEspaciosExportables(personal, "PEN", "Personal", "Familia", "Caja", id, catalog);
  return h;
}
const selected = (spaces, id) => spaces.find(s => s.id === id);
const histories = h => h.calls.filter(c => /^(family|shared):/.test(c));
let passed = 0;
async function check(name, run) { await run(phone()); passed++; console.log(`OK ${name}`); }

await check("automático Personal no lee cajas ni hace consultas remotas", async h => {
  const spaces = await h.load("personal", false);
  assert.deepEqual(h.calls, []); assert.equal(spaces.length, 1);
  assert.equal(selected(spaces, "personal").transactions[0].amount, 35);
});
await check("abrir el selector trae nombres, sin historiales ajenos", async h => {
  const spaces = await h.load(); assert.deepEqual(histories(h), []);
  assert.deepEqual(h.calls.slice().sort(), ["family-index", "local", "shared-index"]);
  assert.equal(spaces.length, 4);
  for (const s of spaces.filter(s => s.id !== "personal")) {
    assert.equal(s.transactionsLoaded, false); assert.equal(s.transactions.length, 0);
    assert.throws(() => h.api.resumenFinanciero(s, "2026-10", {}, []), /not-loaded/);
  }
});
for (const [id, history, amount, currency] of [["family:f", "family:f", 20, "USD"], ["sharedBox:s", "shared:s", 25, "EUR"], ["box:private", null, 18, "PEN"]]) {
  await check(`elegir ${id} carga solo su dinero y conserva moneda/notas`, async h => {
    const spaces = await h.load(id), s = selected(spaces, id);
    assert.deepEqual(histories(h), history ? [history] : []);
    assert.equal(s.transactionsLoaded, true); assert.equal(s.transactions[0].amount, amount); assert.equal(s.currency, currency);
    assert.equal(s.transactions[0].category, "ventas"); assert.equal(s.transactions[0].notes, "Nota sintética");
    assert.equal(h.api.resumenFinanciero(s, "2026-10", {}, []).available, amount);
    for (const other of spaces.filter(s => ![id, "personal"].includes(s.id))) assert.equal(other.transactionsLoaded, false);
  });
}
for (const [id, calls] of [["family:f", ["family-index", "family:f"]], ["sharedBox:s", ["shared-index", "shared:s"]], ["box:private", ["local"]]]) {
  await check(`automático ${id} omite incluso el catálogo de otros espacios`, async h => {
    assert.ok(selected(await h.load(id, false), id)); assert.deepEqual(h.calls, calls);
  });
}
await check("cien cajas en el selector no generan cien lecturas de movimientos", async h => {
  h.shared = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, nombre: `Caja sintética ${i}`, currency: "PEN" }));
  const spaces = await h.load(); assert.equal(spaces.length, 103); assert.deepEqual(histories(h), []);
  h.calls.length = 0; await h.load("sharedBox:s79"); assert.deepEqual(histories(h), ["shared:s79"]);
});
for (const [id, flag] of [["family:f", "failFamily"], ["sharedBox:s", "failShared"]]) {
  await check(`fallo de red/permiso en ${id} no fabrica un historial vacío ni usa Personal`, async h => {
    h[flag] = true; const spaces = await h.load(id);
    assert.equal(selected(spaces, id), undefined); assert.equal(selected(spaces, "personal").transactions[0].amount, 35);
  });
}
await check("un historial realmente vacío sí se distingue del que no se cargó", async h => {
  h.familyRows = []; const s = selected(await h.load("family:f"), "family:f");
  assert.equal(s.transactionsLoaded, true); assert.equal(s.transactions.length, 0);
  assert.equal(h.api.resumenFinanciero(s, "2026-10", {}, []).available, 0);
});
await check("familia cerrada o ID desconocido no se reemplaza por otra cuenta", async h => {
  h.family = null; assert.equal(selected(await h.load("family:f", false), "family:f"), undefined);
  h.calls.length = 0; assert.equal(selected(await h.load("sharedBox:missing", false), "sharedBox:missing"), undefined);
  assert.deepEqual(histories(h), []);
});
await check("sin sesión no se consulta dinero remoto", async h => {
  h.auth.currentUser = null; assert.equal(selected(await h.load("sharedBox:s", false), "sharedBox:s"), undefined);
  assert.deepEqual(h.calls, []);
});
for (const change of ["session", "A-B-A", "uid"]) {
  await check(`respuesta tardía se rechaza si cambió ${change}`, async h => {
    h.familyGate = deferred(); h.entered = deferred(); const task = h.load("family:f"); await h.entered.promise;
    if (change === "uid") h.auth.currentUser = { uid: "synthetic-B" };
    else if (change === "A-B-A") { h.session = 3; h.auth.currentUser = { uid: "synthetic-A" }; }
    else h.session = 2;
    h.familyGate.resolve(); await assert.rejects(task, /export-session-changed/);
  });
}

function originalLoadEffect(deps) {
  const file = ts.createSourceFile("ExportPdfSheet.tsx", read("screens/ExportPdfSheet.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "useEffect" && node.arguments[0]?.getText(file).includes("cargarEspaciosExportables(")) callback = node.arguments[0].getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file); assert.ok(callback, "efecto original de selección encontrado");
  const compiled = ts.transpile(`const effect = ${callback};`, { target: ts.ScriptTarget.ES2022 });
  return new Function(...Object.keys(deps), compiled + "\nreturn effect;")(...Object.values(deps));
}
await check("cambiar Familia lenta a Personal no espera ni aplica la respuesta anterior", async h => {
  let spaces = [{ id: "personal", kind: "personal", transactions: personal }], loading;
  const deps = id => ({ transactions: personal, userCurrency: "PEN", t: k => k, espacioId: id, silent: false, autoExport: false,
    getAccountStorageSession: () => h.session, cargarEspaciosExportables: h.api.cargarEspaciosExportables,
    setEspacios: value => { spaces = typeof value === "function" ? value(spaces) : value; },
    setHistorialCargando: value => { loading = value; },
    loadJSON: async () => [], STORAGE_KEYS: { carryoverCleared: "carry" }, setCarryoverCleared() {}, setEspaciosCargando() {},
  });
  h.familyGate = deferred(); h.entered = deferred();
  const closeFamily = originalLoadEffect(deps("family:f"))(); await h.entered.promise;
  closeFamily(); const closePersonal = originalLoadEffect(deps("personal"))();
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(loading, false); assert.equal(selected(spaces, "personal").transactions[0].amount, 35);
  h.familyGate.resolve(); for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(selected(spaces, "family:f").transactionsLoaded, false, "el resultado cancelado no sustituye al catálogo actual"); closePersonal();
});
await check("Personal queda utilizable aunque el catálogo remoto no termine", async h => {
  let loading = true;
  originalLoadEffect({ transactions: personal, userCurrency: "PEN", t: k => k, espacioId: "personal", silent: false, autoExport: false,
    getAccountStorageSession: () => h.session, cargarEspaciosExportables: () => new Promise(() => {}),
    setEspacios() {}, setHistorialCargando: value => { loading = value; },
  })();
  assert.equal(loading, false, "el catálogo remoto no es requisito para exportar Personal");
});
await check("botón manual rechaza datos pendientes antes de generar cualquier archivo", async () => {
  for (const [loading, space, expected] of [[true, { transactionsLoaded: true }, "common.loading"], [false, { transactionsLoaded: false }, "exportPdf.spaceUnavailable"]]) {
    let notice;
    const run = handlerOriginal("screens/ExportPdfSheet.tsx", "handleExport", {
      exportLock: { current: false }, espaciosCargando: loading, espacio: space, showToast: value => { notice = value; }, t: key => key,
    }, read("screens/ExportPdfSheet.tsx"));
    await run(); assert.equal(notice, expected);
  }
});
console.log(`${passed} escenarios: consultas selectivas, resultados originales, red, sesión y cambio de selección; ningún servicio ni archivo real`);
