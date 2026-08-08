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
   * SE ESPERA A QUE EL MOTOR ARRANQUE, hasta seis segundos. Es lo contrario de lo que hace
   * el servicio —que encola y sigue— y aqui es lo correcto: si no se espera, la respuesta
   * seria siempre "ok" sin saber si el motor llego a estar listo, que es justo lo que hay
   * que averiguar.
   *
   * Seis segundos porque arrancar el sistema de voz de Android tarda de dos a cuatro.
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
      if (!arranco.await(6, TimeUnit.SECONDS)) return "sin-motor"
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
   */
  fun ponerEspanol(m: TextToSpeech): Boolean {
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
