export type HomeNotificationState = {
  hasUrgentPayments: boolean;
  hasPendingImport: boolean;
  hasExportResult: boolean;
};

export type HomeNotificationCandidate = {
  id: string;
  /** Momento en que el aviso se considera llegado al buzón de Fino. */
  arrivedAt: number;
};

export const MAX_HOME_NOTIFICATION_IDS = 250;

/** El indicador cuenta solo avisos que ya llegaron, no pagos futuros. */
export function unreadHomeNotificationIds(
  candidates: HomeNotificationCandidate[],
  seenIds: string[],
  now = Date.now(),
): string[] {
  const vistos = new Set(seenIds);
  return Array.from(new Set(
    candidates
      .filter(({ id, arrivedAt }) => id && arrivedAt <= now && !vistos.has(id))
      .map(({ id }) => id),
  ));
}

/** Conserva un historial pequeño para que el estado leído no crezca sin límite. */
export function mergeSeenHomeNotificationIds(current: string[], added: string[]): string[] {
  return Array.from(new Set([...current, ...added])).slice(-MAX_HOME_NOTIFICATION_IDS);
}

export function summarizeHomeNotifications(state: HomeNotificationState) {
  return {
    hasUrgentNotification: state.hasUrgentPayments || state.hasPendingImport,
    hasAnythingToShow: state.hasUrgentPayments || state.hasPendingImport || state.hasExportResult,
  };
}

/** Solo se informa un intento que realmente llegó a ejecutarse. */
export function shouldShowHomeExportResult(
  result: string | null | undefined,
  automatico: boolean | undefined,
): boolean {
  return Boolean(
    automatico === true && result && !["apagado", "no-toca-hoy", "ya-se-hizo-hoy"].includes(result),
  );
}

const EXPORT_RESULTS_THAT_NOTIFY = new Set([
  "hecho",
  "premium-requerido",
  "pdf-no-se-puede",
  "pdf-sin-respuesta",
  "pdf-vacio",
  "destino-no-automatico",
  "sin-movimientos",
  "espacio-no-disponible",
  "error",
]);

/** No avisa los pulsos internos ni las pruebas manuales, solo resultados reales. */
export function shouldNotifyAutomaticExportResult(
  result: string | null | undefined,
  automatico: boolean,
): boolean {
  return automatico && Boolean(result && EXPORT_RESULTS_THAT_NOTIFY.has(result));
}
