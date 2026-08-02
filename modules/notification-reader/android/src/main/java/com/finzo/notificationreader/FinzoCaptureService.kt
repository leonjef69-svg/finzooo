package com.finzo.notificationreader

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Despierta a Finzo lo justo para registrar el movimiento, sin abrirla.
 *
 * POR QUE HACE FALTA
 *
 * El servicio de notificaciones (FinzoNotificationListener) sabe que llego un
 * yapeo, pero no sabe convertirlo en un movimiento: eso lo hace codigo de la
 * app —el que entiende el texto de Yape, elige la categoria y guarda—. Ese
 * codigo esta escrito en el lenguaje de la app, no en el de Android.
 *
 * Esto arranca ese lenguaje sin pantalla, corre el trabajo y se apaga. Es lo
 * que convierte el registro automatico en automatico de verdad: antes el
 * aviso se quedaba esperando en el buzon hasta que alguien abria Finzo.
 *
 * SI ANDROID NO LO DESPIERTA, NO SE PIERDE NADA
 *
 * Cada fabricante aprieta el ahorro de bateria a su manera y puede negarse a
 * arrancar esto. En ese caso lo capturado sigue intacto en el buzon y la app
 * lo recoge al abrirse, igual que antes. El peor caso es el comportamiento de
 * siempre, nunca un movimiento perdido.
 */
class FinzoCaptureService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(
      // El mismo nombre que registra index.js. Si no coinciden, Android
      // arranca esto, no encuentra el trabajo y se cierra sin decir nada.
      TAREA,
      Arguments.createMap(),
      // Tope de tiempo. De sobra: leer el buzon, entender el texto y guardar
      // es cosa de milisegundos. El tope existe para que un fallo raro no
      // deje el proceso vivo gastando bateria.
      30000,
      // false: no correr si la app esta abierta en pantalla. Ahi ya lo hace
      // ella al volver al frente, y hacerlo dos veces seria registrar el
      // mismo yapeo dos veces.
      false
    )
  }

  companion object {
    const val TAREA = "FinzoCapture"
  }
}
