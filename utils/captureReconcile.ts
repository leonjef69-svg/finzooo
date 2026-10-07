import type { CaptureLogEntry } from "@/utils/autoCapture";

/** Repaso de seguridad para detectar una captura que Android guardó con la app fuera. */
export const INTERVALO_CONCILIACION_CAPTURA_MS = 60_000;

// El registro conserva como máximo 40 avisos. Compararlo es mucho más barato
// que descifrar cada ocho segundos el historial completo y la caja del negocio.
export function huellaRegistroCaptura(registro: readonly CaptureLogEntry[]): string {
  return JSON.stringify(registro);
}

export function debeConciliarCaptura(
  solicitada: boolean,
  avisosNuevos: number,
  registroCambio: boolean,
  ultimaConciliacion: number,
  ahora: number,
): boolean {
  return solicitada || avisosNuevos > 0 || registroCambio || ultimaConciliacion <= 0
    || ahora < ultimaConciliacion
    || ahora - ultimaConciliacion >= INTERVALO_CONCILIACION_CAPTURA_MS;
}
