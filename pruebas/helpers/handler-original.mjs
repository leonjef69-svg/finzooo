import fs from "node:fs";
import ts from "typescript";

// Ejecuta el cuerpo original de un manejador con sus dependencias sustituidas.
// No monta React ni prueba Android: sirve para comprobar las acciones reales
// de guardado y sus bloqueos sin mantener una copia del algoritmo en la prueba.
export function handlerOriginal(file, name, dependencies, sourceText = fs.readFileSync(file, "utf8")) {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let found;
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name?.text === name) found ??= node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!found) throw new Error(`No existe ${name} en ${file}`);
  const code = ts.transpileModule(found.getText(source).replace(/^export\s+(?:default\s+)?/, ""), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${code}\nreturn ${name};`)(...Object.values(dependencies));
}
