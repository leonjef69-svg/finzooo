import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeBudgetMonths, mergeCloudFields } from "@/utils/cloudFieldMerge";
import type { CloudData } from "@/utils/cloudSync";

function data(overrides: Partial<CloudData> = {}): CloudData {
  return {
    hasOnboarded: true,
    userName: "Ana",
    userPhoto: null,
    userCurrency: "PEN",
    userLanguage: "es",
    budgets: {},
    categoryBudgets: {},
    transactions: [],
    goals: [],
    isPremium: false,
    ...overrides,
  };
}

const local = data({
  budgets: { "2026-10": 1000 },
  pagosProgramados: [],
  categoryOverrides: { comida: { name: "Comida vieja" } },
  syncUpdatedAt: { budgets: 10, payments: 10, categoryOverrides: 10 },
});
const remote = data({
  budgets: { "2026-10": 2000 },
  pagosProgramados: [{
    id: "luz",
    tipo: "pago",
    nombre: "Luz",
    monto: 80,
    dia: 15,
    repite: "mensual",
    categoria: "servicios",
    avisoDiasAntes: 1,
    avisoHora: "09:00",
    pagados: [],
    creado: 1,
  }],
  categoryOverrides: { comida: { name: "Alimentos" } },
  syncUpdatedAt: { budgets: 20, payments: 20, categoryOverrides: 20 },
});

const merged = mergeCloudFields(local, remote);
assert.equal(merged.budgets["2026-10"], 2000, "el presupuesto más nuevo de otro teléfono debe conservarse");
assert.equal(merged.pagosProgramados?.[0]?.id, "luz", "un gasto nuevo no puede borrar el calendario remoto");
assert.equal(merged.categoryOverrides?.comida?.name, "Alimentos", "la personalización más nueva debe ganar");

const localNewer = mergeCloudFields(
  data({ categoryBudgets: { comida: 300 }, syncUpdatedAt: { categoryBudgets: 40 } }),
  data({ categoryBudgets: { comida: 100 }, syncUpdatedAt: { categoryBudgets: 30 } }),
);
assert.equal(localNewer.categoryBudgets.comida, 300, "un cambio local posterior sí debe subirse");

const migrated = mergeCloudFields(
  data({ budgets: {} }),
  data({ budgets: { "2026-09": 900 } }),
);
assert.equal(migrated.budgets["2026-09"], 900, "al migrar una cuenta antigua gana la copia compartida de la nube");
assert.equal(migrated.syncUpdatedAt?.budgets, 0, "la migración no inventa una edición reciente para datos antiguos");
assert.equal(migrated.syncFormat, 2, "la migración distingue la unión por elemento de la sustitución antigua");

const distinctMonths = mergeCloudFields(
  data({ budgets: { "2026-10": 1000 }, syncUpdatedAt: { budgets: 40 } }),
  data({ budgets: { "2026-09": 900 }, syncUpdatedAt: { budgets: 30 } }),
);
assert.deepEqual(distinctMonths.budgets, { "2026-09": 900, "2026-10": 1000 },
  "editar octubre no borra septiembre guardado en otro teléfono");
assert.deepEqual(
  mergeBudgetMonths({ "2026-10": 1000 }, { "2026-10": 1500, "2026-09": 900 }, 10, 20),
  { "2026-10": 1500, "2026-09": 900 },
  "si ambos editan el mismo mes gana el cambio posterior, sin perder otro mes",
);
const context = readFileSync("contexts/AppDataContext.tsx", "utf8");
assert.match(context, /merged = mergeCloudFields\(\{ \.\.\.local, syncUpdatedAt: cloudSyncMetaRef\.current \}, cloud\)/,
  "la recepción utiliza la misma unión por elemento que la subida");
assert.match(context, /setBudgets\(merged\.budgets\)/, "los meses fusionados llegan a la pantalla");

console.log("Sincronización por elementos entre dos teléfonos correcta.");
