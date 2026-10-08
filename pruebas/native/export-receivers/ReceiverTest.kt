package com.finzo.exportscheduler

import android.content.Context
import android.content.Intent

fun main() {
  val context = Context()
  val work = FinzoExportReceiver()
  val boot = FinzoBootReceiver()
  fun checkEvents(expected: List<String>) {
    check(TestSignals.events == expected) { "Efectos inesperados: ${TestSignals.events}, esperado $expected" }
    TestSignals.events.clear()
  }
  for (intent in listOf(null, Intent(), Intent().setAction("otra.app.ACCION"))) {
    work.onReceive(context, intent); checkEvents(emptyList())
    boot.onReceive(context, intent); checkEvents(emptyList())
  }
  work.onReceive(context, Intent().setAction(Intent.ACTION_BOOT_COMPLETED)); checkEvents(emptyList())
  boot.onReceive(context, Intent().setAction(ExportSchedulerModule.ACCION_EXPORTAR)); checkEvents(emptyList())
  boot.onReceive(context, Intent().setAction(Intent.ACTION_BOOT_COMPLETED)); checkEvents(listOf("reschedule"))
  work.onReceive(context, Intent().setAction(ExportSchedulerModule.ACCION_EXPORTAR)); checkEvents(listOf("wake", "service"))
  println("Receptores Kotlin originales: nulos/desconocidos ignorados, arranque solo repone, exportacion privada adquiere wake lock antes del servicio. JVM no acredita permisos Android.")
}
