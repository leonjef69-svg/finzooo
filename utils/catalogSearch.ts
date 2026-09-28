import { countriesFor, countryLabelFor, type Country } from "@/constants/countries";
import { CURRENCIES, currencyLabelFor } from "@/constants/currencies";

export function filterCountries(query: string, language: string): Country[] {
  const normalized = query.trim().toLocaleLowerCase(language);
  if (!normalized) return countriesFor(language);
  return countriesFor(language).filter((country) => {
    const name = countryLabelFor(country, language).toLocaleLowerCase(language);
    return name.includes(normalized)
      || country.id.toLowerCase().includes(normalized)
      || country.currency.toLowerCase().includes(normalized);
  });
}

export type NamedCurrency = (typeof CURRENCIES)[number] & { name: string };

export function filterCurrencies(
  query: string,
  language: string,
  translate: (key: string) => string,
): NamedCurrency[] {
  const normalized = query.trim().toLocaleLowerCase(language);
  return CURRENCIES
    .map((currency) => ({
      ...currency,
      name: currencyLabelFor(currency.id, translate, language),
    }))
    .filter((currency) => !normalized
      || currency.name.toLocaleLowerCase(language).includes(normalized)
      || currency.id.toLowerCase().includes(normalized)
      || currency.symbol.toLocaleLowerCase(language).includes(normalized));
}

