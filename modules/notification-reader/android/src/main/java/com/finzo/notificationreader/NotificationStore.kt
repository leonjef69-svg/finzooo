package com.finzo.notificationreader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Buzón donde el servicio va dejando las notificaciones que reconoce como
 * financieras, hasta que Finzo se abre y las recoge.
 *
 * Hace falta guardarlas en disco porque el servicio de Android sigue vivo
 * aunque Finzo esté cerrada: si guardáramos en memoria, todo lo capturado
 * mientras la app no estaba abierta se perdería.
 *
 * Todo lo que se guarda aquí se queda EN EL CELULAR. No hay ninguna llamada
 * de red en este archivo ni en el servicio que lo usa.
 */
object NotificationStore {
  private const val PREFS = "finzo_notification_reader"
  private const val KEY_QUEUE = "queue"
  private const val KEY_SEEN = "seen"
  private const val KEY_ENABLED = "enabled"

  // Tope del buzón. Si alguien no abre Finzo en semanas, preferimos perder
  // lo más viejo antes que llenarle el almacenamiento del celular.
  private const val MAX_QUEUE = 200
  private const val MAX_SEEN = 300

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /**
   * Interruptor que controla Finzo desde sus ajustes. Va aparte del permiso
   * de Android: aunque el permiso siga concedido, si la persona apaga la
   * función dentro de la app dejamos de capturar de inmediato.
   */
  fun isEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, value).apply()
  }

  /**
   * Guarda una notificación en el buzón. `dedupeKey` evita que la misma
   * notificación entre dos veces: Android vuelve a avisar cada vez que una
   * notificación se actualiza (por ejemplo al cambiarle el texto), y sin
   * esto un solo Yape podría registrarse varias veces.
   *
   * Devuelve true solo si de verdad se guardó algo nuevo.
   */
  @Synchronized
  fun add(context: Context, item: JSONObject, dedupeKey: String): Boolean {
    val p = prefs(context)

    val seen = readArray(p.getString(KEY_SEEN, null))
    for (i in 0 until seen.length()) {
      if (seen.optString(i) == dedupeKey) return false
    }
    seen.put(dedupeKey)
    while (seen.length() > MAX_SEEN) seen.remove(0)

    val queue = readArray(p.getString(KEY_QUEUE, null))
    queue.put(item)
    while (queue.length() > MAX_QUEUE) queue.remove(0)

    p.edit()
      .putString(KEY_SEEN, seen.toString())
      .putString(KEY_QUEUE, queue.toString())
      .apply()
    return true
  }

  /**
   * Entrega lo acumulado y vacía el buzón de una sola vez. Se hace atómico
   * (todo o nada) para que no se pierda nada si llega una notificación justo
   * en el momento en que Finzo está recogiendo.
   */
  @Synchronized
  fun drain(context: Context): String {
    val p = prefs(context)
    val queue = p.getString(KEY_QUEUE, null) ?: "[]"
    p.edit().putString(KEY_QUEUE, "[]").apply()
    return queue
  }

  /** Borra todo: buzón y memoria de lo ya visto. */
  @Synchronized
  fun clear(context: Context) {
    prefs(context).edit()
      .putString(KEY_QUEUE, "[]")
      .putString(KEY_SEEN, "[]")
      .apply()
  }

  private fun readArray(raw: String?): JSONArray =
    try {
      if (raw.isNullOrBlank()) JSONArray() else JSONArray(raw)
    } catch (e: Throwable) {
      JSONArray()
    }
}
