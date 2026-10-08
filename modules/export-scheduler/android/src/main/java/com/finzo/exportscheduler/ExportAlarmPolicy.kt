package com.finzo.exportscheduler

/** Una revocacion entre consultar el permiso y programar no rompe el fallback.
 * Otros errores y fallos de la alarma aproximada no se presentan como exito. */
internal object ExportAlarmPolicy {
  fun programar(exactaPermitida: Boolean, exacta: () -> Unit, aproximada: () -> Unit) {
    if (!exactaPermitida) {
      aproximada()
      return
    }
    try {
      exacta()
    } catch (error: SecurityException) {
      aproximada()
    }
  }
}
