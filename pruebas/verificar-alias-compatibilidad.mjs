import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Auditor estático original: un alias no puede esconder una pantalla vacía,
// inexistente, circular, con otra lógica o fuera de la carpeta de pantallas.
const revision = process.env.FINO_ALIAS_AUDITOR_BASELINE;
if (revision) {
  assert.match(revision, /^[a-f0-9]{7,40}$/i);
  const old = execFileSync("git", ["show", `${revision}:pruebas/auditar-pantallas.mjs`], { encoding: "utf8" });
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", old], { encoding: "utf8" });
  assert.equal(result.status, 0, `el auditor histórico clasifica mal el alias real de País: ${result.stdout}`);
}
const directory = path.resolve("screens"), file = path.join(directory, "Old.tsx"), target = path.join(directory, "New.tsx");
const files = new Map([[file, '// Compatibilidad\nexport { default } from "./New";'], [target, 'export default function New() { return null; }']]);
const validate = handlerOriginal("pruebas/auditar-pantallas.mjs", "aliasCompatibilityValid", {
  exports: {}, path, fs: { readFileSync: value => { if (!files.has(value)) throw Error("missing-file"); return files.get(value); }, existsSync: value => files.has(value) },
});
assert.equal(validate(file, directory), true);
files.delete(target); assert.equal(validate(file, directory), false, "destino ausente se mantiene como problema");
files.set(target, "// archivo sin componente"); assert.equal(validate(file, directory), false);
files.set(target, 'export { default } from "./Old";'); assert.equal(validate(file, directory), false, "no acepta ciclos/chains sin componente comprobable");
files.set(target, 'export default function New() { return null; }');
files.set(file, 'export { default } from "../New";'); assert.equal(validate(file, directory), false);
files.set(file, 'export { default } from "./Old";'); assert.equal(validate(file, directory), false);
files.set(file, 'export { default } from "./New";\nconst unused = true;'); assert.equal(validate(file, directory), false, "no exime lógica abandonada");

const actual = handlerOriginal("pruebas/auditar-pantallas.mjs", "aliasCompatibilityValid", { fs, path, exports: {} });
assert.equal(actual(path.resolve("app/country.tsx"), path.resolve("app")), true);
assert.equal(actual(path.resolve("screens/CountryPicker.tsx"), directory), true);
assert.match(fs.readFileSync("app/country.tsx", "utf8"), /from "\.\/language"/);
assert.match(fs.readFileSync("screens/CountryPicker.tsx", "utf8"), /from "\.\/LanguagePicker"/);
console.log("Auditor original estático: aliases puros con destino real; rechazados ausentes, vacíos, ciclos, escapes y lógica adicional. País apunta a Idioma; no acredita navegación Android.");
