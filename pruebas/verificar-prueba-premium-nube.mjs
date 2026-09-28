import fs from "node:fs";

const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");
const funcion = fs.readFileSync("functions/src/premium-trial.js", "utf8");
const servidor = fs.readFileSync("functions/index.js", "utf8");
const cliente = fs.readFileSync("utils/premiumTrialCloud.ts", "utf8");
const fallos = [];

if (!nube.includes("premiumTrialStartedAt?: number")) fallos.push("La nube no guarda el uso de la prueba.");
if (!contexto.includes("premiumTrialStartedAt: pruebaInicio ?? undefined")) fallos.push("Activar la prueba no la sube con la cuenta.");
if (!contexto.includes("cloud.premiumTrialStartedAt ?? pruebaInicio")) fallos.push("Reinstalar no restaura la prueba usada.");
if (!cliente.includes('"activatePremiumTrial"')) fallos.push("La app no pide la prueba al servidor.");
if (!servidor.includes("exports.activatePremiumTrial = onCall")) fallos.push("Falta la función que concede la prueba.");
if (!funcion.includes("runTransaction") || !funcion.includes("premiumTrialStartedAt")) fallos.push("La concesión no es atómica.");
if (!reglas.includes("!('premiumTrialStartedAt' in request.resource.data)")) fallos.push("El teléfono todavía podría iniciar la prueba.");
if (!reglas.includes("== resource.data.premiumTrialStartedAt")) fallos.push("El celular podría borrar o reiniciar una prueba ya usada.");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: la prueba Premium usada queda ligada a la cuenta");
