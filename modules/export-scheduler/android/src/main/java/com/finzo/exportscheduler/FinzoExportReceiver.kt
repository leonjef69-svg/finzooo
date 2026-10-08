package com.finzo.exportscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/**
 * Recibe solamente la alarma privada de Fino (exported=false).
 * Se conserva el componente/accion para no invalidar alarmas existentes.
 * El wake lock sigue adquiriendose antes de iniciar el trabajo de fondo.
 * Conocer una accion no autentica a otra app; la barrera es el manifiesto.
 */
class FinzoExportReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != ExportSchedulerModule.ACCION_EXPORTAR) return
    HeadlessJsTaskService.acquireWakeLockNow(context)
    context.startService(Intent(context, FinzoExportService::class.java))
  }
}
