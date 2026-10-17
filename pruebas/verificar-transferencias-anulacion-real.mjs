import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { withImmediateRemoval } from "./helpers/immediate-removal-original.mjs";

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const module = { exports: {} };
vm.runInNewContext(js(read("components/SpaceTransferAmounts.tsx")), { module, exports: module.exports, React, require: () => ({ Text: "Text", View: "View" }) });
const render = module.exports.default;
function texts(value) {
  if (Array.isArray(value)) return value.flatMap(texts);
  if (!value || typeof value === "boolean") return [];
  return typeof value === "object" ? value.children.flatMap(texts) : [String(value)];
}
const props = { title: "Familia prueba", sentLabel: "Enviado", returnedLabel: "Devuelto", sent: 0, returned: 100, format: value => `S/ ${value}` };
// La versión anterior falla mostrando un envío de cero, no por API ausente.
assert.equal(texts(render(props)).includes("Enviado"), false, "una devolución sola no se presenta como Enviado S/0");
assert.deepEqual(texts(render(props)), ["Familia prueba", "Devuelto", "S/ 100"]);
assert.equal(texts(render({ ...props, sent: 100, returned: 0 })).includes("Devuelto"), false);
assert.equal(texts(render({ ...props, sent: 100 })).includes("Enviado"), true);

const bundled = buildSync({ stdin: { contents: 'export * from "./utils/spaceDeletionNotice.ts"; export * from "./utils/linkedTransfers.ts"; export * from "./constants/i18n.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() } });
const actual = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(createRequire(import.meta.url), actual, actual.exports);
const api = actual.exports;
const contribution = { id: "contribution", tipo: "ingreso", monto: 100, personalOwnerUid: "A", personalTransactionId: 1 };
const returned = { id: "return", tipo: "gasto", monto: 100, personalOwnerUid: "A", personalTransactionId: 2, personalReturnAmount: 100 };
for (const language of ["es", "en", "pt"]) {
  const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), api.translations[language][key] || key);
  const single = api.spaceDeletionNotice([returned], t, value => `S/ ${value}`);
  assert.ok(single.message.includes("S/ 100")); assert.ok(!single.message.includes("spaces."));
  assert.equal(single.action, t("spaces.cancelTransfer"));
  const pair = api.spaceDeletionNotice([contribution, returned], t, String);
  assert.notEqual(pair.message, single.message); assert.notEqual(pair.action, t("common.delete"));
  assert.equal(api.spaceDeletionNotice([{ id: "cash", tipo: "ingreso", monto: 10 }], t, String).action, t("common.delete"));
}
function arrow(file, name, scope) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer; ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, name); vm.runInNewContext(js(`globalThis.action = ${found.getText(tree)};`), scope); return scope.action;
}
{
  const calls = [], scope = { ...api, uid: "A", auth: { currentUser: { uid: "A" } }, caja: { id: "box" }, owner: true, movimientos: [contribution, returned], busy: false,
    ejecutar: action => action(work => work()), withImmediateRemoval, mounted: { current: true }, getAccountStorageSession: () => 1, accountSession: 1,
    setMovimientosOcultos() {}, borradosConfirmados: { current: new Map() }, t: key => key, showToast() {},
    borrarAportePersonal: async (_kind, _space, id) => calls.push(`space:${id}`),
    deleteLinkedTransferTransaction: async id => { calls.push(`personal:${id}`); return true; },
    setMovimientos: update => { scope.movimientos = update(scope.movimientos); },
  };
  const remove = arrow("screens/SharedBoxes.tsx", "borrarGrupo", scope);
  await remove(["contribution", "return"]);
  assert.deepEqual(calls, ["space:return", "personal:2", "space:contribution", "personal:1"], "Caja compartida anula devolución antes del aporte, en ambos lados");
  assert.equal(scope.movimientos.length, 0);
  scope.movimientos = [contribution, returned]; calls.length = 0;
  await remove(["contribution"]); assert.equal(calls.length, 0, "no permite quitar solo el aporte con la devolución todavía vigente");
  scope.movimientos = [{ ...contribution, personalOwnerUid: "B" }]; await remove(["contribution"]);
  assert.equal(calls.length, 0, "el dueño no anula dinero personal de otro miembro");
}
for (const file of ["screens/Family.tsx", "screens/Cajas.tsx", "screens/SharedBoxes.tsx"]) {
  let dialog, calls = 0;
  const scope = { ...api, seleccionados: ["return"], movimientos: [returned], ocupado: false, guardando: false, busy: false,
    t: key => key, fmtFamilia: String, fmt: String, Alert: { alert: (...args) => { dialog = args; } },
    borrarSeleccionados: async () => { calls++; }, borrar: async () => { calls++; }, borrarGrupo: async () => { calls++; } };
  const confirm = handlerOriginal(file, file.includes("SharedBoxes") ? "confirmarBorrado" : "confirmarBorrarSeleccionados", scope, read(file));
  confirm(["return"]); assert.equal(calls, 0, "mostrar el aviso nunca ejecuta dinero");
  assert.equal(dialog[0], "spaces.cancelTransferTitle"); assert.equal(dialog[2][1].text, "spaces.cancelTransfer");
  await dialog[2][1].onPress(); assert.equal(calls, 1, "solo la confirmación expresa inicia la anulación");
}
// Salir de la pantalla no debe saltarse la contraparte de un borrado ya confirmado.
for (const file of ["screens/Family.tsx", "screens/SharedBoxes.tsx"]) {
  for (const reason of ["leave", "offline", "another-account", "same-account-new-session"]) {
    const calls = [], mounted = { current: true };
    let session = 1;
    const scope = { ...api, uid: "A", accountUid: "A", auth: { currentUser: { uid: "A" } }, owner: true,
      familia: { id: "family" }, caja: { id: "box" }, movimientos: [contribution, returned], seleccionados: ["return"],
      mounted, getAccountStorageSession: () => session, accountSession: 1, withImmediateRemoval,
      setMovimientosOcultos() {}, setMovimientos() {}, retirarMovimientoConfirmado() {},
      setSeleccionados() {}, setSeleccionando() {}, borradosConfirmados: { current: new Map() },
      t: key => key, showToast() {},
      ejecutar: action => action(async work => { const value = await work(); if (!mounted.current) throw Error("screen-left"); return value; }),
      borrarAportePersonal: async () => {
        if (reason === "offline") throw Error("offline");
        calls.push("space"); mounted.current = false;
        if (reason === "another-account") scope.auth.currentUser.uid = "B";
        if (reason === "same-account-new-session") session = 3;
      },
      deleteLinkedTransferTransaction: async () => { calls.push("personal"); return true; },
    };
    const name = file.includes("Family") ? "borrarSeleccionados" : "borrar";
    const remove = arrow(file, name, scope);
    await assert.rejects(remove(file.includes("Family") ? ["return"] : returned), reason === "offline" ? /offline/ : reason === "leave" ? /screen-left/ : /account-task-obsolete/);
    assert.deepEqual(calls, reason === "offline" ? [] : reason === "leave" ? ["space", "personal"] : ["space"], file + ": solo la misma cuenta/sesión se actualiza después de confirmar; salir de la pantalla no pierde la contraparte");
  }
}
console.log("Transferencias originales: devolución sin envío cero, avisos ES/EN/PT, confirmación previa, par compartido ordenado, salida al borrar y permisos conservados. No modifica dinero real.");
