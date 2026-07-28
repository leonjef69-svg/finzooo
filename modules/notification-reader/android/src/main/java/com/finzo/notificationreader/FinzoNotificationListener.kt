package com.finzo.notificationreader

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Escucha las notificaciones del celular y guarda SOLO las de apps de dinero.
 *
 * ---- SOBRE LA PRIVACIDAD ----
 * Android obliga a pedir un permiso que da acceso a todas las notificaciones,
 * pero este servicio descarta cualquiera que no venga de una app de la lista
 * de abajo antes de mirar su contenido. Una notificación de WhatsApp, del
 * correo o de cualquier otra app se ignora en la primera línea y nunca se
 * guarda ni se lee.
 *
 * Nada de lo capturado sale del celular: se guarda en el almacenamiento
 * privado de Finzo y se borra apenas la app lo procesa.
 */
class FinzoNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    // Este servicio lo llama el sistema operativo. Si algo aquí lanzara una
    // excepción, Android podría desconectar el servicio y la función dejaría
    // de funcionar en silencio. Por eso todo va dentro de un try.
    try {
      if (!NotificationStore.isEnabled(applicationContext)) return

      val pkg = sbn.packageName?.lowercase() ?: return
      if (!isMoneyApp(pkg)) return

      val extras = sbn.notification?.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: ""
      val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim() ?: ""
      val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim() ?: ""

      // Algunas apps ponen el detalle completo solo en el texto largo (el que
      // se ve al desplegar la notificación). Nos quedamos con el más completo.
      val body = if (bigText.length > text.length) bigText else text
      if (title.isBlank() && body.isBlank()) return

      val item = JSONObject().apply {
        put("package", sbn.packageName)
        put("title", title)
        put("text", body)
        put("postedAt", sbn.postTime)
      }

      // La clave junta app + textos + el segundo en que llegó. Si Android
      // reenvía la misma notificación actualizada, la clave coincide y no se
      // duplica; dos Yapes distintos del mismo monto en segundos diferentes
      // sí entran los dos.
      val dedupeKey = "$pkg|$title|$body|${sbn.postTime / 1000}"

      NotificationStore.add(applicationContext, item, dedupeKey)
    } catch (e: Throwable) {
      // Se ignora a propósito: más vale perder una notificación que dejar el
      // servicio caído para todas las siguientes.
    }
  }

  /**
   * Apps cuyas notificaciones nos interesan. Se compara por "contiene" y no
   * por el nombre exacto del paquete a propósito: los bancos cambian el
   * nombre de sus apps entre versiones y países, y así seguimos
   * reconociéndolas sin tener que sacar una versión nueva de Finzo.
   */
  private fun isMoneyApp(pkg: String): Boolean =
    MONEY_APP_HINTS.any { pkg.contains(it) }

  companion object {
    private val MONEY_APP_HINTS = listOf(
      "yape",
      "plin",
      "bcp",
      "viabcp",
      "interbank",
      "bbva",
      "scotiabank",
      "banbif",
      "pichincha",
      "banconacion",
      "bn.gob",
      "caja",
      "mibanco",
      "ripley",
      "falabella",
      "tunki",
      "izipay",
      "niubiz"
    )
  }
}
