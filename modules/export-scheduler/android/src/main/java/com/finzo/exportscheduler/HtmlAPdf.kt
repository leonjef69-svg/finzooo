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
 * El PDF de Finzo se dibuja desde HTML, y hasta ahora se hacia con expo-print,
 * que necesita que la app este en pantalla. Por eso la exportacion automatica
 * solo podia hacer Excel y CSV: el PDF era el unico formato que no salia con la
 * app cerrada, y el usuario lo pidio igualado (06/08/2026).
 *
 * SE REUSA EL MISMO HTML, Y ESO ES EL PUNTO
 *
 * El HTML lo arma utils/exportPdfHtml.ts, el mismo que usa la pantalla de
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

  fun convertir(
    context: Context,
    html: String,
    destino: String,
    alTerminar: (String?, String?) -> Unit
  ) {
    Handler(Looper.getMainLooper()).post {
      try {
        val web = WebView(context)
        web.settings.javaScriptEnabled = false
        web.webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView, url: String?) {
            view.postDelayed({ escribir(view, destino, alTerminar) }, ESPERA_COLOCADO_MS)
          }
        }
        // Sin direccion base: el HTML lleva el logo incrustado y no pide nada de
        // internet. Si algun dia pidiera una imagen de fuera, aqui no habria
        // desde donde resolverla — y mejor asi: un reporte no puede depender de
        // que haya senal a las tres de la manana.
        web.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
      } catch (e: Throwable) {
        alTerminar(null, e.message ?: "no se pudo crear el conversor")
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
          alTerminar(null, errorMedida)
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
          else alTerminar(null, errorEscritura)
        }
      }
    } catch (e: Throwable) {
      alTerminar(null, e.message ?: "no se pudo convertir a PDF")
    }
  }
}
