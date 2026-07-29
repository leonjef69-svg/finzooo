package com.finzo.voicewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * El widget del micrófono en la pantalla de inicio del celular.
 *
 * Lo único que hace es abrir Finzo directamente en la pantalla de voz. No
 * guarda nada, no lee nada y no se despierta solo: Android lo dibuja una
 * vez y ahí se queda hasta que alguien lo toca.
 *
 * Por eso no gasta batería. Un widget que muestra datos (el saldo, por
 * ejemplo) tendría que despertarse cada tanto para mantenerlos frescos;
 * este no tiene nada que refrescar.
 */
class VoiceWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (id in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.finzo_voice_widget)
      views.setOnClickPendingIntent(R.id.finzo_widget_root, openVoiceScreen(context))
      appWidgetManager.updateAppWidget(id, views)
    }
  }

  companion object {
    /**
     * La orden que se ejecuta al tocar el widget: abrir "finzo://voice".
     *
     * Se usa esa dirección y no "abre la app" a secas porque así se entra
     * DIRECTO al micrófono, sin pasar por Inicio ni por el botón "+". Es la
     * misma dirección que usa la app por dentro, así que si mañana esa
     * pantalla cambia, el widget la sigue encontrando.
     */
    fun openVoiceScreen(context: Context): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("finzo://voice")).apply {
        // Se limita a nuestra propia app: sin esto, si otra app del celular
        // dijera entender direcciones "finzo://", Android podría ofrecerle
        // el toque a ella.
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }

      // IMMUTABLE: nadie puede modificar esta orden después de creada. Es
      // obligatorio desde Android 12 y, de paso, evita que otra app la
      // reutilice apuntando a otro sitio.
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
  }
}
