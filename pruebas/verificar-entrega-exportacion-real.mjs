import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";

const baseline = process.env.FINO_TEST_EXPORT_DELIVERY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const file = "screens/ExportPdfSheet.tsx";
const source = baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const original = (name, deps) => handlerOriginal(file, name, deps, source);
async function scenario(destination, options = {}) {
  const events = [], messages = [];
  let finishUpload;
  const deferred = new Promise(resolve => { finishUpload = resolve; });
  const exportedFile = { uri: "file:///fake/export.pdf", fileName: "Prueba.pdf", mimeType: "application/pdf" };
  const share = async () => { events.push("share"); if (options.fail) throw Error("share-failed"); };
  const upload = async () => { events.push("upload"); if (options.fail) throw Error("upload-failed"); if (options.wait) await deferred; return { name: "Prueba.pdf" }; };
  class Missing extends Error {}
  const deps = {
    monthTx: [{}], format: options.format ?? "pdf", destination, selectedMonthLabel: "Octubre",
    contactosDelDestino: [], contactos: [], contactoElegido: null, recipientName: undefined,
    resolveRecipient: () => null, t: key => key, showToast: message => messages.push(message),
    setExporting: value => events.push(value ? "busy" : "idle"), exportLock: { current: false },
    exportAsPdf: async () => { events.push("file"); return exportedFile; },
    exportAsExcel: async () => { events.push("file"); return exportedFile; },
    exportAsCsv: async () => { events.push("file"); return exportedFile; },
    uploadToDrive: upload, subirADropbox: upload, subirAOneDrive: upload, guardarEnCarpeta: upload,
    shareToWhatsApp: () => options.direct !== false, shareToGmail: () => options.direct !== false,
    shareToMail: () => options.direct !== false,
    Sharing: { isAvailableAsync: async () => options.available !== false, shareAsync: share },
    MailComposer: { isAvailableAsync: async () => options.available !== false,
      composeAsync: async () => { await share(); return { status: options.status ?? "sent" }; } },
    DriveNotSignedIn: Missing, DriveDenied: Missing, DropboxSinConectar: Missing,
    OneDriveSinConectar: Missing, SinCarpeta: Missing, setDropboxListo() {},
    markExported: () => events.push("completed"), confirmarEjecucionProgramada: async () => events.push("scheduled-completed"),
  };
  deps.exportacionHecha = original("exportacionHecha", deps);
  const handle = original("handleExport", deps);
  const promise = handle();
  if (options.double) await handle();
  if (options.wait) {
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(!events.includes("completed"), "No confirmar subida pendiente");
    finishUpload();
  }
  await promise;
  assert.equal(events.at(-1), "idle", "Se libera ante cualquier resultado");
  return { events, messages, handle };
}
for (const destination of ["whatsapp", "gmail", "mail", "share"]) {
  const { events } = await scenario(destination);
  assert.ok(!events.includes("completed") && !events.includes("scheduled-completed"), `${destination}: abrir otra app no confirma entrega`);
  if (destination !== "share") {
    for (const status of ["sent", "cancelled", "saved"]) {
      const fallback = await scenario(destination, { direct: false, status });
      assert.ok(!fallback.events.includes("completed"), "Ni compose SENT garantiza envío en Android");
    }
  }
  const missing = await scenario(destination, { direct: false, available: false });
  assert.ok(!missing.events.includes("completed"));
  assert.ok(!missing.messages.includes("exportPdf.readyToSend"), "No anunciar preparación para enviar si no abrió ninguna app");
  const failure = await scenario(destination, { direct: false, fail: true });
  assert.ok(!failure.events.includes("completed"));
}
for (const destination of ["drive", "dropbox", "onedrive", "folder"]) {
  const success = await scenario(destination, { wait: true, double: true });
  assert.equal(success.events.filter(x => x === "file").length, 1, "Doble toque no genera otro archivo ni sube dos veces");
  assert.deepEqual(success.events.filter(x => x === "completed" || x === "scheduled-completed"), ["completed", "scheduled-completed"]);
  const failure = await scenario(destination, { fail: true });
  assert.ok(!failure.events.includes("completed") && !failure.events.includes("scheduled-completed"));
}
for (const format of ["pdf", "xlsx", "csv"]) {
  const shared = await scenario("share", { format });
  assert.ok(!shared.events.includes("completed") && shared.messages.includes("exportPdf.readyToSend"));
}
const retryOptions = { fail: true };
const retry = await scenario("drive", retryOptions);
retryOptions.fail = false;
await retry.handle();
assert.equal(retry.events.filter(x => x === "file").length, 2, "Un fallo permite volver a preparar el archivo");
assert.equal(retry.events.filter(x => x === "completed").length, 1);
const catalogFile = "constants/i18n.ts";
const catalogSource = baseline ? execFileSync("git", ["show", `${baseline}:${catalogFile}`], { encoding: "utf8" }) : fs.readFileSync(catalogFile, "utf8");
const built = buildSync({ stdin: { contents: catalogSource, sourcefile: "i18n.ts", loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "cjs", alias: { "@": process.cwd() }, write: false, logLevel: "silent" });
const module = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
for (const language of ["es", "en", "pt"]) {
  assert.ok(module.exports.translations[language]["exportPdf.readyToSend"]);
  assert.ok(module.exports.translations[language]["exportPdf.shareUnavailable"]);
}
const installedComposer = fs.readFileSync("node_modules/expo-mail-composer/src/MailComposer.ts", "utf8");
assert.ok(installedComposer.includes("Android does not provide this info"), "Volver a evaluar si el proveedor cambia su contrato");
console.log("Exportacion: manejador original diferencia entrega verificada de abrir otra app, cancelacion, ausencia, error y subida pendiente. Android/recepcion real pendientes.");
