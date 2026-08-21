package com.finzo.notificationreader

import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * PROBAR LA VOZ AHORA MISMO, Y DECIR QUE FALTA SI NO SE OYE.
 *
 * POR QUE EXISTE (07/08/2026)
 *
 * Reportado con dos capturas: el servicio decia **Conectado**, el yapeo aparecia
 * **Registrado**, la voz estaba **encendida**... y no se oyo nada. *"No se escucha en voz
 * alta, capaz pueda ser mi celular."*
 *
 * Y tenia razon en sospechar del celular, porque hasta ahora la app no podia distinguir
 * tres situaciones que desde fuera se ven EXACTAMENTE igual —silencio—:
 *
 *   1. La app no intento hablar (eso ya se sabia: el motivo se apunta).
 *   2. Lo intento, pero el celular no tiene ningun sistema de voz instalado.
 *   3. Lo intento, tiene voz, pero **no en espanol**.
 *   4. Todo listo, pero el **volumen de avisos** esta en cero.
 *
 * La 4 es la mas traicionera de todas: el volumen de los avisos va aparte del de la
 * musica, asi que el celular puede "sonar bien" con la musica alta y tener los avisos en
 * cero. La voz habla de verdad y no se oye nada.
 *
 * Esta clase las separa y devuelve un motivo. Es lo unico que convierte "no funciona" en
 * "te falta esto".
 */
object ProbadorDeVoz {

  /** Cuantas veces se le pregunta al motor por el espanol antes de darlo por perdido. */
  private const val INTENTOS_DE_IDIOMA = 6

  /** El volumen del canal de AVISOS, de 0 a 100. */
  fun volumenDeAvisos(context: Context): Int =
    try {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val tope = audio.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION)
      if (tope <= 0) 0 else audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION) * 100 / tope
    } catch (e: Throwable) {
      // Si no se puede saber, se dice que hay volumen: mas vale no acusar al volumen de un
      // problema que puede ser otro.
      100
    }

  /**
   * Dice la frase y devuelve que paso.
   *
   * SE ESPERA A QUE EL MOTOR ARRANQUE, hasta doce segundos. Es lo contrario de lo que hace
   * el servicio —que encola y sigue— y aqui es lo correcto: si no se espera, la respuesta
   * seria siempre "ok" sin saber si el motor llego a estar listo, que es justo lo que hay
   * que averiguar.
   *
   * ERAN SEIS, Y SE QUEDABAN CORTOS (11/08/2026). Le salio "tu celular no tiene voz
   * instalada" al primer toque y a la segunda funciono. No le faltaba nada: el sistema de
   * voz de Android, con el celular recien encendido o tras rato sin usarse, tarda mas de
   * seis segundos en despertar la primera vez. La segunda ya estaba caliente.
   *
   * Decirle a alguien que le falta instalar algo que SI tiene es peor que tardar: se va a
   * los ajustes a buscar lo que no falta.
   *
   * El motor se suelta siempre al terminar: esto es una prueba a mano, no el camino del
   * yapeo, y dejar un motor vivo por cada toque del boton seria un motor por toque.
   */
  fun probar(context: Context, texto: String): String {
    if (volumenDeAvisos(context) == 0) return "sin-volumen"

    var motor: TextToSpeech? = null
    return try {
      val arranco = CountDownLatch(1)
      var estadoDelArranque = TextToSpeech.ERROR
      motor = TextToSpeech(context) { estado ->
        estadoDelArranque = estado
        arranco.countDown()
      }
      if (!arranco.await(12, TimeUnit.SECONDS)) return "sin-motor"
      if (estadoDelArranque != TextToSpeech.SUCCESS) return "sin-motor"

      val m = motor ?: return "sin-motor"
      if (!ponerEspanol(m)) return "sin-espanol"

      val params = Bundle().apply {
        putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_NOTIFICATION)
      }
      m.speak(texto, TextToSpeech.QUEUE_FLUSH, params, "finzo-prueba")

      // Se espera a que acabe de hablar antes de soltar el motor: soltarlo mientras habla
      // corta la frase a la mitad, y entonces la prueba diria "ok" habiendo sonado a medias.
      esperarAQueTermine(m)
      "ok"
    } catch (e: Throwable) {
      "sin-motor"
    } finally {
      try {
        motor?.stop()
        motor?.shutdown()
      } catch (e: Throwable) {
        // Da igual: lo importante es no quedarse con el motor colgando.
      }
    }
  }

  /**
   * Le pone espanol al motor, probando de lo mas concreto a lo mas general.
   *
   * AQUI HABIA UN FALLO DE VERDAD, y es la causa mas probable de que su celular no hablara:
   * el servicio hacia `motor.language = Locale("es", "PE")` **sin mirar el resultado**. Si
   * el celular no tiene la voz de Peru instalada —y casi ninguno la trae— setLanguage
   * devuelve LANG_NOT_SUPPORTED, el idioma se queda como estaba (ingles, normalmente) y
   * `speak` puede no decir nada con un texto en espanol.
   *
   * Ahora se prueba es-PE, luego es-ES, luego "es" a secas, y se mira la respuesta cada vez.
   * Si ninguna vale, se dice —"sin-espanol"— en vez de callar.
   *
   * Y SE REINTENTA, QUE ES EL ARREGLO DEL 11/08/2026.
   *
   * "Se dice que el motor arranco" y "el motor ya sabe que voces tiene" son dos momentos
   * distintos, y entre uno y otro pasan decimas de segundo. Preguntando en ese hueco,
   * setLanguage contesta que no hay espanol aunque lo haya — y como el idioma se ponia UNA
   * sola vez, al arrancar el servicio, ese "no" se quedaba puesto para siempre: la voz
   * hablaba a un motor sin idioma util y no salia sonido. Un yapeo real, en silencio.
   *
   * Es exactamente el sintoma que reporto: el yapeo entro, no sono nada, y al probar la voz a
   * mano la primera vez fallo y la segunda funciono. La segunda funcionaba porque el motor ya
   * estaba caliente.
   *
   * Se pregunta varias veces durante ~1,5 s antes de darlo por perdido.
   */
  fun ponerEspanol(m: TextToSpeech): Boolean {
    repeat(INTENTOS_DE_IDIOMA) { intento ->
      if (intentarEspanol(m)) return true
      // No en el ultimo: esperar despues del ultimo intento no sirve de nada.
      if (intento < INTENTOS_DE_IDIOMA - 1) {
        try {
          Thread.sleep(300)
        } catch (e: InterruptedException) {
          Thread.currentThread().interrupt()
          return false
        }
      }
    }
    return false
  }

  /**
   * ELIGE LA VOZ, NO SOLO EL IDIOMA (21/08/2026).
   *
   * EL FALLO: *"suena algo chillona, como de un nino medio raro"*.
   *
   * `setLanguage` dice QUE IDIOMA, y deja que Android elija CUAL de las voces de ese idioma
   * usar. Casi todos los celulares traen varias —unas descargadas y buenas, otras comprimidas
   * de reserva— y la que elige por su cuenta suele ser la mas pequena, que es justo la que
   * suena metalica y aguda.
   *
   * Aqui se mira la lista y se escoge a mano. Se prefiere, por este orden:
   *   1. La de MEJOR CALIDAD que haya.
   *   2. Que NO necesite internet: una voz de red calla cuando no hay senal, y un yapeo
   *      llega igual sin datos.
   *   3. Que el pais sea de America antes que el de Espana, para que no diga "cincuenta"
   *      con la z castellana a alguien de Peru.
   *
   * Si no se puede elegir —moviles viejos, o el motor todavia no publica sus voces— no pasa
   * nada: se queda la que Android hubiera puesto, que es como estaba antes.
   */
  private fun mejorVozEspanola(m: TextToSpeech): Boolean {
    val voces =
      try {
        m.voices ?: return false
      } catch (e: Throwable) {
        // getVoices revienta en algunos motores mientras arrancan.
        return false
      }

    val espanolas = voces.filter { it.locale?.language == "es" }
    if (espanolas.isEmpty()) return false

    // Puntos por pais: lo de aca arriba, y Espana la ultima de las espanolas.
    fun puntosDePais(pais: String): Int =
      when (pais.uppercase(Locale.ROOT)) {
        "PE" -> 5
        "MX", "US", "419" -> 4
        "CO", "AR", "CL" -> 3
        "" -> 2
        "ES" -> 1
        else -> 2
      }

    val elegida =
      espanolas.maxByOrNull { v ->
        val calidad = try { v.quality } catch (e: Throwable) { 0 }
        val red = try { v.isNetworkConnectionRequired } catch (e: Throwable) { false }
        val pais = try { v.locale?.country ?: "" } catch (e: Throwable) { "" }
        // La calidad manda; no depender de internet vale mucho; el pais desempata.
        calidad * 100 + (if (red) 0 else 50) + puntosDePais(pais)
      } ?: return false

    return try {
      m.voice = elegida
      true
    } catch (e: Throwable) {
      false
    }
  }

  /** Una pasada por los tres idiomas, sin esperar. */
  private fun intentarEspanol(m: TextToSpeech): Boolean {
    for (idioma in listOf(Locale("es", "PE"), Locale("es", "ES"), Locale("es"))) {
      val resultado =
        try {
          m.setLanguage(idioma)
        } catch (e: Throwable) {
          TextToSpeech.LANG_NOT_SUPPORTED
        }
      if (resultado == TextToSpeech.LANG_AVAILABLE ||
        resultado == TextToSpeech.LANG_COUNTRY_AVAILABLE ||
        resultado == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE
      ) {
        /* EL TONO, PUESTO A MANO. Un motor puede venir con el tono o la velocidad cambiados
           por otra app —los lectores de pantalla los tocan— y eso se queda pegado al motor,
           no a quien lo cambio. Ponerlos aqui garantiza que Fino suene siempre igual. */
        try {
          m.setPitch(1.0f)
          m.setSpeechRate(1.0f)
        } catch (e: Throwable) {
          // Si no se puede, se habla igual con lo que haya.
        }
        mejorVozEspanola(m)
        return true
      }
    }
    return false
  }

  /** Espera a que el motor deje de hablar, con un tope para no colgarse nunca. */
  private fun esperarAQueTermine(m: TextToSpeech) {
    val hasta = System.currentTimeMillis() + 6000
    while (System.currentTimeMillis() < hasta) {
      val hablando =
        try {
          m.isSpeaking
        } catch (e: Throwable) {
          false
        }
      if (!hablando) {
        // Un momento de margen: isSpeaking puede decir "no" justo antes de empezar.
        Thread.sleep(250)
        val sigue =
          try {
            m.isSpeaking
          } catch (e: Throwable) {
            false
          }
        if (!sigue) return
      }
      Thread.sleep(150)
    }
  }
}
