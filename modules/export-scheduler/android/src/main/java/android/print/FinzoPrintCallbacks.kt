package android.print

import android.os.ParcelFileDescriptor

/**
 * POR QUE ESTE ARCHIVO ESTA EN EL PAQUETE "android.print" Y NO EN EL NUESTRO
 *
 * Para convertir HTML en PDF sin pantalla hay que usar el adaptador de impresion
 * de un WebView (createPrintDocumentAdapter). Ese adaptador contesta a traves de
 * dos clases: LayoutResultCallback y WriteResultCallback.
 *
 * Las dos son publicas y abstractas, pero sus CONSTRUCTORES no lo son: solo se
 * pueden heredar desde dentro del paquete android.print. Google las dejo asi
 * porque su idea era que solo el sistema de impresion las creara — es decir,
 * ensenando el cuadro de "imprimir" al usuario. Aqui hace falta lo contrario:
 * escribir el PDF a un archivo, de madrugada, sin nadie delante.
 *
 * Declarar este archivo con "package android.print" es la forma conocida de
 * salvar eso: Kotlin lo compila como si viviera en ese paquete, y entonces si
 * puede heredar. No se toca nada del sistema ni se usa reflexion; solo se pide
 * permiso de paquete.
 *
 * NO ES UN INVENTO NUESTRO: expo-print, que es la libreria que ya usa esta app
 * para el PDF de a mano, hace exactamente esto, en dos archivos con el mismo
 * paquete y el mismo comentario. Se comprobo mirando su codigo el 06/08/2026.
 */

/** Recibe el resultado de medir el documento. */
abstract class FinzoLayoutCallback : PrintDocumentAdapter.LayoutResultCallback()

/** Recibe el resultado de escribir el PDF. */
abstract class FinzoWriteCallback : PrintDocumentAdapter.WriteResultCallback()

/**
 * Las dos ordenes que hay que darle al adaptador, en orden: medir y escribir.
 *
 * Vive aqui, y no en nuestro paquete, solo porque necesita crear las dos clases
 * de arriba. Lo demas de la conversion esta en com.finzo.exportscheduler.
 */
object FinzoPrintPuente {

  /**
   * Pide medir el documento Y NO ESPERA LA RESPUESTA. Esto es lo que fallaba.
   *
   * ESTO COSTO DOS ENTREGAS, Y ES LA DIFERENCIA ENTERA
   *
   * Lo natural es pedir la medida, esperar a que conteste, y escribir despues.
   * Asi estaba, y con eso la conversion se quedaba colgada para siempre: el
   * usuario tocaba "Probar ahora" y el boton giraba sin fin. Con un tope de
   * tiempo puesto, el mensaje fue "la conversion a PDF no contesto en 30
   * segundos".
   *
   * El motivo es que en un WebView que NO esta dentro de ninguna pantalla, esa
   * respuesta no llega nunca. No falla: no llega.
   *
   * La respuesta salio de mirar como lo hace expo-print, que es lo que esta app
   * usa para el PDF de a mano y funciona en este mismo celular: pide la medida
   * con una respuesta vacia —que nadie escucha— y pasa DIRECTAMENTE a escribir.
   * El adaptador ya quedo medido por dentro; lo unico que hay que esperar de
   * verdad es la escritura, y esa si contesta.
   *
   * La leccion, apuntada porque se pago caro: cuando algo de Android ya funciona
   * en esta app, la primera fuente que hay que leer es ESO, no la documentacion.
   */
  fun medirSinEsperar(adaptador: PrintDocumentAdapter, atributos: PrintAttributes) {
    adaptador.onLayout(null, atributos, null, object : FinzoLayoutCallback() {}, null)
  }

  /** Escribe el PDF de un adaptador ya medido. De esto SI se espera respuesta. */
  fun escribir(
    adaptador: PrintDocumentAdapter,
    destino: ParcelFileDescriptor,
    alTerminar: (Boolean, String) -> Unit
  ) {
    adaptador.onWrite(
      arrayOf(PageRange.ALL_PAGES),
      destino,
      null,
      object : FinzoWriteCallback() {
        override fun onWriteFinished(pages: Array<out PageRange>?) {
          alTerminar(true, "")
        }

        override fun onWriteFailed(error: CharSequence?) {
          alTerminar(false, error?.toString() ?: "no se pudo escribir el PDF")
        }

        override fun onWriteCancelled() {
          alTerminar(false, "cancelado")
        }
      }
    )
  }
}
