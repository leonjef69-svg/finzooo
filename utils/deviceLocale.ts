import { COUNTRIES, countryById, type Country } from "@/constants/countries";

/** Detecta la región del celular sin GPS ni permisos. */
export function deviceCountry(): Country {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "es-PE";
  // Una configuración puede venir como "es-CL", pero también como
  // "es-Latn-CL". Tomar siempre la segunda parte confundía "Latn" con el
  // país y terminaba poniendo Perú. Buscamos la región real de dos letras.
  const parts = locale.split(/[-_]/);
  const region = [...parts].reverse().find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  return countryById(region || "") ?? countryById("PE") ?? COUNTRIES[0];
}
