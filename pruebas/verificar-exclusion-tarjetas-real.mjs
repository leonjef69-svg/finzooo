import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL, fileURLToPath } from "node:url";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";
const read = createSourceReader();
const checked = [], messages = [];
const file = "pruebas/verificar-auditoria-financiera.mjs";
const text = read(file).replaceAll("import.meta.url", JSON.stringify(pathToFileURL(path.resolve(file)).href));
// .mjs mantiene ESM aunque se pida CommonJS; el cuerpo JS es TS válido.
// Cambia solo la identidad de compilación, no las acciones del auditor.
const compiled = ts.transpileModule(text, { fileName: "financial-audit.ts", compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module, exports: module.exports,
  process: { env: { FINO_EXCLUDE_CREDIT: "1" }, exit: code => { throw new Error("La auditoría terminó con " + code); } },
  console: { log: line => messages.push(String(line)) },
  require: name => {
    if (name === "node:fs") return { ...fs, readFileSync: (file, ...options) => {
      const normalized = String(file).replaceAll("\\", "/");
      assert.ok(!/\/(?:utils\/(?:creditStore|creditCloud)|screens\/CreditPayV1)\.tsx?$/.test(normalized), "no leer código de tarjetas excluido: " + normalized);
      checked.push(normalized); return fs.readFileSync(file, ...options);
    } };
    if (name === "node:path") return path;
    if (name === "node:url") return { fileURLToPath };
    if (name === "./helpers/handler-original.mjs") return { handlerOriginal };
    throw new Error("Dependencia no autorizada: " + name);
  },
});
assert.equal(messages.filter(message => message.includes("EXCLUIDO")).length, 5);
assert.ok(checked.length > 0 && messages.some(message => message.includes("borrados antiguos")));
const ast = ts.createSourceFile("runner.mjs", read("pruebas/correr.mjs"), ts.ScriptTarget.Latest, true);
let environment;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "entornoPruebas") environment = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(environment);
for (const excluded of [true, false]) {
  const env = new Function("SIN_TARJETAS", "process", "return (" + environment + ");")(excluded, { env: { SAFE_TEST: "1" } });
  assert.equal(env.FINO_EXCLUDE_CREDIT, excluded ? "1" : "0");
  assert.equal(env.SAFE_TEST, "1");
}
assert.equal((read("pruebas/correr.mjs").match(/env: entornoPruebas/g) ?? []).length, 2);
console.log("Auditor financiero original ejecutado sin permitir leer tres fuentes de tarjetas; cinco contratos excluidos y opción del corredor propagada. No audita tarjetas ni cuenta sus comprobaciones como aprobadas.");
