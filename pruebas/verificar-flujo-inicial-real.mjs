import fs from "node:fs";

const bienvenida = fs.readFileSync("screens/Onboarding.tsx", "utf8");
const registro = fs.readFileSync("app/register.tsx", "utf8");
const verificacion = fs.readFileSync("app/verify-email.tsx", "utf8");
const configuracion = fs.readFileSync("app/setup.tsx", "utf8");
const fallos = [];

for (const texto of ["Continuar con Google", "Crear cuenta", "Ya tengo una cuenta", "Tus datos, solo tuyos."]) {
  if (!bienvenida.includes(texto)) fallos.push(`falta ${texto} en bienvenida`);
}
if (!bienvenida.includes("fino-sunset-background.png")) fallos.push("falta el fondo oficial");
if (!registro.includes('router.replace("/verify-email")')) fallos.push("crear cuenta no lleva a verificar correo");
if (!verificacion.includes('router.replace("/setup")')) fallos.push("verificar correo no lleva a configurar Fino");
if (!configuracion.includes("Setup")) fallos.push("falta la configuración inicial");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: bienvenida, cuenta, verificación y configuración están en orden");
