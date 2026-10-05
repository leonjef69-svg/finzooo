import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/utils/firebase";
import { nextId } from "@/utils/id";
import { currencyDecimals } from "@/constants/currencies";
import { getAccountStorageSession, loadJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";
import type { Transaction } from "@/types";

export type PersonalReturnRequest = {
  kind: "family" | "box"; spaceId: string; amount: number; currency: string; fecha: string; description: string;
};
type Payload = PersonalReturnRequest & { personalTransactionId: number };
type Pending = { uid: string; payload: Payload };
export type PersonalReturnReceipt = Payload & {
  uid: string; movementId: string; spaceName: string; createdAt: number;
  allocations: { transactionId: number; amount: number }[];
  localSession: number;
};
const inFlight = new Map<string, { key: string; promise: Promise<PersonalReturnReceipt> }>();
let journalQueue: Promise<void> = Promise.resolve();
function journal<T>(work: () => Promise<T>): Promise<T> {
  const result = journalQueue.then(work);
  journalQueue = result.then(() => undefined, () => undefined);
  return result;
}

function check(uid: string, session: number | null): asserts session is number {
  if (session === null || auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified || getAccountStorageSession() !== session) {
    throw new Error("return-account-changed");
  }
}
function pendingValid(value: Pending, uid: string): boolean {
  return value?.uid === uid && ["family", "box"].includes(value.payload?.kind)
    && typeof value.payload.spaceId === "string" && Number.isSafeInteger(value.payload.personalTransactionId)
    && value.payload.personalTransactionId > 0 && Number.isFinite(value.payload.amount) && value.payload.amount > 0
    && typeof value.payload.currency === "string" && typeof value.payload.fecha === "string" && typeof value.payload.description === "string";
}
async function loadPending(uid: string, session: number | null): Promise<Pending | null> {
  check(uid, session);
  const saved = await loadJSON<Pending | null>(STORAGE_KEYS.personalReturnPending, null);
  check(uid, session);
  if (saved && !pendingValid(saved, uid)) throw new Error("return-pending-invalid");
  return saved;
}
export function personalReturnIsCurrent(receipt: PersonalReturnReceipt): boolean {
  return auth.currentUser?.uid === receipt.uid && getAccountStorageSession() === receipt.localSession;
}
export function transactionMatchesReturn(tx: Transaction, receipt: PersonalReturnReceipt): boolean {
  return tx.id === receipt.personalTransactionId && tx.type === "income" && tx.amount === receipt.amount
    && tx.internalTransfer === receipt.kind && tx.internalTransferSpaceId === receipt.spaceId && tx.internalTransferLink === receipt.movementId;
}
export function mergePersonalReturn(items: Transaction[], tx: Transaction): Transaction[] {
  const existing = items.find(item => item.id === tx.id);
  if (existing && (existing.type !== tx.type || existing.amount !== tx.amount || existing.internalTransfer !== tx.internalTransfer
    || existing.internalTransferSpaceId !== tx.internalTransferSpaceId || existing.internalTransferLink !== tx.internalTransferLink)) return items;
  return existing ? items.map(item => item.id === tx.id ? { ...item, ...tx } : item) : [tx, ...items];
}

/** Solo se retira la orden cuando su ingreso está comprobado en el disco. */
export async function finishPersonalReturn(receipt: PersonalReturnReceipt): Promise<boolean> {
  return journal(async () => {
    check(receipt.uid, receipt.localSession);
    const stored = await loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []);
    check(receipt.uid, receipt.localSession);
    if (!stored.some(tx => transactionMatchesReturn(tx, receipt))) return false;
    const pending = await loadPending(receipt.uid, receipt.localSession);
    if (!pending || pending.payload.personalTransactionId !== receipt.personalTransactionId) return !pending;
    return saveJSONNow(STORAGE_KEYS.personalReturnPending, null);
  });
}

function request(uid: string, input?: PersonalReturnRequest): Promise<PersonalReturnReceipt | null> {
  const session = getAccountStorageSession();
  try { check(uid, session); } catch (error) { return Promise.reject(error); }
  const key = input ? `${input.kind}:${input.spaceId}` : "recovery";
  const earlier = inFlight.get(uid);
  if (earlier) return key === "recovery" || earlier.key === key ? earlier.promise : Promise.reject(new Error("return-busy"));
  const promise = (async () => {
    const pending = await journal(async () => {
      let pending = await loadPending(uid, session);
      if (pending) {
        const stored = await loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []);
        check(uid, session);
        const tx = stored.find(item => item.id === pending!.payload.personalTransactionId);
        // Una orden anterior ya aplicada se confirma por su vínculo de servidor.
        if (tx?.type === "income" && tx.amount === pending.payload.amount && tx.internalTransfer === pending.payload.kind
          && tx.internalTransferSpaceId === pending.payload.spaceId && tx.internalTransferLink?.startsWith("return_")) {
          if (!await saveJSONNow(STORAGE_KEYS.personalReturnPending, null)) throw new Error("return-local-save-failed");
          check(uid, session); pending = null;
        }
      }
      if (!pending && !input) return null;
      if (pending && input && (pending.payload.kind !== input.kind || pending.payload.spaceId !== input.spaceId)) throw new Error("return-busy");
      if (!pending) {
        pending = { uid, payload: { ...input!, amount: Number(input!.amount.toFixed(currencyDecimals(input!.currency))),
          description: input!.description.trim(), personalTransactionId: nextId() } };
        if (!await saveJSONNow(STORAGE_KEYS.personalReturnPending, pending)) throw new Error("return-local-save-failed");
        check(uid, session);
      }
      return pending;
    });
    if (!pending) return null;
    try {
      const response = await httpsCallable<Payload, Omit<PersonalReturnReceipt, "localSession">>(functions, "returnPersonalContribution", { timeout: 130_000 })(pending.payload);
      check(uid, session);
      const value = response.data, payload = pending.payload;
      if (!value || value.uid !== uid || value.kind !== payload.kind || value.spaceId !== payload.spaceId
        || value.personalTransactionId !== payload.personalTransactionId || value.currency !== payload.currency || value.amount !== payload.amount
        || value.fecha !== payload.fecha || typeof value.movementId !== "string" || !value.movementId.startsWith("return_")
        || typeof value.spaceName !== "string" || !Number.isFinite(value.createdAt) || value.createdAt < 0
        || !Array.isArray(value.allocations) || value.allocations.some(item => !Number.isSafeInteger(item.transactionId) || item.transactionId <= 0
          || !Number.isFinite(item.amount) || item.amount <= 0)) throw new Error("return-invalid-response");
      const scale = 10 ** currencyDecimals(value.currency);
      const total = value.allocations.reduce((sum, item) => sum + BigInt(Math.round(item.amount * scale)), 0n);
      if (new Set(value.allocations.map(item => item.transactionId)).size !== value.allocations.length
        || total !== BigInt(Math.round(value.amount * scale))) throw new Error("return-invalid-response");
      return { ...value, localSession: session! };
    } catch (error) {
      const reason = (error as { details?: { reason?: string } })?.details?.reason;
      // Estos rechazos prueban que la operación no se confirmó. Un error de
      // red no lo prueba: conserva la misma orden para recuperar el resultado.
      if (["return-changed", "return-currency-mismatch", "return-invalid-request", "return-space-closed"].includes(reason || "")) {
        await journal(async () => {
          const saved = await loadPending(uid, session);
          if (saved?.payload.personalTransactionId === pending.payload.personalTransactionId) await saveJSONNow(STORAGE_KEYS.personalReturnPending, null);
        });
      }
      throw error;
    }
  })();
  inFlight.set(uid, { key, promise: promise as Promise<PersonalReturnReceipt> });
  void promise.finally(() => { if (inFlight.get(uid)?.promise === promise) inFlight.delete(uid); }).catch(() => undefined);
  return promise;
}

export async function devolverAportePersonal(input: PersonalReturnRequest): Promise<PersonalReturnReceipt> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("return-account-changed");
  const receipt = await request(uid, input);
  if (!receipt) throw new Error("return-invalid-response");
  return receipt;
}
export function recoverPersonalReturn(uid: string): Promise<PersonalReturnReceipt | null> { return request(uid); }
