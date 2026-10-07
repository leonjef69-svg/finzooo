import { fechaEnElMes, type PagoProgramado } from "@/utils/calendarioPagos";

// Volver tras mucho tiempo envía a Inicio. Mientras un aviso lleva a su ficha,
// ese regreso automático no debe reemplazar la ruta con el pago seleccionado.
let abriendoHasta = 0;
export function markCalendarNotificationOpening(): void {
  abriendoHasta = Date.now() + 10_000;
}
export function isCalendarNotificationOpening(): boolean {
  return Date.now() < abriendoHasta;
}

/** Solo acepta avisos propios con una referencia válida a un mes del calendario. */
export function calendarNotificationTarget(data: Record<string, unknown> | undefined):
  { pagoId: string; mes: string } | null {
  if (data?.calendarioPagos !== true || typeof data.pagoId !== "string"
    || data.pagoId.length === 0 || data.pagoId.length > 120
    || typeof data.mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.mes)) return null;
  return { pagoId: data.pagoId, mes: data.mes };
}

/** Un aviso antiguo puede apuntar a un pago borrado o a un mes ya no aplicable. */
export function paymentForCalendarNotification(
  pagos: PagoProgramado[], pagoId: string, mes: string
): PagoProgramado | null {
  const pago = pagos.find(item => item.id === pagoId);
  return pago && fechaEnElMes(pago, mes) !== "" ? pago : null;
}
