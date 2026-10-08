import assert from "node:assert/strict";

import {
  COUNTRIES,
  countriesFor,
  countryById,
  countryFor,
  countryLabelFor,
} from "@/constants/countries";
import {
  CURRENCIES,
  currencyDecimals,
  currencyLabelFor,
  currencySymbolFor,
} from "@/constants/currencies";
import type { Profile } from "@/types";
import type { CloudData } from "@/utils/cloudSync";
import { filterCountries, filterCurrencies } from "@/utils/catalogSearch";
import { profileWithCurrency } from "@/utils/profile";

type Assert<T extends true> = T;
type ProfileKeepsCountry = Assert<"userCountry" extends keyof Profile ? true : false>;
type CloudOmitsLocalCountry = Assert<"userCountry" extends keyof CloudData ? false : true>;
const typeChecks: [ProfileKeepsCountry, CloudOmitsLocalCountry] = [true, true];
assert.deepEqual(typeChecks, [true, true]);

assert.ok(COUNTRIES.length >= 249, `faltan países o territorios: ${COUNTRIES.length}`);
assert.equal(new Set(COUNTRIES.map((country) => country.id)).size, COUNTRIES.length);
assert.ok(CURRENCIES.length >= 150, `faltan monedas: ${CURRENCIES.length}`);
assert.equal(new Set(CURRENCIES.map((currency) => currency.id)).size, CURRENCIES.length);

const currencyIds = new Set(CURRENCIES.map((currency) => currency.id));
const withoutCurrency = COUNTRIES.filter((country) => !currencyIds.has(country.currency));
assert.deepEqual(withoutCurrency, [], "cada país debe apuntar a una moneda disponible");

assert.equal(currencyDecimals("JPY"), 0);
assert.equal(currencyDecimals("KWD"), 3);
assert.equal(currencyDecimals("PEN"), 2);
assert.equal(currencySymbolFor("AED"), "د.إ");
assert.equal(currencySymbolFor("AFN"), "؋");
assert.equal(currencyLabelFor("AED", (key) => key, "es"), "Dírham de Emiratos Árabes Unidos");
assert.equal(currencyLabelFor("PEN", (key) => key, "es"), "Sol peruano");
assert.equal(currencyLabelFor("XCG", (key) => key, "es"), "Florín caribeño");

assert.equal(countryById("bg")?.currency, "EUR");
assert.equal(countryById("CW")?.currency, "XCG");
assert.equal(countryById("SX")?.currency, "XCG");
assert.equal(countryLabelFor(countryById("PE")!, "es"), "Perú");
assert.equal(countryFor("es", "PEN")?.id, "PE");
assert.equal(countryFor("es", "USD", "EC")?.id, "EC", "el país preferido debe conservarse");

const sortedSpanish = countriesFor("es").map((country) => countryLabelFor(country, "es"));
assert.deepEqual(sortedSpanish, [...sortedSpanish].sort((a, b) => a.localeCompare(b, "es")));

assert.deepEqual(filterCountries("perú", "es").map((country) => country.id), ["PE"]);
assert.ok(filterCountries("usd", "es").every((country) => country.currency === "USD"));
assert.deepEqual(
  filterCurrencies("sol peruano", "es", (key) => key).map((currency) => currency.id),
  ["PEN"],
);
assert.deepEqual(
  filterCurrencies("د.إ", "es", (key) => key).map((currency) => currency.id),
  ["AED"],
);

const profile: Profile = {
  userName: "Ana",
  userEmail: "ana@example.com",
  userPhoto: null,
  userCurrency: "PEN",
  userLanguage: "es",
  userCountry: "PE",
  hasOnboarded: true,
};
assert.equal(profileWithCurrency(profile, "USD"), profile, "la cuenta configurada no cambia de moneda");
assert.deepEqual(profileWithCurrency({ ...profile, hasOnboarded: false }, "USD"), {
  ...profile, hasOnboarded: false, userCurrency: "USD", userCountry: "PE",
}, "la cuenta nueva sí permite elegirla sin cambiar de país");

console.log(`Catálogo real correcto: ${COUNTRIES.length} países y ${CURRENCIES.length} monedas.`);
