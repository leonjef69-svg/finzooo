"use strict";

const fs = require("node:fs");
const path = require("node:path");

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Alias de fuentes de prueba, nunca resolución de paquetes ni rutas externas. */
function resolveRepoSource(root, specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith("@/") || /[\\:\0]/.test(specifier)) throw new Error("test-repo-alias-invalid");
  const parts = specifier.slice(2).split("/");
  if (parts.some(part => !part || part === "." || part === ".." || part === "node_modules")) throw new Error("test-repo-alias-invalid");
  const directory = fs.realpathSync(root);
  const base = path.resolve(directory, ...parts);
  if (!inside(directory, base)) throw new Error("test-repo-alias-outside");
  // Mantiene la preferencia TypeScript previa y admite los auxiliares JS
  // compartidos con el servidor, también cuando se indica su extensión.
  const candidates = /\.(?:ts|tsx|js)$/.test(base) ? [base] : [".ts", ".tsx", ".js"].map(extension => base + extension);
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    const actual = fs.realpathSync(candidate);
    if (!inside(directory, actual)) throw new Error("test-repo-alias-outside");
    return actual;
  }
  throw new Error(`test-repo-module-not-found:${specifier}`);
}

module.exports = { resolveRepoSource };
