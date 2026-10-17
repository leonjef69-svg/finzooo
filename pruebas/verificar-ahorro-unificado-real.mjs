import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_TEST_BASELINE;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Hash inválido");
const require = createRequire(import.meta.url);
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
async function bundle(entries, historical = false) {
  const result = await build({ stdin: { contents: entries.map(file => `export * from "./${file}";`).join("\n"), sourcefile: "ahorro-original.ts", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() },
    plugins: historical && revision ? [{ name: "fuentes-git", setup(build) { build.onLoad({ filter: /\.ts$/ }, args => ({ contents: read(args.path.slice(process.cwd().length + 1).replaceAll("\\", "/")), loader: "ts" })); } }] : [] });
  const module = { exports: {} }; new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports); return module.exports;
}
// Primero comportamiento existente, también contra 866b969. La base falla
// por liberar una meta cumplida, NO porque falte el nuevo módulo o una clave.
const old = await bundle(["utils/ahorro.ts", "utils/finances.ts", "utils/saldoAnterior.ts", "utils/linkedTransfers.ts"], true);
const goal = { id: 1, creationId: "goal-a", name: "Laptop", target: 200, saved: 200, completed: true, createdDate: "2026-10-16" };
assert.equal(old.totalApartado([goal]), 200, "alcanzar el objetivo no gasta ni libera los fondos");
const receipt = { id: 10, creationId: "receipt-a", type: "expense", amount: 200, date: "2026-10-16", time: "1:00 p.m.", category: "otros", method: "transfer", description: "Laptop", internalTransfer: "goal", internalTransferSpaceId: "1", internalTransferLink: "a" };
assert.deepEqual(old.totalsForMonth([receipt], "2026-10"), { spent: 0, income: 0, transfersIn: 0, transfersOut: 0 });
assert.equal(old.saldoAnteriorDe("2026-11", { "2026-10": 500 }, [receipt], []), 500, "el mes siguiente no resta de nuevo el recibo");
assert.equal(old.compactPersonalTransferRows([receipt, { ...receipt, id: 11, internalTransferLink: "b" }]).length, 2, "dos aportes no se agrupan en un supuesto envío a Caja");
const api = await bundle(["utils/savingsActions.ts", "utils/personalHistory.ts"]);
let seq = 10;
const movement = (g, delta) => ({ ...receipt, id: ++seq, creationId: `receipt-${seq}`, type: delta > 0 ? "expense" : "income", amount: Math.abs(delta), internalTransferSpaceId: String(g.id), internalTransferSpaceName: g.name, internalTransferLink: `operation-${seq}` });
const base = { ...goal, saved: 0, completed: false };
const source = JSON.stringify([base]);
const add = api.prepareSavingsAction([base], { kind: "add", goalId: 1, amount: 200 }, 500, movement);
assert.equal(add.reserved, 200); assert.equal(old.saldoLibre(500, add.reserved), 300); assert.equal(JSON.stringify([base]), source);
assert.equal(add.goals[0].completed, true); assert.equal(add.goals[0].funding.changes[add.upserts[0].internalTransferLink], 200);
const withdraw = api.prepareSavingsAction(add.goals, { kind: "withdraw", goalId: 1, amount: 50 }, 300, movement);
assert.equal(withdraw.reserved, 150); assert.equal(old.saldoLibre(300, withdraw.reserved), 150); assert.equal(withdraw.upserts[0].type, "income");
const edit = api.prepareSavingsAction(add.goals, { kind: "edit", goal: { ...base, name: "PC", target: 400 } }, 500, movement);
assert.equal(edit.goals[0].saved, 200); assert.equal(edit.goals[0].completed, false); assert.equal(edit.upserts.length, 0);
const created = api.prepareSavingsAction([], { kind: "create", goal: base, initial: 200 }, 500, movement);
assert.equal(created.goals[0].saved, 200); assert.equal(created.upserts.length, 1);
const removed = api.prepareSavingsAction(add.goals, { kind: "delete", goalId: 1 }, 500, movement);
assert.equal(removed.goals.length, 0); assert.equal(removed.reserved, 0); assert.equal(removed.upserts[0].amount, 200); assert.equal(removed.upserts[0].type, "income");
assert.equal(add.upserts.length, 1, "el plan de borrar no elimina recibos anteriores");
const expense = { ...receipt, id: 20, internalTransfer: undefined, amount: 400 };
assert.equal(api.expenseSavingsNeeded(400, 500, add.goals), 100);
const funded = api.prepareSavingsAction(add.goals, { kind: "expense", transaction: expense, allocations: [{ goalId: 1, amount: 100 }] }, 500, movement);
assert.equal(funded.goals[0].saved, 100); assert.equal(funded.upserts.length, 1); assert.equal(funded.upserts[0].id, expense.id);
assert.equal(funded.upserts[0].goalFundingAllocations[0].amount, 100);
assert.equal(old.saldoLibre(100, funded.reserved), 0);
assert.equal(old.totalsForMonth(funded.upserts, "2026-10").spent, 400);
for (const kind of ["add", "withdraw"]) for (const amount of [NaN, Infinity, 0, -1, 501]) {
  assert.throws(() => api.prepareSavingsAction(add.goals, { kind, goalId: 1, amount }, 500, movement));
}
for (const initial of [NaN, Infinity, -1, 501]) assert.throws(() => api.prepareSavingsAction([], { kind: "create", goal: base, initial }, 500, movement));
for (const allocations of [[], [{ goalId: 1, amount: 99 }], [{ goalId: 1, amount: -1 }, { goalId: 1, amount: 101 }], [{ goalId: 2, amount: 100 }]]) {
  assert.throws(() => api.prepareSavingsAction(add.goals, { kind: "expense", transaction: expense, allocations }, 500, movement));
}
for (const row of [receipt, withdraw.upserts[0]]) {
  assert.equal(api.matchesPersonalMovementFilter(row, "savings"), true); assert.equal(api.matchesPersonalMovementFilter(row, "all"), true);
  for (const filter of ["expense", "income", "transfer"]) assert.equal(api.matchesPersonalMovementFilter(row, filter), false);
}
assert.equal(api.matchesPersonalMovementFilter({ ...receipt, internalTransfer: "family" }, "transfer"), true);
assert.equal(api.matchesPersonalMovementFilter(expense, "expense"), true);
assert.equal(old.totalApartado([{ ...base, saved: 0.1 }, { ...base, id: 2, saved: 0.2 }]), 0.3);
assert.equal(JSON.stringify([base]), source, "ni rechazos ni operaciones modifican la fuente");
const home = fs.readFileSync("screens/Home.tsx", "utf8"), history = fs.readFileSync("screens/History.tsx", "utf8");
assert.match(home, /saldoLibre\(personalTotal, apartado\)/); assert.match(history, /id: "savings"/);
for (const code of [home, history]) assert.match(code, /internalTransfer === "goal"\) return[\s\S]*?<SavingsMovementRow/);
for (const language of ["es", "en", "pt"]) assert.ok(fs.readFileSync("constants/i18n.ts", "utf8").includes(`  ${language}: {`));
assert.ok(fs.readFileSync("constants/i18n.ts", "utf8").includes('"savings.total": "Saldo Total en Personal"'));
// JSX original y pulsaciones reales de sus callbacks, con React/IO adaptados.
let hooks = [], cursor = 0, calls = [], outcome = false;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const t = (key, values = {}) => `${key}${Object.keys(values).length ? JSON.stringify(values) : ""}`;
const screen = handlerOriginal("screens/SavingsList.tsx", "SavingsList", {
  React, useState: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
  useRef: value => { const index = cursor++; return hooks[index] ??= { current: value }; }, useEffect() {},
  useAppData: () => ({ fmt: value => `S/${value}`, t, transactions: [], visualStyle: "peachOlive", commitSavingsAction: async action => { calls.push(action); return outcome; } }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), useColorScheme: () => ({ colorScheme: "light" }),
  compararMovimientos: () => 0, irUnaVez() {}, BackButton: "Back", ScrollView: "Scroll", View: "View", Text: "Text", TouchableOpacity: "Button",
  PiggyBank: "Pig", Plus: "Plus", MoreHorizontal: "More", CheckCircle2: "Check", CircleHelp: "Help", ArrowUpRight: "Arrow", LinearGradient: "Gradient",
  SavingsMovementRow: "Receipt", GoalFormSheet: "GoalForm", MoveMoneySheet: "Move", ConfirmDialog: "Confirm", AvisoSoloLectura: "ReadOnly",
  UseSavingsSheet: "Use", visiblePersonalMovement: api.visiblePersonalMovement,
});
const props = { goals: [goal], disponible: 500, apartado: 200, libre: 300, monthLabel: "Octubre", onBack() {} };
const render = (extra = {}) => { cursor = 0; return screen({ ...props, ...extra }); };
function all(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(all); return [node, ...node.children.flatMap(all)]; }
const find = (root, predicate) => all(root).find(predicate);
let root = render();
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
const readonly = render({ soloLectura: true });
assert.equal(find(readonly.children[0], node => node.type === "Button"), undefined, "sin Premium conserva consulta, no ofrece crear");
assert.equal(find(readonly, node => node.type === "ReadOnly")?.type, "ReadOnly");
console.log("Ahorro original: 500→200 apartados→300 libres, retiro, meta cumplida, borrado con recibo, gasto elegido, filtros, precisión y mes siguiente. Sin datos reales ni prueba Android.");
