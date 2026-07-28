package com.finzo.notificationreader

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
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

    Function("setEnabled") { value: Boolean ->
      NotificationStore.setEnabled(context, value)
    }

    // Devuelve todo lo capturado desde la última vez y vacía el buzón.
    // El resultado es texto JSON; quien llama lo convierte a objetos.
    AsyncFunction("drain") { NotificationStore.drain(context) }

    AsyncFunction("clear") { NotificationStore.clear(context) }
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
