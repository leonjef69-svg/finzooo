const fs = require("node:fs");
const path = require("node:path");

function validateFirebaseAndroid(config, expected) {
  if (!expected.projectId || config?.project_info?.project_id !== expected.projectId) {
    throw new Error("La configuración Firebase pertenece a otro proyecto o está incompleta.");
  }
  if (!expected.senderId || String(config.project_info.project_number) !== expected.senderId) {
    throw new Error("El remitente de Firebase no coincide con el de la app.");
  }
  const clients = Array.isArray(config.client) ? config.client.filter(client =>
    client?.client_info?.android_client_info?.package_name === expected.packageName) : [];
  if (!expected.packageName || clients.length !== 1) {
    throw new Error("La configuración debe contener un solo cliente para el paquete Android de Fino.");
  }
  if (!clients[0].client_info.mobilesdk_app_id?.startsWith(`1:${expected.senderId}:android:`)) {
    throw new Error("El identificador Android no coincide con el proyecto Firebase.");
  }
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // No imprimir JSON ni claves cuando un archivo esté dañado.
    throw new Error(`No se pudo leer el JSON configurado: ${path.basename(file)}.`);
  }
}

function prepareFirebaseAndroid(root, copy = false) {
  const app = readJSON(path.join(root, "app.json")).expo;
  const firebaseSource = fs.readFileSync(path.join(root, "utils/firebase.ts"), "utf8");
  function field(name) {
    const matches = [...firebaseSource.matchAll(new RegExp(`^\\s*${name}:\\s*["']([^"']+)["']\\s*,?\\s*$`, "gm"))];
    if (matches.length !== 1) throw new Error(`No se pudo identificar ${name} en la configuración de la app.`);
    return matches[0][1];
  }
  const configured = app?.android?.googleServicesFile;
  if (typeof configured !== "string" || !configured.trim()) {
    throw new Error("Falta android.googleServicesFile en app.json.");
  }
  const config = readJSON(path.resolve(root, configured));
  validateFirebaseAndroid(config, {
    projectId: field("projectId"), senderId: field("messagingSenderId"),
    packageName: app.android.package,
  });
  if (copy) {
    // Copiar exactamente lo validado; no volver a elegir un archivo de Descargas.
    fs.writeFileSync(path.join(root, "android/app/google-services.json"), JSON.stringify(config, null, 2) + "\n");
  }
}

module.exports = { validateFirebaseAndroid, prepareFirebaseAndroid };
if (require.main === module) {
  try {
    if (process.argv.slice(2).some(arg => arg !== "--copy")) throw new Error("Opción desconocida.");
    prepareFirebaseAndroid(path.resolve(__dirname, ".."), process.argv.includes("--copy"));
    console.log("Firebase Android validado: proyecto, remitente y paquete coinciden.");
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
