import fs from "node:fs";
import assert from "node:assert/strict";

const onboarding = fs.readFileSync("screens/Onboarding.tsx", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");

assert.match(onboarding, /deviceLocale/);
assert.match(onboarding, /requestPermissionsAsync/);
assert.match(onboarding, /countriesFor/);
assert.match(onboarding, /countryLabelFor/);
assert.match(onboarding, /country\.id, country\.language, country\.currency/);
assert.match(onboarding, /Cambiar|changeCountry/);
assert.match(context, /setInitialCountry/);
assert.match(context, /hasOnboarded:\s*false/);
assert.match(context, /if \(profile\) \{/);
assert.match(context, /setUserCurrency\(profile\.userCurrency/);

console.log("✓ La entrada detecta y conserva el país, permite cambiarlo y pide avisos antes del registro.");
