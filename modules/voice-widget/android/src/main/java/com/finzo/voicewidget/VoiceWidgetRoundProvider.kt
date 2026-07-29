package com.finzo.voicewidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * La versión redonda y chica del widget: un círculo violeta del tamaño de
 * un ícono normal.
 *
 * Hace exactamente lo mismo que el 2x1 con etiqueta; solo cambia cómo se
 * ve. Existen los dos porque son dos gustos distintos: el redondo se pierde
 * entre los íconos como un botón más, el ancho dice para qué sirve.
 *
 * Va en una clase aparte y no como una opción del otro porque Android
 * identifica cada widget por su clase: un mismo provider no puede ofrecer
 * dos tamaños distintos en la lista de widgets.
 */
class VoiceWidgetRoundProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (id in appWidgetIds) {
      val views = RemoteViews(context.packageName, R.layout.finzo_voice_widget_round)
      // La misma orden que el widget ancho: abrir "finzo://voice".
      views.setOnClickPendingIntent(
        R.id.finzo_widget_round_root,
        VoiceWidgetProvider.openVoiceScreen(context)
      )
      appWidgetManager.updateAppWidget(id, views)
    }
  }
}
