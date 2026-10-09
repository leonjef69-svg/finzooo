import assert from "node:assert/strict";
import { createSourceReader } from "./helpers/source-reader.mjs";
const read = createSourceReader(), ficha = read("PLAYSTORE.md");
const section = title => {
  const part = ficha.split("## " + title + "\n")[1];
  assert.ok(part, title + ": sección existente");
  const block = part.match(/\`\`\`\s*\n([\s\S]*?)\n\`\`\`/);
  assert.ok(block, title + ": contenido a pegar");
  return block[1].replace(/\r\n/g, "\n");
};
const short = section("Descripción corta (máx. 80 caracteres)");
const long = section("Descripción completa");
assert.ok(short.length <= 80);
assert.ok(long.length <= 4000);
assert.ok(long.includes("USO PERSONAL GRATIS") && long.includes("FUNCIONES PRO"), "ficha distingue planes");
assert.ok(ficha.includes("**" + short.length + " caracteres**"));
assert.ok(ficha.includes("**" + long.length + "** caracteres"));
for (const file of ["app/import.tsx", "app/export-pdf.tsx", "app/scheduled-export.tsx"]) {
  assert.ok(read(file).includes("if (!isPremium)"), file + ": protección Pro original");
}
assert.ok(read("app/voice.tsx").includes("!isPremium"));
assert.ok(long.includes("dictar movimientos con Pro"));
assert.ok(long.includes("Las compras todavía no están habilitadas"));
assert.ok(read("utils/compras.ts").includes('mensual: ""') && read("utils/compras.ts").includes('anual: ""'));
assert.ok(long.includes("No se muestran anuncios en esta versión"));
assert.ok(read("constants/anuncios.ts").includes('ADMOB_APP_ID = ""') && read("constants/anuncios.ts").includes('ADMOB_BANNER_ID = ""'));
assert.ok(ficha.includes("el escaneo de boletas actual es local"));
assert.ok(!long.includes("al instante") && !long.includes("Nunca se mezclan"));
assert.ok(long.includes("pueden retrasarse") && long.includes("no confirma"));
assert.ok(ficha.includes("no implica respaldar finanzas de Gratis"));
assert.ok(ficha.includes("no deduce país de") || ficha.includes("no geolocaliza ni deduce país de"));
console.log("Contrato estático ficha/rutas originales: Gratis/Pro, dictado, ausencia de compras/anuncios, longitudes y promesas precisas. No acredita web, APK, Play ni cumplimiento jurídico.");
