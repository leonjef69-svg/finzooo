import type { DatosDelNegocio } from "@/utils/negocio";

export const BUSINESS_LISTS = ["negocios", "productos", "ventas", "movimientos"] as const;
export type BusinessList = typeof BUSINESS_LISTS[number];
export type BusinessDeleted = Record<BusinessList, string[]>;
export const BUSINESS_DELETED_EMPTY: BusinessDeleted = { negocios: [], productos: [], ventas: [], movimientos: [] };
type Row = { id: string; negocioId?: string; updatedAt?: number };

export function normalizeBusinessDeleted(value: unknown): BusinessDeleted {
  if (value != null && (typeof value !== "object" || Array.isArray(value))) throw new Error("negocio-datos-invalidos");
  const source = (value ?? {}) as Partial<BusinessDeleted>;
  const result = { ...BUSINESS_DELETED_EMPTY };
  for (const name of BUSINESS_LISTS) {
    const ids = source[name] === undefined ? [] : source[name];
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id.trim())) throw new Error("negocio-datos-invalidos");
    result[name] = [...new Set(ids)];
  }
  return result;
}

function normalize(data: Partial<DatosDelNegocio>): DatosDelNegocio {
  if (!data || typeof data !== "object" || ![undefined, 1, 2].includes(data.syncFormat)) throw new Error("negocio-datos-invalidos");
  const result = { ...data, syncFormat: 2, deleted: normalizeBusinessDeleted(data.deleted) } as DatosDelNegocio;
  for (const name of BUSINESS_LISTS) {
    const rows = data[name] === undefined ? [] : data[name];
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== "string" || !row.id.trim() ||
      (row.updatedAt !== undefined && (!Number.isFinite(row.updatedAt) || row.updatedAt < 0)))) throw new Error("negocio-datos-invalidos");
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("negocio-datos-invalidos");
    (result[name] as Row[]) = rows;
  }
  return result;
}

/** La marca de borrado gana a todas las copias antiguas. No se poda
 * automáticamente: olvidar una marca podría hacer reaparecer dinero. */
export function mergeBusinessData(local: Partial<DatosDelNegocio>, remote: Partial<DatosDelNegocio>): DatosDelNegocio {
  const a = normalize(local), b = normalize(remote);
  const deleted = normalizeBusinessDeleted({});
  for (const name of BUSINESS_LISTS) deleted[name] = [...new Set([...a.deleted![name], ...b.deleted![name]])];
  const result = { ...b, ...a, syncFormat: 2, deleted } as DatosDelNegocio;
  const removedBusinesses = new Set(deleted.negocios);
  for (const name of BUSINESS_LISTS) {
    const removed = new Set(deleted[name]);
    const byId = new Map<string, Row>();
    for (const row of [...a[name], ...b[name]] as Row[]) {
      if (removed.has(row.id) || (name !== "negocios" && row.negocioId && removedBusinesses.has(row.negocioId))) continue;
      const existing = byId.get(row.id);
      if (!existing || (row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) byId.set(row.id, row);
    }
    (result[name] as Row[]) = [...byId.values()];
  }
  return result;
}

/** Se aplica únicamente a acciones locales; cargar otra cuenta o recibir
 * una copia no significa que el usuario haya pedido borrar lo que falta. */
export function markBusinessChanges(previous: DatosDelNegocio, next: DatosDelNegocio, now = Date.now()): DatosDelNegocio {
  const before = normalize(previous), after = normalize(next);
  const deleted = normalizeBusinessDeleted(after.deleted);
  for (const name of BUSINESS_LISTS) {
    const ids = new Set(after[name].map(row => row.id));
    deleted[name] = [...new Set([...before.deleted![name], ...deleted[name], ...before[name].filter(row => !ids.has(row.id)).map(row => row.id)])];
    const known = new Map<string, Row>(before[name].map(row => [row.id, row]));
    (after[name] as Row[]) = after[name].map(row => {
      const old = known.get(row.id);
      const { updatedAt: _newVersion, ...newFields } = row;
      const { updatedAt: _oldVersion, ...oldFields } = old ?? {};
      if (old && JSON.stringify(newFields) === JSON.stringify(oldFields)) return row;
      return { ...row, updatedAt: Math.max(now, (old?.updatedAt ?? 0) + 1, row.updatedAt ?? 0) };
    });
  }
  return mergeBusinessData({ ...after, deleted }, {});
}
