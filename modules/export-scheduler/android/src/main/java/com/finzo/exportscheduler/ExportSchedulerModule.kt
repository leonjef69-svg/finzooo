package com.finzo.exportscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * El despertador de la exportacion automatica.
 *
 * POR QUE UN DESPERTADOR Y NO UN TRABAJO PERIODICO
 *
 * Los trabajos periodicos de Android (WorkManager) no permiten una hora
 * concreta: garantizan "una vez cada 24 horas", que puede caer a cualquier
 * hora. Para "todos los dias a las 19:26" hace falta un despertador.
 *
 * SE USA EL DESPERTADOR INEXACTO, Y ES A PROPOSITO
 *
 * setAndAllowWhileIdle avisa CERCA de la hora —puede desviarse unos minutos— y
 * no necesita ningun permiso. El exacto (setExactAndAllowWhileIdle) clava el
 * minuto pero desde Android 12 exige el permiso SCHEDULE_EXACT_ALARM, que
 * Google solo aprueba para alarmas y recordatorios de calendario; pedirlo para
 * un reporte de gastos es la clase de cosa que hace que rechacen la app en la
 * tienda. Unos minutos de desvio en un reporte diario no los nota nadie.
 *
 * El "AllowWhileIdle" si importa: sin eso, con el celular quieto toda la noche
 * el despertador se queda esperando a que alguien lo toque, y un reporte a las
 * 3 de la manana no llegaria nunca.
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
  }

  companion object {
    private const val PREFS = "finzo.exportScheduler"
    private const val CLAVE_CUANDO = "cuando"

    private fun guardar(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun alarmas(context: Context): AlarmManager =
      context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun aviso(context: Context): PendingIntent {
      val intent = Intent(context, FinzoExportReceiver::class.java)
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
      alarmas(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, aviso(context))
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
