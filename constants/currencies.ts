// "label" es una CLAVE de traducción (no el texto en sí) — se traduce
// con t() al momento de mostrarla.
export const CURRENCIES = [
  { id: "PEN", label: "currency.PEN", symbol: "S/" },
  { id: "USD", label: "currency.USD", symbol: "US$" },
  { id: "MXN", label: "currency.MXN", symbol: "MX$" },
  { id: "COP", label: "currency.COP", symbol: "COL$" },
  { id: "ARS", label: "currency.ARS", symbol: "AR$" },
  { id: "CLP", label: "currency.CLP", symbol: "CL$" },
  { id: "EUR", label: "currency.EUR", symbol: "€" },
] as const;

export type CurrencyId = (typeof CURRENCIES)[number]["id"];

export function currencySymbolFor(id: string): string {
  return CURRENCIES.find((c) => c.id === id)?.symbol ?? "S/";
}

export function currencyLabelFor(id: string, t: (key: string) => string): string {
  const key = CURRENCIES.find((c) => c.id === id)?.label ?? "currency.PEN";
  return t(key);
}
