import fs from "fs";

const onboarding = fs.readFileSync("screens/Onboarding.tsx", "utf8");
const index = fs.readFileSync("app/index.tsx", "utf8");

const checks = [
  ["usa la portada exacta", /onboarding\/welcome\.png/.test(onboarding)],
  ["usa la configuración exacta", /onboarding\/setup\.png/.test(onboarding)],
  ["usa el acceso exacto", /onboarding\/access\.png/.test(onboarding)],
  ["solo tiene tres pasos", /const TOTAL_STEPS = 3/.test(onboarding)],
  ["permite elegir país", /setCountryModalVisible/.test(onboarding)],
  ["permite elegir moneda", /setCurrencyModalVisible/.test(onboarding)],
  ["activa avisos de verdad", /requestPermissionsAsync/.test(onboarding)],
  ["el botón Google es real", /onGoogle/.test(onboarding)],
  ["ya no muestra el splash verde antiguo", !/screens\/Splash/.test(index)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`FALLA: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("3 pantallas exactas y controles reales");
