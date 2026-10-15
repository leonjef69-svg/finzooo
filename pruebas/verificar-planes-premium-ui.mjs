import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const preciosTs = fs.readFileSync(new URL("../constants/precios.ts", import.meta.url), "utf8");
const compilado = ts.transpileModule(preciosTs, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modulo = { exports: {} };
vm.runInNewContext(compilado, { module: modulo, exports: modulo.exports });

assert.equal(modulo.exports.PRECIOS.plusMensual, 3.6, "Plus conserva el precio aprobado");
assert.equal(modulo.exports.PRECIOS.mensualNormal, 9.99, "Pro conserva el precio mensual aprobado");
assert.equal(modulo.exports.PRECIOS.anual, 84, "Pro anual usa el precio aprobado");
assert.equal(modulo.exports.AHORRO_PRO_ANUAL, 35.88, "el ahorro compara el anual con doce pagos mensuales");

const pantalla = fs.readFileSync(new URL("../screens/Premium.tsx", import.meta.url), "utf8");
assert.match(pantalla, /AHORRO_PRO_ANUAL/, "la pantalla calcula el ahorro desde los precios comunes");
assert.match(pantalla, /premium\.savingsAnnual/, "el anual informa su ahorro");
assert.match(pantalla, /premium\.priceProposal/, "el usuario ve que todavía no puede pagar");
assert.match(pantalla, /premium\.plusName[\s\S]*premium\.proName/, "la pantalla permite comparar Plus y Pro");
assert.match(pantalla, /premium\.autoRegInfoText/, "el registro automático conserva su explicación y alcance");
assert.match(pantalla, /comprasDisponibles\(\) && plan === "pro"/, "el pago solo aparece para Pro si la tienda está habilitada");
assert.doesNotMatch(pantalla, /setIsPremium\(true\)/, "la selección visual nunca regala Pro");

console.log("Planes de Fino: Plus S/ 3.60; Pro S/ 9.99 al mes o S/ 84 al año, con ahorro real de S/ 35.88; pago no disponible indicado y compra no simulada.");
