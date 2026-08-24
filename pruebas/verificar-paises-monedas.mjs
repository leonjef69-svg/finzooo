/**
 * El catálogo mundial no puede repetir el fallo de Firestore: el país vive
 * solo en el perfil local y no añade otro campo a CloudData. También comprueba
 * que ningún país apunte a una moneda inexistente y que las listas enormes
 * tengan buscador. Esta prueba fallaba con el catálogo anterior de 9 países.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
let failures = 0;
const check = (condition, message) => {
  if (!condition) { console.log(`FALLA: ${message}`); failures++; }
};

const countriesSource = read("constants/countries.ts");
const currenciesSource = read("constants/currencies.ts");
const countries = countriesSource.match(/const DATA = `([\s\S]*?)`\.trim/)?.[1]
  .trim().split("\n").map((row) => row.split("|")) ?? [];
const currencies = new Set(
  currenciesSource.match(/const CODES = `([^`]+)`/)?.[1].trim().split(/\s+/) ?? []
);

check(countries.length >= 249, `deben existir todos los países y territorios; hay ${countries.length}`);
check(new Set(countries.map(([id]) => id)).size === countries.length, "no debe haber países repetidos");
check(currencies.size >= 150, `deben existir las monedas del catálogo; hay ${currencies.size}`);
const missing = countries.filter(([, , currency]) => !currencies.has(currency));
check(missing.length === 0, `faltan monedas para: ${missing.map(([id]) => id).join(", ")}`);
check(/ZERO_DECIMALS/.test(currenciesSource) && /THREE_DECIMALS/.test(currenciesSource), "se respetan monedas de 0 y 3 decimales");

const profile = read("types.ts");
const cloud = read("utils/cloudSync.ts");
const cloudType = cloud.slice(cloud.indexOf("export type CloudData = {"), cloud.indexOf("};", cloud.indexOf("export type CloudData = {")));
check(/userCountry\?: string/.test(profile), "el perfil local guarda el país sin romper perfiles antiguos");
check(!/userCountry/.test(cloudType), "el país no modifica CloudData ni las reglas de Firestore");

for (const file of ["screens/CountryPicker.tsx", "screens/CurrencyPicker.tsx", "screens/Onboarding.tsx"]) {
  const screen = read(file);
  check(screen.includes("TextInput"), `${file} permite buscar en la lista larga`);
}

console.log(failures ? `${failures} comprobaciones fallaron` : `Catálogo mundial correcto: ${countries.length} países y ${currencies.size} monedas`);
process.exit(failures ? 1 : 0);
