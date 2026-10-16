import type { DatosCajas } from "@/utils/cajas";
import type { CajaCompartida } from "@/utils/cloudCajasCompartidas";
import { getAccountStorageSession } from "@/utils/storage";
import { auth } from "@/utils/firebase";
import { assertPrivateBoxMoneyLocalMutation } from "@/utils/privateBoxMoneyLocalWrite";

// Caché únicamente visual para que cambiar entre pestañas no pinte una caja
// vacía. Debe poder vaciarse al cambiar de cuenta.
let valor: DatosCajas | null = null;
let session: number | null = null;
let uid = "";
let revision = 0;
const listeners = new Set<() => void>();

type CopiaCajasCompartidas = { cajas: CajaCompartida[]; saldos: Record<string, number> };
let compartidas: (CopiaCajasCompartidas & { uid: string; session: number }) | null = null;

// Solo presentación: esta copia nunca confirma dinero ni sustituye las
// comprobaciones del detalle. No se escribe al disco ni se comparte entre sesiones.
export function leerCajasCompartidasEnMemoria(): CopiaCajasCompartidas | null {
  return compartidas && compartidas.session === getAccountStorageSession()
    && compartidas.uid === auth.currentUser?.uid ? compartidas : null;
}

export function guardarCajasCompartidasEnMemoria(cajas: CajaCompartida[], saldos: Record<string, number>, accountUid: string, accountSession: number | null): void {
  if (!accountUid || accountSession === null || accountSession !== getAccountStorageSession()
    || accountUid !== auth.currentUser?.uid) return;
  compartidas = { uid: accountUid, session: accountSession, cajas: cajas.map(caja => ({ ...caja })),
    saldos: Object.fromEntries(cajas.filter(caja => Number.isFinite(saldos[caja.id])).map(caja => [caja.id, saldos[caja.id]])) };
}

export function revisionCajasEnMemoria(): number { return revision; }
export function observarCajasEnMemoria(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function leerCajasEnMemoria(): DatosCajas | null {
  const current = getAccountStorageSession();
  return current !== null && current === session && uid === (auth.currentUser?.uid ?? "") ? valor : null;
}

export function guardarCajasEnMemoria(siguiente: DatosCajas): void {
  const current = getAccountStorageSession();
  if (current === null) return;
  assertPrivateBoxMoneyLocalMutation("boxes", siguiente);
  if (current === session && uid === (auth.currentUser?.uid ?? "") && valor === siguiente) return;
  session = current; uid = auth.currentUser?.uid ?? ""; valor = siguiente;
  revision++;
  for (const listener of listeners) listener();
}

export function limpiarCajasEnMemoria(): void {
  compartidas = null;
  valor = null;
  session = null;
  uid = "";
  revision++;
  for (const listener of listeners) listener();
}
