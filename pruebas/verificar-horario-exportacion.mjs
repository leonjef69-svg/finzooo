import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
const baseline = process.env.FINO_TEST_EXPORT_TIME_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresion exige un hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
// Ejecutar el catálogo real, no una copia de las traducciones.
const result = await build({ stdin: { contents: read("constants/i18n.ts"), sourcefile: "i18n.ts", loader: "ts", resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent" });
const module = { exports: {} };
new Function("module", "exports", result.outputFiles[0].text)(module, module.exports);
const text = module.exports.translations;
assert.ok(text, "El catálogo real debe existir");
for (const [lang, warning] of [["es", /Android puede retrasarlo/], ["en", /Android may delay it/], ["pt", /Android pode atrasar/]]) {
  assert.match(text[lang]["schedExport.compactFondo"], warning, `${lang}: la ficha no promete puntualidad`);
  assert.match(text[lang]["schedExport.destinoFondo"], warning);
  assert.doesNotMatch(text[lang]["schedExport.testHintFondo"], /EXACTAMENTE|EXACTLY/);
  assert.doesNotMatch(text[lang]["schedExport.fondoNoPdf"], /solo a la hora|on time|sair na hora/);
  assert.match(text[lang]["schedExport.proxima"], /intento|attempt|tentativa/);
}
for (const [lang, warning] of [["es", /aviso puede retrasarse/], ["en", /reminders may be delayed/], ["pt", /aviso pode atrasar/]]) {
  assert.match(text[lang]["schedExport.compactAlAbrir"], warning);
}
const native = read("modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/ExportSchedulerModule.kt");
assert.match(native, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.S \|\| gestor\.canScheduleExactAlarms\(\)/);
assert.match(native, /ExportAlarmPolicy\.programar/);
assert.match(native, /setAlarmClock/); assert.match(native, /setAndAllowWhileIdle/);
const screen = read("screens/ScheduledExportSettings.tsx");
assert.match(screen, /saleSolo \? "schedExport\.compactFondo" : "schedExport\.compactAlAbrir"/);
console.log("Exportación: catálogo real de tres idiomas advierte retrasos; consulta de permiso y política nativa conectadas. Puntualidad física pendiente.");
