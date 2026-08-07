package com.finzo.exportscheduler

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.print.FinzoPrintPuente
import android.print.PrintAttributes
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File

/**
 * Convierte el HTML del reporte en un PDF, SIN PANTALLA.
 *
 * POR QUE HACE FALTA ESTO
 *
 * El PDF de Finzo se dibuja desde HTML, y hasta ahora se hacia con expo-print,
 * que necesita que la app este en pantalla. Por eso la exportacion automatica
 * solo podia hacer Excel y CSV: el PDF era el unico formato que no salia con la
 * app cerrada, y el usuario lo pidio igualado (06/08/2026).
 *
 * SE REUSA EL MISMO HTML, Y ESO ES EL PUNTO
 *
 * El HTML lo arma utils/reportePdfDatos.ts, el mismo que usa la pantalla de
 * exportar a mano. Asi el PDF automatico y el de a mano son el MISMO documento.
 * La alternativa era volver a dibujar el reporte en codigo de Android, y
 * entonces habria dos disenos del mismo papel que se irian separando con cada
 * cambio — el clasico "dos mitades que se desincronizan".
 *
 * TODO ESTO VA EN EL HILO PRINCIPAL
 *
 * Un WebView solo se puede crear y tocar desde el hilo principal de la app,
 * tambien cuando no hay ninguna pantalla. Si se hiciera desde el hilo del
 * trabajo de fondo, Android lanza una excepcion y el reporte se queda sin hacer.
 * De ahi el Handler(Looper.getMainLooper()) de abajo.
 *
 * Y SIN JAVASCRIPT
 *
 * El HTML del reporte es tablas y estilos, nada de codigo. Dejar el JavaScript
 * apagado es una linea menos por donde algo pueda entrar, y ademas hace la
 * conversion mas rapida y predecible.
 *
 * ------------------------------------------------------------------------
 * LO QUE FALLO LA PRIMERA VEZ QUE ESTO CORRIO DE VERDAD (06/08/2026)
 * ------------------------------------------------------------------------
 *
 * El usuario toco "Probar ahora" y el boton se quedo en "Probando..." para
 * siempre. Ni salio el PDF ni salio un error: la conversion NO CONTESTABA.
 *
 * Dos cosas faltaban, y las dos estan arregladas aqui:
 *
 *  1. EL NAVEGADOR NO TENIA TAMANO. Un WebView que no esta metido en ninguna
 *     pantalla mide 0 x 0. Con cero de alto no hay nada que colocar en la hoja,
 *     y el adaptador de impresion se queda esperando un contenido que nunca
 *     llega. Ahora se le da el tamano de una hoja A4 a mano (medir + colocar)
 *     antes de cargar el HTML.
 *
 *  2. NO HABIA NINGUN TOPE DE TIEMPO. Si algo no contesta —esto, o cualquier
 *     otra cosa de aqui dentro— el trabajo se queda esperando y con el la app:
 *     el boton girando y, a la hora fijada, el trabajo de fondo muriendo en
 *     silencio al agotar su tiempo. Un tope convierte "nunca pasa nada" en un
 *     error que se puede leer en pantalla, que es la diferencia entre poder
 *     arreglarlo y adivinar.
 *
 * La leccion, otra vez la misma de este proyecto: no era un calculo mal hecho,
 * era una pieza que solo funciona cuando esta dentro de una pantalla, usada
 * fuera de una pantalla.
 */
object HtmlAPdf {

  /**
   * Espera tras cargar el HTML antes de medir el documento.
   *
   * onPageFinished avisa de que el HTML llego, no de que ya este COLOCADO en la
   * hoja. Midiendo en ese mismo instante salian PDFs de una pagina en blanco o
   * con la tabla cortada. Medio segundo es de sobra para un documento de texto y
   * no se nota en un trabajo que corre solo.
   */
  private const val ESPERA_COLOCADO_MS = 500L

  /**
   * Tope de tiempo para toda la conversion.
   *
   * 30 segundos es muchisimo para armar un PDF de texto —tarda menos de uno— y
   * deja de sobra dentro de los 120 del trabajo de fondo para subir el archivo
   * despues. Lo que importa no es el numero: es que exista.
   */
  private const val TOPE_MS = 30_000L
  private const val TOPE_S = TOPE_MS / 1000

  /**
   * El tamano que se le da al navegador, en puntos de una hoja A4 (72 por
   * pulgada). Es el tamano REAL del papel; el PDF final se dibuja luego a la
   * resolucion que pidan los atributos de impresion, asi que esto no decide la
   * calidad. Solo tiene que no ser cero.
   */
  private const val ANCHO_A4_PT = 595
  private const val ALTO_A4_PT = 842

  fun convertir(
    context: Context,
    html: String,
    destino: String,
    alTerminar: (String?, String?) -> Unit
  ) {
    val principal = Handler(Looper.getMainLooper())
    principal.post {
      // Se contesta UNA sola vez. Sin esto, el tope de tiempo y el resultado de
      // verdad podrian contestar los dos —el segundo hace reventar la promesa de
      // JavaScript— y ademas se tocaria un navegador ya soltado.
      var contestado = false
      var web: WebView? = null

      fun contestar(uri: String?, error: String?) {
        if (contestado) return
        contestado = true
        // Se retira el tope, que ya no hace falta. Solo afecta a lo que ESTE
        // manejador dejo pendiente, no a lo demas de la app.
        principal.removeCallbacksAndMessages(null)
        // Y se suelta el navegador, con un momento de margen: el adaptador de
        // impresion puede estar todavia terminando de tocarlo, y soltarlo en su
        // propia llamada de vuelta hace reventar la app. Uno por reporte
        // quedaria en memoria para siempre.
        web?.let { v -> principal.postDelayed({ v.destroy() }, 250L) }
        web = null
        alTerminar(uri, error)
      }

      principal.postDelayed(
        { contestar(null, "la conversion a PDF no contesto en $TOPE_S segundos") },
        TOPE_MS
      )

      try {
        val v = WebView(context)
        web = v
        v.settings.javaScriptEnabled = false

        // EL TAMANO, ANTES DE CARGAR NADA. Ver la nota de arriba: sin esto mide
        // 0 x 0 y la conversion no contesta nunca.
        val densidad = context.resources.displayMetrics.density
        val ancho = (ANCHO_A4_PT * densidad).toInt()
        val alto = (ALTO_A4_PT * densidad).toInt()
        v.measure(
          View.MeasureSpec.makeMeasureSpec(ancho, View.MeasureSpec.EXACTLY),
          View.MeasureSpec.makeMeasureSpec(alto, View.MeasureSpec.EXACTLY)
        )
        v.layout(0, 0, ancho, alto)

        v.webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView, url: String?) {
            view.postDelayed({
              // Si el tope ya contesto, el navegador esta soltado: tocarlo aqui
              // haria reventar la app.
              if (contestado) return@postDelayed
              escribir(view, destino) { uri, error -> contestar(uri, error) }
            }, ESPERA_COLOCADO_MS)
          }
        }

        // Sin direccion base: el HTML lleva el logo incrustado y no pide nada de
        // internet. Si algun dia pidiera una imagen de fuera, aqui no habria
        // desde donde resolverla — y mejor asi: un reporte no puede depender de
        // que haya senal a las tres de la manana.
        v.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
      } catch (e: Throwable) {
        contestar(null, e.message ?: "no se pudo crear el conversor")
      }
    }
  }

  private fun escribir(
    web: WebView,
    destino: String,
    alTerminar: (String?, String?) -> Unit
  ) {
    try {
      val adaptador = web.createPrintDocumentAdapter("finzo-reporte")
      val atributos = PrintAttributes.Builder()
        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
        // 300 puntos por pulgada: lo mismo que una impresora normal. Menos y el
        // texto se ve borroso al ampliar; mas engorda el archivo sin que se note.
        .setResolution(PrintAttributes.Resolution("finzo", "finzo", 300, 300))
        // Sin margenes propios: el HTML ya trae los suyos. Poniendo los dos, el
        // contenido quedaba metido hacia dentro y se perdia media hoja.
        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
        .build()

      FinzoPrintPuente.medir(adaptador, atributos) { bienMedido, errorMedida ->
        if (!bienMedido) {
          alTerminar(null, "al medir: $errorMedida")
          return@medir
        }
        val archivo = File(destino)
        archivo.parentFile?.mkdirs()
        // Si ya habia uno, se borra antes: escribir encima de un PDF mas largo
        // dejaria el final del anterior pegado al nuevo y el archivo no abriria.
        if (archivo.exists()) archivo.delete()

        val descriptor = ParcelFileDescriptor.open(
          archivo,
          ParcelFileDescriptor.MODE_READ_WRITE or ParcelFileDescriptor.MODE_CREATE
        )
        FinzoPrintPuente.escribir(adaptador, descriptor) { bienEscrito, errorEscritura ->
          try {
            descriptor.close()
          } catch (_: Throwable) {
            // Cerrar puede fallar si Android ya lo cerro. No cambia el resultado.
          }
          if (bienEscrito) alTerminar("file://$destino", null)
          else alTerminar(null, "al escribir: $errorEscritura")
        }
      }
    } catch (e: Throwable) {
      alTerminar(null, e.message ?: "no se pudo convertir a PDF")
    }
  }
}
