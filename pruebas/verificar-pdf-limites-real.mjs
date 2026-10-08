import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { deflateSync, gzipSync, deflateRawSync } from "node:zlib";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_TEST_PDF_LIMITS_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const built = buildSync({ stdin: { contents: read("utils/pdfExtract.ts"), sourcefile: "pdfExtract.ts", loader: "ts", resolveDir: process.cwd() + "/utils" }, bundle: true, platform: "node", format: "cjs", external: ["fflate"], write: false, logLevel: "silent" });
const module = { exports: {} };
const require = createRequire(import.meta.url);
const realFflate = require("fflate");
let maxInputChunk = 0, maxOutputChunk = 0;
class ObservedDecompress extends realFflate.Decompress {
  constructor(callback) { super((chunk, final) => { maxOutputChunk = Math.max(maxOutputChunk, chunk.length); callback(chunk, final); }); }
  push(chunk, final) { maxInputChunk = Math.max(maxInputChunk, chunk.length); return super.push(chunk, final); }
}
new Function("module", "exports", "require", built.outputFiles[0].text)(module, module.exports, name => name === "fflate" ? { ...realFflate, Decompress: ObservedDecompress } : require(name));
const pdf = (...streams) => new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), ...streams.flatMap(([body, flate]) => [Buffer.from(`<< ${flate ? "/Filter /FlateDecode " : ""}/Length ${body.length} >>\nstream\n`), body, Buffer.from("\nendstream\n")])]));
const bomb = deflateSync(Buffer.alloc(9 * 1024 * 1024, 65));
assert.ok(bomb.length < 15 * 1024 * 1024);
await assert.rejects(module.exports.extractPdfText(pdf([bomb, true])), error => error.name === "PdfResourceLimitError", "Un stream pequeño que crece demasiado debe rechazarse, no devolver vacío o texto parcial");
assert.ok(maxInputChunk <= 256 && maxOutputChunk < 1024 * 1024, "El limite se comprueba antes de materializar toda la bomba, con fflate real");
const api = module.exports;
for (const compress of [deflateSync, gzipSync, deflateRawSync]) {
  const normal = compress(Buffer.from("BT 1 0 0 1 60 700 Tm (Saldo) Tj ET"));
  assert.equal(await api.extractPdfText(pdf([normal, true])), "Saldo");
}
const incompleteHeader = Buffer.alloc(128 * 1024 + 512, 65);
Buffer.from([31, 139, 8, 8, 0, 0, 0, 0, 0, 3]).copy(incompleteHeader);
await assert.rejects(api.extractPdfText(pdf([incompleteHeader, true])), error => error.name === "PdfResourceLimitError", "Cabecera sin salida no crece sin limite");
const storedContent = Buffer.from("BT (" + "A".repeat(70000) + ") Tj ET");
assert.equal((await api.extractPdfText(pdf([deflateSync(storedContent, { level: 0 }), true]))).length, 70000, "Bloques validos sin compresion siguen legibles");
const small = deflateSync(Buffer.alloc(7 * 1024 * 1024, 65));
await assert.rejects(api.extractPdfText(pdf(...Array.from({ length: 5 }, () => [small, true]))), error => error.name === "PdfResourceLimitError", "Cuenta tambien streams sin texto, con presupuesto acumulado");
const valid = Buffer.from("BT 1 0 0 1 60 700 Tm (Saldo) Tj ET");
await assert.rejects(api.extractPdfText(pdf([valid, false], [bomb, true])), error => error.name === "PdfResourceLimitError", "No devolver primera pagina parcial ante limite posterior");
await assert.rejects(api.extractPdfText(new Uint8Array(15 * 1024 * 1024 + 1)), error => error.name === "PdfResourceLimitError", "Tambien se protege entrada fuera de pantalla");
const pieces = Buffer.from("BT " + "(x) Tj ".repeat(api.PDF_MAX_TEXT_PIECES + 1) + "ET");
await assert.rejects(api.extractPdfText(pdf([pieces, false])), error => error.name === "PdfResourceLimitError");
await assert.rejects(api.extractPdfText(pdf(...Array.from({ length: api.PDF_MAX_STREAMS + 1 }, () => [Buffer.from(" "), false]))), error => error.name === "PdfResourceLimitError");
assert.equal(await api.extractPdfText(pdf([Buffer.from("{ } BT (Saldo) Tj ET"), false])), "Saldo", "Delimitadores desconocidos avanzan, no atascan el lector");
assert.equal(await api.extractPdfText(new Uint8Array(Buffer.from("%PDF-1.4\n" + "stream\n".repeat(10000)))), "", "Un stream sin ningun cierre no repite busquedas cuadraticas");
const rows = Buffer.from("BT\n" + Array.from({ length: 10000 }, (_, i) => `1 0 0 1 60 ${700 - i * 16} Tm (Fila ${i}) Tj`).join("\n") + "\nET");
assert.equal((await api.extractPdfText(pdf([deflateSync(rows), true]))).split("\n").length, 10000);
assert.equal(await api.extractPdfText(pdf([Buffer.from([255, 255, 255, 255]), true], [deflateSync(valid), true])), "Saldo", "Errores antiguos de stream no cambian a limite inventado");
let notice = "", deleted = 0, reset = 0, parsed = 0;
class File {
  constructor() { this.exists = true; this.size = 100; }
  async arrayBuffer() { return new ArrayBuffer(0); }
  async bytes() { return new Uint8Array(); }
  delete() { deleted++; }
}
const deps = { File, isImportTooLarge: () => false, setLoading() {}, setDone() {}, setLoadingPdf: () => reset++,
  t: key => key, showToastAndClose: msg => { notice = msg; },
  extractPdfText: async () => { throw new api.PdfResourceLimitError(); }, PdfResourceLimitError: api.PdfResourceLimitError,
  parseStatement: () => { parsed++; },
};
const loadFile = handlerOriginal("screens/ImportSheet.tsx", "loadFile", deps, read("screens/ImportSheet.tsx"));
await loadFile("file:///cache/test.pdf", "test.pdf", "application/pdf");
assert.equal(notice, "importSheet.pdfTooComplex");
assert.equal(parsed, 0, "Rechazo no importa filas parciales");
assert.equal(deleted, 1, "Se limpia copia temporal");
assert.ok(reset > 0);
console.log("PDF original/fflate real: limites de entrada/stream/acumulado/fragmentos/cantidad, 10.000 filas, formatos y rechazo sin parcial comprobados. Pantalla con IO adaptado; Android pendiente.");
