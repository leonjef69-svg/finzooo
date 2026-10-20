import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_TEST_BASELINE || "c6f6a407";
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Hash inválido");
const require = createRequire(import.meta.url);
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
async function bundle(entries, historical = false) {
  const result = await build({ stdin: { contents: entries.map(file => `export * from "./${file}";`).join("\n"), sourcefile: "ahorro-original.ts", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() },
    plugins: historical && revision ? [{ name: "fuentes-git", setup(build) { build.onLoad({ filter: /\.ts$/ }, args => ({ contents: read(args.path.slice(process.cwd().length + 1).replaceAll("\\", "/")), loader: "ts" })); } }] : [] });
  const module = { exports: {} }; new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports); return module.exports;
}
// La base es la versión inmediatamente anterior a dejar de crear recibos
// ficticios. Así esta prueba demuestra que antes sí se generaba una fila.
const old = await bundle(["utils/ahorro.ts", "utils/finances.ts", "utils/saldoAnterior.ts", "utils/linkedTransfers.ts"], true);
const goal = { id: 1, creationId: "goal-a", name: "Laptop", target: 200, saved: 200, completed: true, createdDate: "2026-10-16" };
assert.equal(old.totalApartado([goal]), 200, "alcanzar el objetivo no gasta ni libera los fondos");
const receipt = { id: 10, creationId: "receipt-a", type: "expense", amount: 200, date: "2026-10-16", time: "1:00 p.m.", category: "otros", method: "transfer", description: "Laptop", internalTransfer: "goal", internalTransferSpaceId: "1", internalTransferLink: "a" };
assert.deepEqual(old.totalsForMonth([receipt], "2026-10"), { spent: 0, income: 0, transfersIn: 0, transfersOut: 0 });
assert.equal(old.saldoAnteriorDe("2026-11", { "2026-10": 500 }, [receipt], []), 500, "el mes siguiente no resta de nuevo el recibo");
assert.equal(old.compactPersonalTransferRows([receipt, { ...receipt, id: 11, internalTransferLink: "b" }]).length, 2, "dos aportes no se agrupan en un supuesto envío a Caja");
const api = await bundle(["utils/savingsActions.ts", "utils/personalHistory.ts"]);
let seq = 10;
const operationId = () => `operation-${++seq}`;
const base = { ...goal, saved: 0, completed: false };
const previousApi = await bundle(["utils/savingsActions.ts"], true);
const previousAdd = previousApi.prepareSavingsAction([base], { kind: "add", goalId: 1, amount: 200 }, 500,
  (item, delta) => ({ ...receipt, id: 12, creationId: "previous-receipt", type: delta > 0 ? "expense" : "income", amount: Math.abs(delta), internalTransferSpaceId: String(item.id), internalTransferLink: "previous-operation" }));
assert.equal(previousAdd.upserts.length, 1, "la versión anterior sí añadía un movimiento artificial al aportar");
const source = JSON.stringify([base]);
const add = api.prepareSavingsAction([base], { kind: "add", goalId: 1, amount: 200 }, 500, operationId);
assert.equal(add.reserved, 200); assert.equal(old.saldoLibre(500, add.reserved), 300); assert.equal(JSON.stringify([base]), source);
assert.equal(add.goals[0].completed, true); assert.equal(Object.values(add.goals[0].funding.changes).at(-1), 200);
assert.equal(add.upserts.length, 0, "apartar dinero actualiza la meta y no crea un movimiento de gasto");
const withdraw = api.prepareSavingsAction(add.goals, { kind: "withdraw", goalId: 1, amount: 50 }, 300, operationId);
assert.equal(withdraw.reserved, 150); assert.equal(old.saldoLibre(300, withdraw.reserved), 150); assert.equal(withdraw.upserts.length, 0, "liberar dinero no crea un ingreso falso");
const edit = api.prepareSavingsAction(add.goals, { kind: "edit", goal: { ...base, name: "PC", target: 400 } }, 500, operationId);
assert.equal(edit.goals[0].saved, 200); assert.equal(edit.goals[0].completed, false); assert.equal(edit.upserts.length, 0);
const created = api.prepareSavingsAction([], { kind: "create", goal: base, initial: 200 }, 500, operationId);
assert.equal(created.goals[0].saved, 200); assert.equal(created.upserts.length, 0, "crear una meta con aporte inicial no agrega una fila a Movimientos");
const removed = api.prepareSavingsAction(add.goals, { kind: "delete", goalId: 1 }, 500, operationId);
assert.equal(removed.goals.length, 0); assert.equal(removed.reserved, 0); assert.equal(removed.upserts.length, 0, "eliminar la meta libera el apartado, no registra un ingreso");
const expense = { ...receipt, id: 20, internalTransfer: undefined, amount: 400 };
assert.equal(api.expenseSavingsNeeded(400, 500, add.goals), 100);
const funded = api.prepareSavingsAction(add.goals, { kind: "expense", transaction: expense, allocations: [{ goalId: 1, amount: 100 }] }, 500, operationId);
assert.equal(funded.goals[0].saved, 100); assert.equal(funded.upserts.length, 1); assert.equal(funded.upserts[0].id, expense.id);
assert.equal(funded.upserts[0].goalFundingAllocations[0].amount, 100);
assert.equal(old.saldoLibre(100, funded.reserved), 0);
assert.equal(old.totalsForMonth(funded.upserts, "2026-10").spent, 400);
for (const kind of ["add", "withdraw"]) for (const amount of [NaN, Infinity, 0, -1, 501]) {
  assert.throws(() => api.prepareSavingsAction(add.goals, { kind, goalId: 1, amount }, 500, operationId));
}
for (const initial of [NaN, Infinity, -1, 501]) assert.throws(() => api.prepareSavingsAction([], { kind: "create", goal: base, initial }, 500, operationId));
for (const allocations of [[], [{ goalId: 1, amount: 99 }], [{ goalId: 1, amount: -1 }, { goalId: 1, amount: 101 }], [{ goalId: 2, amount: 100 }]]) {
  assert.throws(() => api.prepareSavingsAction(add.goals, { kind: "expense", transaction: expense, allocations }, 500, operationId));
}
const legacyReturn = { ...receipt, id: 11, creationId: "legacy-return", type: "income", amount: 50, internalTransferLink: "legacy-return-link" };
for (const row of [receipt, legacyReturn]) {
  assert.equal(api.matchesPersonalMovementFilter(row, "savings"), true); assert.equal(api.matchesPersonalMovementFilter(row, "all"), true);
  for (const filter of ["expense", "income", "transfer"]) assert.equal(api.matchesPersonalMovementFilter(row, filter), false);
}
assert.equal(api.matchesPersonalMovementFilter({ ...receipt, internalTransfer: "family" }, "transfer"), true);
assert.equal(api.matchesPersonalMovementFilter(expense, "expense"), true);
const recentApi = await bundle(["utils/recentMovementFilters.ts"]);
assert.equal(recentApi.showInPersonalRecent(receipt), false, "los aportes no llenan Movimientos recientes de Personal");
assert.equal(recentApi.showInPersonalRecent(legacyReturn), false, "las devoluciones antiguas tampoco vuelven a llenar Inicio");
assert.equal(recentApi.showInPersonalRecent(expense), true, "un gasto real pagado desde una meta sí queda entre los movimientos recientes");
assert.equal(old.totalApartado([{ ...base, saved: 0.1 }, { ...base, id: 2, saved: 0.2 }]), 0.3);
assert.equal(JSON.stringify([base]), source, "ni rechazos ni operaciones modifican la fuente");
const home = fs.readFileSync("screens/Home.tsx", "utf8"), history = fs.readFileSync("screens/History.tsx", "utf8");
assert.match(home, /saldoLibre\(personalTotal, apartado\)/); assert.match(history, /id: "savings"/);
assert.match(home, /showInPersonalRecent\(row\)/);
assert.match(history, /if \(tx\.internalTransfer === "goal"\) return[\s\S]*?<SavingsMovementRow/);
const savingsListSource = fs.readFileSync("screens/SavingsList.tsx", "utf8"), historySource = fs.readFileSync("screens/History.tsx", "utf8");
assert.doesNotMatch(savingsListSource, /recent\.map\(tx/, "Ahorro muestra las metas sin repetir los movimientos");
assert.doesNotMatch(savingsListSource, /savings\.historyLink|params: \{ savings: "1" \}/, "Ahorro no muestra un acceso separado al historial");
assert.doesNotMatch(home, /savings\.historyLink|personalHistoryHint|params: \{ savings: "1" \}/, "Inicio tampoco muestra el acceso separado al historial de ahorro");
assert.match(historySource, /id: "savings"/, "los registros antiguos siguen disponibles en el filtro general de Historial");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");
for (const language of ["es", "en", "pt"]) assert.ok(translations.includes(`  ${language}: {`));
for (const key of ["savings.tabGoals", "savings.tabMovements", "savings.movementSummary"])
  assert.equal((translations.match(new RegExp(`"${key}":`, "g")) || []).length, 3, `${key} está traducido en los tres idiomas`);
assert.ok(translations.includes('"savings.total": "Saldo Total en Personal"'));
// JSX original y pulsaciones reales de sus callbacks, con React/IO adaptados.
let hooks = [], cursor = 0, calls = [], outcome = false;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const t = (key, values = {}) => `${key}${Object.keys(values).length ? JSON.stringify(values) : ""}`;
const screen = handlerOriginal("screens/SavingsList.tsx", "SavingsList", {
  React, useState: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
  useRef: value => { const index = cursor++; return hooks[index] ??= { current: value }; }, useEffect() {},
  useAppData: () => ({ fmt: value => `S/${value}`, t, visualStyle: "peachOlive", commitSavingsAction: async action => { calls.push(action); return outcome; } }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), useColorScheme: () => ({ colorScheme: "light" }),
  irUnaVez() {}, BackButton: "Back", ScrollView: "Scroll", View: "View", Text: "Text", TouchableOpacity: "Button",
  PiggyBank: "Pig", Plus: "Plus", MoreHorizontal: "More", CheckCircle2: "Check", CircleHelp: "Help", ArrowUpRight: "Arrow", LinearGradient: "Gradient",
  GoalFormSheet: "GoalForm", MoveMoneySheet: "Move", ConfirmDialog: "Confirm", AvisoSoloLectura: "ReadOnly",
  UseSavingsSheet: "Use",
});
const screenGoal = { ...goal, target: 1000, completed: false };
const props = { goals: [screenGoal], disponible: 500, apartado: 200, libre: 300, monthLabel: "Octubre", onBack() {} };
const render = (extra = {}) => { cursor = 0; return screen({ ...props, ...extra }); };
function all(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(all); return [node, ...node.children.flatMap(all)]; }
const find = (root, predicate) => all(root).find(predicate);
let root = render();
assert.equal(find(root, node => node.type === "Receipt"), undefined, "Ahorro no duplica filas del historial");
assert.equal(find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.historyLink"))), undefined,
  "Ahorro no muestra un botón separado para el historial");
const movementTab = find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.tabMovements")));
const goalsTab = find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.tabGoals")));
assert.ok(movementTab && goalsTab, "Metas y Movimientos aparecen como dos botones compactos");
const header = root.children[0];
assert.equal(find(header, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.newGoal")))?.type, "Button", "Nueva meta está en el encabezado, antes del resumen/lista");
const createButton = find(header, node => node.type === "Button"); createButton.props.onPress();
root = render(); let form = find(root, node => node.type === "GoalForm"); assert.ok(form);
assert.equal(await form.props.onSave(base, 20), false); assert.equal(calls.at(-1).initial, 20);
assert.ok(find(render(), node => node.type === "GoalForm"), "fallar al guardar deja el formulario para reintentar");
form.props.onClose(); root = render(); assert.equal(find(root, node => node.type === "GoalForm"), undefined);
const saveButton = find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.save")));
saveButton.props.onPress(); root = render(); const move = find(root, node => node.type === "Move"); assert.equal(move.props.mode, "add");
outcome = true; assert.equal(await move.props.onConfirm(20), true); assert.equal(calls.at(-1).goalId, 1);
assert.equal(find(render(), node => node.type === "Move"), undefined, "confirmar cierra una sola hoja sin otra pantalla de meta");
movementTab.props.onPress(); root = render();
assert.ok(find(root, node => node.type === "Text" && node.children.includes("savings.movementSummary")), "Movimientos explica que presenta un resumen por meta");
const summaryRow = find(root, node => node.type === "View" && node.props.testID === "savings-movement-summary-1");
assert.equal(summaryRow?.type, "View", "la meta tiene una sola fila resumen en Movimientos");
assert.ok(all(summaryRow).some(node => node.type === "Text" && node.children.includes("Laptop")), "el resumen identifica la meta");
assert.ok(all(summaryRow).some(node => node.type === "Text" && node.children.includes("S/200")), "el resumen muestra cuánto hay ahorrado");
assert.ok(all(summaryRow).some(node => node.type === "Text" && node.children.includes("S/1000")), "el resumen muestra el objetivo sin crear otro movimiento");
assert.equal(find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.save"))), undefined, "Movimientos no repite las acciones de las tarjetas de metas");
const secondGoal = { ...goal, id: 2, creationId: "goal-b", name: "Viaje", saved: 50, target: 1000 };
root = render({ goals: [goal, secondGoal] });
assert.equal(all(root).filter(node => node.props.testID?.startsWith("savings-movement-summary-")).length, 2, "Movimientos muestra una sola fila por meta");
find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.tabGoals"))).props.onPress(); root = render();
assert.ok(find(root, node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.save"))), "Metas vuelve a mostrar las metas y sus acciones");
const emptyGoal = { ...goal, saved: 0, completed: false };
assert.equal(find(render({ goals: [emptyGoal], apartado: 0, libre: 500 }), node => node.type === "Button" && node.children.some(child => child?.children?.includes("savings.use"))), undefined,
  "Registrar gasto solo aparece cuando la meta tiene dinero");
const readonly = render({ soloLectura: true });
assert.equal(find(readonly.children[0], node => node.type === "Button"), undefined, "sin Premium conserva consulta, no ofrece crear");
assert.equal(find(readonly, node => node.type === "ReadOnly")?.type, "ReadOnly");
console.log("Ahorro original: aportes, devoluciones, cambios y borrado sin movimientos ficticios; compra con meta = un solo gasto; saldo, filtros, precisión y mes siguiente. Sin datos reales ni prueba Android.");
