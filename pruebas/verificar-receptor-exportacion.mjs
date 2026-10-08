import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_RECEIVER_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresión requiere un hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const manifest = read("modules/export-scheduler/android/src/main/AndroidManifest.xml").replace(/<!--[\s\S]*?-->/g, "");
const blocks = [...manifest.matchAll(/<receiver\b[^>]*?(?:\/>|>[\s\S]*?<\/receiver>)/g)].map(match => match[0]);
const receiver = name => blocks.find(block => block.includes(`android:name="com.finzo.exportscheduler.${name}"`));
assert.match(receiver("FinzoExportReceiver") ?? "", /android:exported="false"/,
  "Una app ajena no puede activar el receptor del trabajo privado");
assert.doesNotMatch(receiver("FinzoExportReceiver"), /intent-filter/);
assert.match(receiver("FinzoBootReceiver") ?? "", /android:exported="true"/);
assert.match(receiver("FinzoBootReceiver"), /android.intent.action.BOOT_COMPLETED/);
assert.equal((receiver("FinzoBootReceiver").match(/<action\b/g) ?? []).length, 1,
  "El receptor público declara únicamente el arranque protegido del sistema");
const base = "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/";
const boot = read(base + "FinzoBootReceiver.kt"), work = read(base + "FinzoExportReceiver.kt");
assert.match(boot, /intent\?\.action != Intent\.ACTION_BOOT_COMPLETED\) return/);
assert.match(boot, /ExportSchedulerModule\.reponerTrasReinicio\(context\)/);
assert.doesNotMatch(boot, /startService|acquireWakeLockNow|ACCION_EXPORTAR/);
assert.doesNotMatch(work, /ACTION_BOOT_COMPLETED|reponerTrasReinicio/);
assert.match(work, /intent\?\.action != ExportSchedulerModule\.ACCION_EXPORTAR\) return/);
assert.match(work, /acquireWakeLockNow\(context\)[\s\S]*context\.startService/);
assert.match(read(base + "ExportSchedulerModule.kt"), /Intent\(context, FinzoExportReceiver::class\.java\)\.setAction\(ACCION_EXPORTAR\)/,
  "La alarma conserva el componente/acción anteriores: no invalida su PendingIntent");
console.log("Exportación: contrato de receptores privado/arranque separado comprobado en fuentes; ejecución Kotlin y Android se verifican aparte.");
