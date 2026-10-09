import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Contrato de mantenimiento, NO prueba de pantallas ni cobertura de Android.
// El inventario viene de Git; no recorre datos privados ni node_modules.
const root = process.cwd();
const read = createSourceReader({ revision: process.env.FINO_DEAD_CODE_BASELINE ?? "" });
const files = (read.revision
  ? execFileSync("git", ["ls-tree", "-r", "--name-only", read.revision], { encoding: "utf8" })
  : execFileSync("git", ["ls-files"], { encoding: "utf8" }))
  .split(/\r?\n/).filter(Boolean);
const retired = [
  "components/BudgetRing.tsx", "components/FAB.tsx", "components/SpaceActionBar.tsx",
  "utils/friendlyName.ts", "functions/src/telegram-handler.js", "metro.config.cjs",
];
const sourceFiles = files.filter(file => /\.(?:[cm]?js|tsx?)$/.test(file)
  && !/^(?:pruebas|docs|android|modules)\//.test(file)
  && !/credit|tarjeta/i.test(file));
function resolveOwn(file, specifier) {
  const target = specifier.startsWith("@/") ? specifier.slice(2)
    : specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null;
  if (!target) return null;
  return [target, `${target}.tsx`, `${target}.ts`, `${target}.js`, `${target}.cjs`]
    .find(candidate => retired.includes(candidate)) ?? null;
}
for (const file of sourceFiles) {
  if (!read.revision && !fs.existsSync(path.join(root, file))) continue;
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.arguments.length === 1
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || ts.isIdentifier(node.expression) && node.expression.text === "require")
        ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteralLike(specifier)) {
      assert.equal(resolveOwn(file, specifier.text), null, `${file} no conserva un importador del archivo retirado`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const packageConfig = JSON.parse(read("functions/package.json"));
assert.equal(packageConfig.main, "index.js");
for (const entry of ["functions/index.js", "functions/local.js"]) {
  const source = ts.createSourceFile(entry, read(entry), ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require"
      && ts.isStringLiteralLike(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(imports.includes("./src/telegram-guided-handler"), `${entry} conserva la entrada guiada vigente`);
}

// Resolver original de Metro, con SOLO la carga de la configuración adaptada:
// evita iniciar NativeWind, watchers o herramientas externas en esta prueba.
// No copia el algoritmo de selección de archivos de Metro.
const require = createRequire(import.meta.url);
const active = path.join(root, "metro.config.js");
const before = require.cache[active];
const adapter = new Module(active);
adapter.loaded = true;
adapter.exports = { projectRoot: root };
require.cache[active] = adapter;
try {
  const resolved = await require("metro-config").resolveConfig(undefined, root);
  assert.equal(resolved.isEmpty, false);
  assert.equal(resolved.filepath, active, "Metro sigue eligiendo la configuración JS activa, no la alternativa vieja");
} finally {
  if (before) require.cache[active] = before;
  else delete require.cache[active];
}
for (const file of retired) {
  const exists = read.revision ? files.includes(file) : fs.existsSync(path.join(root, file));
  assert.equal(exists, false, `${file}: archivo muerto retirado, sin borrar consumidores activos`);
}
console.log("Contrato estático y resolver original/IO adaptado: seis huérfanos fuera; entradas guiadas y Metro activo conservados. No prueba Android.");
