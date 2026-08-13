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
 * Recoge el archivo con el que se abrió Fino desde otra aplicación.
 *
 * Cubre las dos formas en que Android puede mandarnos un archivo:
 *
 *   COMPARTIR ("Compartir → Fino")  → el archivo llega en un extra del
 *                                      intent, no en su dirección.
 *   ABRIR CON ("Abrir con → Fino")  → el archivo llega como la dirección
 *                                      del propio intent.
 *
 * Son sitios distintos y hay que mirar los dos, porque desde fuera se ven
 * igual: la persona elige Fino en una lista y espera lo mismo.
 *
 * Lo que se recibe es una dirección "content://" prestada por la otra app,
 * que puede dejar de valer en cualquier momento. Por eso aquí se COPIA el
 * contenido a la carpeta temporal de Fino y se devuelve una ruta normal:
 * a partir de ahí el archivo es nuestro y el resto de la app lo lee igual
 * que si lo hubiera elegido a mano, incluido el borrado tras leerlo.
 */
class IncomingFileModule : Module() {

  /**
   * El archivo que llegó con Fino YA ABIERTA.
   *
   * Hace falta guardarlo aparte por cómo funciona Android. La pantalla
   * principal de Fino es de tipo "singleTask": si la app ya está viva,
   * Android no la abre otra vez, sino que le entrega el archivo nuevo por
   * onNewIntent(). Y ahí está el problema: React Native NO actualiza
   * activity.intent al recibirlo, así que activity.intent se queda con el
   * intent con el que se abrió la app la primera vez —normalmente un
   * "abrir la app" pelado, sin ningún archivo—.
   *
   * Resultado antes de esto: compartir un estado de cuenta a Fino cuando
   * Fino ya estaba abierta no hacía absolutamente nada. Ni error ni aviso:
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

    // El archivo que se eligio en la pantalla de Android, ya copiado dentro de Fino. Ver
    // traerArchivo. Es asincrona porque copia bytes: con un archivo grande, hacerlo en el
    // hilo de la pantalla la dejaria congelada mientras dura.
    AsyncFunction("traerArchivo") { uri: String -> traerArchivo(uri) }
  }

  /**
   * En que formatos se acepta un documento de Google, del mas comodo al menos.
   *
   * Fuera de esta lista no entra nada: Drive tambien ofrece PDF de una hoja de calculo, y un
   * PDF hecho de una tabla se lee mucho peor que la tabla misma.
   */
  private val FORMATOS_QUE_SIRVEN = listOf(
    "text/csv",
    "text/comma-separated-values",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
  )

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
    // único para lo que Fino se ofrece en la lista de Android.
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

  /**
   * TRAE A FINO EL ARCHIVO QUE SE ELIGIO EN LA PANTALLA DE ANDROID (12/08/2026).
   *
   * Nace de esto: al importar movimientos, las Hojas de calculo de Google salian en gris y no
   * se podian tocar.
   *
   * POR QUE. Una Hoja de Google NO ES UN ARCHIVO. Vive dentro de Drive en un formato propio y no
   * hay bytes que leer. Pedirle el contenido con openInputStream —lo que hace todo el mundo,
   * incluido expo-document-picker— falla siempre. Y falla ADEMAS de la peor manera: la libreria
   * copia el archivo ella sola antes de devolverlo, asi que reventaba entera y la eleccion se
   * perdia. Por eso ahora se le pide que NO copie (copyToCacheDirectory: false) y la copia se
   * hace aqui.
   *
   * Los dos caminos, en orden:
   *
   *   1. Lo normal. Un CSV, un Excel o un PDF se abren y se copian, y ya esta.
   *
   *   2. Si eso no da nada, es un documento de Google. Drive los ofrece convertidos a otros
   *      formatos: se le pregunta cuales tiene (getStreamTypes) y se le pide el que sirva
   *      (openTypedAssetFileDescriptor). Esta es la parte que NO se puede escribir en
   *      JavaScript — son dos llamadas de Android que no estan expuestas— y el unico motivo de
   *      que esto sea codigo nativo.
   *
   * SE PIDE CSV ANTES QUE EXCEL a proposito. Los dos valen, pero el CSV es texto plano: pesa
   * mucho menos y no obliga a arrancar el lector de hojas de calculo para algo que se acaba
   * leyendo como filas y columnas igual.
   *
   * Devuelve un JSON con la ruta ya escrita y, si hubo conversion, en que formato quedo — quien
   * llama lo necesita para saber si lo lee como texto o como Excel. Devuelve null si no se pudo:
   * un dibujo de Google Drawings, por ejemplo, no se convierte a nada que sirva. Nunca lanza.
   */
  private fun traerArchivo(uriTexto: String): String? {
    return try {
      val context = appContext.reactContext ?: return null
      val uri = Uri.parse(uriTexto)

      // 1. El camino de siempre.
      val normal = try {
        copyToCache(uri, displayName(uri))
      } catch (e: Throwable) {
        null
      }
      if (normal != null && normal.length() > 0L) {
        return JSONObject()
          .put("uri", Uri.fromFile(normal).toString())
          .put("convertido", JSONObject.NULL)
          .toString()
      }
      normal?.delete()

      // 2. Es un documento de Google: hay que pedirlo convertido.
      val disponibles = context.contentResolver.getStreamTypes(uri, "*/*") ?: return null
      val elegido = FORMATOS_QUE_SIRVEN.firstOrNull { querido ->
        disponibles.any { it.equals(querido, ignoreCase = true) }
      } ?: return null

      val destino = File(context.cacheDir, "hoja-${System.currentTimeMillis()}")
      context.contentResolver.openTypedAssetFileDescriptor(uri, elegido, null)?.use { descriptor ->
        descriptor.createInputStream().use { entrada ->
          destino.outputStream().use { salida -> entrada.copyTo(salida) }
        }
      } ?: return null

      // Un archivo vacio no es una hoja: es una conversion que fallo sin decirlo.
      if (destino.length() == 0L) {
        destino.delete()
        return null
      }
      JSONObject()
        .put("uri", Uri.fromFile(destino).toString())
        .put("convertido", elegido)
        .toString()
    } catch (e: Throwable) {
      null
    }
  }

}
