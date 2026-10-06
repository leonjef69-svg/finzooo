import { captureAccountTask } from "@/utils/accountTask";
import { CAJAS_VACIAS, validarCajas } from "@/utils/cajas";
import { getAccountStorageSession, hasUnreadableLocalData, loadJSON, STORAGE_KEYS } from "@/utils/storage";

export class PrivateBoxSyncError extends Error {
  constructor(public readonly reason: "pending" | "changed") { super(`private-box-review-${reason}`); }
}
export type PrivateBoxCloudLease = {
  assertCurrent: () => void;
  wait: <T>(work: () => Promise<T>) => Promise<T>;
  remember: <T extends object>(response: T) => T;
};
const queues = new Map<string, Promise<unknown>>();
const epochs = new Map<string, number>();
const reviews = new Map<string, number>();
const leases = new WeakMap<PrivateBoxCloudLease, { uid: string; mode: "cloud" | "review"; close: () => void }>();
const responses = new WeakMap<object, { uid: string; mode: "cloud" | "review"; current: () => boolean }>();

function exclusive<T>(uid: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(work);
  const settled = result.catch(() => undefined);
  queues.set(uid, settled);
  void settled.then(() => { if (queues.get(uid) === settled) queues.delete(uid); });
  return result;
}

function leaseFor(uid: string, epoch: number, mode: "cloud" | "review"): PrivateBoxCloudLease {
  const task = captureAccountTask(uid);
  let active = true;
  const current = () => task.current() && !hasUnreadableLocalData() && (epochs.get(uid) ?? 0) === epoch
    && (mode === "review" || !(reviews.get(uid) ?? 0));
  const assertCurrent = () => {
    if (hasUnreadableLocalData()) throw new Error("datos-locales-ilegibles");
    if (!task.current()) throw new Error("account-task-obsolete");
    if (!active || !current()) throw new PrivateBoxSyncError("changed");
  };
  const lease: PrivateBoxCloudLease = {
    assertCurrent,
    wait: async work => { assertCurrent(); const result = await work(); assertCurrent(); return result; },
    remember: response => {
      assertCurrent();
      const old = responses.get(response);
      if (old && old.current !== current) throw new PrivateBoxSyncError("changed");
      responses.set(response, { uid, mode, current }); return response;
    },
  };
  leases.set(lease, { uid, mode, close: () => { active = false; } }); return lease;
}

/** Misma cola para ambas copias; verifica el archivo cifrado ANTES de la red. */
export async function withPrivateBoxCloudOperation<T>(uid: string, work: (lease: PrivateBoxCloudLease) => Promise<T>): Promise<T> {
  const epoch = epochs.get(uid) ?? 0, session = getAccountStorageSession();
  const lease = leaseFor(uid, epoch, "cloud");
  // No esperar a una revisión anidada: fallar evita un candado circular.
  if (reviews.get(uid)) throw new PrivateBoxSyncError("pending");
  try { return await exclusive(uid, async () => {
    lease.assertCurrent();
    if (session === null || session !== getAccountStorageSession()) throw new PrivateBoxSyncError("changed");
    const data = validarCajas(await lease.wait(() => loadJSON(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS)));
    if (data.revisionesImporte?.some(entry => entry.estado === "pendiente")) throw new PrivateBoxSyncError("pending");
    const result = await lease.wait(() => work(lease));
    return result;
  }); } finally { leases.get(lease)?.close(); }
}

/** Solo el historial anidado reutiliza una autorización ordinaria auténtica. */
export function withPrivateBoxCloudLease<T>(uid: string, lease: PrivateBoxCloudLease | undefined,
  work: (lease: PrivateBoxCloudLease) => Promise<T>): Promise<T> {
  if (!lease) return withPrivateBoxCloudOperation(uid, work);
  const proof = leases.get(lease);
  if (proof?.uid !== uid || proof.mode !== "cloud") return Promise.reject(new PrivateBoxSyncError("changed"));
  lease.assertCurrent(); return work(lease);
}

/** Preparación futura: invalida respuestas, espera subidas en vuelo y no fuerza datos. */
export async function withPrivateBoxMoneyReview<T>(uid: string, work: (lease: PrivateBoxCloudLease) => Promise<T>): Promise<T> {
  const session = getAccountStorageSession(), task = captureAccountTask(uid);
  if (session === null || !task.current() || hasUnreadableLocalData()) throw new PrivateBoxSyncError("changed");
  const epoch = (epochs.get(uid) ?? 0) + 1;
  epochs.set(uid, epoch); reviews.set(uid, (reviews.get(uid) ?? 0) + 1);
  const lease = leaseFor(uid, epoch, "review");
  try { return await exclusive(uid, () => lease.wait(() => work(lease))); }
  finally {
    leases.get(lease)?.close();
    const remaining = (reviews.get(uid) ?? 1) - 1;
    if (remaining) reviews.set(uid, remaining); else reviews.delete(uid);
  }
}

/** Una copia recibida antes de revisar no se aplica después, aunque sea la misma cuenta. */
export function privateBoxCloudResponseCurrent(uid: string, response: object): boolean {
  const proof = responses.get(response);
  return proof?.uid === uid && proof.mode === "cloud" && proof.current();
}
