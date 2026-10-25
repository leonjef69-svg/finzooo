import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta los cálculos y validaciones originales de las tres pantallas.
// FINO_TEST_BASELINE=1955c268 falla por ofrecer 100 cuando Personal deja libres 20.
const read = createSourceReader();
const transpile = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const loaded = new Map();
function originalModule(file) {
  if (loaded.has(file)) return loaded.get(file);
  const entry = { exports: {} };
  loaded.set(file, entry.exports);
  vm.runInNewContext(transpile(read(file)), { module: entry, exports: entry.exports,
    require: name => {
      assert.ok(name.startsWith("@/utils/"), `solo lógica financiera original: ${name}`);
      return originalModule(`${name.slice(2)}.ts`);
    } });
  return entry.exports;
}
const finances = originalModule("utils/finances.ts"), savings = originalModule("utils/ahorro.ts");
function declarationsFor(file) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map(), guards = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(tree), node);
    if (ts.isIfStatement(node) && /(?:saldoPersonalEn|disponibleMovimiento)/.test(node.expression.getText(tree))
      && node.thenStatement.getText(tree).includes("notEnoughPersonal")) guards.push(node.expression.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { tree, declarations, guards };
}
function memoHooks(scope) {
  let index = 0;
  const slots = [];
  scope.useMemo = (build, deps) => {
    const position = index++, prior = slots[position];
    if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) slots[position] = { deps, value: build() };
    return slots[position].value;
  };
  scope.useCallback = (build, deps) => scope.useMemo(() => build, deps);
  return () => { index = 0; };
}
const goal = (saved, extra = {}) => ({ id: 1, name: "Reserva", saved, target: 80, completed: saved >= 80, ...extra });
const rows = [
  { date: "2026-10-10", type: "expense", amount: 30 },
  { date: "2026-10-10", type: "expense", amount: 80, internalTransfer: "goal" },
  { date: "2026-10-10", type: "expense", amount: 20, internalTransfer: "box" },
  { date: "2026-10-11", type: "income", amount: 5, internalTransfer: "box" },
];
const cases = [
  { name: "reserva vigente", budgets: { "2026-10": 100 }, rows: [], goals: [goal(80)], expected: 20 },
  { name: "meta cumplida conserva la reserva", budgets: { "2026-10": 100 }, rows: [], goals: [goal(100)], expected: 0 },
  { name: "sin metas", budgets: { "2026-10": 100 }, rows: [], goals: [], expected: 100 },
  { name: "devolver parte libera ese importe", budgets: { "2026-10": 100 }, rows: [], goals: [goal(62)], expected: 38 },
  { name: "arrastre y transferencias una sola vez", budgets: { "2026-09": 150, "2026-10": 100 }, rows, goals: [goal(80)], expected: 125 },
  { name: "corte de arrastre no oculta déficit", budgets: { "2026-09": 150, "2026-10": 100 }, rows, goals: [goal(80)], cuts: ["2026-10"], expected: -25 },
  { name: "mes de operación anterior", date: "2026-09-30", budgets: { "2026-09": 150, "2026-10": 100 }, rows, goals: [goal(80)], expected: 70 },
  { name: "futuro sin inventar presupuesto", date: "2026-11-01", budgets: { "2026-09": 150, "2026-10": 100 }, rows, goals: [goal(80)], expected: 125 },
  { name: "tres decimales exactos", budgets: { "2026-10": 100.125 }, rows: [], goals: [goal(80.115)], expected: 20.01 },
  { name: "varias reservas y recibos de meta no duplicados", budgets: { "2026-10": 0.5 }, rows: [{ date: "2026-10-20", type: "expense", amount: 0.3, internalTransfer: "goal" }], goals: [goal(0.1), goal(0.2, { id: 2 })], expected: 0.2 },
];
let checked = 0;
for (const file of ["screens/Family.tsx", "screens/Cajas.tsx", "screens/SharedBoxes.tsx"]) {
  const { tree, declarations, guards } = declarationsFor(file);
  assert.ok(declarations.has("saldoPersonalEn"), "ejecutar el callback que usa la pantalla también en la versión antigua");
  const scope = { ...finances, ...savings, goals: [], budgets: {}, transactions: [], carryoverCleared: [],
    fechaHoy: () => "2026-10-24", fechaLocal: () => "2026-10-24", owner: true, movementDate: "2026-10-24" };
  const reset = memoHooks(scope);
  const prepare = ["apartadoPersonal", "saldoPersonalEn", "disponibleMovimiento"].filter(name => declarations.has(name))
    .map(name => `globalThis.${name} = ${declarations.get(name).initializer.getText(tree)};`).join("\n");
  for (const item of cases) {
    scope.budgets = item.budgets; scope.transactions = item.rows; scope.goals = item.goals;
    scope.carryoverCleared = item.cuts ?? []; scope.movementDate = item.date ?? "2026-10-24";
    const untouched = JSON.stringify([scope.budgets, scope.transactions, scope.goals, scope.carryoverCleared]);
    reset(); vm.runInNewContext(transpile(prepare), scope);
    assert.equal(scope.saldoPersonalEn(scope.movementDate), item.expected, `${file}: ${item.name}`);
    if (declarations.has("disponibleMovimiento")) assert.equal(scope.disponibleMovimiento, item.expected);
    // La cuenta anterior sigue disponible para código que necesita el total,
    // como la validación propia de Ahorro; no cambia ninguna ruta excluida.
    assert.equal(scope.disponiblePersonalEnFecha(scope.movementDate, scope.budgets, scope.transactions, scope.carryoverCleared),
      item.expected + savings.totalApartado(scope.goals));
    assert.equal(JSON.stringify([scope.budgets, scope.transactions, scope.goals, scope.carryoverCleared]), untouched);
    checked++;
  }
  // Cambiar la reserva con el formulario abierto invalida el importe memorizado.
  scope.budgets = { "2026-10": 100 }; scope.transactions = []; scope.goals = [goal(80)]; scope.carryoverCleared = []; scope.movementDate = "2026-10-24";
  reset(); vm.runInNewContext(transpile(prepare), scope);
  const firstCallback = scope.saldoPersonalEn;
  reset(); vm.runInNewContext(transpile(prepare), scope);
  assert.equal(scope.saldoPersonalEn, firstCallback, "un cambio puramente visual conserva el cálculo");
  scope.goals = [goal(90)]; reset(); vm.runInNewContext(transpile(prepare), scope);
  assert.equal(scope.saldoPersonalEn(scope.movementDate), 10, "el tope se renueva al apartar más dinero");
  scope.goals = [goal(62)]; reset(); vm.runInNewContext(transpile(prepare), scope);
  assert.equal(scope.saldoPersonalEn(scope.movementDate), 38, "el tope se renueva al devolver dinero a Personal");

  scope.goals = [goal(80)]; reset(); vm.runInNewContext(transpile(prepare), scope);
  Object.assign(scope, { origenDinero: "personal", origenInicial: "personal", anotando: "ingreso", tipo: "ingreso", modo: "ingreso",
    valor: 50, value: 50, valorInicial: 50, initial: 50, inicial: 50, desdePersonal: true,
    editandoAporte: null, aporteEditado: { monto: 0, fecha: "2026-10-24" } });
  assert.ok(guards.length, "hay comprobaciones reales de límite en la pantalla");
  assert.ok(guards.some(expression => vm.runInNewContext(transpile(expression), scope)),
    `${file}: sus condiciones originales impiden enviar 50 si solo quedan 20 libres`);
}
console.log(`Saldo libre de aportes: ${checked} casos financieros en tres pantallas, guardas originales, reservas renovadas y fuentes intactas. Sin IO, Android o Telegram.`);
