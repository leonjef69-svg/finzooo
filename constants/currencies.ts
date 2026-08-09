// "label" es una CLAVE de traducción (no el texto en sí) — se traduce
// con t() al momento de mostrarla.
export const CURRENCIES = [
  { id: "PEN", label: "currency.PEN", symbol: "S/" },
  { id: "USD", label: "currency.USD", symbol: "US$" },
  { id: "MXN", label: "currency.MXN", symbol: "MX$" },
  { id: "COP", label: "currency.COP", symbol: "COL$" },
  { id: "ARS", label: "currency.ARS", symbol: "AR$" },
  { id: "CLP", label: "currency.CLP", symbol: "CL$" },
  // El real faltaba, y era un hueco de verdad: el portugués ya estaba entre
  // los idiomas, así que un brasileño podía tener la app en su idioma pero
  // tenía que llevar sus cuentas en soles o en dólares.
  { id: "BRL", label: "currency.BRL", symbol: "R$" },
  { id: "EUR", label: "currency.EUR", symbol: "€" },
] as const;

export type CurrencyId = (typeof CURRENCIES)[number]["id"];

export function currencySymbolFor(id: string): string {
  return CURRENCIES.find((c) => c.id === id)?.symbol ?? "S/";
}

/**
 * MONEDAS EN LAS QUE LOS PRECIOS NO LLEVAN CÉNTIMOS.
 *
 * No es un detalle de formato: **cambia cómo se lee una boleta**. El escáner se apoya en que
 * un precio lleva decimales para distinguirlo de un código de producto o de un año — eso es lo
 * que evitó que una compra de S/ 16,50 se guardara como S/ 2.423.
 *
 * Pero en Chile un café cuesta **2500** pesos, sin decimales, y en Colombia igual. Con la regla
 * de los soles puesta, ahí el escáner **descartaría todos los montos** y no propondría nada.
 * Salió mirando una boleta chilena de verdad el 09/08/2026, y él lo zanjó: *"el escanear tiene
 * que funcionar en los países que tengo en mi ajuste"*.
 *
 * El peso argentino está aquí aunque tenga centavos por ley: con la inflación, los precios del
 * día a día se escriben enteros desde hace años.
 */
const SIN_CENTIMOS = ["CLP", "COP", "ARS"];

/** ¿En esta moneda los precios llevan céntimos? */
export function usaCentimos(id: string): boolean {
  return !SIN_CENTIMOS.includes(id);
}

export function currencyLabelFor(id: string, t: (key: string) => string): string {
  const key = CURRENCIES.find((c) => c.id === id)?.label ?? "currency.PEN";
  return t(key);
}
