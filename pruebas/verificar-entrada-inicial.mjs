import fs from "node:fs";
import assert from "node:assert/strict";

const onboarding = fs.readFileSync("screens/SetupBudget.tsx", "utf8");
const languagePicker = fs.readFileSync("screens/LanguagePicker.tsx", "utf8");
const notifications = fs.readFileSync("utils/setupNotifications.ts", "utf8");
const currencyPicker = fs.readFileSync("screens/CurrencyPicker.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");

assert.match(onboarding, /useSetupNotifications/);
assert.match(notifications, /Linking\.openSettings/);
assert.match(notifications, /@fino\/setup-notifications-enabled:/);
assert.match(notifications, /AppState\.addEventListener/);
assert.match(notifications, /permission\.granted/);
assert.match(onboarding, /\/language/);
assert.match(onboarding, /\/currency/);
for (const screen of [onboarding, currencyPicker]) {
  assert.match(screen, /fino-settings-background\.png/, "configuración y moneda conservan su fondo nítido");
  assert.doesNotMatch(screen, /blurRadius=/, "el fondo no se amplía ni se desenfoca artificialmente");
}
assert.match(languagePicker, /LANGUAGES/);
assert.doesNotMatch(languagePicker, /countryFor|currencySymbolFor|onSelect\([^)]*currency/);
assert.match(context, /setInitialCountry/);
assert.match(context, /persistCloudProfile\(markCloudProfile\([\s\S]*?country, false\)/,
  "elegir país antes del registro no da por terminado el setup");
assert.match(context, /if \(profile\) \{/);
assert.match(context, /setUserCurrency\(profile\.userCurrency/);

console.log("Contratos estáticos: configuración enlaza idioma independiente de moneda y avisos con permiso. No prueba Android; los manejadores se ejecutan en suites originales aparte.");
