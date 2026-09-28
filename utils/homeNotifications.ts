export type HomeNotificationState = {
  hasUrgentPayments: boolean;
  hasPendingImport: boolean;
  nextScheduledExportAt: number;
  now: number;
};

export function summarizeHomeNotifications(state: HomeNotificationState) {
  const hasScheduledExport = state.nextScheduledExportAt > state.now;
  return {
    hasUrgentNotification: state.hasUrgentPayments || state.hasPendingImport,
    hasScheduledExport,
    hasAnythingToShow: state.hasUrgentPayments || state.hasPendingImport || hasScheduledExport,
  };
}
