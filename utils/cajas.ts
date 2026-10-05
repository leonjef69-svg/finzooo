export type Caja = {
  id: string;
  nombre: string;
  creadaEn: number;
  updatedAt?: number;
};

export type MovimientoCaja = {
  id: string;
  cajaId: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  descripcion: string;
  category?: string;
  notes?: string;
  method?: string;
  fecha: string;
  creadoEn: number;
  updatedAt?: number;
  /** Débito de Personal que financió este ingreso, si corresponde. */
  personalTransactionId?: number;
  /** Parte de este gasto que volvió a Personal. */
  personalReturnAmount?: number;
};

export type DatosCajas = {
  cajas: Caja[];
  movimientos: MovimientoCaja[];
  cajasBorradas: string[];
  movimientosBorrados: string[];
  syncFormat?: 1 | 2;
};

export const CAJAS_VACIAS: DatosCajas = {
  cajas: [],
  movimientos: [],
  cajasBorradas: [],
  movimientosBorrados: [],
};

export function nuevoIdCaja(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizarCajas(value: Partial<DatosCajas> | null | undefined): DatosCajas {
  return {
    cajas: Array.isArray(value?.cajas) ? value.cajas : [],
    movimientos: Array.isArray(value?.movimientos) ? value.movimientos : [],
    cajasBorradas: Array.isArray(value?.cajasBorradas) ? value.cajasBorradas : [],
    movimientosBorrados: Array.isArray(value?.movimientosBorrados) ? value.movimientosBorrados : [],
    ...(value?.syncFormat === 2 ? { syncFormat: 2 as const } : {}),
  };
}

/** No convertir un documento incompleto/dañado en prueba de una Caja vacía. */
export function validarCajas(value: unknown): DatosCajas {
  const invalid = () => { throw new Error("cajas-invalid-data"); };
  if (!value || typeof value !== "object") return invalid();
  const data = value as Partial<DatosCajas>;
  if (!Array.isArray(data.cajas) || !Array.isArray(data.movimientos)
    || (data.syncFormat !== undefined && data.syncFormat !== 1 && data.syncFormat !== 2)
    || (data.cajasBorradas !== undefined && !Array.isArray(data.cajasBorradas))
    || (data.movimientosBorrados !== undefined && !Array.isArray(data.movimientosBorrados))) return invalid();
  const time = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const id = (n: unknown) => typeof n === "string" && n.length > 0;
  const ids = new Set<string>(), movementIds = new Set<string>();
  for (const box of data.cajas) {
    if (!box || !id(box.id) || ids.has(box.id) || typeof box.nombre !== "string"
      || !time(box.creadaEn) || (box.updatedAt !== undefined && !time(box.updatedAt))) return invalid();
    ids.add(box.id);
  }
  for (const row of data.movimientos) {
    if (!row || !id(row.id) || movementIds.has(row.id) || !id(row.cajaId)
      || (row.tipo !== "ingreso" && row.tipo !== "gasto") || !Number.isFinite(row.monto) || row.monto <= 0
      || !Number.isSafeInteger(Math.round(row.monto * 1000))
      || typeof row.descripcion !== "string" || typeof row.fecha !== "string" || !time(row.creadoEn)
      || (row.updatedAt !== undefined && !time(row.updatedAt))
      || (row.personalTransactionId !== undefined && (!Number.isSafeInteger(row.personalTransactionId) || row.personalTransactionId <= 0))
      || (!ids.has(row.cajaId) && !(data.cajasBorradas || []).includes(row.cajaId))
      || (row.personalReturnAmount !== undefined && (row.tipo !== "gasto" || !Number.isFinite(row.personalReturnAmount)
        || row.personalReturnAmount <= 0 || row.personalReturnAmount > row.monto))) return invalid();
    movementIds.add(row.id);
  }
  if ([...(data.cajasBorradas || []), ...(data.movimientosBorrados || [])].some(value => !id(value))) return invalid();
  return normalizarCajas(data);
}

type VersionedItem = { id: string; updatedAt?: number; creadaEn?: number; creadoEn?: number };
export function siguienteVersionCaja(item: VersionedItem, now = Date.now()): number {
  return Math.max(now, (item.updatedAt ?? item.creadaEn ?? item.creadoEn ?? 0) + 1);
}

function firma(item: VersionedItem): string {
  // Los registros son planos. El orden de propiedades/undefined no es edición.
  return JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key, value]) => key !== "updatedAt" && value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
}

/** No convertir una vista vieja dejando atrás movimientos/ediciones en nube. */
export function copiaPrivadaCoincide(caja: Caja, movimientos: MovimientoCaja[], fuente: DatosCajas): boolean {
  const actual = fuente.cajas.find(item => item.id === caja.id);
  if (!actual || firma(actual) !== firma(caja)) return false;
  const rows = fuente.movimientos.filter(item => item.cajaId === caja.id);
  if (rows.length !== movimientos.length) return false;
  const byId = new Map(rows.map(item => [item.id, item]));
  return movimientos.every(item => !!byId.get(item.id) && firma(byId.get(item.id)!) === firma(item));
}

function unirPorId<T extends VersionedItem>(a: T[], b: T[]): T[] {
  const resultado = new Map<string, T>();
  for (const item of [...b, ...a]) {
    const previous = resultado.get(item.id);
    if (!previous) { resultado.set(item.id, item); continue; }
    const version = item.updatedAt ?? item.creadaEn ?? item.creadoEn ?? 0;
    const previousVersion = previous.updatedAt ?? previous.creadaEn ?? previous.creadoEn ?? 0;
    if (version > previousVersion) resultado.set(item.id, item);
    else if (version === previousVersion && firma(item) !== firma(previous)) throw new Error("cajas-sync-conflict");
  }
  return [...resultado.values()];
}

export function fusionarCajas(local: DatosCajas, remoto: DatosCajas): DatosCajas {
  const cajasBorradas = [...new Set([...local.cajasBorradas, ...remoto.cajasBorradas])];
  const movimientosBorrados = [...new Set([...local.movimientosBorrados, ...remoto.movimientosBorrados])];
  const cajasFuera = new Set(cajasBorradas);
  const movimientosFuera = new Set(movimientosBorrados);
  const cajas = unirPorId(local.cajas.filter(item => !cajasFuera.has(item.id)), remoto.cajas.filter(item => !cajasFuera.has(item.id)));
  const idsCajas = new Set(cajas.map((item) => item.id));
  const presentes = (item: MovimientoCaja) => !movimientosFuera.has(item.id) && idsCajas.has(item.cajaId);
  const movimientos = unirPorId(local.movimientos.filter(presentes), remoto.movimientos.filter(presentes));
  // Dos teléfonos pueden gastar el mismo saldo con IDs distintos. No confirmar
  // esa unión como válida ni ocultar uno de los gastos. Unidades de 1/1000
  // cubren monedas de 0, 2 y 3 decimales; BigInt evita desbordar al acumular.
  const saldos = new Map<string, bigint>();
  for (const item of movimientos) {
    const units = Math.round(item.monto * 1000);
    if (!Number.isSafeInteger(units)) throw new Error("cajas-invalid-data");
    saldos.set(item.cajaId, (saldos.get(item.cajaId) ?? 0n) + BigInt(units) * (item.tipo === "ingreso" ? 1n : -1n));
  }
  if ([...saldos.values()].some(saldo => saldo < 0n)) throw new Error("cajas-sync-conflict");
  return { cajas, movimientos, cajasBorradas, movimientosBorrados, syncFormat: 2 };
}

export function saldoCaja(cajaId: string, movimientos: MovimientoCaja[]): number {
  return movimientos.reduce((total, item) => {
    if (item.cajaId !== cajaId) return total;
    return total + (item.tipo === "ingreso" ? item.monto : -item.monto);
  }, 0);
}
