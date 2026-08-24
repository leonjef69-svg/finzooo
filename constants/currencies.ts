/** Monedas activas usadas por el catálogo mundial de países. */
const CODES = `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG`;

const SYMBOLS: Record<string, string> = {
  ARS: "AR$", AUD: "A$", BOB: "Bs", BRL: "R$", CAD: "C$", CHF: "CHF",
  CLP: "CL$", CNY: "¥", COP: "COL$", EUR: "€", GBP: "£", HKD: "HK$",
  IDR: "Rp", ILS: "₪", INR: "₹", JPY: "¥", KRW: "₩", MXN: "MX$",
  NGN: "₦", PEN: "S/", PHP: "₱", RUB: "₽", THB: "฿", TRY: "₺",
  TWD: "NT$", USD: "US$", VND: "₫", ZAR: "R",
};

export type CurrencyId = string;

export const CURRENCIES = CODES.split(" ").map((id) => ({
  id,
  label: `currency.${id}`,
  symbol: SYMBOLS[id] ?? id,
}));

export function currencySymbolFor(id: string): string {
  return CURRENCIES.find((currency) => currency.id === id)?.symbol ?? (id || "S/");
}

/** ISO 4217: monedas cuyo monto cotidiano no lleva parte decimal. */
const ZERO_DECIMALS = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMALS = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function currencyDecimals(id: string): number {
  if (ZERO_DECIMALS.has(id)) return 0;
  if (THREE_DECIMALS.has(id)) return 3;
  return 2;
}

/**
 * El escáner usa esta decisión para distinguir precios de códigos.
 * No es lo mismo que los decimales ISO: en Argentina y Colombia la moneda
 * admite centavos, pero los precios cotidianos suelen imprimirse enteros.
 */
export function usaCentimos(id: string): boolean {
  return currencyDecimals(id) > 0 && !["ARS", "COP"].includes(id);
}

export function currencyLabelFor(
  id: string,
  t: (key: string) => string,
  language = "es"
): string {
  const key = `currency.${id}`;
  const translated = t(key);
  if (translated !== key) return translated;
  try {
    const DisplayNames = (Intl as typeof Intl & { DisplayNames?: new (locales: string[], options: { type: "currency" }) => { of: (id: string) => string | undefined } }).DisplayNames;
    return DisplayNames ? new DisplayNames([language], { type: "currency" }).of(id) || id : id;
  } catch { return id; }
}
