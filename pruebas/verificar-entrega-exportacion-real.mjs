import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import ts from "typescript";

const baseline = process.env.FINO_TEST_EXPORT_DELIVERY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const file = "screens/ExportPdfSheet.tsx";
const source = baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const original = (name, deps) => handlerOriginal(file, name, deps, source);
const contactFile = "utils/sendContacts.ts";
const normalizePhone = handlerOriginal(contactFile, "normalizePhone", {});
const checkPhone = handlerOriginal(contactFile, "checkPhone", { normalizePhone });
const contactsFor = handlerOriginal(contactFile, "contactsFor", {});
const normalizeForMatch = handlerOriginal(contactFile, "normalizeForMatch", {});
const findContactByName = handlerOriginal(contactFile, "findContactByName", { contactsFor, normalizeForMatch });
const resolveRecipient = handlerOriginal(contactFile, "resolveRecipient", { findContactByName });
const fixture = Object.freeze({ id: "fixture-only", name: "Mamá", kind: "whatsapp", value: "+51 999 888 777" });
async function scenario(destination, options = {}) {
  const events = [], messages = [], directCalls = [];
  let finishUpload;
  const deferred = new Promise(resolve => { finishUpload = resolve; });
  const exportedFile = { uri: "file:///fake/export.pdf", fileName: "Prueba.pdf", mimeType: "application/pdf" };
  const share = async () => { events.push("share"); if (options.fail) throw Error("share-failed"); };
  const upload = async () => { events.push("upload"); if (options.fail) throw Error("upload-failed"); if (options.wait) await deferred; return { name: "Prueba.pdf" }; };
  class Missing extends Error {}
  const deps = {
    espaciosCargando: false, espacio: { id: "personal", transactionsLoaded: true },
    monthTx: [{}], format: options.format ?? "pdf", destination, selectedMonthLabel: "Octubre",
    contactosDelDestino: [], contactos: options.contacts ?? [fixture],
    contactoElegido: Object.hasOwn(options, "chosen") ? options.chosen : destination === "whatsapp" ? fixture : null,
    recipientName: options.recipientName, resolveRecipient, checkPhone,
    isWhatsAppInstalled: () => options.installed !== false,
    t: key => key, showToast: message => messages.push(message),
    setExporting: value => events.push(value ? "busy" : "idle"), exportLock: { current: false },
    exportAsPdf: async () => { events.push("file"); return exportedFile; },
    exportAsExcel: async () => { events.push("file"); return exportedFile; },
    exportAsCsv: async () => { events.push("file"); return exportedFile; },
    uploadToDrive: upload, subirADropbox: upload, subirAOneDrive: upload, guardarEnCarpeta: upload,
    shareToWhatsApp: (...args) => { directCalls.push(args); return options.direct !== false; }, shareToGmail: () => options.direct !== false,
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
  if (events.includes("busy")) assert.equal(events.at(-1), "idle", "Se libera ante cualquier resultado");
  return { events, messages, handle, directCalls };
}
// Ejecuta la lista original, también con WhatsApp ausente. No copia su condición.
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let destinations;
function visit(node) {
  if (ts.isArrayLiteralExpression(node) && node.getText(tree).includes('t("exportPdf.destShare")') && node.getText(tree).includes('t("exportPdf.destWhatsApp")')) destinations ??= node;
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(destinations, "Existe la lista original de destinos");
const expression = ts.transpileModule(`const options = ${destinations.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const iconNames = [...new Set(destinations.getText(tree).match(/Icon:\s*(\w+)/g).map(x => x.split(/:\s*/)[1]))];
const visibleOptions = new Function("t", "gmailDisponible", "whatsappDisponible", ...iconNames, `${expression}\nreturn options;`)(x => x, false, false, ...iconNames.map(() => null));
assert.ok(visibleOptions.some(x => x.id === "whatsapp"), "WhatsApp permanece visible aunque no esté instalado");
for (const options of [
  { installed: false }, { chosen: null }, { chosen: { ...fixture, value: "123" } },
  { chosen: { ...fixture, value: "5191234567" } }, { chosen: { ...fixture, kind: "email" } },
  { chosen: null, recipientName: "desconocido" },
  { chosen: null, recipientName: "mamá", contacts: [fixture, { ...fixture, id: "second", name: "Mamá Rosa" }] },
]) {
  const stopped = await scenario("whatsapp", options);
  assert.deepEqual(stopped.events, [], "Sin app, destinatario único o teléfono válido no se genera archivo ni se abre un selector");
  assert.equal(stopped.directCalls.length, 0);
  assert.equal(stopped.messages.length, 1);
}
const voiceBuild = buildSync({ entryPoints: ["utils/voiceCommand.ts"], bundle: true, platform: "node", format: "cjs", alias: { "@": process.cwd(), "react-native": `${process.cwd()}/pruebas/stubs/rn.ts`, "@expo/vector-icons": `${process.cwd()}/pruebas/stubs/vectoricons.ts`, "expo-font": `${process.cwd()}/pruebas/stubs/font.ts`, "lucide-react-native": `${process.cwd()}/pruebas/stubs/lucide.ts` }, write: false, logLevel: "silent" });
const voiceModule = { exports: {} };
new Function("module", "exports", "require", voiceBuild.outputFiles[0].text)(voiceModule, voiceModule.exports, createRequire(import.meta.url));
const voice = voiceModule.exports.parseVoiceCommand("Exportar octubre PDF por WhatsApp a mamá", new Date(2026, 9, 22));
assert.equal(voice.kind, "export");
assert.equal(voice.destination, "whatsapp");
for (const options of [{}, { chosen: null, recipientName: voice.recipient }]) {
  const sent = await scenario("whatsapp", options);
  assert.equal(sent.directCalls.length, 1, "Botón y voz abren una vez el destino");
  assert.equal(sent.directCalls[0][3], "51999888777", "Número del contacto, normalizado y sin depender de otra vuelta de React");
  assert.ok(sent.messages.includes("exportPdf.whatsappReady"));
  assert.ok(!sent.events.includes("share"), "No se abre el selector general");
}
const unavailableChat = await scenario("whatsapp", { direct: false });
assert.ok(unavailableChat.messages.includes("exportPdf.whatsappMissing"));
assert.ok(!unavailableChat.events.includes("share"), "Un chat fallido no deriva a elegir entre cientos de contactos");
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
  for (const key of ["whatsappInstall", "whatsappChoose", "whatsappInvalidPhone", "whatsappHint", "whatsappReady", "whatsappOpen", "whatsappMissing"]) {
    assert.ok(module.exports.translations[language][`exportPdf.${key}`], `${language}: aviso WhatsApp traducido`);
  }
}
const installedComposer = fs.readFileSync("node_modules/expo-mail-composer/src/MailComposer.ts", "utf8");
assert.ok(installedComposer.includes("Android does not provide this info"), "Volver a evaluar si el proveedor cambia su contrato");
console.log("Exportacion original: WhatsApp visible sin instalar; botón/orden de voz con número único normalizado; ausencia, ambigüedad, teléfono inválido y fallo no abren selector. Abrir otra app no acredita entrega; subidas, cancelación, errores y doble toque protegidos. Chat/voz Android reales pendientes.");
