package android.print

import android.os.CancellationSignal
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
 * EL RIESGO Y POR QUE SE ASUME
 *
 * Es una puerta lateral, y si Google cambiara esas dos clases dejaria de
 * compilar. Llevan igual desde Android 4.4 (2013) y una API publica no se
 * cambia sin mas, asi que el riesgo es bajo. La alternativa era volver a dibujar
 * el reporte entero a mano en codigo de Android, y entonces el PDF automatico se
 * veria distinto del PDF que se hace a mano — dos disenos del mismo documento.
 *
 * SI ALGUN DIA DEJA DE COMPILAR, el aviso llega al compilar y no al usuario: el
 * PDF automatico se queda sin hacer y la app cae a lo de antes (esperar a que
 * alguien abra la app). Nunca un reporte corrupto.
 */

/** Recibe el resultado de medir el documento. */
abstract class FinzoLayoutCallback : PrintDocumentAdapter.LayoutResultCallback()

/** Recibe el resultado de escribir el PDF. */
abstract class FinzoWriteCallback : PrintDocumentAdapter.WriteResultCallback()

/**
 * Escribe el PDF de un adaptador ya medido.
 *
 * Vive aqui, y no en nuestro paquete, solo porque necesita crear las dos clases
 * de arriba. Lo demas de la conversion esta en com.finzo.exportscheduler.
 */
object FinzoPrintPuente {
  fun escribir(
    adaptador: PrintDocumentAdapter,
    destino: ParcelFileDescriptor,
    alTerminar: (Boolean, String) -> Unit
  ) {
    adaptador.onWrite(
      arrayOf(PageRange.ALL_PAGES),
      destino,
      CancellationSignal(),
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

  fun medir(
    adaptador: PrintDocumentAdapter,
    atributos: PrintAttributes,
    alTerminar: (Boolean, String) -> Unit
  ) {
    adaptador.onLayout(
      null,
      atributos,
      CancellationSignal(),
      object : FinzoLayoutCallback() {
        override fun onLayoutFinished(info: PrintDocumentInfo?, changed: Boolean) {
          alTerminar(true, "")
        }

        override fun onLayoutFailed(error: CharSequence?) {
          alTerminar(false, error?.toString() ?: "no se pudo medir el PDF")
        }

        override fun onLayoutCancelled() {
          alTerminar(false, "cancelado")
        }
      },
      null
    )
  }
}
