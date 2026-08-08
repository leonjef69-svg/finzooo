package com.finzo.notificationreader

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Puente entre el servicio de Android (Kotlin) y el resto de Finzo
 * (JavaScript). No lee notificaciones por su cuenta: solo pregunta por el
 * permiso, enciende o apaga la función, y entrega lo que el servicio dejó
 * en el buzón.
 */
class NotificationReaderModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "No hay contexto de Android disponible"
    }

  override fun definition() = ModuleDefinition {
    Name("NotificationReader")

    // El aviso que la app espera para registrar el yapeo EN EL MOMENTO.
    //
    // Antes la app preguntaba "¿llegó algo?" cada ocho segundos. Funcionaba,
    // pero el movimiento tardaba en aparecer y con la pantalla delante eso se
    // ve como que no se registró.
    Events(EVENTO)

    // Expo avisa por aquí cuando la app se pone a escuchar (y cuando deja de
    // hacerlo). Es lo que permite saber si hay alguien al otro lado: con la
    // app cerrada no lo hay, y entonces el yapeo lo registra el trabajo de
    // fondo, como hasta ahora.
    OnStartObserving { enEscucha = this@NotificationReaderModule }
    OnStopObserving { enEscucha = null }

    // ¿La persona le dio a Finzo el acceso a notificaciones en los ajustes
    // de Android? Es un permiso especial: no se puede pedir con un popup,
    // hay que mandarla a la pantalla del sistema.
    Function("isPermissionGranted") { hasNotificationAccess() }

    // Abre la pantalla de Android donde se concede ese acceso.
    Function("openPermissionSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // Interruptor propio de Finzo, independiente del permiso de Android.
    Function("isEnabled") { NotificationStore.isEnabled(context) }

    // SOLO PARA SABER QUE APK ESTA INSTALADO.
    //
    // No hace nada: existir ya es la respuesta. Los APK del 2 de agosto por la
    // tarde traen la voz, pero solo a partir de este habla SIN ESPERA —motor
    // precalentado y en su propio hilo—. Sin una marca que los distinga, el
    // usuario dice "sigue tardando" y no hay forma de saber si el arreglo
    // llego a instalarse o si no sirvio. Eso ya paso hoy.
    Function("vozSinEspera") { true }

    Function("isSpeakEnabled") { NotificationStore.isSpeakEnabled(context) }

    Function("setSpeakEnabled") { value: Boolean ->
      NotificationStore.setSpeakEnabled(context, value)
    }

    Function("isSpeakOutgoing") { NotificationStore.isSpeakOutgoing(context) }

    Function("setSpeakOutgoing") { value: Boolean ->
      NotificationStore.setSpeakOutgoing(context, value)
    }

    Function("setEnabled") { value: Boolean ->
      NotificationStore.setEnabled(context, value)
    }

    // Devuelve todo lo capturado desde la última vez y vacía el buzón.
    // El resultado es texto JSON; quien llama lo convierte a objetos.
    AsyncFunction("drain") { NotificationStore.drain(context) }

    AsyncFunction("clear") { NotificationStore.clear(context) }

    // Diagnóstico, como texto JSON: si el servicio está conectado, cuántas
    // notificaciones ha visto en total (de cualquier app), cuál fue la
    // última y cuántas quedan por recoger. Es lo que permite saber POR QUÉ
    // no se captura nada, en vez de mirar una pantalla vacía.
    Function("stats") { NotificationStore.stats(context) }

    // Le pide a Android que vuelva a enganchar el servicio. Es el arreglo
    // habitual cuando deja de capturar después de actualizar la app: el
    // permiso sigue dado, pero el servicio quedó suelto.
    Function("requestRebind") { requestRebind() }

    /**
     * PROBAR LA VOZ AHORA MISMO. Es el boton que separa dos cosas que desde fuera se ven
     * igual: "la app no intento hablar" y "este celular no puede hablar".
     *
     * Pedido el 07/08/2026, con las capturas delante: el servicio decia Conectado, el yapeo
     * se registro, la voz encendida... y no se oyo nada. Sin una prueba a mano, averiguar
     * eso son dias de ir y venir.
     *
     * Devuelve lo que encontro, para poder DECIRLO en pantalla en vez de callar:
     *   "ok"          -> hablo
     *   "sin-motor"   -> el celular no tiene ningun sistema de voz instalado
     *   "sin-espanol" -> tiene voz, pero no en espanol
     *   "sin-volumen" -> todo listo, pero el volumen de notificaciones esta en cero
     */
    AsyncFunction("probarVoz") { texto: String -> ProbadorDeVoz.probar(context, texto) }

    /**
     * El volumen del canal de AVISOS, de 0 a 100.
     *
     * Va aparte del de multimedia, y es el que usa la voz de Finzo a proposito: asi respeta
     * el silencio del celular como cualquier otra notificacion. El precio es que se puede
     * quedar en cero sin que nadie se de cuenta —el de la musica sigue alto y todo "suena"
     * normal—, y entonces la voz habla y no se oye. Con este numero se puede decir.
     */
    Function("volumenDeAvisos") { ProbadorDeVoz.volumenDeAvisos(context) }

    /** Los ajustes de Android donde se instala y elige la voz. */
    Function("abrirAjustesDeVoz") { abrirAjustes("com.android.settings.TTS_SETTINGS") }

    /** Los de sonido, para subir el volumen de los avisos. */
    Function("abrirAjustesDeSonido") { abrirAjustes(Settings.ACTION_SOUND_SETTINGS) }

    /**
     * Los del ahorro de bateria de Finzo.
     *
     * Hace falta porque los Honor, Huawei y Xiaomi cierran los servicios en segundo plano
     * por su cuenta, y con el lector cerrado no hay ni registro ni voz.
     */
    Function("abrirAjustesDeBateria") {
      // Primero la pantalla de la propia app, que existe en todos los Android y lleva a
      // "Bateria". La lista general de ahorro de bateria no esta en todos.
      abrirAjustes(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:" + context.packageName)
    }
  }

  companion object {
    const val EVENTO = "onCapture"

    /**
     * El modulo mientras la app lo esta escuchando, o null si no.
     *
     * Volatile porque lo escribe el hilo de la app y lo lee el del servicio de
     * notificaciones, que son distintos.
     */
    @Volatile
    private var enEscucha: NotificationReaderModule? = null

    /**
     * Le dice a la app que acaba de llegar un aviso, para que lo registre YA.
     *
     * Devuelve true solo si habia alguien escuchando. Cuando devuelve false
     * —la app cerrada, o sin haberse suscrito todavia— quien llama tiene que
     * seguir por el camino de siempre: despertar el trabajo de fondo.
     *
     * Nunca lanza: lo llama el servicio de notificaciones de Android, y una
     * excepcion ahi puede dejar el servicio desconectado y la funcion entera
     * muerta en silencio.
     */
    fun avisarDeCaptura(): Boolean =
      try {
        val modulo = enEscucha
        if (modulo == null) {
          false
        } else {
          modulo.sendEvent(EVENTO, Bundle())
          true
        }
      } catch (e: Throwable) {
        false
      }
  }

  /**
   * Abre una pantalla de ajustes de Android, y avisa si no se pudo.
   *
   * Devuelve false en vez de reventar porque estas pantallas NO estan en todos los
   * celulares: la de la voz sobre todo, que cada fabricante mueve de sitio. Con el false, la
   * pantalla puede decir "busca esto a mano" en vez de cerrarse sola.
   */
  private fun abrirAjustes(accion: String, datos: String? = null): Boolean =
    try {
      val intent = Intent(accion).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (datos != null) intent.data = android.net.Uri.parse(datos)
      context.startActivity(intent)
      true
    } catch (e: Throwable) {
      false
    }

  private fun requestRebind(): Boolean =
    try {
      NotificationListenerService.requestRebind(
        ComponentName(context, FinzoNotificationListener::class.java)
      )
      true
    } catch (e: Throwable) {
      false
    }

  /**
   * Android guarda la lista de apps con acceso a notificaciones en un ajuste
   * del sistema, con formato "paquete/clase:paquete/clase". Buscamos si el
   * paquete de Finzo aparece ahí.
   */
  private fun hasNotificationAccess(): Boolean =
    try {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      )
      !enabled.isNullOrBlank() && enabled.split(":").any { entry ->
        ComponentName.unflattenFromString(entry)?.packageName == context.packageName
      }
    } catch (e: Throwable) {
      false
    }
}
