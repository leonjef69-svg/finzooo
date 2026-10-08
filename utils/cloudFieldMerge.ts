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

/** Presupuestos de meses distintos no se sustituyen entre teléfonos. */
export function mergeBudgetMonths(
  local: Record<string, number>,
  remote: Record<string, number>,
  localChangedAt: number,
  remoteChangedAt: number,
): Record<string, number> {
  return localChangedAt > remoteChangedAt
    ? { ...remote, ...local }
    : { ...local, ...remote };
}

type Entries = Map<string, unknown>;
const groups = Object.values(CLOUD_SYNC_GROUPS);
const entryPath = (...parts: string[]) => JSON.stringify(parts);
const stampKey = (kind: "write" | "delete", group: CloudSyncGroup, path: string) =>
  `${kind}:${group}:${encodeURIComponent(path)}`;
const clock = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const photo = (value: unknown) => typeof value === "string" && value.startsWith("data:");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => compare(a, b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

function record(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("cloud-field-invalid");
  return value as Record<string, unknown>;
}

export function cloudGroupValue(data: CloudData, group: CloudSyncGroup): unknown {
  switch (group) {
    case "profile": return { userName: data.userName, userPhoto: data.userPhoto, userCurrency: data.userCurrency, userLanguage: data.userLanguage };
    case "budgets": return data.budgets;
    case "categoryBudgets": return data.categoryBudgets;
    case "payments": return data.pagosProgramados ?? [];
    case "merchants": return data.merchantLearned ?? {};
    case "categoryOverrides": return data.categoryOverrides ?? {};
    case "customCategories": return data.categoriasPropias ?? [];
    case "carryover": return data.carryoverCleared ?? [];
    case "favoriteIcons": return data.iconosFavoritos ?? [];
  }
}

export function replaceCloudGroup(data: CloudData, group: CloudSyncGroup, value: unknown): CloudData {
  switch (group) {
    case "profile": return { ...data, ...record(value) } as CloudData;
    case "budgets": return { ...data, budgets: value as CloudData["budgets"] };
    case "categoryBudgets": return { ...data, categoryBudgets: value as CloudData["categoryBudgets"] };
    case "payments": return { ...data, pagosProgramados: value as CloudData["pagosProgramados"] };
    case "merchants": return { ...data, merchantLearned: value as CloudData["merchantLearned"] };
    case "categoryOverrides": return { ...data, categoryOverrides: value as CloudData["categoryOverrides"] };
    case "customCategories": return { ...data, categoriasPropias: value as CloudData["categoriasPropias"] };
    case "carryover": return { ...data, carryoverCleared: value as CloudData["carryoverCleared"] };
    case "favoriteIcons": return { ...data, iconosFavoritos: value as CloudData["iconosFavoritos"] };
  }
}

/** Cada registro tiene presencia y campos propios; pagar un mes no borra otro. */
function entriesFor(group: CloudSyncGroup, value: unknown): Entries {
  const entries: Entries = new Map();
  if (group === "carryover" || group === "favoriteIcons") {
    if (!Array.isArray(value)) throw new Error("cloud-field-invalid");
    for (const key of value) {
      if (typeof key !== "string") throw new Error("cloud-field-invalid");
      if (group !== "favoriteIcons" || !photo(key)) entries.set(entryPath(key), true);
    }
  } else if (group === "payments" || group === "customCategories") {
    if (!Array.isArray(value)) throw new Error("cloud-field-invalid");
    for (const raw of value) {
      const item = record(raw);
      if (typeof item.id !== "string" || !item.id) throw new Error("cloud-field-invalid");
      const id = item.id;
      if (entries.has(entryPath(id, "$exists"))) throw new Error("cloud-field-duplicate-id");
      entries.set(entryPath(id, "$exists"), true);
      for (const [field, fieldValue] of Object.entries(item)) {
        if (field === "$exists" || fieldValue === undefined) continue;
        if (group === "payments" && field === "pagados") {
          if (!Array.isArray(fieldValue)) throw new Error("cloud-field-invalid");
          for (const month of fieldValue) {
            if (typeof month !== "string") throw new Error("cloud-field-invalid");
            entries.set(entryPath(id, field, month), true);
          }
        } else if (group === "payments" && field === "movimientos") {
          for (const [month, movement] of Object.entries(record(fieldValue))) entries.set(entryPath(id, field, month), movement);
        } else entries.set(entryPath(id, field), fieldValue);
      }
    }
  } else if (group === "categoryOverrides") {
    for (const [id, fields] of Object.entries(record(value))) {
      entries.set(entryPath(id, "$exists"), true);
      for (const [field, fieldValue] of Object.entries(record(fields))) {
        if (field !== "$exists" && fieldValue !== undefined) entries.set(entryPath(id, field), fieldValue);
      }
    }
  } else {
    for (const [key, fieldValue] of Object.entries(record(value))) {
      if (fieldValue === undefined || (group === "profile" && key === "userPhoto" && fieldValue === null)) continue;
      entries.set(entryPath(key), fieldValue);
    }
  }
  return entries;
}

function valueFromEntries(group: CloudSyncGroup, entries: Entries, times: Record<string, number>): unknown {
  const sorted = [...entries].sort(([a], [b]) => compare(a, b));
  if (group === "favoriteIcons") {
    sorted.sort(([a], [b]) => clock(times[stampKey("write", group, b)]) - clock(times[stampKey("write", group, a)]) || compare(a, b));
  }
  if (group === "carryover" || group === "favoriteIcons") return sorted.map(([path]) => JSON.parse(path)[0]);
  if (group === "payments" || group === "customCategories" || group === "categoryOverrides") {
    const records = new Map<string, Record<string, unknown>>();
    for (const [path, value] of sorted) {
      const [id, field, month] = JSON.parse(path) as string[];
      if (entries.get(entryPath(id, "$exists")) !== true) continue;
      if (field === "$exists") { if (!records.has(id)) records.set(id, {}); continue; }
      const item = records.get(id) ?? {};
      if (group === "payments" && field === "pagados") item.pagados = [...((item.pagados as string[] | undefined) ?? []), month];
      else if (group === "payments" && field === "movimientos") item.movimientos = { ...((item.movimientos as Record<string, unknown> | undefined) ?? {}), [month]: value };
      else Object.defineProperty(item, field, { value, writable: true, enumerable: true, configurable: true });
      records.set(id, item);
    }
    if (group === "categoryOverrides") return Object.fromEntries(records);
    return [...records].map(([id, item]) => group === "payments" ? { ...item, id, pagados: item.pagados ?? [] } : { ...item, id });
  }
  const fields = Object.fromEntries(sorted.map(([path, value]) => [JSON.parse(path)[0], value]));
  return group === "profile" ? { userName: "", userPhoto: null, userCurrency: "PEN", userLanguage: "es", ...fields } : fields;
}

/** Registra cambios concretos. La ausencia sin una marca NO significa borrar. */
export function recordCloudGroupChange(
  metadata: Record<string, number>, group: CloudSyncGroup, before: unknown, after: unknown, now = Date.now(),
): Record<string, number> {
  const earlier = entriesFor(group, before);
  const later = entriesFor(group, after);
  const timestamp = Object.values(metadata).reduce((latest, value) => Math.max(latest, clock(value)), clock(now)) + 1;
  if (!Number.isSafeInteger(timestamp)) throw new Error("sync-clock-overflow");
  const next = { ...metadata, [group]: timestamp };
  for (const path of new Set([...earlier.keys(), ...later.keys()])) {
    // Una edición no rejuvenece los campos antiguos que no se tocaron.
    // Esto importa antes de la primera unión de una copia del formato viejo.
    const writeKey = stampKey("write", group, path);
    if (earlier.has(path) && !(writeKey in next)) next[writeKey] = clock(metadata[group]);
    if (later.has(path) && (!earlier.has(path) || stable(earlier.get(path)) !== stable(later.get(path)))) next[writeKey] = timestamp;
    if (earlier.has(path) && !later.has(path)) next[stampKey("delete", group, path)] = timestamp;
  }
  return next;
}

function pathsFromMetadata(metadata: Record<string, number>, group: CloudSyncGroup): string[] {
  const prefixes = [`write:${group}:`, `delete:${group}:`];
  return Object.keys(metadata).flatMap((key) => {
    const prefix = prefixes.find((p) => key.startsWith(p));
    if (!prefix) return [];
    try {
      const path = decodeURIComponent(key.slice(prefix.length));
      const parts = JSON.parse(path);
      return Array.isArray(parts) && parts.length > 0 && parts.length <= 3 && parts.every((part) => typeof part === "string") ? [path] : [];
    } catch { return []; }
  });
}

/** Dos cuentas configuradas no pueden reinterpretar sus importes al unirse. */
export function assertMatchingAccountCurrencies(
  local: Pick<CloudData, "hasOnboarded" | "userCurrency">,
  remote: Pick<CloudData, "hasOnboarded" | "userCurrency">,
): void {
  if (local.hasOnboarded && remote.hasOnboarded &&
    (local.userCurrency || "PEN") !== (remote.userCurrency || "PEN")) {
    throw new Error("account-currency-conflict");
  }
}

/** Unir por campo conserva registros independientes y respeta borrados explícitos. */
export function mergeCloudFields(local: CloudData, remote: CloudData): CloudData {
  assertMatchingAccountCurrencies(local, remote);
  const localTimes = local.syncUpdatedAt ?? {};
  const remoteTimes = remote.syncUpdatedAt ?? {};
  const times: Record<string, number> = {};
  for (const key of new Set([...Object.keys(localTimes), ...Object.keys(remoteTimes)])) times[key] = Math.max(clock(localTimes[key]), clock(remoteTimes[key]));
  let merged: CloudData = { ...local, syncFormat: 2 };
  for (const group of groups) {
    const a = entriesFor(group, cloudGroupValue(local, group));
    const b = entriesFor(group, cloudGroupValue(remote, group));
    const result: Entries = new Map();
    const universe = new Set([...a.keys(), ...b.keys(), ...pathsFromMetadata(localTimes, group), ...pathsFromMetadata(remoteTimes, group)]);
    for (const path of universe) {
      const writeKey = stampKey("write", group, path);
      const deleteKey = stampKey("delete", group, path);
      const deletedAt = deleteKey in localTimes || deleteKey in remoteTimes ? Math.max(clock(localTimes[deleteKey]), clock(remoteTimes[deleteKey])) : -1;
      // Un bloque del formato antiguo no demuestra que este elemento se
      // haya vuelto a crear. Frente a un borrado explícito hace falta una
      // escritura propia posterior, no la fecha de editar otro elemento.
      const aTime = writeKey in localTimes ? clock(localTimes[writeKey]) : deletedAt >= 0 ? -1 : a.has(path) ? clock(localTimes[group]) : 0;
      const bTime = writeKey in remoteTimes ? clock(remoteTimes[writeKey]) : deletedAt >= 0 ? -1 : b.has(path) ? clock(remoteTimes[group]) : 0;
      // Una foto puede omitirse para reducir el archivo. Sin una marca de
      // borrado, eso no elimina la foto que todavía existe en el teléfono.
      const availableTime = Math.max(a.has(path) ? aTime : -1, b.has(path) ? bTime : -1);
      if (availableTime > deletedAt) {
        const chooseA = a.has(path) && (!b.has(path) || aTime > bTime || (aTime === bTime && (
          writeKey in localTimes && !(writeKey in remoteTimes) ||
          ((writeKey in localTimes) === (writeKey in remoteTimes) && (local.syncFormat === 2 || remote.syncFormat === 2) && stable(a.get(path)) > stable(b.get(path)))
        )));
        result.set(path, chooseA ? a.get(path) : b.get(path));
      }
      if (a.has(path) || b.has(path) || writeKey in localTimes || writeKey in remoteTimes) times[writeKey] = Math.max(0, aTime, bTime);
      if (deletedAt >= 0) times[deleteKey] = deletedAt;
    }
    // Cero es una fecha desconocida, no una edición recién hecha. Inventar
    // Date.now() aquí haría ganar datos antiguos frente a cambios reales.
    times[group] = Math.max(clock(localTimes[group]), clock(remoteTimes[group]));
    merged = replaceCloudGroup(merged, group, valueFromEntries(group, result, times));
  }
  // Una selección previa al registro no gana a la moneda de una copia ya
  // configurada, aunque haya sido elegida más recientemente en este teléfono.
  const configured = local.hasOnboarded ? local : remote.hasOnboarded ? remote : null;
  return { ...merged, ...(configured ? { userCurrency: configured.userCurrency || "PEN", hasOnboarded: true } : {}),
    syncUpdatedAt: Object.fromEntries(Object.entries(times).sort(([a], [b]) => compare(a, b))) };
}
