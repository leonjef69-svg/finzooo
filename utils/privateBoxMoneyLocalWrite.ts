import { canonical } from "../functions/src/private-box-money-shared.js";

export type PrivateBoxMoneyLocalKey = "transactions" | "deletedIds" | "currency" | "boxes";
export type PrivateBoxMoneyLocalWrite = { publish: (work: () => void) => void; release: () => void };
let active: { current: () => boolean; values: Record<PrivateBoxMoneyLocalKey, string>; publishing: boolean } | null = null;

export function assertPrivateBoxMoneyLocalIdle(): void {
  if (active?.current() && !active.publishing) throw new Error("private-box-source-changed");
}

/** Solo durante la escritura/lectura final nativa, nunca durante HTTP/cifrado.
 * Rechaza un cambio ANTES de modificar memoria, no lo descarta después.
 * Las asignaciones idénticas de React no son otra operación financiera.
 */
export function assertPrivateBoxMoneyLocalMutation(key: PrivateBoxMoneyLocalKey, value: unknown): void {
  if (active?.current() && !active.publishing && active.values[key] !== canonical(value)) throw new Error("private-box-source-changed");
}

export function reservePrivateBoxMoneyLocalWrite(current: () => boolean,
  values: Record<PrivateBoxMoneyLocalKey, unknown>): PrivateBoxMoneyLocalWrite {
  if (!current() || active?.current()) throw new Error("private-box-source-changed");
  const proof = { current, values: { transactions: canonical(values.transactions), deletedIds: canonical(values.deletedIds),
    currency: canonical(values.currency), boxes: canonical(values.boxes) }, publishing: false };
  active = proof;
  return {
    publish: work => {
      if (active !== proof || !proof.current() || proof.publishing) throw new Error("private-box-source-changed");
      proof.publishing = true;
      try { work(); } finally { proof.publishing = false; }
    },
    release: () => { if (active === proof) active = null; },
  };
}
