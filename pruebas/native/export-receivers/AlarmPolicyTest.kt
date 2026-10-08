package com.finzo.exportscheduler

fun main() {
  val events = mutableListOf<String>()
  ExportAlarmPolicy.programar(false, { error("No se debe intentar exacta sin permiso") }, { events.add("aproximada") })
  check(events == listOf("aproximada")); events.clear()
  ExportAlarmPolicy.programar(true, { events.add("exacta") }, { events.add("aproximada") })
  check(events == listOf("exacta")); events.clear()
  ExportAlarmPolicy.programar(true, { events.add("revocada"); throw SecurityException("permiso retirado") }, { events.add("aproximada") })
  check(events == listOf("revocada", "aproximada")); events.clear()
  try {
    ExportAlarmPolicy.programar(true, { throw IllegalStateException("fallo real") }, { events.add("no debe ocultar") })
    error("Se oculto un error real")
  } catch (error: IllegalStateException) { check(error.message == "fallo real") }
  check(events.isEmpty())
  for (allowed in listOf(false, true)) {
    try {
      ExportAlarmPolicy.programar(allowed, { throw SecurityException() }, { throw IllegalArgumentException("fallo aproximada") })
      error("Se oculto el fallo de fallback")
    } catch (error: IllegalArgumentException) { check(error.message == "fallo aproximada") }
  }
  println("Politica Kotlin original: sin permiso no intenta exacta; con acceso programa; revocacion cae a aproximada una vez; errores no se ocultan. No acredita puntualidad Android.")
}
