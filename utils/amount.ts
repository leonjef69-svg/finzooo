// Limpieza de lo que la persona escribe en un campo de dinero.
//
// Por qué existe este archivo: antes cada pantalla repetía la misma línea
//   v.replace(/[^0-9.]/g, "")
// en siete lugares distintos, y esa línea tenía dos fallos:
//
//   1. BORRABA la coma en vez de entenderla como decimal. Quien escribía
//      "1,50" —como se escribe en Argentina, España, Colombia o Chile—
//      terminaba guardando 150. Cien veces más de lo que quiso poner.
//
//   2. Dejaba pasar varios puntos ("1.2.3"), y parseFloat lo recortaba en
//      silencio a 1.2 sin avisar de nada.
//
// Al estar en un solo sitio, el arreglo vale para toda la app y no puede
// volver a quedar a medias en una pantalla.
import { currencyDecimals } from "@/constants/currencies";

/** Máximo de montos enteros. Los decimales requieren un límite menor. */
export const MAX_MONEY_AMOUNT = 9_000_000_000_000;

// Los números de JavaScript dejan de distinguir céntimos con fiabilidad
// mucho antes del máximo admitido para montos enteros.
const MAX_WITH_FRACTION: Record<number, number> = { 2: 100_000_000_000, 3: 10_000_000_000 };

export function sanitizeAmountInput(raw: string, currency = "PEN"): string {
  const limpio = raw.replace(/[^0-9.,]/g, "");
  const separadores = [...limpio].flatMap((char, index) => char === "." || char === "," ? [index] : []);
  let s: string;

  if (separadores.length === 0) {
    s = limpio;
  } else {
    const ultimo = separadores.at(-1)!;
    const fraccion = limpio.slice(ultimo + 1).replace(/[^0-9]/g, "");
    const entero = limpio.slice(0, ultimo).replace(/[^0-9]/g, "");
    const tieneAmbos = limpio.includes(".") && limpio.includes(",");
    const gruposDeMiles = separadores.length > 1
      && limpio.split(/[.,]/).slice(1).every((grupo) => grupo.length === 3);
    const unicoPareceMiles = currencyDecimals(currency) !== 3 && separadores.length === 1
      && fraccion.length === 3
      && entero.length > 0
      && entero !== "0";

    if (gruposDeMiles || (!tieneAmbos && unicoPareceMiles)) {
      s = limpio.replace(/[.,]/g, "");
    } else {
      // Si aparecen punto y coma, el último es el decimal y los anteriores son
      // miles: 1,500.25 y 1.500,25 producen el mismo valor.
      s = `${entero}${limpio.endsWith(".") || limpio.endsWith(",") ? "." : fraccion ? `.${fraccion}` : ""}`;
    }
  }

  // Conservar lo escrito permite mostrar un error. Recortarlo aquí convertía
  // 9.999.999.999.999 en 999.999.999.999 sin que la persona se enterara.
  return s;
}

/**
 * Mantiene visible un monto inválido para poder explicarlo antes de guardar.
 * Nunca convierte un monto grande en otro monto más pequeño.
 */
export function sanitizeSafeAmountInput(raw: string, currency = "PEN"): string {
  return sanitizeAmountInput(raw, currency);
}

export function isSafeMoneyAmount(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_MONEY_AMOUNT;
}

export function amountInputError(raw: string, currency = "PEN"): "tooLarge" | "tooManyDecimals" | null {
  const clean = sanitizeAmountInput(raw, currency);
  const decimals = currencyDecimals(currency);
  const fraction = clean.split(".")[1] ?? "";
  if (fraction.length > decimals) return "tooManyDecimals";
  const amount = Number(clean);
  if (Number.isFinite(amount) && (amount > MAX_MONEY_AMOUNT
    || (fraction.length > 0 && amount > (MAX_WITH_FRACTION[decimals] ?? MAX_MONEY_AMOUNT)))) return "tooLarge";
  return null;
}

// Convierte a número lo ya limpiado. Devuelve 0 ante cualquier cosa que no
// sea un número válido, para que nunca se guarde NaN en un movimiento.
export function parseAmountInput(raw: string, currency = "PEN"): number {
  const clean = sanitizeAmountInput(raw, currency);
  if (amountInputError(clean, currency)) return 0;
  const n = Number(clean);
  return isSafeMoneyAmount(n) ? n : 0;
}
