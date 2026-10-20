import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import ts from "typescript";

const revision = process.env.FINO_TEST_BASELINE;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Hash inválido");
const require = createRequire(import.meta.url);
async function original(files, historical = false) {
  const result = await build({ stdin: { contents: files.map(file => `export * from "./${file}";`).join("\n"), sourcefile: "metas-originales.ts", resolveDir: process.cwd() },
    bundle: true, write: false, format: "cjs", platform: "node", alias: { "@": process.cwd() },
    plugins: historical && revision ? [{ name: "fuentes-anteriores", setup(builder) { builder.onLoad({ filter: /\.ts$/ }, args => ({
      contents: execFileSync("git", ["show", `${revision}:${args.path.slice(process.cwd().length + 1).replaceAll("\\", "/")}`], { encoding: "utf8" }), loader: "ts" })); } }] : [] });
  const module = { exports: {} }; new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports); return module.exports;
}
// Primero una conducta anterior, no una API inexistente: la captura reportada.
const prior = await original(["utils/ahorro.ts"], true);
assert.equal(prior.hayDescuadre(-18, 0), false, "sin dinero en metas no dice que se gastó dinero apartado");
const api = await original(["utils/ahorro.ts", "utils/savingsActions.ts", "utils/personalHistory.ts", "utils/finances.ts", "utils/presupuestoMensual.ts", "utils/amount.ts", "utils/recordMerge.ts"]);
let sequence = 100;
const goal = { id: 1, creationId: "goal-one", name: "Viaje", target: 20, saved: 20, completed: true, createdDate: "2026-10-17" };
const receipt = (item, delta) => ({ id: ++sequence, creationId: `receipt-${sequence}`, internalTransferLink: `operation-${sequence}`, internalTransfer: "goal", internalTransferSpaceId: String(item.id),
  internalTransferSpaceName: item.name, type: delta > 0 ? "expense" : "income", amount: Math.abs(delta), date: "2026-10-17", category: "otros", description: item.name, notes: "", method: "transfer" });
const operationId = () => `operation-${++sequence}`;
const before = JSON.stringify(goal);
const edited = api.prepareSavingsAction([goal], { kind: "edit", goal: { ...goal, target: 30 }, saved: 10, expectedSaved: 20 }, 100, operationId);
assert.equal(edited.goals[0].saved, 10); assert.equal(edited.goals[0].target, 30); assert.equal(edited.goals[0].completed, false);
assert.equal(api.saldoLibre(100, edited.reserved), 90); assert.equal(edited.upserts.length, 0, "editar el apartado no agrega un movimiento de ingreso");
assert.equal(api.prepareSavingsAction(edited.goals, { kind: "edit", goal: edited.goals[0], saved: 20, expectedSaved: 10 }, 100, operationId).reserved, 20);
for (const saved of [-1, NaN, Infinity, 101]) assert.throws(() => api.prepareSavingsAction([goal], { kind: "edit", goal, saved, expectedSaved: 20 }, 100, operationId));
assert.throws(() => api.prepareSavingsAction([{ ...goal, saved: 30 }], { kind: "edit", goal, saved: 10, expectedSaved: 20 }, 100, operationId), /savings-invalid-action/,
  "un formulario atrasado no retira el aporte que acaba de llegar");
const expense = { id: 30, creationId: "expense-one", amount: 20, type: "expense", category: "otros", description: "Compra", method: "cash", notes: "", date: "2026-10-17" };
const used = api.prepareSavingsAction([goal], { kind: "use", goalId: 1, transaction: expense }, 100, operationId);
assert.equal(used.goals[0].saved, 0); assert.equal(used.upserts.length, 1, "una compra, un único gasto; no una devolución visible más un gasto");
assert.equal(used.upserts[0].internalTransfer, undefined); assert.equal(used.upserts[0].amount, 20);
const allocation = used.upserts[0].goalFundingAllocations[0];
assert.equal(used.goals[0].funding.changes[allocation.operationId], -20); assert.equal(allocation.goalId, 1);
const totalAfter = api.disponiblePersonalEnFecha("2026-10-17", { "2026-10": 100 }, used.upserts, []);
assert.equal(totalAfter, 80); assert.equal(api.saldoLibre(totalAfter, used.reserved), 80, "usar la meta no aumenta el dinero libre en Personal");
assert.equal(api.totalsForMonth(used.upserts, "2026-10").spent, 20); assert.equal(api.totalsForMonth(used.upserts, "2026-10").income, 0);
assert.equal(api.matchesPersonalMovementFilter(used.upserts[0], "savings"), true);
for (const transaction of [{ ...expense, amount: 21 }, { ...expense, type: "income" }, { ...expense, internalTransfer: "family" }]) {
  assert.throws(() => api.prepareSavingsAction([goal], { kind: "use", goalId: 1, transaction }, 100, operationId));
}
assert.equal(JSON.stringify(goal), before);
assert.equal(api.transferidoPendienteDelMes([receipt(goal, 10)], "2026-10"), 0, "los recibos antiguos de ahorro no bloquean cambios como si fueran Cajas");

const sent = { ...expense, id: 40, creationId: "sent-one", amount: 100, date: "2026-09-20", internalTransfer: "family", internalTransferSpaceId: "family-one", internalTransferLink: "sent-remote" };
const returned = { ...sent, id: 41, creationId: "return-one", type: "income", date: "2026-10-17", internalTransferLink: "return-remote", internalTransferAllocations: [{ transactionId: 40, amount: 100 }] };
const rows = [sent, returned], rowsBefore = JSON.stringify(rows);
assert.deepEqual(new Set(api.returnedTransferHistoryIds(rows, 40)), new Set([40, 41]));
assert.deepEqual(new Set(api.returnedTransferHistoryIds(rows, 41)), new Set([40, 41]));
const hidden = api.preparePersonalHistoryRemoval(rows, [41]);
assert.equal(hidden.length, 2); assert.equal(hidden.filter(api.visiblePersonalMovement).length, 0);
for (const date of ["2026-09-20", "2026-10-17", "2026-11-01"]) assert.equal(api.disponiblePersonalEnFecha(date, { "2026-09": 500 }, hidden, []),
  api.disponiblePersonalEnFecha(date, { "2026-09": 500 }, rows, []), "quitar un par de meses distintos conserva TODOS los saldos y arrastres");
assert.equal(JSON.stringify(rows), rowsBefore);
const badReturns = [
  { ...returned, amount: 80, internalTransferAllocations: [{ transactionId: 40, amount: 80 }] },
  { ...returned, amount: 120, internalTransferAllocations: [{ transactionId: 40, amount: 120 }] },
  { ...returned, internalTransferAllocations: [] },
  { ...returned, internalTransferSpaceId: "other-family" },
  { ...returned, internalTransfer: "box" },
  { ...returned, internalTransferAllocations: [{ transactionId: 400, amount: 100 }] },
  { ...returned, internalTransferAllocations: [{ transactionId: 40, amount: 50 }, { transactionId: 40, amount: 50 }] },
];
for (const other of badReturns) {
  assert.equal(api.returnedTransferHistoryIds([sent, other], sent.id).length, 0);
  assert.throws(() => api.preparePersonalHistoryRemoval([sent, other], [sent.id]));
}
assert.equal(api.returnedTransferHistoryIds([{ ...sent, internalTransferConsumedAmount: 20 }, returned], 40).length, 0);
const savingsRow = receipt(goal, 10);
assert.equal(api.removablePersonalHistoryIds([savingsRow]).has(savingsRow.id), true);
assert.equal(api.preparePersonalHistoryRemoval([savingsRow], [savingsRow.id])[0].amount, 10);
const mutation = api.prepareTransactionMutation(rows, [], {}, hidden, [], () => `mutation-${++sequence}`, () => undefined);
const merged = api.mergeTransactionCopies(mutation.transactions, rows, [], [], mutation.metadata, {});
assert.equal(merged.transactions.filter(api.visiblePersonalMovement).length, 0, "una copia atrasada no vuelve a mostrar el par quitado");
const large = Array.from({ length: 5000 }, (_, i) => [{ ...sent, id: i * 2 + 1000 }, { ...returned, id: i * 2 + 1001, internalTransferAllocations: [{ transactionId: i * 2 + 1000, amount: 100 }] }]).flat();
assert.equal(api.removablePersonalHistoryIds(large).size, 10000, "diez mil filas de un espacio se recorren por grupos sin perder registros");

let hooks = [], cursor = 0, savedGoal;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const t = (key, params) => `${key}${params ? JSON.stringify(params) : ""}`;
const form = handlerOriginal("screens/GoalFormSheet.tsx", "GoalFormSheet", { React, ...api,
  useState: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], value => { hooks[index] = value; }]; }, useRef: value => { const index = cursor++; return hooks[index] ??= { current: value }; }, useEffect() {},
  useAppData: () => ({ userCurrency: "PEN", t, fmt: n => `S/${n}`, showToast() {} }), useSavingsBalance: () => ({ free: 80, max: 80 }),
  nextId: () => 1, fechaLocalISO: () => "2026-10-17", currencySymbolFor: () => "S/", useSafeAreaInsets: () => ({ bottom: 0 }), useColorScheme: () => ({ colorScheme: "light" }),
  useKeyboardAnimatedPadding: () => ({ animatedPaddingStyle: {}, keyboardVisible: false, onFieldFocus() {}, onFieldBlur() {} }),
  Animated: { View: "View" }, View: "View", Text: "Text", TextInput: "Input", TouchableOpacity: "Button", ScrollView: "Scroll", X: "X",
});
function flatten(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(flatten); return [node, ...node.children.flatMap(flatten)]; }
const render = () => { cursor = 0; return form({ goal, onClose() {}, onSave: async (item, initial, expectedSaved) => { savedGoal = { item, initial, expectedSaved }; return true; } }); };
let tree = render(); flatten(tree).find(node => node.type === "Input" && node.props.accessibilityLabel === "savingsDetail.saved").props.onChangeText("10");
tree = render(); const button = flatten(tree).filter(node => node.type === "Button").at(-1);
assert.equal(button.props.disabled, false); await button.props.onPress(); assert.equal(savedGoal.item.saved, 10); assert.equal(savedGoal.item.target, 20); assert.equal(savedGoal.expectedSaved, 20);
const savingsUI = fs.readFileSync("screens/SavingsList.tsx", "utf8");
assert.ok(!savingsUI.includes('t("savings.total")') && !savingsUI.includes('t("savingsDetail.remaining"'));
assert.ok(savingsUI.includes('t("savings.personalAvailable")') && savingsUI.includes('t("savingsDetail.saved")') && savingsUI.includes('t("goalForm.targetLabel")'));
// El formulario reutilizado conserva la categoría de un borrador. Solo un
// cambio real entre ingreso/gasto escoge la categoría inicial del otro tipo.
const addSource = fs.readFileSync("screens/AddSheet.tsx", "utf8"), ast = ts.createSourceFile("AddSheet.tsx", addSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let typeEffect;
function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes('setCategory(type === "expense"')) typeEffect = node.arguments[0].getText(ast); ts.forEachChild(node, visit); }
visit(ast); assert.ok(typeEffect);
const effectCode = ts.transpileModule(`return (${typeEffect});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const initializedType = { current: "expense" }, categories = [];
const effect = type => new Function("initializedType", "type", "transaction", "setCategory", "setIcono", effectCode)(initializedType, type, undefined, value => categories.push(value), () => {});
effect("expense")(); effect("expense")(); assert.deepEqual(categories, [], "ni montar ni repetir el efecto pisa Otros o una categoría recuperada");
effect("income")(); assert.deepEqual(categories, ["salario"]); effect("expense")(); assert.deepEqual(categories, ["salario", "comida"]);
console.log("Metas originales: aportar/devolver/editar sin movimientos ficticios, usar ahorro como un solo gasto real, recibos antiguos preservados, meses/10.000 filas/copia antigua protegidos. React/IO adaptados; sin modificar dinero real.");
