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
const base = "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler";
const fixture = path.join(root, "pruebas/native/export-receivers");
fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
const temp = fs.mkdtempSync(path.join(root, ".tmp/receiver-kotlin-"));
const baseline = process.env.FINO_TEST_RECEIVER_KOTLIN_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresion exige un hash Git.");
const source = name => {
  const file = `${base}/${name}.kt`;
  if (!baseline || name !== "FinzoExportReceiver") return path.join(root, file);
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
run(["-cp", compiler.join(path.delimiter), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
  "-classpath", stdlib, "-d", path.join(temp, "classes"), source("FinzoExportReceiver"), source("FinzoBootReceiver"), source("ExportAlarmPolicy"),
  ...fs.readdirSync(fixture).filter(file => file.endsWith(".kt")).map(file => path.join(fixture, file))]);
run(["-cp", [path.join(temp, "classes"), stdlib].join(path.delimiter), "com.finzo.exportscheduler.ReceiverTestKt"]);
run(["-cp", [path.join(temp, "classes"), stdlib].join(path.delimiter), "com.finzo.exportscheduler.AlarmPolicyTestKt"]);
