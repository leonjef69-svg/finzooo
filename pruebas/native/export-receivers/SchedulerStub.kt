package com.finzo.exportscheduler

import android.content.Context

object TestSignals { val events = mutableListOf<String>() }
object ExportSchedulerModule {
  const val ACCION_EXPORTAR = "com.finzo.exportscheduler.EXPORTAR"
  fun reponerTrasReinicio(context: Context) { TestSignals.events.add("reschedule") }
}
class FinzoExportService
