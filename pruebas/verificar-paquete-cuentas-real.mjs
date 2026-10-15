import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { accountEndpoints, accountSource } from "../scripts/preparar-servidor-cuentas.mjs";

const original = fs.readFileSync("functions/index.js", "utf8");
function inspect(source) {
  const state = { secrets: [], exports: {} };
  const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: fn => fn }) } };
  const wrap = (_options, handler) => handler;
  vm.runInNewContext(source, { exports: state.exports, require: name => {
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-functions/v2/https") return { onCall: wrap, onRequest: wrap, HttpsError: Error };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: wrap };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: wrap };
    if (name === "firebase-functions/params") return { defineSecret: name => { state.secrets.push(name); return {}; } };
    return {}; // Ningún handler se ejecuta; solo se inspecciona el manifiesto.
  } });
  return state;
}
const before = inspect(original), source = accountSource(original), after = inspect(source);
assert.equal(before.secrets.length, 2, "la entrada anterior declara secretos aun al seleccionar otros servicios");
assert.deepEqual(after.secrets, []);
assert.deepEqual(Object.keys(after.exports).sort(), [...accountEndpoints].sort());
for (const name of accountEndpoints) assert.equal(after.exports[name].toString(), before.exports[name].toString(), `${name}: cuerpo original idéntico`);
assert.equal(Object.keys(after.exports).some(name => /telegram|report/i.test(name)), false);
assert.throws(() => accountSource(original.replace("exports.mutateSharedMovement", "exports.omitida")), /Falta un servicio/);
console.log("Paquete real: 16 servicios originales idénticos, sin Telegram, cron ni declaración de secretos; el manifiesto anterior sí declara dos.");
