package com.finzo.exportscheduler

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.print.FinzoPrintPuente
import android.print.PrintAttributes
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File

/**
 * Convierte el HTML del reporte en un PDF, SIN PANTALLA.
 *
 * POR QUE HACE FALTA ESTO
 *
 * El PDF de Fino se dibuja desde HTML, y a mano se hace con expo-print, que
 * necesita que la app este en pantalla. Por eso la exportacion automatica solo
 * podia hacer Excel y CSV: el PDF era el unico formato que no salia con la app
 * cerrada, y el usuario lo pidio igualado (06/08/2026).
 *
 * SE REUSA EL MISMO HTML, Y ESO ES EL PUNTO
 *
 * El HTML lo arma utils/reportePdfDatos.ts, el mismo que usa la pantalla de
 * exportar a mano. Asi el PDF automatico y el de a mano son el MISMO documento.
 * La alternativa era volver a dibujar el reporte en codigo de Android, y
 * entonces habria dos disenos del mismo papel que se irian separando con cada
 * cambio — el clasico "dos mitades que se desincronizan".
 *
 * ------------------------------------------------------------------------
 * ESTO SE ESCRIBIO TRES VECES. LO QUE FALLO Y LO QUE LO ARREGLO
 * ------------------------------------------------------------------------
 *
 * Las dos primeras versiones se COLGABAN: el usuario tocaba "Probar ahora" y el
 * boton giraba sin fin. Ni PDF ni error. A la hora fijada pasaba lo mismo sin
 * que se viera, porque Android mataba el trabajo en silencio al agotar su tiempo.
 *
 *  1er intento: pedir la medida del documento y ESPERAR la respuesta antes de
 *     escribir. Es lo natural, y es lo que colgaba.
 *  2do intento: darle al navegador el tamano de una hoja A4 a mano, creyendo que
 *     medir 0 x 0 era la causa. No lo era; siguio colgado exactamente igual (con
 *     el tope ya puesto, el mensaje fue "no contesto en 30 segundos").
 *  3ro, el que funciona: NO esperar la respuesta de la medida. Ver la nota larga
 *     en FinzoPrintPuente.medirSinEsperar.
 *
 * COMO SE ENCONTRO: leyendo expo-print, que es lo que esta misma app usa para el
 * PDF de a mano y funciona en este mismo celular. Hace exactamente esto — pide la
 * medida con una respuesta que nadie escucha y pasa derecho a escribir.
 *
 * > Cuando algo de Android ya funciona en esta app, la primera fuente que hay que
 * > leer es ESO, no la documentacion ni la intuicion. Dos entregas perdidas por
 * > no empezar por ahi.
 *
 * Y por eso este archivo se pega ahora a expo-print a proposito: mismo orden,
 * mismos atributos de papel, misma forma de cargar el HTML. Cada diferencia es un
 * sitio donde uno puede funcionar y el otro no.
 *
 * TODO ESTO VA EN EL HILO PRINCIPAL
 *
 * Un WebView solo se puede crear y tocar desde el hilo principal de la app,
 * tambien cuando no hay ninguna pantalla. Si se hiciera desde el hilo del
 * trabajo de fondo, Android lanza una excepcion y el reporte se queda sin hacer.
 * De ahi el Handler(Looper.getMainLooper()) de abajo.
 */
object HtmlAPdf {

  /**
   * Tope de tiempo para toda la conversion.
   *
   * Ya no deberia hacer falta, y se queda igual: es lo que convirtio "el boton
   * gira para siempre" en un mensaje que se podia leer, y sin ese mensaje este
   * fallo seguiria sin encontrarse. Un trabajo de fondo colgado no avisa de nada.
   *
   * 30 segundos es muchisimo para un PDF de texto —tarda menos de uno— y deja de
   * sobra dentro de los 120 del trabajo de fondo para subir el archivo despues.
   */
  private const val TOPE_MS = 30_000L
  private const val TOPE_S = TOPE_MS / 1000

  /**
   * EL MISMO PAPEL QUE EL PDF DE A MANO, y no es un detalle.
   *
   * La pantalla de exportar llama a expo-print sin decirle tamano, asi que
   * expo-print usa su valor por defecto: 612 x 792 puntos a 72 por pulgada, o
   * sea hoja Carta. Aqui habia A4 a 300 puntos por pulgada.
   *
   * Con eso, el reporte automatico y el de a mano habrian salido en hojas de
   * distinto tamano y con los saltos de pagina en otro sitio — dos documentos
   * distintos con el mismo nombre, que es justo lo que este modulo existe para
   * evitar. Los milesimos de pulgada salen de la misma cuenta que hace expo-print
   * (puntos / 0,072).
   */
  private const val ANCHO_MILS = 8500
  private const val ALTO_MILS = 11000
  private const val PUNTOS_POR_PULGADA = 72

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
      // Hasta donde se llego, para que el tope diga algo util si vuelve a saltar.
      // Sin esto el mensaje era "no contesto" y no decia donde se atasco.
      var etapa = "cargando el HTML"

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
        { contestar(null, "la conversion a PDF no contesto en $TOPE_S segundos ($etapa)") },
        TOPE_MS
      )

      try {
        val v = WebView(context)
        web = v
        // Igual que expo-print. El HTML del reporte lleva tildes y el simbolo de
        // soles; sin declarar la codificacion en los dos sitios, salen partidas.
        v.settings.defaultTextEncodingName = "UTF-8"
        // Y sin JavaScript. Es el valor por defecto de Android, y se escribe
        // igual: el HTML del reporte es tablas y estilos, nada de codigo, asi que
        // dejarlo dicho es una linea menos por donde algo pueda entrar el dia que
        // el reporte incluya algo que venga de fuera.
        v.settings.javaScriptEnabled = false
        v.webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView, url: String?) {
            if (contestado) return
            escribir(view, destino, { e -> etapa = e }) { uri, error -> contestar(uri, error) }
          }
        }
        // Sin direccion base: el HTML lleva el logo incrustado y no pide nada de
        // internet. Si algun dia pidiera una imagen de fuera, aqui no habria
        // desde donde resolverla — y mejor asi: un reporte no puede depender de
        // que haya senal a las tres de la manana.
        v.loadDataWithBaseURL(null, html, "text/html; charset=utf-8", "UTF-8", null)
      } catch (e: Throwable) {
        contestar(null, e.message ?: "no se pudo crear el conversor")
      }
    }
  }

  private fun escribir(
    web: WebView,
    destino: String,
    apuntarEtapa: (String) -> Unit,
    alTerminar: (String?, String?) -> Unit
  ) {
    try {
      apuntarEtapa("midiendo")
      val adaptador = web.createPrintDocumentAdapter("finzo-reporte")
      val atributos = PrintAttributes.Builder()
        .setMediaSize(PrintAttributes.MediaSize("finzo", "finzo", ANCHO_MILS, ALTO_MILS))
        .setResolution(
          PrintAttributes.Resolution("finzo", "finzo", PUNTOS_POR_PULGADA, PUNTOS_POR_PULGADA)
        )
        // Sin margenes propios: el HTML ya trae los suyos. Poniendo los dos, el
        // contenido quedaba metido hacia dentro y se perdia media hoja.
        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
        .build()

      // NO SE ESPERA LA MEDIDA. Es el arreglo entero; ver la nota en
      // FinzoPrintPuente.medirSinEsperar.
      FinzoPrintPuente.medirSinEsperar(adaptador, atributos)

      apuntarEtapa("escribiendo")
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
    } catch (e: Throwable) {
      alTerminar(null, e.message ?: "no se pudo convertir a PDF")
    }
  }
}
