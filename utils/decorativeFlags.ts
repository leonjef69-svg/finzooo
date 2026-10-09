import { countryById } from "@/constants/countries";
import { CURRENCIES } from "@/constants/currencies";

const LANGUAGE_FLAGS = new Map<string, string>([["es", "🇪🇸"], ["en", "🇺🇸"], ["pt", "🇧🇷"]]);
const SHARED_CURRENCY_FLAGS: Record<string, string> = {
  EUR: "🇪🇺", ANG: "🇨🇼", XCG: "🇨🇼", XAF: "🇨🇲",
  XOF: "🇸🇳", XCD: "🇦🇬", XPF: "🇵🇫",
};
const knownCurrencies = new Set(CURRENCIES.map(currency => currency.id));

/** Adorno del idioma; no determina país, moneda ni preferencias guardadas. */
export function languageFlagFor(language: string): string {
  return LANGUAGE_FLAGS.get(language.trim().toLowerCase()) ?? "🌐";
}

/**
 * Adorno representativo, no residencia ni exclusividad de uso de una moneda.
 * Reutiliza los códigos del catálogo; no convierte ni modifica importes.
 */
export function currencyFlagFor(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (!knownCurrencies.has(code)) return "🌐";
  return SHARED_CURRENCY_FLAGS[code] ?? countryById(code.slice(0, 2))?.flag ?? "🌐";
}
