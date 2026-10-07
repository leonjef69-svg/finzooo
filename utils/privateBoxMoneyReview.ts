import type { Transaction } from "@/types";
import { conservarRevisionImporte, sustituirRevisionImporte, validarCajas, validarRevisionImporte, type DatosCajas, type RevisionImporteCaja } from "@/utils/cajas";
import { canonical, moneyAcknowledgement, moneyResult, type MoneyAck, type MoneyReview, type MoneySource } from "../functions/src/private-box-money-shared.js";
import { units } from "../functions/src/money-units.js";

/** Construye solo una pareja enlazada por IDs; no busca similitud de dinero. */
export function prepararRevisionImporte(local: DatosCajas, rows: Transaction[], deleted: number[],
  remote: DatosCajas, remoteRows: Transaction[], remoteDeleted: number[], uid: string, currency: string,
  id: string, movementId: string, chosen: MoneySource, now = Date.now(), reemplaza?: string): RevisionImporteCaja {
  validarCajas(local); validarCajas(remote);
  const one = <T,>(items: T[], match: (item: T) => boolean): T => {
    const selected = items.filter(match);
    if (selected.length !== 1) throw new Error("cajas-money-changed");
    return selected[0];
  };
  const movement = one(local.movimientos, row => row.id === movementId);
  const other = one(remote.movimientos, row => row.id === movementId);
  const box = one(local.cajas, box => box.id === movement.cajaId);
  const cloudBox = one(remote.cajas, row => row.id === box.id);
  if (canonical(box) !== canonical(cloudBox)) throw new Error("cajas-money-changed");
  const personal = one(rows, row => row.id === movement.personalTransactionId);
  const cloudPersonal = one(remoteRows, row => row.id === personal.id);
  const prior = reemplaza ? local.revisionesImporte?.find(value => value.id === reemplaza) : undefined;
  if (reemplaza && (!prior || prior.estado !== "pendiente" || prior.uid !== uid || prior.currency !== currency
    || prior.box.id !== box.id || prior.local.personal.id !== personal.id || prior.local.movement.id !== movementId)) throw new Error("cajas-money-changed");
  const version = Math.max(now, (personal.updatedAt ?? 0) + 1, (cloudPersonal.updatedAt ?? 0) + 1,
    (movement.updatedAt ?? movement.creadoEn) + 1, (other.updatedAt ?? other.creadoEn) + 1, (prior?.version ?? 0) + 1);
  const entry: RevisionImporteCaja = { id, uid, currency, box, local: { personal, movement },
    remote: { personal: cloudPersonal, movement: other }, chosen, createdAt: now, version, estado: "pendiente", ...(reemplaza ? { reemplaza } : {}) };
  validarRevisionImporte(entry);
  assertSources(local, rows, deleted, entry, "original");
  assertSources(remote, remoteRows, remoteDeleted, { ...entry, local: entry.remote }, "original");
  if (local.revisionesImporte?.some(value => value.estado === "pendiente" && value.local.personal.id === personal.id && value.id !== reemplaza)) throw new Error("cajas-money-pending");
  // Valida primero; no transforma valores no finitos ni comparte referencias.
  return JSON.parse(JSON.stringify(entry));
}

function assertSources(data: DatosCajas, rows: Transaction[], deleted: number[], entry: MoneyReview, mode: "original" | "confirmed" | "retire"): void {
  const result = moneyResult(entry), movementId = entry.local.movement.id, personalId = entry.local.personal.id;
  const box = data.cajas.filter(box => box.id === entry.box.id);
  const moves = data.movimientos.filter(row => row.id === movementId);
  const personal = rows.filter(row => row.id === personalId);
  if (box.length !== 1 || canonical(box[0]) !== canonical(entry.box) || moves.length !== 1 || personal.length !== 1
    || deleted.includes(personalId) || data.movimientosBorrados.includes(movementId) || data.cajasBorradas.includes(entry.box.id)
    || data.conversiones?.[entry.box.id] || data.movimientos.filter(row => row.personalTransactionId === personalId).length !== 1
    || rows.filter(row => row.internalTransferLink === movementId).length !== 1
    || data.movimientos.some(row => row.cajaId === entry.box.id && (row.personalReturnAmount !== undefined || data.movimientosBorrados.includes(row.id)))) throw new Error("cajas-money-changed");
  const allowed = mode === "original" || mode === "retire" ? [entry.local] : [entry.local, entry.remote, result];
  if (!allowed.some(pair => canonical(pair.personal) === canonical(personal[0]))
    || !allowed.some(pair => canonical(pair.movement) === canonical(moves[0]))) throw new Error("cajas-money-changed");
  let balance = 0n;
  for (const row of data.movimientos.filter(row => row.cajaId === entry.box.id)) {
    const amount = units(row.id === movementId && mode !== "retire" ? result.movement.monto : row.monto, entry.currency, "cajas-money-changed");
    balance += amount * (row.tipo === "ingreso" ? 1n : -1n);
  }
  if (balance < 0n) throw new Error("cajas-money-negative-balance");
}

/** Conserva una elección sin corregir dinero. Exige todavía los originales locales. */
export function conservarOriginalesImporte(data: DatosCajas, rows: Transaction[], deleted: number[],
  entry: RevisionImporteCaja, uid: string, currency: string): DatosCajas {
  validarCajas(data); validarRevisionImporte(entry);
  if (entry.uid !== uid || entry.currency !== currency || entry.estado !== "pendiente") throw new Error("cajas-money-changed");
  assertSources(data, rows, deleted, entry, "original");
  return entry.reemplaza ? sustituirRevisionImporte(data, entry) : conservarRevisionImporte(data, entry);
}

/** SOLO un plan puro. El contexto aún debe guardar sus claves juntas en Android. */
export function confirmarRevisionImporteLocal(data: DatosCajas, rows: Transaction[], deleted: number[],
  entry: RevisionImporteCaja, ack: MoneyAck, uid: string, currency: string): { data: DatosCajas; transactions: Transaction[] } {
  validarCajas(data); validarRevisionImporte(entry);
  const retained = data.revisionesImporte?.find(value => value.id === entry.id);
  if (entry.uid !== uid || entry.currency !== currency || !retained || canonical(retained) !== canonical(entry)
    || canonical(ack) !== canonical(moneyAcknowledgement(entry))) throw new Error("cajas-money-changed");
  assertSources(data, rows, deleted, entry, "confirmed");
  const result = moneyResult(entry);
  const next = conservarRevisionImporte({ ...data,
    movimientos: data.movimientos.map(row => row.id === result.movement.id ? result.movement : row),
  }, { ...entry, estado: "confirmado" });
  return { data: next, transactions: rows.map(row => row.id === result.personal.id ? result.personal : row) };
}

/** No altera el dinero; solo cierra el pendiente si los originales locales ya coinciden. */
export function retirarRevisionImporteLocal(data: DatosCajas, rows: Transaction[], deleted: number[],
  entry: RevisionImporteCaja, uid: string, currency: string): DatosCajas {
  validarCajas(data); validarRevisionImporte(entry);
  const retained = data.revisionesImporte?.find(value => value.id === entry.id);
  if (entry.uid !== uid || entry.currency !== currency || entry.estado !== "pendiente"
    || !retained || canonical(retained) !== canonical(entry)
    || entry.local.personal.amount !== entry.local.movement.monto
    || entry.local.personal.date !== entry.local.movement.fecha) throw new Error("cajas-money-changed");
  assertSources(data, rows, deleted, entry, "retire");
  return conservarRevisionImporte(data, { ...entry, estado: "retirado" });
}
