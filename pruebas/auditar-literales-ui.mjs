// Evita que una pantalla vuelva a mezclar español con inglés/portugués.
// Revisa texto JSX, etiquetas accesibles, placeholders y mensajes directos.
// Tarjetas de crédito quedan fuera por decisión explícita del propietario.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const DIRS = ["app", "screens", "components"];
const ALLOWED = new Set([
  "Fino",
  "Fino✦",
  "G",
  "PRO",
  "FREE",
  "0.00",
  "AAAA-MM-DD",
  "S/",
  "✉️",
  "CSV · Excel · PDF",
  "x",
  // El módulo de tarjetas queda pendiente y excluido por decisión del propietario.
  "Tarjeta de crédito",
  "Cuotas, fechas y pagos",
]);

function filesIn(dir, result = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) filesIn(full, result);
    else if (/\.tsx$/.test(name) && !/Credit/i.test(name) && !full.includes(`${path.sep}credit`)) result.push(full);
  }
  return result;
}

function meaningful(value) {
  const text = value.replace(/\s+/g, " ").trim();
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(text) && !ALLOWED.has(text) ? text : "";
}

const issues = [];
function report(file, node, text, kind) {
  const where = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  issues.push(`${path.relative(ROOT, file)}:${where.line + 1} ${kind}: "${text}"`);
}

for (const file of DIRS.flatMap((dir) => filesIn(path.join(ROOT, dir)))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = meaningful(node.getText());
      if (text) report(file, node, text, "texto JSX sin t()");
    }
    if (ts.isJsxAttribute(node) && ["accessibilityLabel", "accessibilityHint", "placeholder"].includes(node.name.getText(source))) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        const text = meaningful(node.initializer.text);
        if (text) report(file, node, text, `${node.name.getText(source)} sin t()`);
      }
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(source);
      const first = node.arguments[0];
      if ((call === "showToast" || call === "Alert.alert") && first && ts.isStringLiteral(first)) {
        const text = meaningful(first.text);
        if (text) report(file, first, text, `${call} sin t()`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (issues.length) {
  console.error(issues.map((issue) => `FALTA TRADUCIR: ${issue}`).join("\n"));
  process.exit(1);
}

console.log("La interfaz auditada no contiene textos visibles sin traducir");
