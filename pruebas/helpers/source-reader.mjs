import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Solo lectura: fija una revisión UNA vez. No hace checkout, no modifica
// archivos ni interpreta el valor como orden de shell. "1" conserva la opción
// histórica de HEAD, pero no es una regresión permanente tras hacer commit.
export function createSourceReader({ revision = process.env.FINO_TEST_BASELINE, report = true } = {}) {
  let commit = null;
  if (revision) {
    if (revision !== "1" && !/^[0-9a-f]{7,40}$/i.test(revision)) {
      throw new Error("FINO_TEST_BASELINE requiere un hash de commit (o 1 para HEAD).");
    }
    commit = execFileSync("git", ["rev-parse", "--verify", `${revision === "1" ? "HEAD" : revision}^{commit}`], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Revisión Git no válida.");
  }
  const root = process.cwd();
  function read(file) {
    // Todos los consumidores usan rutas de fuentes relativas al repositorio.
    if (typeof file !== "string" || !file || file.includes("\\") || file.includes(":")
      || file.includes("\0") || path.posix.isAbsolute(file) || file.split("/").some(part => part === ".." || part === ".")) {
      throw new Error("Ruta de fuente no válida.");
    }
    return commit ? execFileSync("git", ["show", `${commit}:${file}`], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }) : fs.readFileSync(path.join(root, file), "utf8");
  }
  read.revision = commit;
  if (report) console.log(`[Fuentes] ${commit ?? "carpeta actual, incluidos cambios sin commit"}`);
  return read;
}
