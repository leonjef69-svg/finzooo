import fs from "fs";

const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");
const storage = fs.readFileSync("utils/storage.ts", "utf8");

const verificaciones = [
  [nube.includes("deletedGoalIds?: number[]"), "la nube acepta borrados de metas"],
  [nube.includes("mergeGoalCopies(clean.goals"), "la subida usa la fusión común de metas"],
  [contexto.includes('rememberDeletion(source.metadata, "goal"') && contexto.includes("STORAGE_KEYS.goals, STORAGE_KEYS.deletedGoalIds, STORAGE_KEYS.cloudSyncMeta"), "el borrado prepara comprobante y lote"],
  [contexto.includes("mergeGoalCopies(goalsLive.current, cloud.goals"), "la recepción usa las metas vigentes"],
  [storage.includes('deletedGoalIds: "finzo:deletedGoalIds"'), "los borrados sobreviven al reinicio"],
  [reglas.includes("'deletedGoalIds'"), "las reglas permiten el nuevo dato protegido"],
];

let fallos = 0;
for (const [cumple, mensaje] of verificaciones) {
  console.log(`  ${cumple ? "OK   " : "FALLA"} ${mensaje}`);
  if (!cumple) fallos++;
}

console.log(fallos ? `\n${fallos} fallos\n` : "\nContrato estático presente; NO prueba la suma de aportes ni Android. FINO-62 tiene diagnóstico separado.\n");
process.exit(fallos ? 1 : 0);
