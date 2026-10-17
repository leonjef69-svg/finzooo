import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { handlerOriginal } from "./handler-original.mjs";

export function familyMutationOriginal(memory = new Map()) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(fs.readFileSync("utils/familyMutation.ts", "utf8"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }),
    { module, exports: module.exports });
  return { ...module.exports, invalidarCopiaFamilia: handlerOriginal("screens/Family.tsx", "invalidarCopiaFamilia", { familiaEnMemoria: memory }) };
}
