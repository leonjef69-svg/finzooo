import { createRequire } from "node:module";
import { buildSync } from "esbuild";

// Lógica original común TS/Node; SHA real de la dependencia existente.
// Adaptador de carga para VM: no copia el algoritmo ni usa red/archivos reales.
const require = createRequire(import.meta.url);
let original;
export function recordOriginOriginal() {
  if (original) return original;
  const root = process.cwd();
  const result = buildSync({ stdin: { contents: 'export * from "./utils/recordOrigin"; export * from "./utils/goalFunding"; export * from "./utils/recordMerge";',
    sourcefile: "original-financial-helpers.ts", resolveDir: root, loader: "ts" }, alias: { "@": root },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent" });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  original = module.exports;
  return original;
}
