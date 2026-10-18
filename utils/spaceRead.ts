type ReadScope = { uid: string; session: number | null; revision: number; key: string };
type PendingRead = { startedAt: number; promise: Promise<unknown> };
const pending = new Map<string, PendingRead>();
const MAX_PENDING_AGE_MS = 8_000;
const MAX_PENDING_READS = 64;

/** Solo consultas en curso. No conserva resultados, confirma dinero ni escribe
 * datos. Cada pantalla sigue comprobando su propia cuenta/sesión al recibir. */
export function shareSpaceRead<T>(scope: ReadScope, work: () => Promise<T>, force = false): Promise<T> {
  if (!scope.uid || scope.session === null) return work();
  const now = Date.now();
  for (const [key, entry] of pending) {
    const age = now - entry.startedAt;
    if (age < 0 || age >= MAX_PENDING_AGE_MS) pending.delete(key);
  }
  const key = JSON.stringify([scope.uid, scope.session, scope.revision, scope.key]);
  // Una actualización expresa sustituye la ficha anterior. Quien vuelva
  // después espera la nueva lectura, nunca la que se decidió actualizar.
  if (force) pending.delete(key);
  const existing = pending.get(key);
  if (existing) return existing.promise as Promise<T>;
  // Retirar una ficha no cancela la consulta ni altera a quien la espera.
  if (pending.size >= MAX_PENDING_READS) pending.delete(pending.keys().next().value!);
  const entry: PendingRead = { startedAt: now, promise: Promise.resolve().then(work) };
  const promise = entry.promise.finally(() => { if (pending.get(key) === entry) pending.delete(key); }) as Promise<T>;
  entry.promise = promise;
  pending.set(key, entry);
  return promise;
}
