import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const transpile = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const loaded = new Map();
function originalModule(file) {
  if (loaded.has(file)) return loaded.get(file);
  const entry = { exports: {} };
  loaded.set(file, entry.exports);
  vm.runInNewContext(transpile(read(file)), { module: entry, exports: entry.exports,
    require: name => {
      assert.ok(name.startsWith("@/utils/"), `dependencia financiera original: ${name}`);
      return originalModule(`${name.slice(2)}.ts`);
    } });
  return entry.exports;
}
function source(file) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(tree), node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { tree, declarations };
}
function memoHooks(scope) {
  let index = 0;
  const slots = [];
  scope.useMemo = (build, deps) => {
    const slot = index++, prior = slots[slot];
    if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) slots[slot] = { deps, value: build() };
    return slots[slot].value;
  };
  scope.useCallback = (callback, deps) => scope.useMemo(() => callback, deps);
  return () => { index = 0; };
}
const results = [], failures = [];
function scenario(name, run) {
  try { run(); } catch (error) { failures.push(`${name}: ${error.message}`); }
}

scenario("lista privada", () => {
  const { tree, declarations } = source("screens/Cajas.tsx");
  let amountExpression;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "cajasEnLista.map") {
      function findAmount(child) {
        if (ts.isCallExpression(child) && child.expression.getText(tree) === "fmt") amountExpression = child.arguments[0].getText(tree);
        ts.forEachChild(child, findAmount);
      }
      findAmount(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(amountExpression, "ejecutar el importe de la tarjeta original, también en la versión anterior");
  const cajaTree = ts.createSourceFile("utils/cajas.ts", read("utils/cajas.ts"), ts.ScriptTarget.Latest, true);
  const saldoFunction = cajaTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "saldoCaja");
  const saldoCaja = vm.runInNewContext(transpile(`(${saldoFunction.getText(cajaTree).replace(/^export\s+/, "")})`));
  const boxes = Array.from({ length: 25 }, (_, id) => ({ id: id === 24 ? "__proto__" : `caja-${id}`, archivadaLocal: id % 4 === 0 }));
  const rows = Array.from({ length: 10_000 }, (_, index) => ({ id: `m-${index}`, cajaId: boxes[index % boxes.length].id,
    tipo: index % 3 ? "ingreso" : "gasto", monto: index % 2 ? 0.1 : 0.2,
    ...(index % 7 === 0 ? { personalTransactionId: index + 1 } : {}) }));
  const before = JSON.stringify(rows);
  let visits = 0;
  const tracked = rows.map(row => new Proxy(row, { get(target, property) {
    if (property === "cajaId") visits++;
    return Reflect.get(target, property);
  } }));
  const scope = { datos: { movimientos: tracked }, saldoCaja };
  const reset = memoHooks(scope);
  const prepare = ["saldosPrivadas"].filter(name => declarations.has(name))
    .map(name => `globalThis.${name} = ${declarations.get(name).initializer.getText(tree)};`).join("\n");
  const render = () => {
    reset(); vm.runInNewContext(transpile(prepare), scope);
    return boxes.map(item => {
      scope.item = item;
      return vm.runInNewContext(transpile(amountExpression), scope);
    });
  };
  const expected = boxes.map(box => saldoCaja(box.id, rows));
  assert.deepEqual(render(), expected, "misma suma, mismo orden y transferencias incluidas");
  const firstVisits = visits;
  for (let i = 0; i < 20; i++) assert.deepEqual(render(), expected, "seleccionar, escribir y abrir el código conservan los importes");
  results.push({ case: "private", boxes: boxes.length, movements: rows.length, renders: 21,
    firstMovementVisits: firstVisits, totalMovementVisits: visits });
  assert.ok(firstVisits <= rows.length, `una pasada basta para todas las cajas: ${firstVisits} lecturas para ${rows.length} movimientos`);
  assert.equal(visits, firstVisits, "veinte cambios visuales no vuelven a recorrer los movimientos");
  const selectedBalance = declarations.get("saldoActual").initializer.getText(tree);
  for (const box of [...boxes, { id: "sin-movimientos" }, null]) {
    scope.caja = box;
    assert.equal(vm.runInNewContext(transpile(selectedBalance), scope), box ? saldoCaja(box.id, rows) : 0,
      "seleccionar una caja usa el mismo importe exacto que su tarjeta");
  }
  for (const next of [
    [...rows, { id: "aporte", cajaId: boxes[0].id, tipo: "ingreso", monto: 123.45 }],
    rows.map((row, i) => i === 0 ? { ...row, monto: 987.65 } : row),
    rows.filter((_, i) => i !== 0),
    [],
  ]) {
    scope.datos = { movimientos: next };
    assert.deepEqual(render(), boxes.map(box => saldoCaja(box.id, next)), "añadir, editar, borrar y vaciar actualizan cada saldo");
  }
  assert.equal(JSON.stringify(rows), before, "presentación no modifica movimientos");
});

scenario("disponible de Personal en caja compartida", () => {
  const { tree, declarations } = source("screens/SharedBoxes.tsx");
  let availableExpression;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "SpaceMovementSheet") {
      const attr = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(tree) === "availableText");
      availableExpression = attr?.initializer.expression.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(availableExpression, "ejecutar el importe real enviado al formulario");
  const finances = originalModule("utils/finances.ts");
  let calculations = 0;
  const rows = Array.from({ length: 1_000 }, (_, id) => ({ id, date: id % 2 ? "2026-09-20" : "2026-10-20", type: id % 3 ? "income" : "expense", amount: 0.1,
    ...(id % 11 === 0 ? { internalTransfer: "box" } : {}) }));
  const scope = { budgets: { "2026-09": 200, "2026-10": 300 }, transactions: rows, goals: [], totalApartado: originalModule("utils/ahorro.ts").totalApartado, carryoverCleared: [], movementDate: "2026-10-20", owner: true,
    userCurrency: "PEN", t: (_key, values) => values.amount, formatAmount: String, currencySymbolFor: () => "S/",
    disponiblePersonalEnFecha: (...args) => { calculations++; return finances.disponiblePersonalEnFecha(...args); },
    saldoLibrePersonalEnFecha: (...args) => { calculations++; return finances.saldoLibrePersonalEnFecha(...args); } };
  const reset = memoHooks(scope);
  const prepare = ["apartadoPersonal", "saldoPersonalEn", "disponibleMovimiento"].filter(name => declarations.has(name))
    .map(name => `globalThis.${name} = ${declarations.get(name).initializer.getText(tree)};`).join("\n");
  const render = () => {
    reset(); vm.runInNewContext(transpile(prepare), scope);
    return vm.runInNewContext(transpile(availableExpression), scope);
  };
  const expected = () => String(finances.disponiblePersonalEnFecha(scope.movementDate, scope.budgets, scope.transactions, scope.carryoverCleared));
  assert.equal(render(), expected());
  for (let i = 0; i < 20; i++) assert.equal(render(), expected());
  results.push({ case: "sharedPersonalAvailable", movements: rows.length, renders: 21, calculations });
  assert.equal(calculations, 1, "escribir monto, abrir/cerrar código y seleccionar no recalculan todo Personal");
  scope.owner = false;
  assert.equal(render(), undefined, "otro integrante no recibe el saldo de Personal del propietario");
  assert.equal(calculations, 1, "no calcular Personal cuando ese integrante no puede usarlo");
  scope.owner = true;
  assert.equal(render(), expected(), "volver al propietario usa el cálculo vigente");
  for (const change of [
    () => { scope.movementDate = "2026-09-25"; },
    () => { scope.transactions = [...rows, { id: "nuevo", date: "2026-09-25", type: "expense", amount: 10 }]; },
    () => { scope.budgets = { ...scope.budgets, "2026-09": 500 }; },
    () => { scope.movementDate = "2026-10-25"; scope.carryoverCleared = ["2026-10"]; },
  ]) {
    const prior = calculations; change();
    assert.equal(render(), expected(), "fecha, movimientos, presupuesto y arrastre usan sus valores actuales");
    assert.equal(calculations, prior + 1);
  }
});
console.log(JSON.stringify({ originalPresentationExecuted: true, adaptedReactOnly: true, noIO: true, notAndroidFPS: true, results }));
assert.deepEqual(failures, [], failures.join("\n"));
