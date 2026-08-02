package com.finzo.notificationreader

import android.app.Notification
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import android.content.ComponentName
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

  // Android avisa por aquí cuando de verdad engancha el servicio. Dar el
  // permiso y que el servicio esté CONECTADO son dos cosas distintas: el
  // permiso puede estar dado y el servicio caído (pasa sobre todo después
  // de actualizar la app). Sin anotarlo, esa diferencia era invisible.
  override fun onListenerConnected() {
    try {
      NotificationStore.setConnected(applicationContext, true)
    } catch (e: Throwable) {
      // Nunca dejar que el servicio del sistema se caiga por esto.
    }
  }

  override fun onListenerDisconnected() {
    try {
      NotificationStore.setConnected(applicationContext, false)
      // Le pide a Android que lo vuelva a enganchar. Es lo que suele
      // resolver que deje de capturar después de una actualización.
      requestRebind(ComponentName(applicationContext, FinzoNotificationListener::class.java))
    } catch (e: Throwable) {
      // Igual que arriba.
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    // Este servicio lo llama el sistema operativo. Si algo aquí lanzara una
    // excepción, Android podría desconectar el servicio y la función dejaría
    // de funcionar en silencio. Por eso todo va dentro de un try.
    try {
      val pkg = sbn.packageName?.lowercase() ?: return

      // Se anota ANTES de cualquier filtro: solo el nombre del paquete y la
      // hora, nunca el contenido. Es lo que permite distinguir "el servicio
      // no arrancó" de "arrancó pero no reconoce la app del banco" — dos
      // problemas que desde la pantalla se ven exactamente igual.
      NotificationStore.noteSeen(applicationContext, pkg)

      if (!NotificationStore.isEnabled(applicationContext)) return
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

      val esNueva = NotificationStore.add(applicationContext, item, dedupeKey)

      // Solo se dice en voz alta si de verdad es nueva. Android reenvía la
      // misma notificación cada vez que se actualiza, y sin esto el celular
      // repetiría el mismo yapeo dos y tres veces seguidas.
      if (esNueva) {
        anunciar(title, body)
        // Y se despierta a Finzo lo justo para registrarlo, sin abrirla. Si
        // Android se niega —cada fabricante aprieta el ahorro de bateria a su
        // manera— lo capturado sigue en el buzon y la app lo recoge al
        // abrirse, igual que antes.
        registrarYa()
      }
    } catch (e: Throwable) {
      // Se ignora a propósito: más vale perder una notificación que dejar el
      // servicio caído para todas las siguientes.
    }
  }

  /**
   * Le pide a Android que despierte a Finzo para registrar lo capturado.
   *
   * Va en su propio try y aparte del guardado: si esto falla, el aviso YA
   * esta en el buzon. Lo peor que puede pasar es que se registre al abrir la
   * app, que es lo que pasaba antes.
   */
  private fun registrarYa() {
    try {
      val intent = Intent(applicationContext, FinzoCaptureService::class.java)
      applicationContext.startService(intent)
      HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
    } catch (e: Throwable) {
      // Android 12 y posteriores pueden negarse a arrancar un servicio desde
      // segundo plano. No es un fallo: el buzon sigue lleno y la app lo
      // vacia al abrirse.
    }
  }

  /**
   * DICE EN VOZ ALTA lo que acaba de llegar.
   *
   * Se lee el texto de la notificación TAL CUAL, sin analizarlo. Yape ya
   * escribe "Te yapearon S/ 50.00 de Juan Pérez": ahí están el nombre y el
   * monto, mejor puestos de lo que los pondría cualquier frase armada por
   * nosotros, y sin riesgo de decir un número equivocado.
   *
   * Va aquí y no en la app porque este servicio corre aunque Finzo esté
   * cerrada. Hecho del otro lado, el aviso llegaría cuando la persona abriera
   * la app —horas después— y ya no serviría de nada.
   */
  private fun anunciar(title: String, body: String) {
    try {
      if (!NotificationStore.isSpeakEnabled(applicationContext)) return

      val texto = if (body.isNotBlank()) body else title
      if (texto.isBlank()) return
      val limpio = sinTildes(texto)

      // NO ES UN MOVIMIENTO: claves, promociones, encuestas.
      //
      // Yape manda "Operación en curso. Hemos generado y autocompletado la
      // clave" pegado a CADA yapeo. La app ya lo descartaba —salía como "No
      // es un movimiento"— pero la voz no lo miraba y lo leía en voz alta.
      if (PALABRAS_A_IGNORAR.any { limpio.contains(it) }) return

      // Y TIENE QUE TRAER UN MONTO.
      //
      // Un movimiento de dinero siempre dice cuánto. Sin esto, cualquier
      // aviso de una app de banco —"tu estado de cuenta ya está listo"— se
      // leería en voz alta. Es la misma condición que usa la app para decidir
      // si registra algo.
      if (!TIENE_MONTO.containsMatchIn(limpio)) return

      // Solo lo que ENTRA, salvo que se pida lo contrario. Que el celular
      // anuncie en voz alta lo que uno acaba de pagar, delante de la cola del
      // supermercado, no lo quiere nadie.
      if (!NotificationStore.isSpeakOutgoing(applicationContext) && !pareceIngreso(texto)) return

      hablar(texto)
    } catch (e: Throwable) {
      // Nunca dejar caer el servicio por no poder hablar.
    }
  }

  /**
   * ¿Es plata que ENTRA?
   *
   * Se mira el texto y no la app: la misma app manda los dos avisos. La lista
   * está en minúsculas y sin tildes porque el texto se compara así.
   */
  private fun pareceIngreso(texto: String): Boolean =
    PALABRAS_DE_INGRESO.any { sinTildes(texto).contains(it) }

  /** Minusculas y sin tildes, que es como estan escritas las listas. */
  private fun sinTildes(texto: String): String =
    texto.lowercase()
      .replace("á", "a").replace("é", "e").replace("í", "i")
      .replace("ó", "o").replace("ú", "u")

  /**
   * El motor de voz de Android.
   *
   * Se crea uno nuevo por cada aviso y se suelta al terminar. Guardarlo
   * dejaría un motor de voz vivo dentro de un servicio del sistema que puede
   * pasar días sin usarse.
   *
   * El texto se pone en cola con el volumen de notificación, no el de
   * multimedia: así respeta el silencio del celular como cualquier otro
   * aviso.
   */
  private fun hablar(texto: String) {
    var motor: TextToSpeech? = null
    motor = TextToSpeech(applicationContext) { estado ->
      try {
        if (estado != TextToSpeech.SUCCESS) {
          motor?.shutdown()
          return@TextToSpeech
        }
        motor?.language = Locale("es", "PE")

        // El aviso de "ya termine" se registra ANTES de hablar. Puesto
        // despues no llega nunca —la frase ya iba en camino— y el motor de
        // voz se quedaria vivo dentro de un servicio del sistema.
        motor?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) {}

          override fun onDone(id: String?) {
            motor?.shutdown()
          }

          @Deprecated("Android lo pide igual", ReplaceWith(""))
          override fun onError(id: String?) {
            motor?.shutdown()
          }
        })

        val params = Bundle().apply {
          putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_NOTIFICATION)
        }
        motor?.speak(texto, TextToSpeech.QUEUE_ADD, params, "finzo-aviso")
      } catch (e: Throwable) {
        motor?.shutdown()
      }
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
    /**
     * Como suena un aviso de plata que ENTRA. Sin tildes: el texto se compara
     * ya normalizado. Cubre Yape, Plin y los avisos de los bancos.
     */
    /**
     * Avisos que NO son un movimiento: claves, promociones, encuestas.
     *
     * Copiada tal cual de NOT_A_MOVEMENT, en utils/notificationParser. La app
     * ya los descartaba, pero la voz no los miraba: leia en voz alta cosas
     * como "Operacion en curso. Hemos generado y autocompletado la clave",
     * que Yape manda pegada a cada yapeo.
     */
    private val PALABRAS_A_IGNORAR = listOf(
      "codigo de verificacion",
      "codigo de seguridad",
      "clave temporal",
      "no compartas",
      "Operación en curso. Hemos generado
  // y autocompletado la clave",
      "operacion en curso",
      "autocompletado la clave",
      "generado y autocompletado",
      "sorteo",
      "promocion",
      "encuesta",
      "preaprobado",
      "pre aprobado",
      "solicita tu"
    )

    /** Un monto: "S/ 20", "S/20.00". Sin monto no hay movimiento. */
    private val TIENE_MONTO = Regex("""s/s?d""")

    private val PALABRAS_DE_INGRESO = listOf(
      "te yapearon",
      "te yapeo",
      "nuevo yapeo",
      "yapeo recibido",
      "te plinearon",
      "te plineo",
      "recibiste",
      "has recibido",
      "pago recibido",
      "abono",
      "abonaron",
      "abonado",
      "deposito",
      "depositaron",
      "te envio",
      "te enviaron",
      "te transfirio",
      "te transfirieron",
      "cobraste"
    )

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
