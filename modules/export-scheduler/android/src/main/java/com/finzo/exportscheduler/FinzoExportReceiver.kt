package com.finzo.exportscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/**
 * Recibe el despertador y arranca el trabajo.
 *
 * POR QUE HAY UN RECEPTOR EN MEDIO Y NO SE ARRANCA EL SERVICIO DIRECTAMENTE
 *
 * Desde Android 8, una app que esta en segundo plano NO puede arrancar un
 * servicio: el sistema lanza una excepcion. Un receptor de mensajes SI puede,
 * durante los segundos que dura su ejecucion. Es la forma documentada de hacer
 * esto y la que usa toda app con trabajos programados.
 *
 * El candado de energia (wake lock) se pide ANTES de arrancar el servicio, no
 * dentro: entre que este receptor termina y el servicio empieza hay un hueco
 * en el que Android puede volver a dormir el celular, y el trabajo se quedaria
 * a medias sin ningun error.
 *
 * TAMBIEN ATIENDE EL REINICIO DEL TELEFONO
 *
 * Los despertadores de Android no sobreviven a apagar el telefono. Al
 * encenderlo llega BOOT_COMPLETED y aqui se vuelve a poner el de la proxima
 * hora. Sin esto, reiniciar el celular dejaba la exportacion automatica muerta
 * en silencio: la pantalla seguiria diciendo "cada dia a las 19:26" y no
 * llegaria nada nunca mas.
 */
class FinzoExportReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
      // Al reiniciar no se exporta: se vuelve a poner el despertador. Exportar
      // aqui mandaria un reporte cada vez que alguien reinicia el telefono.
      ExportSchedulerModule.reponerTrasReinicio(context)
      return
    }

    HeadlessJsTaskService.acquireWakeLockNow(context)
    context.startService(Intent(context, FinzoExportService::class.java))
  }
}
