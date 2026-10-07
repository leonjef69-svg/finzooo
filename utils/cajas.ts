import { canonical, validateMoneyReview, type MoneyReview } from "../functions/src/private-box-money-shared.js";
import { utf8ByteLength } from "./utf8";

export type Caja = {
  id: string;
  nombre: string;
  creadaEn: number;
  updatedAt?: number;
  /** Solo local: impide usar la copia privada mientras compartir es incierto. */
  sharingPending?: boolean;
  /** Solo local: distingue un reintento de una conversión nueva. */
  sharingAttempt?: string;
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

export type ConversionCaja = {
  uid: string; sourceId: string; targetId: string; name: string; currency: string;
  createdAt: number; digest: string; completedAt: number;
  links: { personalId: number; movementId: string }[];
};

/** Copias de nombres solo locales, cifradas dentro de Cajas; nunca se suben. */
export type RevisionNombreCaja = {
  id: string; uid: string; boxId: string; local: Caja; remoto: Caja; elegido: Caja;
  creadoEn: number; estado: "pendiente" | "confirmado";
};

/** Cuatro originales y elección solo locales; no se suben como respaldo. */
export type RevisionImporteCaja = MoneyReview & {
  estado: "pendiente" | "confirmado" | "sustituido";
  /** Enlaces solo locales: conserva la elección anterior y su sucesora. */
  reemplaza?: string;
  reemplazadaPor?: string;
};

export type DatosCajas = {
  cajas: Caja[];
  movimientos: MovimientoCaja[];
  cajasBorradas: string[];
  movimientosBorrados: string[];
  syncFormat?: 1 | 2 | 3;
  /** Confirmaciones escritas solo por el servidor, no una segunda copia del dinero. */
  conversiones?: Record<string, ConversionCaja>;
  revisionesNombre?: RevisionNombreCaja[];
  revisionesImporte?: RevisionImporteCaja[];
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
    ...(value?.syncFormat === 2 || value?.syncFormat === 3 ? { syncFormat: value.syncFormat } : {}),
    ...(value?.conversiones ? { conversiones: value.conversiones } : {}),
    ...(value?.revisionesNombre ? { revisionesNombre: value.revisionesNombre } : {}),
    ...(value?.revisionesImporte ? { revisionesImporte: value.revisionesImporte } : {}),
  };
}

/** No convertir un documento incompleto/dañado en prueba de una Caja vacía. */
export function validarCajas(value: unknown): DatosCajas {
  const invalid = () => { throw new Error("cajas-invalid-data"); };
  if (!value || typeof value !== "object") return invalid();
  const data = value as Partial<DatosCajas>;
  if (!Array.isArray(data.cajas) || !Array.isArray(data.movimientos)
    || (data.syncFormat === 3 && data.conversiones === undefined)
    || (data.syncFormat !== undefined && ![1, 2, 3].includes(data.syncFormat))
    || (data.cajasBorradas !== undefined && !Array.isArray(data.cajasBorradas))
    || (data.movimientosBorrados !== undefined && !Array.isArray(data.movimientosBorrados))) return invalid();
  const time = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const id = (n: unknown) => typeof n === "string" && n.length > 0;
  const ids = new Set<string>(), movementIds = new Set<string>();
  for (const box of data.cajas) {
    if (!box || !id(box.id) || ids.has(box.id) || typeof box.nombre !== "string"
      || !time(box.creadaEn) || (box.updatedAt !== undefined && !time(box.updatedAt))
      || (box.sharingPending !== undefined && typeof box.sharingPending !== "boolean")
      || (box.sharingAttempt !== undefined && (typeof box.sharingAttempt !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(box.sharingAttempt)))) return invalid();
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
  if (data.conversiones !== undefined) {
    if (!data.conversiones || typeof data.conversiones !== "object" || Array.isArray(data.conversiones) || data.syncFormat !== 3) return invalid();
    for (const [key, value] of Object.entries(data.conversiones)) {
      if (!value || key !== value.sourceId || !id(value.uid) || value.targetId !== `${value.uid}_${key}`
        || typeof value.name !== "string" || !/^[A-Z]{3}$/.test(value.currency)
        || !/^[a-f0-9]{64}$/.test(value.digest) || !time(value.createdAt) || !time(value.completedAt)
        || !Array.isArray(value.links) || value.links.some(link => !link || !Number.isSafeInteger(link.personalId) || link.personalId <= 0 || !id(link.movementId))) return invalid();
    }
  }
  if (data.revisionesNombre !== undefined) {
    if (!Array.isArray(data.revisionesNombre) || data.revisionesNombre.length > 50) return invalid();
    const revisions = new Set<string>();
    for (const entry of data.revisionesNombre) {
      if (!revisionNombreValida(entry) || revisions.has(entry.id)) return invalid();
      revisions.add(entry.id);
    }
  }
  if (data.revisionesImporte !== undefined) {
    if (!Array.isArray(data.revisionesImporte) || data.revisionesImporte.length > 50) return invalid();
    const revisions = new Set<string>(), pending = new Set<number>();
    let owner: string | undefined;
    for (const entry of data.revisionesImporte) {
      try { validarRevisionImporte(entry); } catch { return invalid(); }
      if (revisions.has(entry.id) || (owner !== undefined && owner !== entry.uid)
        || (entry.estado === "pendiente" && pending.has(entry.local.personal.id))) return invalid();
      revisions.add(entry.id);
      owner = entry.uid;
      if (entry.estado === "pendiente") pending.add(entry.local.personal.id);
    }
    const byId = new Map(data.revisionesImporte.map(entry => [entry.id, entry]));
    for (const entry of data.revisionesImporte) {
      if (entry.reemplaza) {
        const prior = byId.get(entry.reemplaza);
        if (!prior || prior.estado !== "sustituido" || prior.reemplazadaPor !== entry.id
          || !mismaParejaImporte(prior, entry) || prior.version >= entry.version) return invalid();
      }
      if (entry.reemplazadaPor) {
        const next = byId.get(entry.reemplazadaPor);
        if (!next || next.reemplaza !== entry.id || !mismaParejaImporte(entry, next) || next.version <= entry.version) return invalid();
      }
    }
    if (bytesRevisionesImporte(data.revisionesImporte) > 400_000) return invalid();
  }
  return normalizarCajas(data);
}

export function validarRevisionImporte(entry: RevisionImporteCaja): void {
  if (!entry || !["pendiente", "confirmado", "sustituido"].includes(entry.estado)) throw new Error("cajas-invalid-data");
  const reference = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{16,160}$/.test(id) && id !== entry.id;
  if ((entry.reemplaza !== undefined && !reference(entry.reemplaza))
    || (entry.estado === "sustituido" ? !reference(entry.reemplazadaPor) : entry.reemplazadaPor !== undefined)) throw new Error("cajas-invalid-data");
  validateMoneyReview(entry);
  canonical(entry);
  // Reserva también el byte adicional de "confirmado": un archivo al límite
  // debe poder confirmar sin borrar otra revisión para hacer espacio.
  if (utf8ByteLength(JSON.stringify({ ...entry, estado: "confirmado" })) > 150_000) throw new Error("cajas-money-history-full");
}

function bytesRevisionesImporte(entries: RevisionImporteCaja[]): number {
  return utf8ByteLength(JSON.stringify(entries.map(entry => ({ ...entry, estado: "confirmado" }))));
}

/** No elimina una versión anterior ni reemplaza otra elección con el mismo ID. */
export function conservarRevisionImporte(data: DatosCajas, entry: RevisionImporteCaja): DatosCajas {
  validarRevisionImporte(entry);
  const old = data.revisionesImporte?.find(value => value.id === entry.id);
  // Retirar una elección exige guardar su sucesora en el mismo lote, nunca
  // esta función de una sola revisión ni una confirmación de la elección vieja.
  if (entry.estado === "sustituido" || old?.estado === "sustituido" || (!old && entry.reemplaza)) throw new Error("cajas-money-changed");
  if (old && canonical({ ...old, estado: entry.estado }) !== canonical(entry)) throw new Error("cajas-money-changed");
  if (old?.estado === "confirmado" && entry.estado === "pendiente") return data;
  if (old && old.estado === entry.estado) return data;
  if (!old && entry.estado === "pendiente" && data.revisionesImporte?.some(value => value.estado === "pendiente"
    && value.local.personal.id === entry.local.personal.id)) throw new Error("cajas-money-pending");
  if (!old && (data.revisionesImporte?.length ?? 0) >= 50) throw new Error("cajas-money-history-full");
  // Clona después de validar: NaN/Infinity no se convierten en null y las
  // referencias del formulario no pueden modificar los originales retenidos.
  const retained = [...(data.revisionesImporte || []).filter(value => value.id !== entry.id), JSON.parse(JSON.stringify(entry))];
  if (bytesRevisionesImporte(retained) > 400_000) throw new Error("cajas-money-history-full");
  return { ...data, revisionesImporte: retained };
}

function mismaParejaImporte(a: RevisionImporteCaja, b: RevisionImporteCaja): boolean {
  return a.uid === b.uid && a.currency === b.currency && a.box.id === b.box.id
    && a.local.personal.id === b.local.personal.id && a.local.movement.id === b.local.movement.id;
}

/** Retira únicamente el intento anterior, sin borrar sus cuatro originales. */
export function sustituirRevisionImporte(data: DatosCajas, entry: RevisionImporteCaja): DatosCajas {
  validarCajas(data); validarRevisionImporte(entry);
  const old = data.revisionesImporte?.find(value => value.id === entry.reemplaza);
  if (!old || old.estado !== "pendiente" || entry.estado !== "pendiente" || !mismaParejaImporte(old, entry)
    || old.version >= entry.version || data.revisionesImporte?.some(value => value.id === entry.id)) throw new Error("cajas-money-changed");
  if ((data.revisionesImporte?.length ?? 0) >= 50) throw new Error("cajas-money-history-full");
  const previous: RevisionImporteCaja = { ...old, estado: "sustituido", reemplazadaPor: entry.id };
  validarRevisionImporte(previous);
  const retained = [...data.revisionesImporte!.map(value => value.id === old.id ? previous : value), entry];
  if (bytesRevisionesImporte(retained) > 400_000) throw new Error("cajas-money-history-full");
  return validarCajas({ ...data, revisionesImporte: JSON.parse(JSON.stringify(retained)) });
}

/** La copia atrasada no reactiva un intento; dos sucesoras diferentes no se eligen a ciegas. */
function unirRevisionesImporte(a: RevisionImporteCaja[], b: RevisionImporteCaja[]): RevisionImporteCaja[] {
  const result = new Map<string, RevisionImporteCaja>();
  for (const entry of [...a, ...b]) {
    validarRevisionImporte(entry);
    const old = result.get(entry.id);
    if (old) {
      const original = (value: RevisionImporteCaja) => canonical({ ...value, estado: undefined, reemplazadaPor: undefined });
      if (original(old) !== original(entry)) throw new Error("cajas-money-changed");
      if (old.estado !== "pendiente" && entry.estado !== "pendiente" && canonical(old) !== canonical(entry)) throw new Error("cajas-money-changed");
      if (old.estado !== "pendiente") continue;
    }
    result.set(entry.id, entry);
  }
  return [...result.values()];
}

const nombreBase = (box: Caja) => JSON.stringify(Object.fromEntries(Object.entries(box)
  .filter(([key, value]) => !["nombre", "updatedAt"].includes(key) && value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
export const cajaNombreCoincide = (a: Caja, b: Caja): boolean => a.nombre === b.nombre
  && (a.updatedAt ?? a.creadaEn) === (b.updatedAt ?? b.creadaEn) && nombreBase(a) === nombreBase(b);

/** Solo un desacuerdo de nombre, no datos de creación/conversión ni dinero. */
export function diferenciasNombreCajas(local: DatosCajas, remoto: DatosCajas): { local: Caja; remoto: Caja }[] {
  const remote = new Map(remoto.cajas.map(box => [box.id, box]));
  const deleted = new Set([...local.cajasBorradas, ...remoto.cajasBorradas]);
  return local.cajas.flatMap(box => {
    const other = remote.get(box.id);
    if (!other || deleted.has(box.id) || local.conversiones?.[box.id] || remoto.conversiones?.[box.id]
      || box.sharingPending || other.sharingPending || box.sharingAttempt || other.sharingAttempt
      || box.nombre === other.nombre || !box.nombre.trim() || !other.nombre.trim() || box.nombre.length > 30 || other.nombre.length > 30
      || (box.updatedAt ?? box.creadaEn) !== (other.updatedAt ?? other.creadaEn) || nombreBase(box) !== nombreBase(other)) return [];
    return [{ local: box, remoto: other }];
  });
}

function revisionNombreValida(entry: RevisionNombreCaja): boolean {
  const box = (value: Caja) => !!value && typeof value.id === "string" && value.id.length > 0 && typeof value.nombre === "string"
    && value.nombre.trim().length > 0 && value.nombre.length <= 30 && Number.isSafeInteger(value.creadaEn) && value.creadaEn >= 0
    && (value.updatedAt === undefined || (Number.isSafeInteger(value.updatedAt) && value.updatedAt >= 0))
    && !value.sharingPending && !value.sharingAttempt;
  return !!entry && typeof entry.id === "string" && entry.id.length > 0 && typeof entry.uid === "string" && entry.uid.length > 0
    && ["pendiente", "confirmado"].includes(entry.estado) && Number.isSafeInteger(entry.creadoEn) && entry.creadoEn >= 0
    && box(entry.local) && box(entry.remoto) && box(entry.elegido) && entry.boxId === entry.local.id && entry.boxId === entry.remoto.id && entry.boxId === entry.elegido.id
    && entry.local.nombre !== entry.remoto.nombre && nombreBase(entry.local) === nombreBase(entry.remoto) && nombreBase(entry.local) === nombreBase(entry.elegido)
    && [entry.local.nombre, entry.remoto.nombre].includes(entry.elegido.nombre)
    && (entry.local.updatedAt ?? entry.local.creadaEn) === (entry.remoto.updatedAt ?? entry.remoto.creadaEn)
    && (entry.elegido.updatedAt ?? 0) > (entry.local.updatedAt ?? entry.local.creadaEn);
}

export function prepararRevisionNombre(local: DatosCajas, remoto: DatosCajas, uid: string, id: string, boxId: string, usar: "local" | "nube", now = Date.now()): RevisionNombreCaja {
  const pair = diferenciasNombreCajas(local, remoto).find(item => item.local.id === boxId);
  if (!pair || !["local", "nube"].includes(usar)) throw new Error("cajas-name-changed");
  const copy = (box: Caja): Caja => JSON.parse(JSON.stringify(box));
  const entry: RevisionNombreCaja = { id, uid, boxId, local: copy(pair.local), remoto: copy(pair.remoto),
    elegido: { ...copy(usar === "local" ? pair.local : pair.remoto), updatedAt: siguienteVersionCaja(pair.local, now) }, creadoEn: now, estado: "pendiente" };
  if (!revisionNombreValida(entry)) throw new Error("cajas-invalid-data");
  return entry;
}

export function conservarRevisionNombre(data: DatosCajas, entry: RevisionNombreCaja): DatosCajas {
  if (!revisionNombreValida(entry)) throw new Error("cajas-invalid-data");
  const old = data.revisionesNombre?.find(value => value.id === entry.id);
  if (old && JSON.stringify({ ...old, estado: entry.estado }) !== JSON.stringify(entry)) throw new Error("cajas-name-changed");
  if (old?.estado === "confirmado" && entry.estado === "pendiente") return data;
  if (!old && (data.revisionesNombre?.length ?? 0) >= 50) throw new Error("cajas-name-history-full");
  return { ...data, revisionesNombre: [...(data.revisionesNombre || []).filter(value => value.id !== entry.id), entry] };
}

export function confirmarRevisionNombreLocal(data: DatosCajas, entry: RevisionNombreCaja, uid: string): DatosCajas {
  const current = data.cajas.find(box => box.id === entry.boxId);
  if (entry.uid !== uid || !current || data.cajasBorradas.includes(entry.boxId) || data.conversiones?.[entry.boxId]
    || (!cajaNombreCoincide(current, entry.local) && !cajaNombreCoincide(current, entry.elegido))) throw new Error("cajas-name-changed");
  return conservarRevisionNombre({ ...data, cajas: data.cajas.map(box => box.id === entry.boxId ? { ...box, nombre: entry.elegido.nombre, updatedAt: entry.elegido.updatedAt } : box) }, { ...entry, estado: "confirmado" });
}

type VersionedItem = { id: string; updatedAt?: number; creadaEn?: number; creadoEn?: number };
export function siguienteVersionCaja(item: VersionedItem, now = Date.now()): number {
  return Math.max(now, (item.updatedAt ?? item.creadaEn ?? item.creadoEn ?? 0) + 1);
}

function firma(item: VersionedItem): string {
  // Los registros son planos. El orden de propiedades/undefined no es edición.
  return JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key, value]) => key !== "updatedAt" && key !== "sharingPending" && key !== "sharingAttempt" && value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
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
  const entries = unirRevisionesImporte(remoto.revisionesImporte || [], local.revisionesImporte || []);
  const money = entries.length ? validarCajas({ ...CAJAS_VACIAS, revisionesImporte: entries }) : CAJAS_VACIAS;
  // La fusión ordinaria no decide el importe de una revisión pendiente.
  // La integración deberá confirmar las dos mitades mediante su guardado propio.
  for (const entry of money.revisionesImporte || []) {
    if (entry.estado !== "pendiente") continue;
    if (local.cajasBorradas.includes(entry.box.id) || remoto.cajasBorradas.includes(entry.box.id)
      || local.movimientosBorrados.includes(entry.local.movement.id) || remoto.movimientosBorrados.includes(entry.local.movement.id)
      || local.conversiones?.[entry.box.id] || remoto.conversiones?.[entry.box.id]) throw new Error("cajas-sync-conflict");
    const a = local.movimientos.find(row => row.id === entry.local.movement.id);
    const b = remoto.movimientos.find(row => row.id === entry.local.movement.id);
    if (a && b && canonical(a) !== canonical(b)) throw new Error("cajas-sync-conflict");
  }
  const signature = (value: ConversionCaja) => JSON.stringify([value.uid, value.sourceId, value.targetId, value.name,
    value.currency, value.createdAt, value.digest, value.completedAt,
    [...value.links].sort((a, b) => a.personalId - b.personalId).map(link => [link.personalId, link.movementId])]);
  const conversiones = { ...remoto.conversiones, ...local.conversiones };
  for (const [id, conversion] of Object.entries(conversiones)) {
    // Una copia atrasada puede contener ediciones sin subir. No borrarlas por
    // inferencia: solo el reintento con la huella exacta puede retirarlas.
    if (local.cajas.some(box => box.id === id) || remoto.cajas.some(box => box.id === id)
      || local.movimientos.some(row => row.cajaId === id) || remoto.movimientos.some(row => row.cajaId === id)
      || (local.conversiones?.[id] && remoto.conversiones?.[id]
        && signature(local.conversiones[id]) !== signature(remoto.conversiones[id]))) throw new Error("cajas-sync-conflict");
    if (conversion.sourceId !== id) throw new Error("cajas-invalid-data");
  }
  const cajasBorradas = [...new Set([...local.cajasBorradas, ...remoto.cajasBorradas])];
  const movimientosBorrados = [...new Set([...local.movimientosBorrados, ...remoto.movimientosBorrados])];
  const cajasFuera = new Set(cajasBorradas);
  const movimientosFuera = new Set(movimientosBorrados);
  const pending = new Set([...local.cajas, ...remoto.cajas].filter(box => box.sharingPending).map(box => box.id));
  const attempts = new Map<string, string>();
  for (const box of [...local.cajas, ...remoto.cajas].filter(box => box.sharingPending && box.sharingAttempt)) {
    if (attempts.has(box.id) && attempts.get(box.id) !== box.sharingAttempt) throw new Error("cajas-sync-conflict");
    attempts.set(box.id, box.sharingAttempt!);
  }
  const cajas = unirPorId(local.cajas.filter(item => !cajasFuera.has(item.id)), remoto.cajas.filter(item => !cajasFuera.has(item.id)))
    .map(box => pending.has(box.id) ? { ...box, sharingPending: true, ...(attempts.has(box.id) ? { sharingAttempt: attempts.get(box.id)! } : {}) } : box);
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
  let retained = { ...CAJAS_VACIAS };
  for (const entry of [...(remoto.revisionesNombre || []), ...(local.revisionesNombre || [])]) {
    const prior = retained.revisionesNombre?.find(value => value.id === entry.id);
    retained = conservarRevisionNombre(retained, prior?.estado === "confirmado" ? { ...entry, estado: "confirmado" } : entry);
  }
  return { cajas, movimientos, cajasBorradas, movimientosBorrados,
    ...(money.revisionesImporte ? { revisionesImporte: money.revisionesImporte } : {}),
    ...(retained.revisionesNombre ? { revisionesNombre: retained.revisionesNombre } : {}),
    ...(local.syncFormat === 3 || remoto.syncFormat === 3 || Object.keys(conversiones).length
      ? { syncFormat: 3 as const, conversiones } : { syncFormat: 2 as const }) };
}

export function saldoCaja(cajaId: string, movimientos: MovimientoCaja[]): number {
  return movimientos.reduce((total, item) => {
    if (item.cajaId !== cajaId) return total;
    return total + (item.tipo === "ingreso" ? item.monto : -item.monto);
  }, 0);
}
