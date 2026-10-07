import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const localBot = fs.readFileSync(path.join(root, "functions/local.js"), "utf8");
const featuredGraphic = fs.readFileSync(path.join(root, "tienda/hacer-destacado.mjs"), "utf8");

assert.equal(packageJson.scripts["reset-project"], undefined, "npm no debe ofrecer borrar/mover el proyecto");
assert.equal(fs.existsSync(path.join(root, "scripts/reset-project.js")), false, "la herramienta de plantilla no debe seguir ejecutable");
assert.doesNotMatch(readme, /reset-project/, "el README no debe invitar a reiniciar Fino");
assert.match(localBot, /FINO_LOCAL_ALLOW_WEBHOOK_DELETE/, "el bot local exige autorizar el cambio de webhook");
assert.match(localBot, /FINO_LOCAL_FIREBASE_PROJECT_ID/, "el proyecto Firebase se elige de forma explícita");
assert.doesNotMatch(localBot, /initializeApp\(\{[^\n]*projectId: "dotero-2d430"/, "el bot no usa producción por defecto");
assert.match(featuredGraphic, /sharp-cli@\d+\.\d+\.\d+/, "la herramienta gráfica usa una versión fija");

// Sin permiso, el script debe detenerse antes de cargar Firebase o llamar a Telegram.
const denied = spawnSync(process.execPath, [path.join(root, "functions/local.js")], {
  cwd: root,
  env: {
    ...process.env,
    FINO_LOCAL_ALLOW_WEBHOOK_DELETE: "",
    FINO_LOCAL_FIREBASE_PROJECT_ID: "",
    TELEGRAM_BOT_TOKEN: "token-de-prueba",
  },
  encoding: "utf8",
  timeout: 5000,
});
assert.notEqual(denied.status, 0, "sin autorización explícita el script falla cerrado");
assert.match(`${denied.stderr}${denied.stdout}`, /FINO_LOCAL_ALLOW_WEBHOOK_DELETE/);

const productionDenied = spawnSync(process.execPath, [path.join(root, "functions/local.js")], {
  cwd: root,
  env: {
    ...process.env,
    FINO_LOCAL_ALLOW_WEBHOOK_DELETE: "YES",
    FINO_LOCAL_FIREBASE_PROJECT_ID: "dotero-2d430",
    FINO_LOCAL_ALLOW_PRODUCTION: "",
    TELEGRAM_BOT_TOKEN: "token-de-prueba",
  },
  encoding: "utf8",
  timeout: 5000,
});
assert.notEqual(productionDenied.status, 0, "producción necesita otra autorización explícita");
assert.match(`${productionDenied.stderr}${productionDenied.stdout}`, /FINO_LOCAL_ALLOW_PRODUCTION/);

console.log("Herramientas peligrosas retiradas y bot local cerrado sin autorización explícita.");
