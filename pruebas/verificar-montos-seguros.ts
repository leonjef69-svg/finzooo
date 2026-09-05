import { strict as assert } from "node:assert";
import {
  MAX_MONEY_AMOUNT,
  parseAmountInput,
  sanitizeAmountInput,
  sanitizeSafeAmountInput,
} from "@/utils/amount";
import { fmt, fmtCompact } from "@/utils/format";
import { parseCreditMoneyInput } from "@/utils/creditMoney";

assert.equal(
  sanitizeAmountInput("12312211111111111111111111112"),
  "1231221111111",
  "el campo debe detenerse en trece cifras enteras",
);
assert.equal(parseAmountInput(String(MAX_MONEY_AMOUNT)), MAX_MONEY_AMOUNT);
assert.equal(parseAmountInput("9000000000001"), 0);
assert.equal(parseCreditMoneyInput("9000000000001", "PEN"), null);
assert.equal(
  sanitizeSafeAmountInput("9999999999999"),
  "999999999999",
  "escribir trece nueves debe ignorar la ultima cifra en vez de bloquear Guardar",
);
assert.equal(
  parseAmountInput(sanitizeSafeAmountInput("9999999999999")),
  999999999999,
  "el monto que queda visible siempre debe poder guardarse",
);
assert.equal(
  sanitizeSafeAmountInput("9000000000000.9"),
  "9000000000000",
  "un decimal sobre el maximo debe ignorarse sin cambiar la parte entera",
);

for (const shown of [
  fmt(1e54, "S/", "PEN"),
  fmtCompact(1e54, "S/", "PEN"),
]) {
  assert.doesNotMatch(shown, /e\+|monto inválido/i);
  assert.match(shown, /nonill/);
}

console.log("Montos largos: límite seguro y formato legible correctos.");
