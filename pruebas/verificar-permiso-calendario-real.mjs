import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_TEST_PAYMENT_PERMISSION_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const utilFile = "utils/avisosDePagos.ts", contextFile = "contexts/AppDataContext.tsx";
const events = [], scheduled = [], cancelled = [];
let enabled = true, granted = false, answer = true, canAskAgain = true;
let permissionFailure = false, saveSucceeded = true;
const Notifications = {
  getPermissionsAsync: async () => { events.push("get"); return { granted, canAskAgain }; },
  requestPermissionsAsync: async () => { events.push("request"); if (permissionFailure) throw Error("permiso roto"); granted = answer; return { granted }; },
  setNotificationChannelAsync: async () => { events.push("channel"); },
  getAllScheduledNotificationsAsync: async () => [...scheduled],
  cancelScheduledNotificationAsync: async id => { cancelled.push(id); scheduled.splice(scheduled.findIndex(x => x.identifier === id), 1); },
  scheduleNotificationAsync: async item => { scheduled.push({ identifier: String(scheduled.length + 1), ...item }); },
  AndroidImportance: { HIGH: 4 }, SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "interval" },
};
const deps = { Notifications, MARCA: "calendarioPagos", CANAL: "finzo-pagos-v2", MESES_POR_DELANTE: 3,
  loadJSON: async () => enabled, saveJSONNow: async (_key, value) => { if (saveSucceeded) enabled = value; return saveSucceeded; },
  CLAVE_AVISOS: "finzo:avisosEncendidos", estadoEn: () => "pendiente", cuandoAvisar: () => new Date(2027, 0, 1),
  mesDe: () => "2026-10", mesSiguiente: value => value + "+1", textoDelAviso: () => "Pago",
};
for (const name of ["avisosEncendidos", "guardarAvisosEncendidos", "prepararCanal", "retirarLosNuestros", "hacerlo", "probarAviso"]) {
  deps[name] = handlerOriginal(utilFile, name, deps, read(utilFile));
}
// hacerlo captures its dependencies at construction; the helpers above already exist.
const api = handlerOriginal(utilFile, "reprogramarAvisosDePagos", { ...deps, enFila: Promise.resolve({ puestos: 0 }) }, read(utilFile));
const payment = { id: "luz", nombre: "Luz" }, translate = key => key;
function reset() { events.length = scheduled.length = cancelled.length = 0; enabled = true; granted = false; answer = true; canAskAgain = true; permissionFailure = false; saveSucceeded = true; }
reset();
assert.equal((await api([payment], translate)).fallo, "sin-permiso");
assert.ok(!events.includes("request"), "Recuperar pagos al iniciar no solicita permiso aunque Android lo concedería");
await api([payment], translate);
assert.ok(!events.includes("request"), "Volver/cambiar moneda no reabre permiso");
assert.equal(scheduled.length, 0);
reset();
assert.equal((await api([payment], translate, new Date(), undefined, { solicitarPermiso: true })).puestos, 3);
assert.equal(events.filter(x => x === "request").length, 1);
assert.ok(events.indexOf("channel") < events.indexOf("request"), "Canal antes del diálogo Android 13");
await api([payment], translate);
assert.equal(events.filter(x => x === "request").length, 1, "Permiso ya concedido no se pide otra vez");
reset(); answer = false;
assert.equal((await api([payment], translate, new Date(), undefined, { solicitarPermiso: true })).fallo, "sin-permiso");
await api([payment], translate);
assert.equal(events.filter(x => x === "request").length, 1, "Negarlo no crea petición en el siguiente arranque");
reset(); canAskAgain = false;
assert.equal((await api([payment], translate, new Date(), undefined, { solicitarPermiso: true })).fallo, "sin-permiso");
assert.ok(!events.includes("request"));
reset(); enabled = false;
scheduled.push({ identifier: "calendar", content: { data: { calendarioPagos: true } } }, { identifier: "export", content: { data: { exportacion: true } } });
assert.equal((await api([payment], translate, new Date(), undefined, { solicitarPermiso: true })).puestos, 0);
assert.deepEqual(events, [], "Apagar no consulta ni pide permisos ni crea canal");
assert.deepEqual(cancelled, ["calendar"]);
assert.deepEqual(scheduled.map(x => x.identifier), ["export"]);
reset(); await api([], translate, new Date(), undefined, { solicitarPermiso: true });
assert.deepEqual(events, [], "Sin pagos no se solicita permiso");
reset(); permissionFailure = true;
assert.match((await api([payment], translate, new Date(), undefined, { solicitarPermiso: true })).fallo, /permiso: permiso roto/);
permissionFailure = false; granted = true;
assert.equal((await api([payment], translate)).puestos, 3, "La fila permite reintentar después de un error");
reset(); assert.equal(await deps.probarAviso(translate), "listo");
assert.ok(events.indexOf("channel") < events.indexOf("request"));
assert.equal(scheduled[0].content.data.prueba, true);
assert.equal(await deps.guardarAvisosEncendidos(false), true);
assert.equal(await deps.avisosEncendidos(), false, "El siguiente programado lee el interruptor guardado");
saveSucceeded = false; assert.equal(await deps.guardarAvisosEncendidos(true), false);
assert.equal(enabled, false, "No inventar un guardado correcto");

// Consume la intención del Guardar original una sola vez; no copia el efecto.
const source = read(contextFile), tree = ts.createSourceFile(contextFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function walk(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
    && node.arguments[0]?.getText(tree).includes("reprogramarAvisosDePagos(pagosProgramados")) effect = node.arguments[0].getText(tree);
  ts.forEachChild(node, walk);
}
walk(tree); assert.ok(effect);
const intent = { current: false }, contextCalls = [];
const context = { solicitarPermisoDePagos: intent, pagosProgramados: [payment], ready: true, hasOnboarded: true,
  userCurrency: "PEN", tRef: { current: translate }, fmt: value => String(value),
  STORAGE_KEYS: { pagosProgramados: "payments" }, saveJSON() {},
  paymentNotificationFormatter: () => value => String(value),
  reprogramarAvisosDePagos: async (...args) => { contextCalls.push(args); return { puestos: 3 }; },
  setAvisosProgramados() {}, setAvisosFallo() {}, CLOUD_SYNC_GROUPS: { payments: "payments" },
  markCloudGroup: (_group, previous, update) => update(previous), setPagosProgramados: next => { context.pagosProgramados = next; },
};
function runEffect() { new Function(...Object.keys(context), transformSync(`return ${effect};`, { loader: "ts" }).code)(...Object.values(context))(); }
runEffect(); assert.equal(contextCalls.at(-1)[4].solicitarPermiso, false);
handlerOriginal(contextFile, "guardarPagoProgramado", context, source)({ ...payment, id: "nuevo" });
assert.equal(intent.current, true); assert.equal(context.pagosProgramados.length, 2);
runEffect(); assert.equal(contextCalls.at(-1)[4].solicitarPermiso, true); assert.equal(intent.current, false);
runEffect(); assert.equal(contextCalls.at(-1)[4].solicitarPermiso, false);
handlerOriginal(contextFile, "reprogramarAvisos", context, source)();
assert.equal(contextCalls.at(-1)[4].solicitarPermiso, true, "Activar explícitamente puede pedir permiso");
assert.ok(source.includes("const solicitarPermisoDePagos = useRef(false)"));
assert.match(source, /setPagosProgramados\(\[\]\);\s+solicitarPermisoDePagos\.current = false;/);

// Interruptor original espera guardado, impide doble toque y no finge éxito.
const screen = "screens/AvisosDelCalendario.tsx", changes = [], errors = [], lock = { current: false };
let finishSave;
const pending = new Promise(resolve => { finishSave = resolve; });
const switchDeps = { cambiandoAvisos: lock, guardarAvisosEncendidos: () => pending,
  setEncendidos: value => changes.push(value), reprogramarAvisos: () => changes.push("schedule"),
  t: translate, showToast: message => errors.push(message) };
const change = handlerOriginal(screen, "cambiarAvisos", switchDeps, read(screen));
const changing = change(false); await change(true);
assert.deepEqual(changes, [], "No programa antes de escribir ni duplica");
finishSave(true); await changing;
assert.deepEqual(changes, [false, "schedule"]); assert.equal(lock.current, false);
changes.length = 0;
for (const save of [async () => false, async () => { throw Error("disco"); }]) {
  const handle = handlerOriginal(screen, "cambiarAvisos", { ...switchDeps, guardarAvisosEncendidos: save }, read(screen));
  await handle(true);
  assert.deepEqual(changes, []); assert.equal(lock.current, false);
}
assert.deepEqual(errors, ["toast.localSaveFailed", "toast.localSaveFailed"]);
assert.ok(read(screen).includes("onChange={cambiarAvisos}"));
console.log("Calendario: programador, intención del Guardar/efecto y cambio de interruptor originales comprobados con IO adaptado. Sin permiso al iniciar; Android real pendiente.");
