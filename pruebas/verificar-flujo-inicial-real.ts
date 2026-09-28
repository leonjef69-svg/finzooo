import assert from "node:assert/strict";
import fs from "node:fs";
import { translations, type LanguageId } from "@/constants/i18n";

const bienvenida = fs.readFileSync("screens/Onboarding.tsx", "utf8");
const registro = fs.readFileSync("app/register.tsx", "utf8");
const configuracion = fs.readFileSync("app/setup.tsx", "utf8");

const claves = [
  "onboarding.continueGoogle",
  "onboarding.createAccount",
  "onboarding.haveAccount",
] as const;

for (const language of ["es", "en", "pt"] satisfies LanguageId[]) {
  for (const key of claves) {
    assert.ok(translations[language][key]?.trim(), `${key} debe tener texto en ${language}`);
  }
}

for (const key of claves) {
  assert.ok(bienvenida.includes(`t("${key}")`), `la bienvenida debe usar ${key}`);
}

assert.ok(bienvenida.includes("fino-person-background.png"), "falta el fondo oficial con la persona");
assert.ok(registro.includes('router.replace("/setup")'), "crear cuenta no lleva a configurar Fino");
assert.ok(
  configuracion.includes('router.replace(auth.currentUser && !auth.currentUser.emailVerified ? "/verify-email" : "/(tabs)")'),
  "configurar Fino no lleva a verificar un correo pendiente",
);
assert.ok(configuracion.includes("Setup"), "falta la configuración inicial");

console.log("Bienvenida, traducciones, cuenta, verificación y configuración están en orden");
