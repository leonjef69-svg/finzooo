import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocFromServer } from "firebase/firestore";
import { auth, db, functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";
import { getAccountStorageSession, hasUnreadableLocalData, loadJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";
import { isSafeMoneyAmount } from "@/utils/amount";
import type { Transaction } from "@/types";
import type { MovimientoFamilia } from "@/utils/cloudFamilia";

type Movement = Omit<MovimientoFamilia, "id" | "creadoEn" | "creadoPor">;
type Receipt = { movementId: string; createdAt: number };
type Kind = "family" | "box";
export type SharedMovementOperation = { movementId: string; currency: string };
type Pending = SharedMovementOperation & { version: 1; uid: string; kind: Kind; spaceId: string; movement: Movement };
export type SharedMovementRecovery = Pending & Receipt;
// Compatibilidad con llamadas internas sin token explícito. Las pantallas
// nuevas asignan una intención al formulario, no a una combinación de montos.
const attempts = new Map<string, string>();
const inFlight = new Map<string, Promise<Receipt>>();
let journalQueue: Promise<unknown> = Promise.resolve();
function journal<T>(work: () => Promise<T>): Promise<T> {
  const result = journalQueue.then(work, work);
  journalQueue = result.then(() => undefined, () => undefined);
  return result;
}
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);

/** Orden estable para comprobar el contenido y repetir el comprobante exacto. */
function canonicalMovement(value: Movement): Movement {
  if (!value || !["ingreso", "gasto"].includes(value.tipo) || !isSafeMoneyAmount(value.monto) || value.monto <= 0
    || typeof value.descripcion !== "string" || value.descripcion.length > 120
    || typeof value.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.fecha)
    || !Number.isFinite(Date.parse(`${value.fecha}T00:00:00Z`))
    || new Date(`${value.fecha}T00:00:00Z`).toISOString().slice(0, 10) !== value.fecha) throw new Error("shared-pending-invalid");
  const movement: Movement = { tipo: value.tipo, monto: value.monto, descripcion: value.descripcion, fecha: value.fecha };
  for (const key of ["method", "category", "notes"] as const) {
    if (value[key] !== undefined) {
      const limit = key === "notes" ? 300 : key === "method" ? 40 : 50;
      if (typeof value[key] !== "string" || value[key].length > limit) throw new Error("shared-pending-invalid");
      movement[key] = value[key];
    }
  }
  if (value.personalTransactionId !== undefined || value.personalOwnerUid !== undefined) {
    if (value.tipo !== "ingreso" || value.method !== "transfer" || !Number.isSafeInteger(value.personalTransactionId)
      || value.personalTransactionId! <= 0 || typeof value.personalOwnerUid !== "string") throw new Error("shared-pending-invalid");
    movement.personalTransactionId = value.personalTransactionId;
    movement.personalOwnerUid = value.personalOwnerUid;
  }
  return movement;
}

export function nuevaOperacionMovimientoCompartido(kind: Kind, spaceId: string, currency: string): SharedMovementOperation {
  return { movementId: doc(collection(db, kind === "family" ? "familySpaces" : "boxSpaces", spaceId, "movements")).id, currency };
}

async function loadPending(uid: string, task: ReturnType<typeof captureAccountTask>): Promise<Pending[]> {
  const saved = await task.wait(() => loadJSON<Pending[]>(STORAGE_KEYS.sharedMovementPending, []));
  if (hasUnreadableLocalData() || !Array.isArray(saved)) throw new Error("shared-pending-invalid");
  const spaces = new Set<string>();
  const ids = new Set<string>();
  for (const value of saved) {
    if (!value || value.version !== 1 || value.uid !== uid || !["family", "box"].includes(value.kind)
      || !validId(value.spaceId) || !validId(value.movementId) || !/^[A-Z]{3}$/.test(value.currency)
      || (value.movement?.personalOwnerUid !== undefined && value.movement.personalOwnerUid !== uid)) throw new Error("shared-pending-invalid");
    canonicalMovement(value.movement);
    const key = `${value.kind}:${value.spaceId}`;
    if (spaces.has(key) || ids.has(value.movementId)) throw new Error("shared-pending-invalid");
    spaces.add(key);
    ids.add(value.movementId);
  }
  return saved;
}
async function savePending(values: Pending[], task: ReturnType<typeof captureAccountTask>): Promise<void> {
  if (!await task.wait(() => saveJSONNow(STORAGE_KEYS.sharedMovementPending, values))) throw new Error("shared-local-save-failed");
  const checked = await task.wait(() => loadJSON<Pending[] | null>(STORAGE_KEYS.sharedMovementPending, null));
  if (hasUnreadableLocalData() || JSON.stringify(checked) !== JSON.stringify(values)) throw new Error("shared-local-save-failed");
}
async function removePending(pending: Pending, task: ReturnType<typeof captureAccountTask>): Promise<void> {
  await journal(async () => {
    const saved = await loadPending(pending.uid, task);
    if (saved.some(item => item.movementId === pending.movementId)) await savePending(saved.filter(item => item.movementId !== pending.movementId), task);
  });
}

/** Retirar el intento enlazado requiere encontrar su débito confirmado. */
export async function confirmarMovimientoCompartido(movementId: string, uid: string): Promise<boolean> {
  const task = captureAccountTask(uid);
  return journal(async () => {
    const saved = await loadPending(uid, task);
    const pending = saved.find(item => item.movementId === movementId);
    if (!pending) return true;
    const personalId = pending.movement.personalTransactionId;
    // Las altas externas se retiran únicamente al recibir su comprobante en
    // sendPending; este camino confirma exclusivamente la mitad Personal.
    if (personalId == null) return false;
    if (personalId != null) {
      const rows = await task.wait(() => loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []));
      if (hasUnreadableLocalData() || !rows.some(row => row.id === personalId && row.type === "expense"
        && row.amount === pending.movement.monto && row.date === pending.movement.fecha
        && row.internalTransfer === pending.kind && row.internalTransferSpaceId === pending.spaceId
        && row.internalTransferLink === movementId)) return false;
    }
    await savePending(saved.filter(item => item.movementId !== movementId), task);
    return true;
  });
}

async function sendPending(pending: Pending, task: ReturnType<typeof captureAccountTask>): Promise<Receipt> {
  const key = `${pending.uid}:${getAccountStorageSession()}:${pending.movementId}`;
  const earlier = inFlight.get(key);
  if (earlier) return earlier;
  const promise = (async () => {
    try {
      const response = await task.wait(() => httpsCallable<unknown, Receipt>(functions, "mutateSharedMovement")({
        kind: pending.kind, spaceId: pending.spaceId, movementId: pending.movementId, action: "create", movement: pending.movement,
      }));
      if (response.data.movementId !== pending.movementId || !Number.isFinite(response.data.createdAt) || response.data.createdAt < 0) throw new Error("shared-invalid-response");
      if (pending.movement.personalTransactionId == null) await removePending(pending, task);
      return { movementId: pending.movementId, createdAt: response.data.createdAt };
    } catch (error) {
      const reason = (error as { details?: { reason?: unknown } })?.details?.reason;
      if (typeof reason === "string") await removePending(pending, task);
      throw error;
    }
  })();
  inFlight.set(key, promise);
  void promise.finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); }).catch(() => undefined);
  return promise;
}

export async function guardarMovimientoCompartido(kind: Kind, spaceId: string, uid: string, value: Movement, operation?: SharedMovementOperation): Promise<string> {
  const task = captureAccountTask(uid);
  const movement = canonicalMovement(value);
  const expected = operation ?? await task.wait(async () => {
    const root = await getDocFromServer(doc(db, kind === "family" ? "familySpaces" : "boxSpaces", spaceId));
    if (!root.exists() || root.metadata.fromCache || root.metadata.hasPendingWrites) throw new Error("shared-space-unconfirmed");
    return { currency: String(root.data().currency || "PEN") };
  });
  const key = JSON.stringify([uid, getAccountStorageSession(), kind, spaceId, movement]);
  const movementId = operation?.movementId ?? attempts.get(key) ?? nuevaOperacionMovimientoCompartido(kind, spaceId, expected.currency).movementId;
  if (!validId(spaceId) || !validId(movementId) || !/^[A-Z]{3}$/.test(expected.currency)
    || (movement.personalOwnerUid !== undefined && movement.personalOwnerUid !== uid)) throw new Error("shared-pending-invalid");
  if (!operation) attempts.set(key, movementId);
  try {
    const pending = await journal(async () => {
      const saved = await loadPending(uid, task);
      const previous = saved.find(item => item.kind === kind && item.spaceId === spaceId);
      if (previous) {
        if (previous.movementId !== movementId) throw new Error("shared-operation-pending");
        if (previous.currency !== expected.currency || JSON.stringify(canonicalMovement(previous.movement)) !== JSON.stringify(movement)) throw new Error("shared-pending-invalid");
        return previous;
      }
      const pending: Pending = { version: 1, uid, kind, spaceId, movementId, currency: expected.currency, movement };
      await savePending([...saved, pending], task);
      return pending;
    });
    await sendPending(pending, task);
    attempts.delete(key);
    return movementId;
  } catch (error) {
    const reason = (error as { details?: { reason?: unknown } })?.details?.reason;
    if (typeof reason === "string") attempts.delete(key); // Rechazo definitivo, no pérdida de conexión.
    throw error;
  }
}

export async function hayMovimientoCompartidoPendiente(kind: Kind, spaceId: string, uid: string): Promise<boolean> {
  const task = captureAccountTask(uid);
  return journal(async () => (await loadPending(uid, task)).some(item => item.kind === kind && item.spaceId === spaceId));
}

/** Repetir un ID consulta su comprobante en el servidor; nunca crea otra orden. */
export async function recuperarMovimientoCompartido(
  kind: Kind, spaceId: string, uid: string, currency: string,
  confirmPersonal: (pending: SharedMovementRecovery) => Promise<boolean>,
): Promise<boolean> {
  const task = captureAccountTask(uid);
  const pending = await journal(async () => (await loadPending(uid, task)).find(item => item.kind === kind && item.spaceId === spaceId));
  if (!pending) return false;
  if (pending.currency !== currency) throw new Error("shared-currency-mismatch");
  const root = await task.wait(() => getDocFromServer(doc(db, kind === "family" ? "familySpaces" : "boxSpaces", spaceId)));
  if (!root.exists() || root.metadata.fromCache || root.metadata.hasPendingWrites || root.data().closed === true
    || String(root.data().currency || "PEN") !== pending.currency) throw new Error("shared-space-unconfirmed");
  // El servidor comprueba pertenencia/actor y que el movimiento siga vigente.
  const receipt = await sendPending(pending, task);
  if (pending.movement.personalTransactionId != null) {
    // La fecha y el ID personal de la intención permanecen intactos al reintentar.
    if (!await task.wait(() => confirmPersonal({ ...pending, ...receipt }))) throw new Error("shared-local-save-failed");
    if (!await task.wait(() => confirmarMovimientoCompartido(pending.movementId, uid))) throw new Error("shared-local-save-failed");
  }
  return true;
}

export async function borrarMovimientoCompartido(kind: "family" | "box", spaceId: string, movementId: string): Promise<void> {
  const task = captureAccountTask(auth.currentUser?.uid ?? "");
  await task.wait(() => httpsCallable(functions, "mutateSharedMovement")({ kind, spaceId, movementId, action: "delete" }));
}
