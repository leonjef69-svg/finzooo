"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const ts = require("../../node_modules/typescript");
const esbuild = require("../../node_modules/esbuild");
const { resolveRepoSource } = require("../test-support/repo-source-resolver");
const root = path.resolve(__dirname, "../..");

test("cargador de repositorio resuelve TS, TSX y auxiliares JS existentes", () => {
  for (const source of ["utils/amount.ts", "constants/iconos.tsx", "functions/src/private-box-money-shared.js"]) {
    assert.equal(resolveRepoSource(root, `@/${source.replace(/\.(ts|tsx|js)$/, "")}`), fs.realpathSync(path.join(root, source)));
    assert.equal(resolveRepoSource(root, `@/${source}`), fs.realpathSync(path.join(root, source)));
  }
});

test("cargador no resuelve paquetes, carpetas ni rutas fuera del repositorio", () => {
  for (const specifier of ["firebase/firestore", "@/../fuera", "@/utils/../../fuera", "@/C:/fuera", "@/utils\\amount",
    "@//utils/amount", "@/node_modules/esbuild/package.json", "@/utils/no-existe", "@/utils"]) {
    assert.throws(() => resolveRepoSource(root, specifier), /test-repo-/);
  }
});

test("cargador original del grupo integrado ejecuta dependencia JS sin Firebase ni red", async () => {
  // No importar el archivo de pruebas: eso arrancaría comprobaciones remotas.
  // Se ejecuta SOLO su función original de empaquetado contra un módulo puro.
  const file = path.join(root, "functions/emulator-tests/personal-history-client.test.js");
  const baseline = process.env.FINO_TEST_ALIAS_BASELINE;
  if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
  const source = baseline ? execFileSync("git", ["show", `${baseline}:functions/emulator-tests/personal-history-client.test.js`], { cwd: root, encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let original;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "clientModule") original = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(original);
  const dependencies = { fs, path, esbuild, createRequire, resolveRepoSource, __dirname: path.dirname(file), __filename: file,
    formatBaseline: null, cycleBaseline: null, require: createRequire(file) };
  const clientModule = new Function(...Object.keys(dependencies), `${original}\nreturn clientModule;`)(...Object.values(dependencies));
  const api = await clientModule(null, "utils/cloudLegacyTransfers.ts", "fake-loader-user");
  const old = { id: 1, type: "expense", amount: 10, date: "2026-10-24", description: "Ficticio", internalTransfer: "family", internalTransferLink: "movement-a", updatedAt: 1 };
  const current = { ...old, creationId: "fixture-creation", internalTransferSpaceId: "family-a", updatedAt: 2 };
  let proofs = 0;
  const result = await api.completarReferenciasCompartidasAntiguas("fake-loader-user", "PEN", [current], [old], {}, {}, async () => {
    proofs++;
    return { space: { currency: "PEN" }, movement: { personalOwnerUid: "fake-loader-user", personalTransactionId: 1,
      fecha: "2026-10-24", tipo: "ingreso", monto: 10 } };
  });
  assert.equal(proofs, 1, "el módulo original ejecutó canonical del auxiliar JS antes de comprobar la prueba");
  assert.equal(result.transactions[0].creationId, "fixture-creation");
  assert.equal(result.transactions[0].internalTransferSpaceId, "family-a");
  assert.equal(result.transactions[0].amount, 10);
  assert.equal(globalThis.__finoHistoryTestDb, undefined); assert.equal(globalThis.__finoHistoryTestAuth, undefined);
});
