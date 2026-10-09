import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { createSourceReader } from "./helpers/source-reader.mjs";
const read = createSourceReader();
function original(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(read(file), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }), {
    module, exports: module.exports, require: name => {
      assert.ok(name in dependencies, "dependencia inesperada: " + name); return dependencies[name];
    },
  });
  return module.exports;
}
const order = original("utils/ordenarMovimientos.ts");
const merge = original("utils/mergeTransactions.ts", { "@/utils/ordenarMovimientos": order });
for (const [name, count] of [["pruneDeletedTransactionIds", 5001], ["pruneDeletedGoalIds", 1001]]) {
  const input = Array.from({ length: count }, (_, index) => index + 1), before = JSON.stringify(input);
  const ids = merge[name]([...input, 1, 2, NaN, Infinity]);
  assert.equal(ids.length, count, name + ": no olvidar una marca antigua por cantidad");
  assert.ok(ids.includes(1));
  assert.equal(ids[0], count);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(JSON.stringify(input), before);
  for (const id of [1, Math.floor(count / 2), count]) assert.ok(ids.includes(id), "la copia atrasada no puede ignorar este borrado conocido");
}
const many = Array.from({ length: 100000 }, (_, index) => index + 1);
const started = performance.now();
const deleted = merge.pruneDeletedTransactionIds(many);
assert.equal(deleted.length, 100000);
assert.ok(deleted.includes(1));
assert.ok(performance.now() - started < 3000, "normalización de 100000 marcas no se vuelve cuadrática");
// Contratos de la conexión: la lógica de filtros/IO se prueba también en las
// suites originales de recepción y servidor. Aquí NO se copia esa lógica.
const context = read("contexts/AppDataContext.tsx"), cloud = read("utils/cloudSync.ts");
assert.ok(!context.includes("borrados.includes(") && !context.includes("metasBorradas.includes("), "filtros grandes por Set, no búsqueda por cada elemento");
assert.ok(context.includes("idsBorrados.has(") && context.includes("idsMetasBorradas.has("));
assert.ok(cloud.includes('throw new Error("demasiado-grande")'), "si no cabe la copia, se rechaza sin recortar las marcas");
assert.ok(!cloud.includes("deletedTransactionIds.slice") && !cloud.includes("deletedGoalIds.slice"));
console.log("Funciones originales: 5001 movimientos y 1001 metas borradas no se olvidan; 100000 marcas normalizadas sin truncar. Conexión Set/capacidad es contrato estático. Borrados por UUID y clientes antiguos pendientes.");
