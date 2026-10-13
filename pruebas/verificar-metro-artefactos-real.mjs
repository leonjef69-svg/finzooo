import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_METRO_BASELINE || "" });
const requireActual = createRequire(new URL("../metro.config.js", import.meta.url));
const module = { exports: {} };
// Configuración original con las bibliotecas reales: no una copia del patrón.
vm.runInNewContext(read("metro.config.js"), { require: requireActual, module,
  __dirname: process.cwd(), console, process }, { filename: "metro.config.js" });
const config = module.exports;
const patterns = Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList];
const ignored = value => patterns.some(pattern => pattern.test(value));
const root = process.cwd();
for (const suffix of [".tmp/audit-walk-PuNM1p/node_modules", ".tmp", ".tmp-123/a.js", "pruebas/.tmp-123/codigo.js",
  ".gradle-cache/a", ".pnpm-store/a", ".android-user/a", "output/a"] ) {
  for (const separator of ["/", "\\"]) {
    const file = path.join(root, suffix).replace(/[\\/]/g, separator);
    assert.ok(ignored(file), `Metro no debe vigilar artefactos que las pruebas retiran: ${file}`);
  }
}
for (const suffix of ["utils/nav.ts", "screens/Family.tsx", "screens/Cajas.tsx", "app/family.tsx",
  "modules/incoming-file/index.ts", "functions/src/private-box-money-shared.js", "node_modules/expo/package.json",
  "pruebas/verificar-espacios.mjs", "assets/icon.png", ".tmp-source.ts", "output-source.ts"]) {
  assert.equal(ignored(path.join(root, suffix)), false, `las fuentes siguen disponibles: ${suffix}`);
}
assert.equal(ignored(path.join(root, ".expo", "types", "router.d.ts")), true, "conserva la exclusión original de Expo");
assert.equal(typeof config.resolver.resolveRequest, "function", "conserva la resolución compartida de NativeWind");
// Metro combina las expresiones; banderas distintas harían fallar el arranque.
assert.equal(new Set(patterns.map(pattern => pattern.flags)).size, 1);
console.log("Metro original: artefactos efímeros excluidos, fuentes/dependencias presentes y configuración Expo/NativeWind conservada. Arranque real verificado aparte.");
