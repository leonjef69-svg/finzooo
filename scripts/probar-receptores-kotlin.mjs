import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";

const root = process.cwd();
if (!fs.existsSync(path.join(root, "app.json"))) throw new Error("Ejecutar desde la raiz de Fino.");
const cache = path.join(process.env.GRADLE_USER_HOME || path.join(root, ".gradle-cache"), "caches/modules-2/files-2.1");
function jar(group, name, version) {
  const base = path.join(cache, group, name, version);
  if (!fs.existsSync(base)) throw new Error(`Falta dependencia local ${name}:${version}; no se descarga ni se omite la prueba.`);
  for (const hash of fs.readdirSync(base)) {
    const entry = path.join(base, hash, `${name}-${version}.jar`);
    if (fs.existsSync(entry)) return entry;
  }
  throw new Error(`Falta JAR local ${name}:${version}.`);
}
const stdlib = jar("org.jetbrains.kotlin", "kotlin-stdlib", "2.1.20");
const compiler = [jar("org.jetbrains.kotlin", "kotlin-compiler-embeddable", "2.1.20"), stdlib,
  jar("org.jetbrains.kotlin", "kotlin-script-runtime", "2.1.20"), jar("org.jetbrains.kotlin", "kotlin-reflect", "1.6.10"),
  jar("org.jetbrains.intellij.deps", "trove4j", "1.0.20200330"), jar("org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm", "1.8.0")];
const annotationVersions = fs.readdirSync(path.join(cache, "org.jetbrains", "annotations")).sort().reverse();
compiler.push(jar("org.jetbrains", "annotations", annotationVersions[0]));
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java";
const privacy = process.argv.includes("--screen-privacy");
const notification = process.argv.includes("--notification-privacy");
const base = notification ? "modules/notification-reader/android/src/main/java/com/finzo/notificationreader"
  : privacy ? "modules/screen-privacy/android/src/main/java/com/finzo/screenprivacy"
  : "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler";
const fixture = path.join(root, notification ? "pruebas/native/notification-privacy"
  : privacy ? "pruebas/native/screen-privacy" : "pruebas/native/export-receivers");
fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
const temp = fs.mkdtempSync(path.join(root, ".tmp/receiver-kotlin-"));
const baseline = notification ? process.env.FINO_TEST_NOTIFICATION_PRIVACY_BASELINE
  : privacy ? process.env.FINO_TEST_SCREEN_PRIVACY_BASELINE : process.env.FINO_TEST_RECEIVER_KOTLIN_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresion exige un hash Git.");
const source = name => {
  const file = `${base}/${name}.kt`;
  if (!baseline || (notification ? name !== "NotificationStore" : (!privacy && name !== "FinzoExportReceiver"))) return path.join(root, file);
  // Fuente anterior como artefacto de regresion, no edicion del proyecto.
  const target = path.join(temp, `${name}.kt`);
  fs.writeFileSync(target, execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root }));
  return target;
};
const run = args => {
  const result = spawnSync(java, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Comprobacion Kotlin fallo (${result.status}). Artefactos en ${temp}`);
};
const sources = notification ? ["NotificationStore", "NotificationCipher", "NotificationPreferences"]
  : privacy ? ["ScreenPrivacy", "ScreenPrivacyPackage"] : ["FinzoExportReceiver", "FinzoBootReceiver", "ExportAlarmPolicy"];
const fixtureClasses = path.join(temp, "fixture-classes");
const javaSources = fs.readdirSync(fixture).filter(file => file.endsWith(".java"));
const classpath = [stdlib];
if (notification) classpath.push(jar("org.json", "json", "20180813"));
if (javaSources.length) {
  const javac = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "javac.exe" : "javac") : "javac";
  const result = spawnSync(javac, ["-d", fixtureClasses, ...javaSources.map(file => path.join(fixture, file))], { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) throw result.error || Error("Adaptadores Java no compilan.");
  classpath.push(fixtureClasses);
}
run(["-cp", compiler.join(path.delimiter), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
  "-classpath", classpath.join(path.delimiter), "-d", path.join(temp, "classes"), ...sources.map(source),
  ...fs.readdirSync(fixture).filter(file => file.endsWith(".kt")).map(file => path.join(fixture, file))]);
const mainClasses = notification ? ["com.finzo.notificationreader.NotificationPrivacyTestKt"]
  : privacy ? ["com.finzo.screenprivacy.ScreenPrivacyTestKt"]
  : ["com.finzo.exportscheduler.ReceiverTestKt", "com.finzo.exportscheduler.AlarmPolicyTestKt"];
for (const mainClass of mainClasses) run(["-cp", [path.join(temp, "classes"), ...classpath].join(path.delimiter), mainClass]);
