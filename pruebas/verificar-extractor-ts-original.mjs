import assert from "node:assert/strict";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

let extractor = handlerOriginal;
const baseline = process.env.FINO_TEST_HANDLER_PARSER_BASELINE;
if (baseline) {
  assert.match(baseline, /^[a-f0-9]{7,40}$/i);
  const source = execFileSync("git", ["show", `${baseline}:pruebas/helpers/handler-original.mjs`], { encoding: "utf8" });
  const module = { exports: {} };
  new Function("module", "exports", "require", ts.transpileModule(source, {
    fileName: "original-reader.js", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(module, module.exports, createRequire(import.meta.url));
  extractor = module.exports.handlerOriginal;
}

let session = 1;
const auth = { currentUser: { uid: "A" } };
const capture = extractor("utils/accountTask.ts", "captureAccountTask", { auth, getAccountStorageSession: () => session });
const task = capture("A");
assert.equal(await task.wait(async () => "dato"), "dato", "extraer .ts genérico no lo convierte en JSX");
session++;
await assert.rejects(task.wait(async () => "dato"), /account-task-obsolete/);
console.log("Extractor original: .ts genérico compilado como TypeScript, sesión real preservada; no es prueba Android.");
