package com.finzo.incomingfile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
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
  /** Numero cualquiera; solo sirve para reconocer NUESTRA respuesta entre las de Android. */
  private val CODIGO_ELEGIR = 7311

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

  /**
   * La eleccion de archivo que esta abierta ahora mismo, si la hay.
   *
   * Hace falta porque la pantalla de Android no devuelve nada al momento: se abre, y el
   * resultado llega despues por otro camino. Aqui se guarda a quien hay que contestarle.
   */
  private var eligiendo: Promise? = null

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

    // Abre la pantalla de Android para elegir un archivo y lo devuelve ya copiado dentro de
    // Fino —convertido, si era un documento de Google—. Ver elegirArchivo.
    AsyncFunction("elegirArchivo") { promise: Promise -> elegirArchivo(promise) }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode == CODIGO_ELEGIR) responder(resultCode, intent)
    }
  }

  /**
   * QUE SE PUEDE ELEGIR EN LA PANTALLA DE ANDROID.
   *
   * Lo que no este aqui sale en gris. Los dos ultimos son documentos de Google, y son el motivo
   * de que Fino abra esta pantalla por su cuenta (ver elegirArchivo).
   */
  private val TIPOS_QUE_SE_OFRECEN = arrayOf(
    "text/csv",
    "text/comma-separated-values",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/pdf",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.document",
  )

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
  private fun displayName(uri: Uri, siNoHay: String = "estado-de-cuenta.pdf"): String {
    val context = appContext.reactContext ?: return siNoHay
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
    return uri.lastPathSegment?.takeIf { it.contains('.') } ?: siNoHay
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
   * ABRE LA PANTALLA DE ANDROID PARA ELEGIR UN ARCHIVO (12/08/2026).
   *
   * Fino ya tenia con que elegir archivos —expo-document-picker— y aun asi esto esta escrito a
   * mano. El motivo es UNA linea suya:
   *
   *     addCategory(Intent.CATEGORY_OPENABLE)
   *
   * Esa categoria significa "enseñame solo lo que se pueda abrir como archivo". Y una Hoja de
   * Google NO se puede: no es un archivo, vive dentro de Drive en un formato propio. Con esa
   * linea puesta, Drive la enseña EN GRIS por mucho que se le pidan sus formatos — la lista de
   * tipos no pinta nada. Ese fue el primer intento del 12/08/2026, y por eso no sirvio: la
   * conversion estaba bien escrita y no llegaba a ejecutarse nunca.
   *
   * Aqui se pide lo mismo SIN esa categoria, y entonces si se puede tocar.
   *
   * Y DE PASO SE ARREGLA UN BLOQUEO. Aquella libreria guarda "hay una eleccion en curso" y si
   * Android no le devuelve el resultado —pasa: el sistema puede matar la pantalla mientras el
   * selector esta abierto— se queda bloqueada PARA SIEMPRE: todos los toques siguientes fallan
   * sin decir nada y el boton parece muerto. Le paso a el esa misma noche. Aqui, si llega una
   * peticion nueva con otra a medias, la vieja se da por cancelada y la nueva sigue: un boton
   * que no responde no se puede arreglar desde la app.
   */
  private fun elegirArchivo(promise: Promise) {
    val actividad = appContext.currentActivity
    if (actividad == null) {
      promise.resolve(fallo("sin-pantalla"))
      return
    }
    // La de antes se da por perdida en vez de rechazar la nueva. Ver arriba.
    eligiendo?.resolve(cancelado())
    eligiendo = promise
    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, TIPOS_QUE_SE_OFRECEN)
      }
      actividad.startActivityForResult(intent, CODIGO_ELEGIR)
    } catch (e: Throwable) {
      eligiendo = null
      promise.resolve(fallo("no-se-abrio"))
    }
  }

  /**
   * Contesta a la eleccion que estaba abierta.
   *
   * La copia y la conversion van en un hilo aparte a proposito: pueden tardar —una hoja grande
   * se descarga entera de Drive— y esto corre en el hilo de la pantalla, que se quedaria
   * congelada mientras dura.
   */
  private fun responder(resultCode: Int, intent: Intent?) {
    val promise = eligiendo ?: return
    eligiendo = null

    val uri = intent?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      // Cancelar no es un fallo: se sale de la pantalla y no pasa nada mas.
      promise.resolve(cancelado())
      return
    }
    Thread {
      val respuesta = try {
        traerArchivo(uri)
      } catch (e: Throwable) {
        null
      }
      promise.resolve(respuesta ?: fallo("no-se-pudo-leer"))
    }.start()
  }

  private fun cancelado(): String = JSONObject().put("cancelado", true).toString()

  /**
   * El motivo viaja hasta la pantalla y se enseña.
   *
   * Antes esto no existia y cada fallo era un silencio: se elegia un archivo, no pasaba
   * absolutamente nada, y no habia forma de saber si el problema era el archivo, el permiso o
   * la app. Es lo que costo mas tiempo del 12/08/2026.
   */
  private fun fallo(motivo: String): String =
    JSONObject().put("error", motivo).toString()

  /**
   * TRAE A FINO EL ARCHIVO ELEGIDO, convertido si hace falta.
   *
   * Dos caminos, en orden:
   *
   *   1. Lo normal. Un CSV, un Excel o un PDF se abren y se copian, y ya esta.
   *
   *   2. Si eso no da nada, es un documento de Google: no hay bytes que leer. Drive los ofrece
   *      convertidos a otros formatos, asi que se le pregunta cuales tiene (getStreamTypes) y se
   *      le pide el que sirva (openTypedAssetFileDescriptor). Estas dos llamadas son el motivo
   *      de que esto sea codigo nativo: no existen en JavaScript.
   *
   * SE PIDE CSV ANTES QUE EXCEL a proposito. Los dos valen, pero el CSV es texto plano: pesa
   * mucho menos y no obliga a arrancar el lector de hojas de calculo para algo que se acaba
   * leyendo como filas y columnas igual.
   *
   * Devuelve un JSON con la ruta ya escrita, el nombre, y en que formato quedo si hubo
   * conversion —quien llama lo necesita para saber si lo lee como texto o como hoja de
   * calculo—. Devuelve null si no se pudo: un dibujo de Google Drawings, por ejemplo, no se
   * convierte a nada que sirva.
   */
  private fun traerArchivo(uri: Uri): String? {
    val context = appContext.reactContext ?: return null
    // Sin el respaldo ".pdf" de compartir: alli un archivo sin nombre casi seguro es el estado
    // de cuenta de un banco, pero aqui puede ser cualquier cosa, y llamar PDF a una hoja de
    // calculo la manda al lector equivocado.
    val nombre = displayName(uri, "archivo")

    // 1. El camino de siempre.
    val normal = try {
      copyToCache(uri, nombre)
    } catch (e: Throwable) {
      null
    }
    if (normal != null && normal.length() > 0L) {
      return JSONObject()
        .put("uri", Uri.fromFile(normal).toString())
        .put("nombre", nombre)
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
    return JSONObject()
      .put("uri", Uri.fromFile(destino).toString())
      .put("nombre", nombre)
      .put("convertido", elegido)
      .toString()
  }

}
