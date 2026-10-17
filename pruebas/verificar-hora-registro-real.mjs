import assert from "node:assert/strict";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_MOVEMENT_TIME_BASELINE ?? "" });
const opened = new Date(2026, 9, 14, 8, 5).getTime(), saved = new Date(2026, 9, 14, 8, 12).getTime();
const horaDe = handlerOriginal("utils/format.ts", "horaDe", {}, read("utils/format.ts"));
const deps = { transaction: undefined, time: horaDe(opened), type: "expense", amount: "10", category: "comida", icono: undefined, iconColor: "green", date: "2026-10-14", method: "cash", description: "Prueba", notes: "", userCurrency: "PEN", parseAmountInput: Number, nextId: () => 100, horaDe, Date: { now: () => saved } };
deps.source = undefined;
const original = handlerOriginal("screens/AddSheet.tsx", "createMovement", deps, read("screens/AddSheet.tsx"));
assert.equal(original().time, horaDe(saved), "la hora se toma al guardar, no al abrir el formulario siete minutos antes");
for (const time of [undefined, "", "3:21 p.m."]) {
  const tx = { id: 12, type: "expense", amount: 5, category: "comida", date: "2020-01-01", time, origin: "imported" };
  const edit = handlerOriginal("screens/AddSheet.tsx", "createMovement", { ...deps, source: tx, transaction: tx, time: time || horaDe(opened) }, read("screens/AddSheet.tsx"));
  assert.equal(edit().time, time, "editar conserva la hora original incluso cuando falta");
}
for (const unknown of [0, -1, NaN, Infinity, 1e25]) assert.equal(horaDe(unknown), "", "no fabrica una hora para un instante ausente/inválido");
assert.equal(horaDe(new Date(2026, 9, 14, 0, 5).getTime()), "12:05 a.m.");
assert.equal(horaDe(new Date(2026, 9, 14, 12, 5).getTime()), "12:05 p.m.");
for (const file of ["utils/cloudFamilia.ts", "utils/cloudCajasCompartidas.ts"]) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const initializer = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(tree) === "alNumero").initializer;
  const code = ts.transpileModule(`return (${initializer.getText(tree)});`, { compilerOptions: { module: ts.ModuleKind.None } }).outputText;
  const convert = new Function("Date", code)({ now: () => saved });
  assert.equal(convert(null), 0, file + ": sello ausente nunca pasa a ser la hora de lectura");
  assert.equal(convert(undefined), 0);
  assert.equal(convert(saved), saved);
  assert.equal(convert({ toMillis: () => saved }), saved, "sello real del servidor conservado");
}
console.log("Hora original: Guardar usa el reloj de ese momento, edición/importados sin hora no inventan una, AM/PM correctos y sellos remotos ausentes no toman Date.now. Sin registro financiero real.");
