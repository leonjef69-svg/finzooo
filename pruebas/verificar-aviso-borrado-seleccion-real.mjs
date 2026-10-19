import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_SELECTION_NOTICE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const modules = new Map();
function original(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const js = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: path => {
    assert.ok(path.startsWith("@/utils/"), `Dependencia no adaptada: ${path}`);
    return original(path.slice(2) + ".ts");
  } });
  modules.set(file, module.exports);
  return module.exports;
}
const { translations } = original("constants/i18n.ts");
const { spaceDeletionNotice } = original("utils/spaceDeletionNotice.ts");
for (const language of ["es", "en", "pt"]) {
  const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), translations[language][key] || key);
  for (const count of [1, 2]) {
    const rows = Array.from({ length: count }, (_, id) => ({ id: String(id), tipo: "gasto", monto: 5 }));
    const notice = spaceDeletionNotice(rows, t, String);
    assert.ok(notice.title.trim().length > 0);
    assert.doesNotMatch(notice.title + notice.message, /spaces\./, "la confirmación usa traducciones reales");
    assert.doesNotMatch(notice.title, /\b(?:todos|todas|all)\b/i, "seleccionar una parte no debe anunciar que borra todo");
    assert.ok(notice.message.includes(String(count)), "la confirmación conserva la cantidad real");
    assert.doesNotMatch(notice.message, /\{count\}|\b1 (?:movimientos|transactions|movimentações)\b/, "un solo movimiento no debe llevar plural incorrecto");
    assert.equal(notice.action, t("common.delete"));
  }
  const returned = { id: "return", tipo: "gasto", monto: 100, personalTransactionId: 2, personalReturnAmount: 100 };
  const linked = spaceDeletionNotice([returned], t, value => `S/ ${value}`);
  assert.equal(linked.title, t("spaces.cancelTransferTitle"));
  assert.equal(linked.action, t("spaces.cancelTransfer"));
  assert.ok(linked.message.includes("S/ 100"), "no debilita el aviso monetario de la devolución");
}
console.log("Aviso original en tres idiomas: selección parcial sin anunciar borrado total, cantidad exacta y anulación monetaria intacta.");
