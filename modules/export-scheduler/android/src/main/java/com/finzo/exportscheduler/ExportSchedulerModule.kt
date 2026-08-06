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
 * POR QUE setAlarmClock Y NO LOS OTROS DOS
 *
 * Es el unico que da hora exacta SIN pedir permisos, y ademas Android lo
 * respeta con el telefono dormido. Los otros dos que parecian obvios fallaron:
 *
 *   setAndAllowWhileIdle — se uso primero y fue un error. Es INEXACTO: Android
 *     agrupa esos avisos y puede retrasarlos diez minutos o mas. El usuario
 *     probo poniendo la hora un minuto adelante y no sono; con este despertador
 *     era casi imposible que sonara puntual. Para un reporte diario el desvio
 *     no importaria, pero para PROBARLO importa muchisimo, y una funcion que no
 *     se puede probar no se puede creer.
 *
 *   setExactAndAllowWhileIdle — clava el minuto, pero desde Android 12 exige el
 *     permiso SCHEDULE_EXACT_ALARM, que Google solo aprueba para alarmas y
 *     calendarios. Pedirlo para una app de gastos es de las cosas por las que
 *     rechazan una app en la tienda.
 *
 * LO QUE SE PAGA: Android trata esto como una alarma de reloj, asi que puede
 * ensenar el iconito de alarma en la barra de arriba con la proxima hora. Es
 * visible y hay que avisarlo; a cambio, el reporte llega cuando dice que llega.
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
    /** La accion del despertador. Solo con esta se exporta. Ver el receptor. */
    const val ACCION_EXPORTAR = "com.finzo.exportscheduler.EXPORTAR"

    private const val PREFS = "finzo.exportScheduler"
    private const val CLAVE_CUANDO = "cuando"

    private fun guardar(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun alarmas(context: Context): AlarmManager =
      context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun aviso(context: Context): PendingIntent {
      // Con accion propia, y no un mensaje vacio: el receptor tiene que estar
      // abierto para que el sistema pueda avisar del arranque, y lo unico que
      // impide que otra app dispare una exportacion es que el receptor exija
      // esta accion. Ver FinzoExportReceiver.
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
      try {
        gestor.setAlarmClock(AlarmManager.AlarmClockInfo(cuando, aviso(context)), aviso(context))
      } catch (e: SecurityException) {
        // Algun fabricante podria negarlo. Antes que quedarse sin nada, se cae
        // al inexacto: llega tarde, pero llega.
        gestor.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, aviso(context))
      }
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
