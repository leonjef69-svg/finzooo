import { strict as assert } from "node:assert";
import {
  MAX_MONEY_AMOUNT,
  parseAmountInput,
  sanitizeAmountInput,
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

for (const shown of [
  fmt(1e54, "S/", "PEN"),
  fmtCompact(1e54, "S/", "PEN"),
]) {
  assert.doesNotMatch(shown, /e\+|monto inválido/i);
  assert.match(shown, /nonill/);
}

console.log("Montos largos: límite seguro y formato legible correctos.");
