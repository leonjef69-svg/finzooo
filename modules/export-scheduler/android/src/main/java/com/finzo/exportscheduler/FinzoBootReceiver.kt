package com.finzo.exportscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Solo repone la alarma al recibir el arranque protegido de Android.
 * No acepta la accion privada de exportacion ni inicia el servicio. */
class FinzoBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    ExportSchedulerModule.reponerTrasReinicio(context)
  }
}
