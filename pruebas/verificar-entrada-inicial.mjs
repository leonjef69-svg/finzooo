import fs from "node:fs";
import assert from "node:assert/strict";

const onboarding = fs.readFileSync("screens/SetupBudget.tsx", "utf8");
const countryPicker = fs.readFileSync("screens/CountryPicker.tsx", "utf8");
const currencyPicker = fs.readFileSync("screens/CurrencyPicker.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");

assert.match(onboarding, /Linking\.openSettings/);
assert.match(onboarding, /notificationKey/);
assert.match(onboarding, /AppState\.addEventListener/);
assert.match(onboarding, /permission\.granted/);
assert.match(onboarding, /\/country/);
assert.match(onboarding, /\/currency/);
for (const screen of [onboarding, countryPicker, currencyPicker]) {
  assert.match(screen, /fino-settings-background\.png/, "las tres pantallas usan el mismo fondo nítido");
  assert.doesNotMatch(screen, /blurRadius=/, "el fondo no se amplía ni se desenfoca artificialmente");
}
assert.match(context, /setInitialCountry/);
assert.match(context, /hasOnboarded:\s*false/);
assert.match(context, /if \(profile\) \{/);
assert.match(context, /setUserCurrency\(profile\.userCurrency/);

console.log("✓ La configuración permite cambiar país y moneda, y los avisos requieren permiso real.");
