import { strict as assert } from "node:assert";
import {
  MAX_MONEY_AMOUNT,
  amountInputError,
  parseAmountInput,
  sanitizeAmountInput,
  sanitizeSafeAmountInput,
} from "@/utils/amount";
import { fmt, fmtCompact } from "@/utils/format";
import { parseCreditMoneyInput } from "@/utils/creditMoney";
import fs from "node:fs";
import path from "node:path";

assert.equal(
  sanitizeAmountInput("12312211111111111111111111112"),
  "12312211111111111111111111112",
  "el campo no puede convertir un monto excesivo en otro distinto",
);
assert.equal(parseAmountInput(String(MAX_MONEY_AMOUNT)), MAX_MONEY_AMOUNT);
assert.equal(parseAmountInput("1,500"), 1500, "una coma de miles no puede guardar 1.5");
assert.equal(parseAmountInput("1,500.25"), 1500.25, "acepta miles y decimales al estilo de Perú");
assert.equal(parseAmountInput("1.500,25"), 1500.25, "acepta miles y decimales con coma decimal");
assert.equal(parseAmountInput("0,5"), 0.5, "una coma decimal corta conserva los centavos");
assert.equal(parseAmountInput("12,345,678"), 12345678, "acepta varios grupos de miles");
assert.equal(parseAmountInput("9000000000001"), 0);
assert.equal(parseCreditMoneyInput("9000000000001", "PEN"), null);
assert.equal(
  sanitizeSafeAmountInput("9999999999999"),
  "9999999999999",
  "el usuario debe ver completo el monto inválido",
);
assert.equal(
  parseAmountInput(sanitizeSafeAmountInput("9999999999999")),
  0,
  "nunca se debe guardar un monto recortado sin avisar",
);
assert.equal(
  sanitizeSafeAmountInput("9000000000000.9"),
  "9000000000000.9",
  "el decimal fuera de rango debe seguir visible",
);
assert.equal(amountInputError("9000000000000.9"), "tooLarge");
assert.equal(parseAmountInput("9000000000000.9"), 0);
assert.equal(parseAmountInput("12.3456", "PEN"), 0, "PEN no acepta cuatro decimales");
assert.equal(amountInputError("0.001", "PEN"), "tooManyDecimals");
assert.equal(parseAmountInput("1.234", "BHD"), 1.234, "BHD acepta tres decimales");
assert.equal(parseAmountInput("10.5", "JPY"), 0, "JPY no acepta fracciones");
assert.equal(parseAmountInput("9000000000000.01", "PEN"), 0, "no se aceptan centavos cuyo cálculo pierde precisión");
assert.equal(parseAmountInput("9000000000000", "PEN"), 9000000000000, "los enteros existentes siguen admitidos");

const categoryBudgets = fs.readFileSync(
  path.join(process.cwd(), "screens/CategoryBudgets.tsx"),
  "utf8",
);
assert.match(categoryBudgets, /category-budget-limit-/, "cada categoría conserva su campo editable de límite");
assert.match(categoryBudgets, /categoryBudgets\.limitFor/, "el límite sigue identificado para editarlo");
assert.match(categoryBudgets, /categoryBudgets\.monthlyLimit/, "debajo del importe se aclara que el límite es mensual");
assert.doesNotMatch(categoryBudgets, /categoryBudgets\.spent/, "el editor no repite el gasto junto al límite");
assert.match(categoryBudgets, /accessibilityHint=\{t\("categoryBudgets\.tapToEdit"\)\}/, "toda la fila anuncia que se puede tocar para editar");
assert.match(categoryBudgets, /categoryBudgets\.overLimit/, "superar el límite muestra una alerta roja breve");
assert.match(categoryBudgets, /categoryBudgets\.nearLimit/, "acercarse al límite muestra una alerta ámbar breve");
assert.match(categoryBudgets, /spent \/ limit >= 0\.9/, "el aviso ámbar empieza al alcanzar el 90% del límite");
assert.doesNotMatch(categoryBudgets, /category-budget-progress-/, "la pantalla de edición no repite las barras de consulta");
assert.match(categoryBudgets, /initialCreate/, "crear una categoría usa el formulario compartido en el panel inferior");
const reportBudgets = fs.readFileSync(
  path.join(process.cwd(), "screens/Reports.tsx"),
  "utf8",
);
assert.match(reportBudgets, /report-category-budget-spent-/, "Reportes separa el gasto del límite");
assert.match(reportBudgets, /report-category-budget-limit-/, "Reportes alinea el límite a la izquierda");
assert.match(reportBudgets, /COLOR_HEX_600\[b\.color\]/, "cada barra conserva el color de su categoría");
assert.match(reportBudgets, /borderBottomWidth: 1/, "las categorías se separan con una línea visible");
assert.match(
  categoryBudgets,
  /sanitizeSafeAmountInput\(value, userCurrency\)/,
  "el limite por categoria no se bloquea al escribir rapido",
);

for (const shown of [
  fmt(1e54, "S/", "PEN"),
  fmtCompact(1e54, "S/", "PEN"),
]) {
  assert.doesNotMatch(shown, /e\+|monto inválido/i);
  assert.match(shown, /nonill/);
}

console.log("Montos largos: límite seguro y formato legible correctos.");
