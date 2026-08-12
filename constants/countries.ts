// Los países que Fino conoce, con su idioma y su moneda.
//
// POR QUÉ EXISTE ESTO
//
// Antes había dos ajustes sueltos, Moneda e Idioma, y había que acertar con
// los dos. Nada impedía acabar con pesos mexicanos y la app en portugués: una
// combinación que nadie elige a propósito pero que sale sola de tocar uno y
// olvidar el otro.
//
// Elegir el país pone los dos de una vez y bien. Los ajustes sueltos siguen
// ahí debajo, porque el caso raro es real: alguien que vive en Perú y prefiere
// la app en inglés, o que cobra en dólares. Sin esa salida quedaría atrapado
// en lo que el país decidió por él.
//
// El orden es a propósito: primero el país de casa, después el resto de
// Latinoamérica por tamaño, y España y Estados Unidos al final.

import type { CurrencyId } from "@/constants/currencies";
import type { LanguageId } from "@/constants/i18n";

export type Country = {
  id: string;
  /** Clave de traducción del nombre, no el nombre. Se traduce con t(). */
  label: string;
  flag: string;
  language: LanguageId;
  currency: CurrencyId;
};

export const COUNTRIES: Country[] = [
  { id: "PE", label: "country.PE", flag: "🇵🇪", language: "es", currency: "PEN" },
  { id: "MX", label: "country.MX", flag: "🇲🇽", language: "es", currency: "MXN" },
  { id: "CO", label: "country.CO", flag: "🇨🇴", language: "es", currency: "COP" },
  { id: "AR", label: "country.AR", flag: "🇦🇷", language: "es", currency: "ARS" },
  { id: "CL", label: "country.CL", flag: "🇨🇱", language: "es", currency: "CLP" },
  { id: "BO", label: "country.BO", flag: "🇧🇴", language: "es", currency: "BOB" },
  // Brasil no se podía usar de verdad hasta ahora: el portugués existía como
  // idioma, pero el real no estaba entre las monedas. Un brasileño tenía que
  // llevar sus cuentas en soles o en dólares.
  { id: "BR", label: "country.BR", flag: "🇧🇷", language: "pt", currency: "BRL" },
  { id: "ES", label: "country.ES", flag: "🇪🇸", language: "es", currency: "EUR" },
  { id: "US", label: "country.US", flag: "🇺🇸", language: "en", currency: "USD" },
];

export function countryById(id: string): Country | undefined {
  return COUNTRIES.find((c) => c.id === id);
}

/**
 * Qué país corresponde a un idioma y una moneda ya elegidos.
 *
 * Sirve para que la pantalla de países aparezca ya marcada la primera vez,
 * sin pedir nada: quien ya tenía español y soles verá Perú señalado.
 *
 * Devuelve undefined cuando la combinación no es de ningún país —inglés con
 * soles, por ejemplo—, y entonces no se marca ninguno. Marcar el más
 * parecido sería mentir sobre lo que está puesto.
 */
export function countryFor(language: string, currency: string): Country | undefined {
  return COUNTRIES.find((c) => c.language === language && c.currency === currency);
}
