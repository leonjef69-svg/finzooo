import type { DatosCajas } from "@/utils/cajas";
import { getAccountStorageSession } from "@/utils/storage";
import { auth } from "@/utils/firebase";
import { assertPrivateBoxMoneyLocalMutation } from "@/utils/privateBoxMoneyLocalWrite";

// Caché únicamente visual para que cambiar entre pestañas no pinte una caja
// vacía. Debe poder vaciarse al cambiar de cuenta.
let valor: DatosCajas | null = null;
let session: number | null = null;
let uid = "";

export function leerCajasEnMemoria(): DatosCajas | null {
  const current = getAccountStorageSession();
  return current !== null && current === session && uid === (auth.currentUser?.uid ?? "") ? valor : null;
}

export function guardarCajasEnMemoria(siguiente: DatosCajas): void {
  const current = getAccountStorageSession();
  if (current === null) return;
  assertPrivateBoxMoneyLocalMutation("boxes", siguiente);
  session = current; uid = auth.currentUser?.uid ?? ""; valor = siguiente;
}

export function limpiarCajasEnMemoria(): void {
  valor = null;
  session = null;
  uid = "";
}
