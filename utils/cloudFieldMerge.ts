import type { CloudData } from "@/utils/cloudSync";

export const CLOUD_SYNC_GROUPS = {
  profile: "profile",
  budgets: "budgets",
  categoryBudgets: "categoryBudgets",
  payments: "payments",
  merchants: "merchants",
  categoryOverrides: "categoryOverrides",
  customCategories: "customCategories",
  carryover: "carryover",
  favoriteIcons: "favoriteIcons",
} as const;

export type CloudSyncGroup = typeof CLOUD_SYNC_GROUPS[keyof typeof CLOUD_SYNC_GROUPS];

/**
 * Conserva el bloque que realmente se modificó más tarde. Así registrar un
 * gasto en un teléfono no devuelve el presupuesto o el calendario a la copia
 * vieja que ese teléfono tenía abierta.
 */
export function mergeCloudFields(local: CloudData, remote: CloudData): CloudData {
  const localTimes = local.syncUpdatedAt ?? {};
  const remoteTimes = remote.syncUpdatedAt ?? {};
  const now = Date.now();
  const times: Record<string, number> = { ...remoteTimes, ...localTimes };
  const localWins = (group: CloudSyncGroup) => {
    const localTime = localTimes[group] ?? 0;
    const remoteTime = remoteTimes[group] ?? 0;
    times[group] = Math.max(localTime, remoteTime) || now;
    // En la migración inicial ambos valen cero. Gana la nube, que es la copia
    // compartida, y a partir de aquí ambos lados ya quedan fechados.
    return localTime > remoteTime;
  };
  const choose = <T,>(group: CloudSyncGroup, localValue: T, remoteValue: T): T =>
    localWins(group) ? localValue : remoteValue;

  const profile = choose(
    CLOUD_SYNC_GROUPS.profile,
    { userName: local.userName, userPhoto: local.userPhoto, userCurrency: local.userCurrency, userLanguage: local.userLanguage },
    { userName: remote.userName, userPhoto: remote.userPhoto, userCurrency: remote.userCurrency, userLanguage: remote.userLanguage },
  );
  return {
    ...local,
    ...profile,
    budgets: choose(CLOUD_SYNC_GROUPS.budgets, local.budgets, remote.budgets),
    categoryBudgets: choose(CLOUD_SYNC_GROUPS.categoryBudgets, local.categoryBudgets, remote.categoryBudgets),
    pagosProgramados: choose(CLOUD_SYNC_GROUPS.payments, local.pagosProgramados ?? [], remote.pagosProgramados ?? []),
    merchantLearned: choose(CLOUD_SYNC_GROUPS.merchants, local.merchantLearned ?? {}, remote.merchantLearned ?? {}),
    categoryOverrides: choose(CLOUD_SYNC_GROUPS.categoryOverrides, local.categoryOverrides ?? {}, remote.categoryOverrides ?? {}),
    categoriasPropias: choose(CLOUD_SYNC_GROUPS.customCategories, local.categoriasPropias ?? [], remote.categoriasPropias ?? []),
    carryoverCleared: choose(CLOUD_SYNC_GROUPS.carryover, local.carryoverCleared ?? [], remote.carryoverCleared ?? []),
    iconosFavoritos: choose(CLOUD_SYNC_GROUPS.favoriteIcons, local.iconosFavoritos ?? [], remote.iconosFavoritos ?? []),
    syncUpdatedAt: times,
  };
}
