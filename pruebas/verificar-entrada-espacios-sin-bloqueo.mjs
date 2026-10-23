import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_ENTRY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function find(file, predicate) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (!result && predicate(node)) result = node; if (!result) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(result, file); return result;
}
// Ejecuta las condiciones reales que rodean el contenido, incluyendo las
// ramas falsas. No basta con buscar que el texto Crear exista en el archivo.
function reachable(node, scope) {
  let child = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (!ts.isConditionalExpression(parent)) continue;
    if (child !== parent.whenTrue && child !== parent.whenFalse) continue;
    const yes = Boolean(vm.runInNewContext(parent.condition.getText(), scope));
    if (yes !== (child === parent.whenTrue)) return false;
  }
  return true;
}
const cajas = "screens/Cajas.tsx";
const rows = find(cajas, node => ts.isCallExpression(node) && node.expression.getText() === "cajasEnLista.map");
const scope = { ready: true, compartiendo: false, caja: undefined, lista: true,
  cajasOcultas: new Set(), accountUid: "A", verArchivadas: false, compartidasConocidas: false, cargandoCompartidas: true,
  compartidaAbierta: null, cajasEnLista: [{ id: "local" }], compartidasEnLista: [] };
assert.equal(reachable(rows, scope), true, "la caja local no espera internet");
scope.ready = false;
assert.equal(reachable(rows, scope), true, "el contenedor y Crear no desaparecen al leer el teléfono");
const save = find(cajas, node => ts.isJsxAttribute(node) && node.name.getText() === "onPress"
  && node.initializer?.getText() === "{crearCaja}").parent;
const disabled = save.properties.find(prop => prop.name?.getText() === "disabled").initializer.expression;
assert.equal(vm.runInNewContext(disabled.getText(), { ready: false, guardando: false }), true,
  "mostrar el formulario no permite guardar sobre datos todavía desconocidos");
const family = find("screens/Family.tsx", node => ts.isJsxElement(node) && node.openingElement.tagName.getText() === "Text"
  && node.getText().includes('{t("family.listHelp")}'));
assert.equal(reachable(family, { cargando: true, verTodas: true, auth: { currentUser: { uid: "A" } }, familia: null }), true,
  "Crear/Unirme de Familia no esperan la consulta inicial");
console.log("Entrada original: lista local y controles disponibles durante consultas pendientes; guardado protegido.");
