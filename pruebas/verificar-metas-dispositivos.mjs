import fs from "fs";

const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");
const storage = fs.readFileSync("utils/storage.ts", "utf8");

const verificaciones = [
  [nube.includes("deletedGoalIds?: number[]"), "la nube acepta borrados de metas"],
  [nube.includes("mergeGoals(siguiente.goals"), "la subida fusiona metas de dos celulares"],
  [contexto.includes("setDeletedGoalIds((prev)"), "borrar una meta deja constancia"],
  [contexto.includes("mergeGoals(locales, cloud.goals)"), "al volver a la app se recogen metas remotas"],
  [storage.includes('deletedGoalIds: "finzo:deletedGoalIds"'), "los borrados sobreviven al reinicio"],
  [reglas.includes("'deletedGoalIds'"), "las reglas permiten el nuevo dato protegido"],
];

let fallos = 0;
for (const [cumple, mensaje] of verificaciones) {
  console.log(`  ${cumple ? "OK   " : "FALLA"} ${mensaje}`);
  if (!cumple) fallos++;
}

console.log(fallos ? `\n${fallos} fallos\n` : "\nTodo bien\n");
process.exit(fallos ? 1 : 0);
