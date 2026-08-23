package com.finzo.notificationreader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Buzón donde el servicio va dejando las notificaciones que reconoce como
 * financieras, hasta que Fino se abre y las recoge.
 *
 * Hace falta guardarlas en disco porque el servicio de Android sigue vivo
 * aunque Fino esté cerrada: si guardáramos en memoria, todo lo capturado
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
  private const val KEY_SPEAK = "speak"
  private const val KEY_SPEAK_OUT = "speak_outgoing"
  private const val KEY_MONEDA = "moneda"

  // ---- Diagnóstico ----
  // Sin esto, cuando no se captura nada es imposible saber por qué: si
  // Android nunca conectó el servicio, si lo conectó pero la app estaba
  // apagada, o si llegan avisos pero de apps que no reconocemos. Son tres
  // problemas distintos con tres arreglos distintos, y desde fuera se ven
  // exactamente igual: una pantalla vacía.
  private const val KEY_CONNECTED = "connected"
  private const val KEY_CONNECTED_AT = "connectedAt"
  private const val KEY_TOTAL_SEEN = "totalSeen"
  private const val KEY_LAST_PKG = "lastPkg"
  private const val KEY_LAST_AT = "lastAt"

  /**
   * SI ALGUNA VEZ LLEGO UN AVISO DE UNA APP DE DINERO, Y CUANDO (21/08/2026).
   *
   * EL HUECO QUE COSTO UNA TARDE: `noteSeen` guardaba SOLO la ultima app. Su pantalla decia
   * "888 avisos vistos, ultimo com.whatsapp" — y con eso no hay forma de saber si Yape aviso
   * y quedo tapado por el WhatsApp siguiente, o si Yape no aviso nunca. Son dos problemas
   * distintos con dos arreglos distintos, y desde fuera se ven igual.
   *
   * Guardando esto aparte, la pregunta se contesta sola: o dice "hace 2 minutos" —y entonces
   * el fallo esta en leer el texto— o dice "nunca" —y entonces Yape no esta avisando, que no
   * es algo que Fino pueda arreglar desde dentro.
   */
  private const val KEY_LAST_MONEY_PKG = "lastMoneyPkg"
  private const val KEY_LAST_MONEY_AT = "lastMoneyAt"
  private const val KEY_MONEY_SEEN = "moneySeen"

  /** Las ultimas apps que avisaron, separadas por coma. Solo el nombre, nunca el texto. */
  private const val KEY_ULTIMAS = "ultimasApps"
  private const val CUANTAS_ULTIMAS = 8

  // Por qué la voz hablo o se callo la ultima vez. Sin esto, "no dijo nada"
  // se ve exactamente igual con la voz apagada, con un monto que no se
  // reconocio, o con un aviso que se tomo por un pago tuyo: tres problemas
  // distintos, tres arreglos distintos, y un dia entero para distinguirlos.
  private const val KEY_LAST_SPEAK = "lastSpeak"
  private const val KEY_LAST_SPEAK_AT = "lastSpeakAt"

  // Tope del buzón. Si alguien no abre Fino en semanas, preferimos perder
  // lo más viejo antes que llenarle el almacenamiento del celular.
  private const val MAX_QUEUE = 200
  private const val MAX_SEEN = 300

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /**
   * Interruptor que controla Fino desde sus ajustes. Va aparte del permiso
   * de Android: aunque el permiso siga concedido, si la persona apaga la
   * función dentro de la app dejamos de capturar de inmediato.
   */
  fun isEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, value).apply()
  }

  /**
   * Si el celular DICE en voz alta lo que acaba de llegar.
   *
   * Viene apagado. Una app que empieza a hablar sola sin avisar es de las
   * pocas cosas que se desinstalan en el momento: sonaria en una reunion, en
   * clase o en la caja del supermercado sin que nadie lo hubiera pedido.
   */
  fun isSpeakEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_SPEAK, false)

  fun setSpeakEnabled(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean(KEY_SPEAK, value).apply()
  }

  /**
   * Si tambien habla cuando SALE dinero, no solo cuando entra.
   *
   * Apagado tambien. Enterarse de que a uno le llego un yape sin sacar el
   * celular es util; que el celular anuncie en voz alta lo que uno acaba de
   * pagar, delante de la cola del supermercado, no lo es.
   */
  fun isSpeakOutgoing(context: Context): Boolean =
    prefs(context).getBoolean(KEY_SPEAK_OUT, false)

  fun setSpeakOutgoing(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean(KEY_SPEAK_OUT, value).apply()
  }

  /**
   * La moneda elegida en la app ("PEN", "MXN"...), para poder DECIRLA.
   *
   * La voz leia "S/ 1" tal cual y el celular pronunciaba "ese ene uno": el simbolo no es una
   * palabra. Para cambiarlo por "soles" hay que saber en que pais esta la persona, y este
   * servicio corre con Fino CERRADA, sin acceso a los ajustes de la app. Asi que la app lo
   * deja escrito aqui, cada vez que arranca y cada vez que se cambia la moneda.
   *
   * Por defecto soles: es el pais de casa. Y equivocarse aqui solo cambia la palabra que se
   * oye, nunca el numero.
   */
  fun moneda(context: Context): String =
    prefs(context).getString(KEY_MONEDA, "PEN") ?: "PEN"

  fun setMoneda(context: Context, value: String) {
    prefs(context).edit().putString(KEY_MONEDA, value).apply()
  }

  /** Android conectó (o desconectó) el servicio de notificaciones. */
  fun setConnected(context: Context, value: Boolean) {
    prefs(context).edit()
      .putBoolean(KEY_CONNECTED, value)
      .putLong(KEY_CONNECTED_AT, System.currentTimeMillis())
      .apply()
  }

  /**
   * Anota que llegó UNA notificación cualquiera, sea de la app que sea.
   *
   * Se llama antes de filtrar por app a propósito: si este contador sube
   * pero no se captura nada, el servicio funciona y el problema es la lista
   * de apps de dinero. Si no sube, es que Android nunca lo conectó. Solo se
   * guarda el nombre del paquete y la hora — nunca el contenido.
   */
  @Synchronized
  fun noteSeen(context: Context, pkg: String, esAppDeDinero: Boolean) {
    val p = prefs(context)
    val anteriores = (p.getString(KEY_ULTIMAS, "") ?: "")
      .split(",")
      .map { it.trim() }
      .filter { it.isNotBlank() && it != pkg }
    val ultimas = (anteriores + pkg).takeLast(CUANTAS_ULTIMAS).joinToString(",")

    val cambio = p.edit()
      .putInt(KEY_TOTAL_SEEN, p.getInt(KEY_TOTAL_SEEN, 0) + 1)
      .putString(KEY_LAST_PKG, pkg)
      .putLong(KEY_LAST_AT, System.currentTimeMillis())
      .putString(KEY_ULTIMAS, ultimas)

    // Esta marca usa EXACTAMENTE el mismo resultado que el filtro del servicio.
    // Antes la pantalla mostraba siempre "ninguno": las claves existían, pero nadie
    // las escribía. Eso hacía imposible distinguir un Yape no recibido de uno recibido
    // cuyo texto cambió.
    if (esAppDeDinero) {
      cambio
        .putInt(KEY_MONEY_SEEN, p.getInt(KEY_MONEY_SEEN, 0) + 1)
        .putString(KEY_LAST_MONEY_PKG, pkg)
        .putLong(KEY_LAST_MONEY_AT, System.currentTimeMillis())
    }

    cambio.apply()
  }

  /**
   * Anota por qué la voz hablo o se callo con el ultimo aviso.
   *
   * Se guarda SOLO el motivo ("sin-monto", "es-salida", "hablo"...), nunca el
   * texto de la notificacion, igual que en noteSeen.
   */
  @Synchronized
  fun noteSpeak(context: Context, motivo: String) {
    prefs(context).edit()
      .putString(KEY_LAST_SPEAK, motivo)
      .putLong(KEY_LAST_SPEAK_AT, System.currentTimeMillis())
      .apply()
  }

  /** Todo el diagnóstico junto, como texto JSON. */
  fun stats(context: Context): String {
    val p = prefs(context)
    return JSONObject().apply {
      put("connected", p.getBoolean(KEY_CONNECTED, false))
      put("connectedAt", p.getLong(KEY_CONNECTED_AT, 0L))
      put("totalSeen", p.getInt(KEY_TOTAL_SEEN, 0))
      put("lastPackage", p.getString(KEY_LAST_PKG, "") ?: "")
      put("moneySeen", p.getInt(KEY_MONEY_SEEN, 0))
      put("lastMoneyPackage", p.getString(KEY_LAST_MONEY_PKG, "") ?: "")
      put("lastMoneyAt", p.getLong(KEY_LAST_MONEY_AT, 0L))
      put("ultimasApps", p.getString(KEY_ULTIMAS, "") ?: "")
      put("lastAt", p.getLong(KEY_LAST_AT, 0L))
      put("enabled", p.getBoolean(KEY_ENABLED, false))
      put("queued", readArray(p.getString(KEY_QUEUE, null)).length())
      put("lastSpeak", p.getString(KEY_LAST_SPEAK, "") ?: "")
      put("lastSpeakAt", p.getLong(KEY_LAST_SPEAK_AT, 0L))
    }.toString()
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
   * en el momento en que Fino está recogiendo.
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
