"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { migratePersonalHistory } = require("../src/personal-history-migration");

async function main() {
  const uid = process.argv[2];
  if (!uid) throw new Error("Indica el UID exacto de la cuenta de prueba.");
  // Protección intencional: una ejecución accidental nunca migra producción.
  if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.FINO_MIGRATE_PRODUCTION_CONFIRMED !== uid) {
    throw new Error("Producción bloqueada. Requiere autorización y confirmación explícita del UID.");
  }
  initializeApp();
  const result = await migratePersonalHistory(getFirestore(), uid);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
