package com.finzo.notificationreader

import android.app.Notification
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
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

  // ---- La voz ----
  //
  // UN SOLO motor, compartido y reutilizado. Antes se creaba uno nuevo por
  // cada aviso; como cada motor tiene su propia cola, dos yapes seguidos
  // hablaban A LA VEZ y no se entendia ninguno. En un negocio, con varios
  // yapes en un minuto, eso es ruido.
  //
  // Y TODO ESTO EN SU PROPIO HILO, NO EN EL PRINCIPAL.
  //
  // Estaba en el hilo principal, que es el mismo donde Android dibuja y donde
  // Finzo se despierta para registrar el yapeo. Al llegar un yape pasan las
  // dos cosas a la vez, y hablar se ponia EN LA COLA detras de todo ese
  // trabajo: la notificacion aparecia y la voz llegaba segundos despues.
  //
  // La voz no tiene nada que ver con la pantalla, asi que no tiene por que
  // esperar a la pantalla. Con su propio hilo sale en cuanto llega el aviso,
  // sin importar lo ocupada que este la app.
  //
  // Sigue habiendo UN solo hilo para la voz —no uno por aviso— porque la cola
  // se toca desde varios sitios y dos a la vez la romperian.
  private val hiloVoz = HandlerThread("finzo-voz").apply { start() }
  private val mano = Handler(hiloVoz.looper)
  private var motor: TextToSpeech? = null
  private var vozLista = false

  /**
   * ¿El motor tiene un espanol utilizable puesto?
   *
   * Aparte de `vozLista` a proposito. El motor puede haber arrancado bien —vozLista— y no
   * tener idioma, y en ese caso hablar no suena. Antes esas dos cosas iban juntas: se
   * apuntaba "sin-espanol" y se seguia adelante como si nada, asi que la voz le hablaba a un
   * motor que no podia decir nada. Ver el reintento en vaciarCola.
   */
  private var idiomaListo = false
  private val porDecir = ArrayDeque<String>()

  /**
   * CUANTAS VECES SE VUELVE A ENCENDER EL MOTOR ANTES DE RENDIRSE.
   *
   * El motor de voz de Android es un servicio aparte y el sistema lo puede matar cuando le
   * hace falta memoria — pasa con el celular lleno de apps abiertas. Cuando eso ocurre, el
   * motor que Finzo tiene guardado queda inservible: acepta ordenes y no suena nada.
   *
   * Rendirse al primer fallo dejaria la voz muda hasta reiniciar el celular. Insistir sin
   * limite gastaria bateria dando vueltas si de verdad no hay voz instalada. Tres es el
   * termino medio, y el contador se pone a cero en cuanto se habla bien una vez.
   */
  private var reencendidos = 0

  /**
   * El aviso que se dijo bien la ultima vez ya no cuenta para el limite de arriba.
   *
   * Sin esto, tres fallos repartidos a lo largo de un mes agotarian los reintentos y la voz
   * se quedaria muda para siempre sin que nadie entendiera por que.
   */
  private var hablaronBien = false

  /**
   * EL VIGILANTE DEL ARRANQUE.
   *
   * Android promete llamar de vuelta cuando el motor esta listo, y a veces no llama: el
   * servicio de voz se cuelga, o el sistema lo mata mientras arranca. El motor quedaba creado
   * pero nunca listo, y como prepararVoz se corta en seco cuando ya hay uno, no se volvia a
   * intentar JAMAS. Voz muda para siempre, sin un solo error por ningun lado.
   */
  private val vigilarArranque = Runnable {
    if (!vozLista) {
      anotarVoz("motor-no-arranco")
      reencender()
    }
  }

  // Android avisa por aquí cuando de verdad engancha el servicio. Dar el
  // permiso y que el servicio esté CONECTADO son dos cosas distintas: el
  // permiso puede estar dado y el servicio caído (pasa sobre todo después
  // de actualizar la app). Sin anotarlo, esa diferencia era invisible.
  override fun onListenerConnected() {
    try {
      NotificationStore.setConnected(applicationContext, true)

      // EL MOTOR DE VOZ, LISTO DESDE YA.
      //
      // Arrancarlo tarda 2 a 4 segundos: es el sistema de voz de Android
      // despertandose y cargando el idioma, no Finzo pensando. Si se espera al
      // primer yapeo, esa espera se oye — la notificacion aparece y la voz
      // llega despues.
      //
      // Encendiendolo aqui, en cuanto Android engancha el servicio, ya esta
      // caliente cuando llega el primer yapeo del dia.
      if (NotificationStore.isSpeakEnabled(applicationContext)) {
        mano.post { prepararVoz() }
      }
    } catch (e: Throwable) {
      // Nunca dejar que el servicio del sistema se caiga por esto.
    }
  }

  // Android tira el servicio: no dejar un motor de voz ni un hilo colgando.
  override fun onDestroy() {
    try {
      soltarVoz()
      hiloVoz.quitSafely()
    } catch (e: Throwable) {
      // Nunca estorbar el cierre del servicio.
    }
    super.onDestroy()
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

        // Y SE REGISTRA. Por el camino más corto que haya en este momento.
        //
        // Si la app está abierta y escuchando, se le avisa y lo registra ella
        // AL INSTANTE. Antes no se le decía nada: la app preguntaba sola cada
        // ocho segundos, así que con la pantalla delante el movimiento
        // tardaba en salir y parecía que no se había registrado.
        //
        // Si no hay nadie escuchando —la app cerrada— se despierta el trabajo
        // de fondo, como hasta ahora. Y si Android se niega a despertarlo
        // —cada fabricante aprieta el ahorro de batería a su manera— lo
        // capturado sigue en el buzón y la app lo recoge al abrirse.
        //
        // Nunca los dos: el buzón se vacía de una sola vez, así que quien
        // llegue primero se lo lleva, pero avisar por los dos lados sería
        // despertar un proceso para nada.
        if (!NotificationReaderModule.avisarDeCaptura()) {
          registrarYa()
        }
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
      if (!NotificationStore.isSpeakEnabled(applicationContext)) {
        anotarVoz("apagado")
        return
      }

      val texto = if (body.isNotBlank()) body else title
      if (texto.isBlank()) {
        anotarVoz("sin-texto")
        return
      }
      val limpio = normalizar(texto)

      // NO ES UN MOVIMIENTO: claves, promociones, encuestas.
      //
      // Yape manda "Operación en curso. Hemos generado y autocompletado la
      // clave" pegado a CADA yapeo. La app ya lo descartaba —salía como "No
      // es un movimiento"— pero la voz no lo miraba y lo leía en voz alta.
      if (PALABRAS_A_IGNORAR.any { limpio.contains(it) }) {
        anotarVoz("no-es-movimiento")
        return
      }

      // Y TIENE QUE TRAER UN MONTO.
      //
      // Un movimiento de dinero siempre dice cuánto. Sin esto, cualquier
      // aviso de una app de banco —"tu estado de cuenta ya está listo"— se
      // leería en voz alta.
      if (!TIENE_MONTO.containsMatchIn(limpio)) {
        anotarVoz("sin-monto")
        return
      }

      // Y TIENE QUE DECIR SI EL DINERO ENTRA O SALE.
      //
      // AQUI ESTABA EL FALLO DE LA PUBLICIDAD DE YAPE (07/08/2026). Le llego esto y el
      // celular lo leyo en voz alta: *"sin dinero? solicita tu prestamo por S/ 2000
      // preaprobados, pagalo en 6 cuotas"*. Un anuncio, no un movimiento.
      //
      // Y era el fallo tipico de este proyecto: DOS MITADES QUE POR SEPARADO ESTAN BIEN Y
      // EL FALLO EN LA COSTURA. El interprete de la app ya lo rechazaba —exige que el
      // aviso diga si el dinero entra o sale, y si no lo dice devuelve "noDirection"—.
      // Pero la voz no miraba eso: le bastaba que hubiera un monto. Y un anuncio de
      // prestamo lleva monto de sobra.
      //
      // Peor todavia con "leer tambien las salidas" activado: ahi la unica comprobacion
      // que quedaba era la del monto, asi que CUALQUIER aviso de Yape con una cifra se
      // leia en voz alta. El ajuste solo debe ensanchar la regla a las salidas de verdad,
      // nunca apagarla.
      //
      // Ahora se pide lo mismo que pide el interprete: una direccion reconocida. Un
      // anuncio no dice "te envio" ni "pagaste", asi que se queda callado.
      val entra = pareceIngreso(limpio)
      val sale = pareceSalida(limpio)
      if (!entra && !sale) {
        anotarVoz("sin-direccion")
        return
      }

      // Y de las dos, solo lo que ENTRA salvo que se pida lo contrario. Que el celular
      // anuncie en voz alta lo que uno acaba de pagar, delante de la cola del
      // supermercado, no lo quiere nadie.
      if (!entra && !NotificationStore.isSpeakOutgoing(applicationContext)) {
        anotarVoz("es-salida")
        return
      }

      // "EN COLA", NO "HABLO".
      //
      // Aqui la frase todavia no ha sonado: solo se ha decidido que hay que decirla. El "hablo"
      // lo pone el propio motor cuando EMPIEZA a hablar (ver escucharAlMotor), y si nunca
      // empieza, en la pantalla se queda "en-cola" — que es la verdad y ademas apunta al sitio
      // correcto. Antes se apuntaba "hablo" aqui mismo, asi que el diagnostico juraba que
      // habia hablado con el celular mudo.
      anotarVoz("en-cola")
      // EL SIMBOLO DE LA MONEDA, CAMBIADO POR SU PALABRA.
      //
      // Yape escribe "S/ 1" y el celular pronunciaba "ese ene uno": un simbolo no es una
      // palabra. Se hace aqui, sobre el texto que se va a decir, y NO sobre el que se guarda:
      // en el registro tiene que quedar el aviso tal como llego.
      hablar(MonedaEnVoz.conPalabras(texto, NotificationStore.moneda(applicationContext)))
    } catch (e: Throwable) {
      // Nunca dejar caer el servicio por no poder hablar.
      anotarVoz("error")
    }
  }

  /**
   * Deja anotado POR QUÉ se hablo o no.
   *
   * Costo un dia entero averiguar por que la voz callaba con un yapeo real:
   * desde fuera, "no dijo nada" se ve igual esté apagada, no reconozca el
   * monto, o crea que es un pago tuyo. Ahora la pantalla lo dice.
   *
   * Se guarda solo el MOTIVO, nunca el texto del aviso.
   */
  private fun anotarVoz(motivo: String) {
    try {
      NotificationStore.noteSpeak(applicationContext, motivo)
    } catch (e: Throwable) {
      // Un diagnostico nunca puede tumbar el servicio.
    }
  }

  /**
   * ¿Es plata que ENTRA?
   *
   * Se mira el texto y no la app: la misma app manda los dos avisos. Recibe
   * el texto YA normalizado, que es como estan escritas las listas.
   */
  private fun pareceIngreso(limpio: String): Boolean =
    PALABRAS_DE_INGRESO.any { limpio.contains(it) }

  /** Como suena un aviso de plata que SALE. Ver PALABRAS_DE_SALIDA. */
  private fun pareceSalida(limpio: String): Boolean =
    PALABRAS_DE_SALIDA.any { limpio.contains(it) }

  /**
   * Minusculas, sin tildes y con los espacios RAROS convertidos en normales.
   *
   * Lo de los espacios no es un detalle: Yape escribe el monto con un espacio
   * "duro" (el que impide que "S/" y el numero se partan en dos lineas). Se
   * ve igual que un espacio normal, pero para Kotlin NO lo es, y por eso la
   * voz se quedo muda con un yapeo de verdad. Aqui se igualan todos antes de
   * comparar nada.
   */
  private fun normalizar(texto: String): String =
    texto.lowercase()
      .replace("á", "a").replace("é", "e").replace("í", "i")
      .replace("ó", "o").replace("ú", "u")
      .replace(ESPACIOS, " ")
      .trim()

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
    mano.post {
      try {
        // LA COLA TIENE TOPE.
        //
        // Si el motor no llegara a arrancar nunca, cada yapeo iria dejando su frase aqui y la
        // lista creceria sin fin dentro de un servicio del sistema que puede pasar dias
        // encendido. Con tope, lo peor que pasa es perder los avisos mas viejos — que a esas
        // alturas ya no le sirven a nadie: nadie quiere oir a las ocho de la noche el yapeo de
        // las nueve de la mañana.
        while (porDecir.size >= MAX_EN_COLA) porDecir.removeFirst()
        porDecir.add(texto)

        // EL VOLUMEN, ANOTADO ANTES DE HABLAR.
        //
        // El canal de avisos va aparte del de la musica: el celular puede "sonar bien" con la
        // musica alta y tener los avisos en cero. La voz habla de verdad y no se oye nada, y
        // desde fuera se ve igual que un fallo del motor. Se deja apuntado para que la
        // pantalla de diagnostico señale al volumen y no al motor. NO se corta por esto: puede
        // haber un auricular conectado con su propio volumen.
        if (ProbadorDeVoz.volumenDeAvisos(applicationContext) == 0) anotarVoz("sin-volumen")

        // Si el motor ya esta caliente —lo normal— se dice AHORA. Si no, se
        // enciende y la frase espera en la cola hasta que termine de arrancar.
        if (vozLista) vaciarCola() else prepararVoz()
      } catch (e: Throwable) {
        anotarVoz("error-al-hablar")
        reencender()
      }
    }
  }

  /**
   * Enciende el motor de voz si no lo estaba. **Y no lo apaga nunca.**
   *
   * Antes se apagaba tras un minuto sin usarse. Eso hacia que el primer yapeo
   * despues de un rato tardara 2 a 4 segundos en sonar: lo que tarda el
   * sistema de voz de Android en despertar. Por decision del usuario el
   * 02/08/2026 se quita ese limite — quiere que hable en el momento, siempre.
   *
   * Lo que cuesta: un motor de voz despierto gasta algo de bateria y memoria.
   * Se suelta al destruirse el servicio.
   *
   * Siempre desde el hilo principal.
   */
  private fun prepararVoz() {
    if (motor != null) return

    // EL VIGILANTE DEL ARRANQUE.
    //
    // Android promete llamar de vuelta cuando el motor esta listo, y a veces no llama: el
    // servicio de voz se cuelga, o el sistema lo mata mientras arranca. En ese caso el motor
    // quedaba creado pero nunca listo, y como prepararVoz se corta en seco cuando ya hay un
    // motor, NO SE VOLVIA A INTENTAR JAMAS. La voz muda para siempre, sin ningun error.
    //
    // Si a los veinte segundos no ha arrancado, se tira y se enciende otro. Veinte porque
    // arrancar tarda de dos a cuatro, y hasta doce con el celular recien encendido.
    mano.postDelayed(vigilarArranque, 20000)

    motor = TextToSpeech(applicationContext) { estado ->
      mano.post {
        mano.removeCallbacks(vigilarArranque)
        if (estado == TextToSpeech.SUCCESS) {
          // EL IDIOMA, PROBANDO DE LO CONCRETO A LO GENERAL. AQUI HABIA UN FALLO.
          //
          // Antes era `motor?.language = Locale("es", "PE")` a secas, SIN MIRAR EL
          // RESULTADO. Y casi ningun celular trae la voz de Peru instalada: en ese caso
          // Android devuelve "no soportado", el idioma se queda como estaba —ingles, casi
          // siempre— y una frase en espanol puede no sonar. La app creia haber hablado.
          //
          // Es la causa mas probable de lo reportado el 07/08/2026: servicio conectado,
          // yapeo registrado, voz encendida, y silencio. Ver ProbadorDeVoz.ponerEspanol,
          // que es la misma prueba y por eso vive en un solo sitio.
          //
          // Si no hay espanol de ninguna clase se deja anotado en vez de callar: asi la
          // pantalla puede decir que falta instalar la voz.
          val m = motor ?: return@post
          idiomaListo = ProbadorDeVoz.ponerEspanol(m)
          if (!idiomaListo) anotarVoz("sin-espanol")
          escucharAlMotor(m)
          vozLista = true
          vaciarCola()
        } else {
          anotarVoz("sin-motor")
          reencender()
        }
      }
    }
  }

  /**
   * Suelta en el motor todo lo que haya esperando, EN ORDEN y una detras de
   * otra.
   *
   * QUEUE_ADD encola dentro de ESTE motor. Por eso hay uno solo y se reutiliza:
   * antes se creaba uno nuevo por cada aviso, y como cada motor tiene su
   * propia cola, cinco yapes seguidos hablaban los cinco A LA VEZ. En un
   * negocio con varios yapes en un minuto no se entendia ninguno.
   */
  private fun vaciarCola() {
    val m = motor ?: return

    // SI AL ARRANCAR NO HABIA ESPANOL, SE VUELVE A INTENTAR AHORA (11/08/2026).
    //
    // El idioma se ponia UNA sola vez, al encender el motor — que es cuando el motor esta mas
    // frio y peor contesta. Un "no hay espanol" en ese instante se quedaba puesto para
    // siempre, porque este motor no se suelta nunca: la voz seguia hablandole a un motor sin
    // idioma util, y no salia sonido. Un yapeo real, en silencio, con todo lo demas en verde.
    //
    // Aqui el motor lleva rato despierto y contesta bien. Es el momento correcto para
    // preguntar otra vez.
    if (!idiomaListo) {
      idiomaListo = ProbadorDeVoz.ponerEspanol(m)
      if (!idiomaListo) anotarVoz("sin-espanol")
    }

    val params = Bundle().apply {
      putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_NOTIFICATION)
    }
    while (porDecir.isNotEmpty()) {
      val frase = porDecir.removeFirst()
      val resultado =
        try {
          m.speak(frase, TextToSpeech.QUEUE_ADD, params, "finzo-" + System.nanoTime())
        } catch (e: Throwable) {
          TextToSpeech.ERROR
        }

      // SE MIRA SI EL MOTOR ACEPTO LA FRASE, que hasta hoy no se miraba.
      //
      // El registro decia "hablo" en cuanto se mandaba el texto, hubiera sonado o no. Asi que
      // la pantalla de diagnostico —la que existe justo para esto— afirmaba que si habia
      // hablado mientras el celular estaba mudo. Un diagnostico que miente es peor que no
      // tener ninguno: manda a buscar el fallo donde no esta.
      if (resultado != TextToSpeech.SUCCESS) {
        anotarVoz("no-sono")
        // Se devuelve la frase a la cola y se enciende un motor nuevo. Antes se tiraba el
        // motor Y la frase: el yapeo se perdia para siempre aunque el motor nuevo funcionara
        // perfectamente. Ahora el aviso se dice con el motor de repuesto.
        porDecir.addFirst(frase)
        reencender()
        return
      }
    }
  }

  /**
   * SE ENTERA DE SI LA FRASE SONO DE VERDAD, y no solo de si se mando.
   *
   * Que `speak` devuelva SUCCESS significa "acepto el encargo", no "se oyo". Entre una cosa y
   * otra el motor puede morirse, quedarse sin la voz descargada o fallar por dentro, y ahi la
   * app se quedaba tan tranquila creyendo que habia hablado.
   *
   * Con esto, "hablo" se apunta cuando el motor EMPIEZA a hablar de verdad, no cuando se le
   * manda el texto. Es la diferencia entre un diagnostico que ayuda y uno que despista.
   */
  private fun escucharAlMotor(m: TextToSpeech) {
    try {
      m.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
          mano.post {
            anotarVoz("hablo")
            // Sono: el motor esta sano y los reintentos vuelven a estar disponibles enteros
            // para la proxima vez que se estropee, dentro de un mes o de un año.
            hablaronBien = true
            reencendidos = 0
          }
        }

        override fun onDone(utteranceId: String?) {}

        @Deprecated("Android la pide igual", ReplaceWith(""))
        override fun onError(utteranceId: String?) {
          mano.post {
            anotarVoz("no-sono")
            reencender()
          }
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
          mano.post {
            anotarVoz("no-sono")
            reencender()
          }
        }
      })
    } catch (e: Throwable) {
      // Sin el aviso de vuelta se sigue hablando igual: solo se pierde el diagnostico fino.
    }
  }

  /**
   * Tira el motor y enciende otro, SIN PERDER lo que estaba por decir.
   *
   * Es la diferencia entre "esta vez no sono" y "ya no vuelve a sonar". El motor de voz es un
   * servicio aparte que el sistema puede matar cuando le hace falta memoria; cuando pasa, el
   * que Finzo tiene guardado acepta ordenes y no suena nada. Sin volver a encenderlo, la voz
   * queda muda hasta reiniciar el celular.
   *
   * Con tope de intentos: si de verdad no hay voz instalada, insistir sin parar solo gastaria
   * bateria. El contador se pone a cero en cuanto se habla bien una vez, asi que unos fallos
   * sueltos repartidos en meses no dejan la voz apagada para siempre.
   */
  private fun reencender() {
    val pendientes = ArrayList(porDecir)
    soltarVoz()
    if (reencendidos >= MAX_REENCENDIDOS && !hablaronBien) {
      anotarVoz("motor-no-arranca")
      return
    }
    reencendidos++
    hablaronBien = false
    porDecir.addAll(pendientes)
    prepararVoz()
  }

  /** Apaga el motor y tira lo que quedara sin decir. */
  private fun soltarVoz() {
    mano.removeCallbacks(vigilarArranque)
    try {
      motor?.shutdown()
    } catch (e: Throwable) {
      // Da igual: lo importante es no quedarse con la referencia.
    }
    motor = null
    vozLista = false
    idiomaListo = false
    porDecir.clear()
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
     * Cuantas frases como mucho esperan a que arranque el motor.
     *
     * Sin tope, un motor que no arrancara nunca iria acumulando una frase por yapeo dentro de
     * un servicio del sistema que puede pasar dias encendido.
     */
    private const val MAX_EN_COLA = 20

    /** Cuantas veces se enciende un motor nuevo antes de rendirse. Ver reencender(). */
    private const val MAX_REENCENDIDOS = 3

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
      // Yape manda esto pegado a CADA yapeo: "Operación en curso. Hemos
      // generado y autocompletado la clave".
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

    /**
     * TODO lo que se ve como un espacio pero no lo es.
     *
     * El espacio "duro" ( ) es el que usan las apps para que "S/" y el
     * numero no se partan en dos lineas. En JavaScript cuenta como espacio;
     * en Kotlin NO. Por esa unica diferencia el registro reconocia el yapeo y
     * la voz se quedaba muda con el mismo texto.
     *
     * Se pasan todos a un espacio normal —y varios seguidos a uno solo—
     * antes de comparar.
     */
    private val ESPACIOS =
      Regex("[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+")

    /**
     * Un monto: "S/ 20", "S/20.00", "S/. 1,250.50", "S / 20" o "PEN 20".
     *
     * Es el mismo criterio que usa findAmount en utils/notificationParser, y
     * se escribe igual de ancho A PROPOSITO. La version anterior —"s/" pegado
     * y un solo espacio— era mas estrecha que la de JavaScript, y esa
     * diferencia es justo la que dejo la voz muda: la app registraba el
     * yapeo y el celular no decia nada.
     *
     * El texto llega ya normalizado, por eso "s/" y no "S/".
     *
     * ACEPTA LAS NUEVE MONEDAS DE LA APP, no solo los soles (11/08/2026).
     *
     * Salio de una pregunta suya al añadir Bolivia: *"si me pongo la moneda en Bolivia, ¿el
     * yape llegara igual pero en bolivianos?"*. No: con "Bs 50" esta regla decia que no habia
     * monto y **la voz no hablaba nunca**. La app ofrecia nueve monedas desde hacia meses y el
     * lector de avisos entendia una.
     *
     * El orden va de mas largo a mas corto a proposito: "us$" tiene que probarse antes que
     * "$", o "us$ 20" se leeria como un "$" suelto con una "us" colgando delante.
     *
     * Y las que son letras —"pen", "bs"— llevan limite de palabra, o "pendiente" y "pensión"
     * pasarian por montos. Los simbolos que no son letras no lo llevan: entre dos caracteres
     * no alfabeticos, \b no casa nunca.
     *
     * TIENE QUE DECIR LO MISMO QUE utils/simbolosDeMoneda. Hay una prueba que lo comprueba:
     * si las dos se separan, la app registra el movimiento y el celular se queda callado — o
     * al reves, que es peor.
     */
    private val TIENE_MONTO =
      Regex("(?:col\\$|us\\$|mx\\$|ar\\$|cl\\$|\\bpen|s\\s*/\\s*\\.?|\\bbs\\.?|r\\$|€|\\$)\\s*\\d")

    /**
     * Como suena un aviso de plata que ENTRA. Copiada tal cual de
     * INCOME_HINTS, en utils/notificationParser: escribirla a mano fue lo que
     * dejo la voz muda con los yapes, por faltarle "te envio".
     */
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

    /**
     * Como suena un aviso de plata que SALE. Copiada tal cual de EXPENSE_HINTS, en
     * utils/notificationParser.
     *
     * SE COPIA, NO SE ESCRIBE A MANO. Ya paso una vez con la lista de entradas: se
     * escribio "segun como suenan" los avisos, le faltaba "te envio", y la voz se quedaba
     * muda con los yapes de verdad mientras la app SI los registraba. Un fallo que desde
     * fuera parecia del microfono, del volumen o del celular.
     *
     * Hace falta desde el 07/08/2026, cuando la voz empezo a exigir una direccion: sin
     * esta lista, "leer tambien las salidas" no tendria con que reconocer una salida y
     * dejaria muda justamente la opcion que se pidio activar.
     */
    private val PALABRAS_DE_SALIDA = listOf(
      "yapeaste",
      "yapeo enviado",
      "plineaste",
      "pagaste",
      "pago exitoso",
      "pago realizado",
      "pago procesado",
      "compra",
      "consumo",
      "consumiste",
      "cargo",
      "debito",
      "retiro",
      "retiraste",
      "enviaste",
      "transferiste",
      "transferencia enviada"
    )

    /**
     * SOLO YAPE, por decision del usuario el 02/08/2026.
     *
     * Antes estaban tambien Plin, BCP, Interbank, BBVA, Scotiabank, BanBif,
     * Pichincha, Banco de la Nacion, cajas, Mibanco, Ripley, Falabella,
     * Tunki, Izipay y Niubiz. Ninguno se llego a probar con un movimiento de
     * verdad: las palabras estaban escritas segun como SUELEN redactar sus
     * avisos, no segun uno real.
     *
     * Y mientras tanto molestaban. El aviso de Scotiabank "Operacion en
     * curso. Hemos generado y autocompletado la clave" se capturaba, se
     * guardaba y salia en la pantalla de diagnostico — un aviso de seguridad
     * de un banco que Finzo no necesita ni mirar.
     *
     * Mejor una app que funciona con la que se usa que quince a medias. Para
     * volver a meter uno hace falta un aviso REAL suyo: se agrega su paquete
     * aqui y en APPS_ACEPTADAS de utils/notificationParser, y se comprueba que
     * sus palabras esten en las listas de entradas y salidas.
     *
     * "yape" tambien cubre "com.bcp.innovacxion.yapeapp", que es el paquete
     * de verdad de la app.
     */
    private val MONEY_APP_HINTS = listOf("yape")
  }
}
