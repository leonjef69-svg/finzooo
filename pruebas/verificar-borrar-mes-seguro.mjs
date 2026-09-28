import fs from "node:fs";
import assert from "node:assert/strict";

const withoutComments = (file) => fs.readFileSync(file, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const home = withoutComments("screens/Home.tsx");
const i18n = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(home, /function borrarTodoElMes/);
assert.match(home, /setConfirmandoBorrarTodo\(true\)/, "borrar el mes debe pedir confirmación");
assert.match(i18n, /deleteAllTitle[^\n]*\{count\}/, "el aviso debe indicar cuántos movimientos");
assert.match(i18n, /deleteAllTitle[^\n]*\{month\}/, "el aviso debe indicar el mes");
assert.match(i18n, /no se puede deshacer/, "el aviso debe explicar que no se puede deshacer");
for (const key of ["home.deleteAll", "home.deleteAllTitle", "home.deleteAllMessage"]) {
  const occurrences = (i18n.match(new RegExp(`"${key.replace(".", "\\.")}":`, "g")) ?? []).length;
  assert.equal(occurrences, 3, `${key} debe existir en los tres idiomas`);
}
assert.match(
  home,
  /movimientosBorrablesDelMes = useMemo\(\(\) => monthTx\.filter\([^\n]+internalTransfer/,
  "solo deben considerarse movimientos normales del mes visible",
);
assert.match(home, /onBulkDelete\(movimientosBorrablesDelMes\.map/);

console.log("Borrar un mes conserva confirmación, contexto y alcance seguro.");
