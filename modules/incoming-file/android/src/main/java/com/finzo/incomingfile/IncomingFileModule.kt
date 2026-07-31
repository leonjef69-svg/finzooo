package com.finzo.incomingfile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

/**
 * Recoge el archivo con el que se abrió Finzo desde otra aplicación.
 *
 * Cubre las dos formas en que Android puede mandarnos un archivo:
 *
 *   COMPARTIR ("Compartir → Finzo")  → el archivo llega en un extra del
 *                                      intent, no en su dirección.
 *   ABRIR CON ("Abrir con → Finzo")  → el archivo llega como la dirección
 *                                      del propio intent.
 *
 * Son sitios distintos y hay que mirar los dos, porque desde fuera se ven
 * igual: la persona elige Finzo en una lista y espera lo mismo.
 *
 * Lo que se recibe es una dirección "content://" prestada por la otra app,
 * que puede dejar de valer en cualquier momento. Por eso aquí se COPIA el
 * contenido a la carpeta temporal de Finzo y se devuelve una ruta normal:
 * a partir de ahí el archivo es nuestro y el resto de la app lo lee igual
 * que si lo hubiera elegido a mano, incluido el borrado tras leerlo.
 */
class IncomingFileModule : Module() {

  /**
   * El archivo que llegó con Finzo YA ABIERTA.
   *
   * Hace falta guardarlo aparte por cómo funciona Android. La pantalla
   * principal de Finzo es de tipo "singleTask": si la app ya está viva,
   * Android no la abre otra vez, sino que le entrega el archivo nuevo por
   * onNewIntent(). Y ahí está el problema: React Native NO actualiza
   * activity.intent al recibirlo, así que activity.intent se queda con el
   * intent con el que se abrió la app la primera vez —normalmente un
   * "abrir la app" pelado, sin ningún archivo—.
   *
   * Resultado antes de esto: compartir un estado de cuenta a Finzo cuando
   * Finzo ya estaba abierta no hacía absolutamente nada. Ni error ni aviso:
   * la app pasaba al frente y se quedaba en Inicio.
   */
  private var pendingIntent: Intent? = null

  override fun definition() = ModuleDefinition {
    Name("IncomingFile")

    OnNewIntent { intent ->
      // Solo se guardan los que traen archivo. Cualquier otro motivo por el
      // que Android traiga la app al frente no debe pisar un archivo que
      // todavía esté esperando a que la app termine de arrancar.
      if (intent.action == Intent.ACTION_VIEW || intent.action == Intent.ACTION_SEND) {
        pendingIntent = intent
      }
    }

    // Devuelve el archivo pendiente como texto JSON, o null si no hay
    // ninguno. "consume" en el nombre no es adorno: solo lo entrega UNA
    // vez. Sin eso, cada vez que la app volviera al frente se importaría
    // otra vez el mismo estado de cuenta.
    Function("consumePendingFile") { consume() }
  }

  private fun consume(): String? {
    val activity = appContext.currentActivity ?: return null
    // Primero el que llegó con la app abierta; si no, el de arranque.
    val intent = pendingIntent ?: activity.intent ?: return null

    val uri = when (intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND -> extraStream(intent)
      else -> null
    } ?: return null

    return try {
      val name = displayName(uri)
      val copied = copyToCache(uri, name) ?: return null
      // Se marca como consumido ANTES de devolverlo. Si algo fallara más
      // adelante, es preferible perder una importación a repetirla en
      // bucle cada vez que la app vuelve al frente.
      forget(activity)
      JSONObject().apply {
        put("uri", "file://${copied.absolutePath}")
        put("name", name)
      }.toString()
    } catch (e: Throwable) {
      forget(activity)
      null
    }
  }

  /** Borra el archivo pendiente por los dos lados por los que puede llegar. */
  private fun forget(activity: android.app.Activity) {
    pendingIntent = null
    activity.intent = Intent(Intent.ACTION_MAIN)
  }

  @Suppress("DEPRECATION")
  private fun extraStream(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

  /**
   * El nombre que la otra app le da al archivo. Importa mas de lo que
   * parece: de él sale el reconocimiento del banco y si se trata como PDF.
   */
  private fun displayName(uri: Uri): String {
    val context = appContext.reactContext ?: return "estado-de-cuenta.pdf"
    try {
      context.contentResolver
        .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
          if (cursor.moveToFirst()) {
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0) {
              val name = cursor.getString(index)
              if (!name.isNullOrBlank()) return name
            }
          }
        }
    } catch (e: Throwable) {
      // Algunas apps no responden a esta consulta; se sigue con el
      // respaldo de abajo en vez de quedarse sin importación.
    }
    // Sin nombre, se supone PDF: es lo que manda todo banco peruano y lo
    // único para lo que Finzo se ofrece en la lista de Android.
    return uri.lastPathSegment?.takeIf { it.contains('.') } ?: "estado-de-cuenta.pdf"
  }

  private fun copyToCache(uri: Uri, name: String): File? {
    val context = appContext.reactContext ?: return null
    val target = File(context.cacheDir, "entrante-${System.currentTimeMillis()}-${safe(name)}")
    context.contentResolver.openInputStream(uri)?.use { input ->
      target.outputStream().use { output -> input.copyTo(output) }
    } ?: return null
    return target
  }

  /** Deja el nombre sin nada que pueda salirse de la carpeta temporal. */
  private fun safe(name: String): String =
    name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(60)
}
