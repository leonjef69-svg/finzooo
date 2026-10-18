import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Dependencia real para los manejadores extraídos. Una instancia por escenario
// impide que una consulta deliberadamente bloqueada contamine otro escenario.
export function spaceReadOriginal() {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(fs.readFileSync("utils/spaceRead.ts", "utf8"), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }), { module, exports: module.exports });
  return module.exports;
}
