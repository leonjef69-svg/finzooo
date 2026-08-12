package com.finzo.voicewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Puente para que Fino pueda OFRECER poner el widget en la pantalla de
 * inicio, en vez de dejar que cada quien lo busque a mano.
 *
 * A mano el camino es: mantener pulsado en un hueco vacío de la pantalla →
 * "Widgets" → bajar por una lista de decenas de apps → encontrar Fino →
 * arrastrarlo. Mucha gente no lo encuentra nunca.
 *
 * Con esto, un botón dentro de la app le pide a Android que lo coloque, y
 * lo único que hay que hacer es confirmar. El widget en sí no necesita
 * nada de este archivo para funcionar: es solo comodidad.
 */
class VoiceWidgetModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "No hay contexto de Android disponible"
    }

  override fun definition() = ModuleDefinition {
    Name("VoiceWidget")

    // ¿La pantalla de inicio de este celular permite que una app pida
    // colocar un widget? Android lo permite desde la versión 8, pero
    // algunos lanzadores (sobre todo los que la gente instala aparte) no lo
    // implementan. Cuando devuelve false, la app explica el camino a mano.
    Function("canRequestPin") { canRequestPin() }

    // Le pide a Android que coloque el widget. El sistema muestra su propia
    // ventana de confirmación — la app NO puede colocarlo por su cuenta, y
    // está bien que sea así: nadie quiere que una app le llene la pantalla
    // de inicio sin permiso.
    //
    // Devuelve false si el celular no lo permite; en ese caso no aparece
    // ninguna ventana y hay que hacerlo a mano.
    // "round" coloca el círculo de 1x1; cualquier otra cosa, el 2x1 con
    // etiqueta.
    Function("requestPin") { variant: String -> requestPin(variant) }
  }

  private fun canRequestPin(): Boolean =
    try {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
    } catch (e: Throwable) {
      false
    }

  private fun requestPin(variant: String): Boolean =
    try {
      if (!canRequestPin()) {
        false
      } else {
        val target =
          if (variant == "round") VoiceWidgetRoundProvider::class.java
          else VoiceWidgetProvider::class.java
        val provider = ComponentName(context, target)
        AppWidgetManager.getInstance(context).requestPinAppWidget(
          provider,
          null,
          // Al confirmar, Android ejecuta esto. Se le pasa la misma orden
          // que el propio widget, así que la pantalla de voz se abre de
          // inmediato y se ve que el botón nuevo ya funciona.
          VoiceWidgetProvider.openVoiceScreen(context)
        )
      }
    } catch (e: Throwable) {
      false
    }
}
