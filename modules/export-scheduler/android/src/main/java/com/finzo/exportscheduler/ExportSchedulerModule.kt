package com.finzo.exportscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * El despertador de la exportacion automatica.
 *
 * POR QUE UN DESPERTADOR Y NO UN TRABAJO PERIODICO
 *
 * La app calcula el proximo dia/hora y aqui programa una alarma individual.
 * Un trabajo periodico tampoco garantiza la hora exacta ni un intervalo puntual.
 *
 * PUNTUALIDAD: setAlarmClock tambien exige acceso a alarmas exactas desde
 * Android 12. No se pide un permiso nuevo: se consulta el acceso existente y,
 * sin el, se usa setAndAllowWhileIdle. Android puede retrasar esa alarma.
 * Probar el guardado inmediato no acredita la puntualidad del horario.
 */
class ExportSchedulerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "No hay contexto de Android disponible"
    }

  override fun definition() = ModuleDefinition {
    Name("ExportScheduler")

    // SOLO PARA SABER SI ESTE APK LO TRAE.
    //
    // No hace nada: existir ya es la respuesta. Las actualizaciones por
    // internet no traen codigo de Android, asi que en un APK anterior a esto
    // el modulo entero no existe. La app pregunta antes de prometer nada.
    Function("estaDisponible") { true }

    /**
     * Pone el despertador para un momento concreto.
     *
     * Recibe la fecha y hora en milisegundos, calculada por la app: el
     * calendario (que dia toca segun la frecuencia) ya vive en JavaScript y
     * duplicarlo aqui seria tener dos calendarios que se pueden desincronizar.
     */
    Function("programar") { cuandoMillis: Double ->
      val cuando = cuandoMillis.toLong()
      guardar(context).edit().putLong(CLAVE_CUANDO, cuando).apply()
      poner(context, cuando)
    }

    /** Quita el despertador. Al apagar la exportacion automatica. */
    Function("cancelar") {
      guardar(context).edit().remove(CLAVE_CUANDO).apply()
      alarmas(context).cancel(aviso(context))
    }

    /**
     * Convierte el HTML del reporte en un PDF y devuelve donde quedo.
     *
     * AsyncFunction y no Function: crear el WebView, cargar el HTML, medirlo y
     * escribirlo lleva su tiempo, y una Function bloquearia el hilo de la app
     * mientras. Ademas el resultado llega por callbacks, asi que hace falta
     * poder contestar mas tarde.
     *
     * Recibe el HTML ya armado por utils/exportPdfHtml, el MISMO que usa la
     * pantalla de exportar a mano: asi el PDF automatico y el de a mano son el
     * mismo documento. Ver HtmlAPdf.
     */
    AsyncFunction("htmlAPdf") { html: String, destino: String, promesa: Promise ->
      HtmlAPdf.convertir(context, html, destino) { uri, error ->
        if (uri != null) promesa.resolve(uri)
        else promesa.reject("pdf", error ?: "no se pudo convertir a PDF", null)
      }
    }
  }

  companion object {
    /** La accion del despertador. Solo con esta se exporta. Ver el receptor. */
    const val ACCION_EXPORTAR = "com.finzo.exportscheduler.EXPORTAR"

    private const val PREFS = "finzo.exportScheduler"
    private const val CLAVE_CUANDO = "cuando"

    private fun guardar(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun alarmas(context: Context): AlarmManager =
      context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun aviso(context: Context): PendingIntent {
      // Componente/accion explicitos e inmutables: solo el receptor privado.
      // El arranque del sistema lo atiende FinzoBootReceiver por separado.
      val intent = Intent(context, FinzoExportReceiver::class.java).setAction(ACCION_EXPORTAR)
      return PendingIntent.getBroadcast(
        context,
        0,
        intent,
        // FLAG_IMMUTABLE es obligatorio desde Android 12. UPDATE_CURRENT para
        // que reprogramar reemplace el anterior en vez de dejar dos.
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    private fun poner(context: Context, cuando: Long) {
      val gestor = alarmas(context)
      val exactaPermitida = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || gestor.canScheduleExactAlarms()
      ExportAlarmPolicy.programar(exactaPermitida,
        exacta = { gestor.setAlarmClock(AlarmManager.AlarmClockInfo(cuando, aviso(context)), aviso(context)) },
        aproximada = { gestor.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, aviso(context)) }
      )
    }

    /**
     * Vuelve a poner el despertador despues de reiniciar el telefono.
     *
     * Se guarda la hora en los ajustes de Android y no se pregunta a la app,
     * porque al arrancar el telefono la app no esta viva: no hay JavaScript al
     * que preguntarle.
     *
     * Si la hora guardada ya paso mientras el telefono estaba apagado, se pone
     * para dentro de un minuto: asi el reporte que se perdio sale al encender,
     * en vez de esperar hasta el dia siguiente.
     */
    fun reponerTrasReinicio(context: Context) {
      val cuando = guardar(context).getLong(CLAVE_CUANDO, 0L)
      if (cuando == 0L) return
      val ahora = System.currentTimeMillis()
      poner(context, if (cuando > ahora) cuando else ahora + 60_000L)
    }
  }
}
