// Empaquetado mecánico: conserva literalmente las funciones probadas y excluye
// Telegram/cron/secretos del descubrimiento de Firebase. No edita functions/.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

export const accountEndpoints = Object.freeze([
  "getCloudAccess", "acceptLegalDocuments", "activatePremiumTrial", "mutateSharedMovement",
  "changePersonalContribution", "returnPersonalContribution", "manageLinkedSpace", "leaveLinkedSpace",
  "finalizeLinkedSpaceDeletion", "privateBoxMigration", "prepareIncompleteBoxDeletion", "resolvePrivateBoxMoney",
  "recoverPrivateBoxMoney", "retirePrivateBoxMoney", "deletePersonalCloudCopy", "cleanupDeletedCloudAccount",
]);

export function accountSource(source) {
  const tree = ts.createSourceFile("index.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = new Set();
  const chunks = tree.statements.filter(statement => {
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
      const target = statement.expression.left;
      if (ts.isPropertyAccessExpression(target) && target.expression.getText(tree) === "exports") {
        if (!accountEndpoints.includes(target.name.text)) return false;
        found.add(target.name.text);
      }
    }
    if (ts.isVariableStatement(statement)) {
      const text = statement.getText(tree);
      if (/require\(["'](?:\.\/src\/telegram[^"']*|firebase-functions\/params)["']\)/.test(text)
        || /\bdefineSecret\s*\(/.test(text)) return false;
    }
    return true;
  }).map(statement => source.slice(statement.getFullStart(), statement.end));
  if (accountEndpoints.some(name => !found.has(name))) throw new Error("Falta un servicio de cuenta; no se prepara el despliegue.");
  const output = chunks.join("\n");
  if (/TELEGRAM_|defineSecret\s*\(|require\(["']\.\/src\/telegram/.test(output)) throw new Error("La preparación contiene una dependencia de Telegram.");
  return output;
}

export function prepareAccountServer(root) {
  const sourceRoot = path.join(root, "functions");
  const source = accountSource(fs.readFileSync(path.join(sourceRoot, "index.js"), "utf8"));
  const destination = fs.mkdtempSync(path.join(root, ".tmp", "firebase-cuentas-"));
  const functionsDir = path.join(destination, "functions");
  fs.mkdirSync(functionsDir);
  fs.writeFileSync(path.join(functionsDir, "index.js"), source);
  for (const name of ["package.json", "package-lock.json"]) fs.copyFileSync(path.join(sourceRoot, name), path.join(functionsDir, name));
  fs.cpSync(path.join(sourceRoot, "src"), path.join(functionsDir, "src"), {
    recursive: true, filter: file => !path.basename(file).startsWith("telegram"),
  });
  // Solo para análisis local. Firebase no sube node_modules; Cloud Build usa
  // el lock original. No copiar .env, sesiones, logs, pruebas ni credenciales.
  fs.symlinkSync(path.join(sourceRoot, "node_modules"), path.join(functionsDir, "node_modules"), "junction");
  const config = path.join(destination, "firebase.json");
  fs.writeFileSync(config, JSON.stringify({ functions: {
    source: "functions", runtime: "nodejs22", ignore: ["node_modules", ".git", "firebase-debug.log", "*.local"],
  } }, null, 2));
  return { config, endpoints: accountEndpoints };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareAccountServer(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))));
}
