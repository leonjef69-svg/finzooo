import {
  currencyDecimals,
  currencySymbolFor,
} from "@/constants/currencies";
import { fmt } from "@/utils/format";
import { MAX_MONEY_AMOUNT } from "@/utils/amount";

const MAX_INPUT_LENGTH = 18;

/**
 * Conserva únicamente los caracteres que puede usar un monto escrito. La
 * interpretación se hace al guardar porque punto y coma cambian según el país.
 */
export function sanitizeCreditMoneyInput(value: string) {
  return value.replace(/[^0-9.,]/g, "").slice(0, MAX_INPUT_LENGTH);
}

function validThousands(value: string, separator: string) {
  const groups = value.split(separator);
  return (
    groups.length > 1 &&
    /^\d{1,3}$/.test(groups[0]) &&
    groups.slice(1).every((group) => /^\d{3}$/.test(group))
  );
}

function safeAmount(value: number, currencyId: string) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY_AMOUNT) return null;
  const factor = 10 ** currencyDecimals(currencyId);
  if (value > Number.MAX_SAFE_INTEGER / factor) return null;
  return value;
}

/**
 * Acepta tanto 1,359.50 como 1.359,50 sin adivinar separadores ambiguos.
 * Devuelve null si el texto no representa un monto seguro para JavaScript.
 */
export function parseCreditMoneyInput(
  input: string,
  currencyId = "PEN",
): number | null {
  const value = sanitizeCreditMoneyInput(input);
  if (!value || !/\d/.test(value)) return null;
  const decimals = currencyDecimals(currencyId);
  const dotCount = (value.match(/\./g) ?? []).length;
  const commaCount = (value.match(/,/g) ?? []).length;
  let normalized = value;

  if (dotCount && commaCount) {
    const decimalSeparator = value.lastIndexOf(".") > value.lastIndexOf(",") ? "." : ",";
    const groupingSeparator = decimalSeparator === "." ? "," : ".";
    if ((decimalSeparator === "." ? dotCount : commaCount) !== 1) return null;
    const [integerPart, fractionPart = ""] = value.split(decimalSeparator);
    if (
      !fractionPart ||
      fractionPart.length > decimals ||
      !validThousands(integerPart, groupingSeparator)
    )
      return null;
    normalized = `${integerPart.split(groupingSeparator).join("")}.${fractionPart}`;
  } else if (dotCount || commaCount) {
    const separator = dotCount ? "." : ",";
    const count = dotCount || commaCount;
    if (count > 1) {
      if (!validThousands(value, separator)) return null;
      normalized = value.split(separator).join("");
    } else {
      const [integerPart, fractionPart = ""] = value.split(separator);
      if (!integerPart || !fractionPart) return null;
      if (decimals > 0 && fractionPart.length <= decimals) {
        normalized = `${integerPart}.${fractionPart}`;
      } else if (fractionPart.length === 3 && /^\d{1,3}$/.test(integerPart)) {
        normalized = `${integerPart}${fractionPart}`;
      } else {
        return null;
      }
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  return safeAmount(Number(normalized), currencyId);
}

export function isSafeCreditAmount(value: number, currencyId = "PEN") {
  return safeAmount(value, currencyId) !== null;
}

export function creditMoneyEpsilon(currencyId = "PEN") {
  return 0.5 / 10 ** currencyDecimals(currencyId);
}

export function creditMoneyPlaceholder(currencyId = "PEN") {
  const decimals = currencyDecimals(currencyId);
  return decimals ? `0.${"0".repeat(decimals)}` : "0";
}

export function formatCreditMoney(value: number, currencyId = "PEN") {
  const safe = Number.isFinite(value) ? value : 0;
  return fmt(safe, currencySymbolFor(currencyId), currencyId);
}

const COMPACT_UNITS = [
  { value: 1_000_000_000_000_000, suffix: "mil bill." },
  { value: 1_000_000_000_000, suffix: "bill." },
  { value: 1_000_000_000, suffix: "mil M" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "mil" },
];

/** Mantiene el monto exacto habitual y solo abrevia cuando realmente no cabe. */
export function formatCreditMoneyCompact(
  value: number,
  currencyId = "PEN",
  maxCharacters = 17,
) {
  const exact = formatCreditMoney(value, currencyId);
  if (exact.length <= maxCharacters) return exact;
  const abs = Math.abs(value);
  const unit = COMPACT_UNITS.find((candidate) => abs >= candidate.value);
  if (!unit) return exact;
  const scaled = abs / unit.value;
  const digits = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1;
  const decimal = ["CLP", "COP", "ARS", "BRL", "EUR"].includes(currencyId)
    ? ","
    : ".";
  const number = scaled.toFixed(digits).replace(".", decimal);
  return `${value < 0 ? "-" : ""}${currencySymbolFor(currencyId)} ${number} ${unit.suffix}`;
}

export function isCreditMoneyCompacted(
  value: number,
  currencyId = "PEN",
  maxCharacters = 17,
) {
  return (
    formatCreditMoneyCompact(value, currencyId, maxCharacters) !==
    formatCreditMoney(value, currencyId)
  );
}
