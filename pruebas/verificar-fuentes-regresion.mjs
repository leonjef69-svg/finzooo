import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const baseline = process.env.FINO_TEST_SOURCE_READER_BASELINE;
if (baseline && !/^[0-9a-f]{7,40}$/i.test(baseline)) throw new Error("Hash de regresión no válido.");
const original = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const oldRevision = "5cd7e09";
const failures = [];
const expected = execFileSync("git", ["show", `${oldRevision}:utils/cloudFieldMerge.ts`], { encoding: "utf8" });
assert.notEqual(expected, fs.readFileSync("utils/cloudFieldMerge.ts", "utf8"), "la fixture antigua realmente difiere de la fuente actual");
for (const file of ["pruebas/verificar-seguridad-continuacion.mjs", "pruebas/verificar-fusion-pro.mjs", "pruebas/verificar-nube-pro-servidor.mjs"]) {
  const source = ts.createSourceFile(file, original(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let declaration;
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(node => node.name.getText(source) === "read")) declaration = statement.getText(source);
  }
  assert.ok(declaration, `${file}: ejecutar lector original, no una copia`);
  const scope = { fs, execFileSync, process: { env: { FINO_TEST_BASELINE: oldRevision } },
    createSourceReader: () => createSourceReader({ revision: oldRevision, report: false }) };
  vm.runInNewContext(`${declaration}\nresult = read("utils/cloudFieldMerge.ts");`, scope);
  if (scope.result !== expected) failures.push(`${file}: ignoró el hash solicitado y leyó HEAD`);
}
assert.equal(failures.join("\n"), "", "Los tres lectores deben respetar la revisión pedida");

const read = createSourceReader({ revision: oldRevision, report: false });
assert.match(read.revision, /^[a-f0-9]{40}$/);
assert.equal(read("utils/cloudFieldMerge.ts"), expected);
assert.equal(createSourceReader({ revision: "1", report: false }).revision,
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
const current = createSourceReader({ revision: "", report: false });
assert.equal(current.revision, null);
assert.equal(current("utils/cloudFieldMerge.ts"), fs.readFileSync("utils/cloudFieldMerge.ts", "utf8"));
for (const value of ["HEAD; exit", "--help", "HEAD", "zzzzzzz", "local-delete"]) {
  assert.throws(() => createSourceReader({ revision: value, report: false }), /hash de commit/);
}
for (const file of ["../app.json", "/app.json", "C:/app.json", "utils\\id.ts", "utils/./id.ts", "", "a\0b"]) {
  assert.throws(() => read(file), /Ruta de fuente/);
}
assert.throws(() => read("utils/no-existe-fino-source-reader.ts"), "una fuente ausente NO cae silenciosamente al disco actual");
console.log("Lectores originales: revisión explícita respetada, HEAD histórico identificado y fuentes inválidas rechazadas. No es una prueba de Android.");
