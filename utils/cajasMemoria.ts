import type { DatosCajas } from "@/utils/cajas";

// Caché únicamente visual para que cambiar entre pestañas no pinte una caja
// vacía. Debe poder vaciarse al cambiar de cuenta.
let valor: DatosCajas | null = null;

export function leerCajasEnMemoria(): DatosCajas | null {
  return valor;
}

export function guardarCajasEnMemoria(siguiente: DatosCajas): void {
  valor = siguiente;
}

export function limpiarCajasEnMemoria(): void {
  valor = null;
}
