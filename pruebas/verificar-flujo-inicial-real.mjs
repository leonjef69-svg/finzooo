import fs from "node:fs";

const bienvenida = fs.readFileSync("screens/Onboarding.tsx", "utf8");
const traducciones = fs.readFileSync("constants/i18n.ts", "utf8");
const registro = fs.readFileSync("app/register.tsx", "utf8");
const configuracion = fs.readFileSync("app/setup.tsx", "utf8");
const fallos = [];

for (const clave of ["onboarding.continueGoogle", "onboarding.createAccount", "onboarding.haveAccount"]) {
  if (!bienvenida.includes(`t("${clave}")`)) fallos.push(`falta ${clave} en bienvenida`);
  if ((traducciones.match(new RegExp(`"${clave.replace(".", "\\.")}"`, "g")) || []).length !== 3) {
    fallos.push(`${clave} no está disponible en los tres idiomas`);
  }
}
if (!bienvenida.includes("fino-person-background.png")) fallos.push("falta el fondo oficial con la persona");
if (!registro.includes('router.replace("/setup")')) fallos.push("crear cuenta no lleva a configurar Fino");
if (!configuracion.includes('router.replace(auth.currentUser && !auth.currentUser.emailVerified ? "/verify-email" : "/(tabs)")')) {
  fallos.push("configurar Fino no lleva a verificar un correo pendiente");
}
if (!configuracion.includes("Setup")) fallos.push("falta la configuración inicial");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: bienvenida, cuenta, verificación y configuración están en orden");
