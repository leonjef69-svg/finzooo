import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_HOME_VISIBILITY_BASELINE });
const source = read("screens/Home.tsx"), tree = ts.createSourceFile("Home.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const home = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "Home");
const statements = home.body.statements;
const declarations = statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]);
const prefs = declarations.find(node => node.initializer?.getText(tree) === "useHomeVisibility(ready)");
const toggle = statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "togglePreviousBalance").getText(tree);
const card = declarations.find(node => node.name.getText(tree) === "showPreviousBalanceCard").initializer.getText(tree);
const run = (code, scope) => vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), scope);
const plain = value => JSON.parse(JSON.stringify(value));
let uid = "A", session = 1, saved = null, writeOK = true, holdRead;
const writes = [], notices = [], effects = [];
const auth = { get currentUser() { return uid ? { uid } : null; } };
const storage = { STORAGE_KEYS: { homeVisibility: "finzo:homeVisibility" }, getAccountStorageSession: () => session,
  hasUnreadableLocalData: () => false, loadJSON: async () => holdRead ? holdRead : saved,
  saveJSONNow: async (key, value) => { assert.equal(key, "finzo:homeVisibility", "solo se escribe la preferencia, nunca movimientos o presupuestos"); writes.push(plain(value)); if (writeOK) saved = plain(value); return writeOK; } };
function load(file, dependencies) {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    module: m, exports: m.exports, require: name => dependencies(name),
  }); return m.exports;
}
let api, hook;
if (prefs) {
  api = load("utils/homeVisibility.ts", name => name.endsWith("firebase") ? { auth } : storage);
  hook = load("utils/useHomeVisibility.ts", name => name === "react" ? {
    useEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, get) => get(),
  } : name.endsWith("AppDataContext") ? { useAppData: () => ({ showToast: text => notices.push(text), t: key => key }) }
    : name.endsWith("firebase") ? { auth } : name.endsWith("homeVisibility") ? api : storage).useHomeVisibility;
  await api.loadHomeVisibility();
}
function mount() {
  const slots = []; let cursor = 0;
  return () => {
    cursor = 0;
    const s = { ready: true, mk: "2026-10", hasPreviousBalanceHistory: true, useHomeVisibility: hook,
      useState: initial => {
        const index = cursor++; if (!(index in slots)) slots[index] = initial;
        return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
      } };
    const code = prefs ? `const ${prefs.getText(tree)};` : declarations.filter(node =>
      node.name.getText(tree).includes("[hideBalance,") || node.name.getText(tree).includes("[collapsedPreviousBalanceMonths,"))
      .map(node => `const ${node.getText(tree)};`).join("\n");
    return run(`${code}\n${toggle}\n({ hideBalance, showCard: ${card}, togglePreviousBalance, setHideBalance })`, s);
  };
}
let render = mount(); assert.equal(render().showCard, true);
render().togglePreviousBalance(); assert.equal(render().showCard, false);
render = mount();
assert.equal(render().showCard, false, "Ocultar saldo anterior → Familia/Cajas → Personal no debe volver a mostrar la tarjeta");
// El fallo anterior se demuestra arriba por conducta, sin intentar cargar módulos inexistentes.
render().setHideBalance(true); render = mount(); assert.equal(render().hideBalance, true);
assert.equal(render().showCard, false);
render().togglePreviousBalance(); assert.equal(render().showCard, true, "solo Mostrar vuelve a abrir la tarjeta");
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(saved, { hideAmounts: true, collapsedPreviousBalanceMonths: [] });

// Reinicio de módulo: leer disco no expone nada mientras la preferencia está pendiente.
api = load("utils/homeVisibility.ts", name => name.endsWith("firebase") ? { auth } : storage);
assert.equal(api.readHomeVisibility().ready, false); assert.equal(api.readHomeVisibility().hideAmounts, true);
await api.loadHomeVisibility(); assert.equal(api.readHomeVisibility().hideAmounts, true);
await api.updateHomeVisibility(value => ({ ...value, collapsedPreviousBalanceMonths: ["2026-10"] }));
assert.deepEqual(plain(api.readHomeVisibility().collapsedPreviousBalanceMonths), ["2026-10"]);
writeOK = false; assert.equal(await api.updateHomeVisibility(value => ({ ...value, hideAmounts: true })), false);
assert.equal(api.readHomeVisibility().hideAmounts, true, "un fallo de disco no revela importes ni revierte la ocultación en memoria"); writeOK = true;

// Una lectura de A retenida no entrega su preferencia al usuario B ni a otra sesión de A.
let finish; holdRead = new Promise(resolve => { finish = resolve; }); session = 2;
const pending = api.loadHomeVisibility(); uid = "B"; session = 3;
finish({ hideAmounts: false, collapsedPreviousBalanceMonths: ["2026-10"] }); await pending;
assert.equal(api.readHomeVisibility().ready, false); assert.equal(api.readHomeVisibility().hideAmounts, true);
assert.deepEqual(plain(api.readHomeVisibility().collapsedPreviousBalanceMonths), []);
holdRead = undefined; saved = null; await api.loadHomeVisibility(); assert.equal(api.readHomeVisibility().hideAmounts, false);

const storageSource = read("utils/storage.ts");
assert.match(storageSource.slice(storageSource.indexOf("export const ACCOUNT_STORAGE_KEYS")), /STORAGE_KEYS.homeVisibility/,
  "la preferencia se limpia/archiva por cuenta con el inventario existente");
assert.ok(writes.length >= 3); assert.equal(notices.length, 0);
console.log("Inicio original: tarjeta oculta tras desmontar/navegar, ojo recordado, Mostrar explícito, disco/reinicio, lectura protegida y sesiones aisladas. Sin dinero real.");
