import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { transformSync, build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const baseline = process.env.FINO_TEST_BELL_MOTION_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const source = read("screens/Home.tsx");
const tree = ts.createSourceFile("Home.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback, previous;
function walk(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
    && node.arguments[0]?.getText(tree).includes("avisosNuevosAnteriores.current")) callback = node.arguments[0].getText(tree);
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "avisosNuevosAnteriores") previous = node.initializer.getText(tree);
  ts.forEachChild(node, walk);
}
walk(tree);
assert.ok(callback && previous);
const compileExpression = text => transformSync(`return ${text};`, { loader: "ts" }).code;
const ref = new Function("useRef", compileExpression(previous))(value => ({ current: value }));
const rotate = { value: 0 };
const calls = [], cancelled = [];
const dependencies = { avisosNuevosAnteriores: ref, rotacionCampana: rotate, ReduceMotion: { System: "system" },
  withTiming: (target, config) => ({ target, config }), withSequence: (...steps) => { calls.push(steps); return steps; },
  cancelAnimation: value => cancelled.push(value) };
function run(ids, reduced = false, loaded = true, exportLoaded = true) {
  const env = { ...dependencies, idsNoLeidos: ids, numeroNoLeidos: ids.length, reducirMovimiento: reduced,
    estadoAvisosCargado: loaded, estadoExportacionInicialCargado: exportLoaded, ready: true };
  const effect = new Function(...Object.keys(env), compileExpression(callback))(...Object.values(env));
  effect();
}
run([], false, true, false);
assert.equal(ref.current, null, "Espera la lectura inicial del resultado de exportacion");
run(["old-a", "old-b"]);
assert.equal(calls.length, 0, "Abrir Inicio con avisos viejos no simula una llegada nueva");
run(["old-a", "old-b", "new-c"]);
assert.equal(calls.length, 1); assert.equal(calls[0].length, 5);
for (const step of calls[0]) assert.equal(step.config.reduceMotion, "system");
run(["old-a", "old-b", "new-c"]);
assert.equal(calls.length, 1, "Render repetido no repite movimiento");
run(["old-a", "new-d", "new-c"]);
assert.equal(calls.length, 2, "Detecta un aviso nuevo aunque el contador total no cambie");
run(["new-d", "new-c"]);
assert.equal(calls.length, 2, "Leer/quitar aviso no hace vibrar la campana");
run(["new-d", "new-c", "new-e"], true);
assert.equal(calls.length, 2); assert.equal(rotate.value, 0); assert.equal(cancelled.length, 1);
run(["new-d", "new-c", "new-e"], false);
assert.equal(calls.length, 2, "Desactivar reducir movimiento no reproduce avisos viejos");
run(Array.from({ length: 12 }, (_, i) => `burst-${i}`));
assert.equal(calls.at(-1).length, 25, "Rafaga limitada a cinco pulsos");

const require = createRequire(import.meta.url);
const hookCode = (await build({ stdin: { contents: read("utils/useReduceMotion.ts"), sourcefile: "useReduceMotion.ts", loader: "ts" },
  bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent", plugins: [{ name: "hooks", setup(b) {
    b.onResolve({ filter: /^(react|react-native)$/ }, args => ({ path: args.path, namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ loader: "js", contents: args.path === "react"
      ? "export const useState=(v)=>[v,(n)=>globalThis.__motion.changes.push(n)]; export const useEffect=(f)=>{globalThis.__motion.effect=f};"
      : "export const AccessibilityInfo={addEventListener:(_,f)=>{globalThis.__motion.event=f;return{remove:()=>{globalThis.__motion.removed=true}}},isReduceMotionEnabled:()=>globalThis.__motion.read()};" }));
  } }] })).outputFiles[0].text;
const settle = () => new Promise(resolve => setImmediate(resolve));
function hook(read) {
  const env = { changes: [], read, removed: false };
  globalThis.__motion = env;
  const module = { exports: {} };
  new Function("module", "exports", "require", hookCode)(module, module.exports, require);
  assert.equal(module.exports.useReduceMotion(), true, "No anima antes de conocer la preferencia");
  env.cleanup = env.effect();
  return env;
}
try {
  let reply;
  let env = hook(() => new Promise(resolve => { reply = resolve; }));
  env.event(true); reply(false); await settle();
  assert.deepEqual(env.changes, [true], "Lectura inicial atrasada no revierte cambio del sistema");
  env.event(false); assert.deepEqual(env.changes, [true, false]);
  env.cleanup(); env.event(true); assert.equal(env.removed, true); assert.deepEqual(env.changes, [true, false]);
  env = hook(async () => false); await settle(); assert.deepEqual(env.changes, [false]); env.cleanup();
  env = hook(async () => { throw Error("unsupported"); }); await settle(); assert.deepEqual(env.changes, []); env.cleanup();
} finally { delete globalThis.__motion; }
const catalogCode = await build({ stdin: { contents: read("constants/i18n.ts"), sourcefile: "i18n.ts", loader: "ts", resolveDir: process.cwd() },
  bundle: true, format: "cjs", platform: "node", alias: { "@": process.cwd() }, write: false, logLevel: "silent" });
const catalogModule = { exports: {} };
new Function("module", "exports", "require", catalogCode.outputFiles[0].text)(catalogModule, catalogModule.exports, require);
for (const [language, family, box] of [["es", "Enviado a Familia", "Enviado a Caja"], ["en", "Sent to Family", "Sent to Box"],
  ["pt", "Enviado à Família", "Enviado à Caixa"]]) {
  assert.equal(catalogModule.exports.translations[language]["transfer.sentToFamily"], family);
  assert.equal(catalogModule.exports.translations[language]["transfer.sentToBox"], box);
}
console.log("Campana: efecto/hook originales comprobados para carga vieja, llegada nueva, mismo contador, rafagas, reducir movimiento y lectura atrasada. Android visual pendiente.");
