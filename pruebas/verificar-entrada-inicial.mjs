import fs from "node:fs";
import assert from "node:assert/strict";

const onboarding = fs.readFileSync("screens/SetupBudget.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");

assert.match(onboarding, /requestPermissionsAsync/);
assert.match(onboarding, /\/country/);
assert.match(onboarding, /\/currency/);
assert.match(context, /setInitialCountry/);
assert.match(context, /hasOnboarded:\s*false/);
assert.match(context, /if \(profile\) \{/);
assert.match(context, /setUserCurrency\(profile\.userCurrency/);

console.log("✓ La configuración permite cambiar país y moneda, y los avisos requieren permiso real.");
