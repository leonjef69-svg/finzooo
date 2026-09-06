import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync("screens/Home.tsx", "utf8");
const cardStart = home.indexOf('t("home.previousBalance")');
const cardEnd = home.indexOf('t("home.spent")', cardStart);
const card = home.slice(cardStart - 500, cardEnd);

assert.ok(cardStart > 0 && cardEnd > cardStart, "se encontró la tarjeta de saldo anterior");
assert.match(card, /bg-teal-50/);
assert.match(card, /border-teal-300/);
assert.match(card, /accessibilityRole="button"/);
assert.match(card, /accessibilityLabel=\{t\("home\.restoreCarryoverConfirm"\)\}/);
assert.match(card, /accessibilityLabel=\{t\("home\.resetCarryoverConfirm"\)\}/);
assert.equal((card.match(/w-10 h-10/g) ?? []).length, 2, "ambas acciones tienen una zona visible de 40 × 40");
assert.match(card, /Eraser size=\{20\}/);
assert.match(card, /RotateCcw size=\{20\}/);
assert.match(card, /bg-rose-100/, "borrar se distingue como acción destructiva");
assert.match(card, /bg-emerald-100/, "restaurar se distingue como acción segura");

console.log("Saldo anterior: acciones visibles, accesibles y diferenciadas.");
