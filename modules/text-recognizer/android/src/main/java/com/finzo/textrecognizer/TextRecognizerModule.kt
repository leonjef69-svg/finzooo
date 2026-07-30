package com.finzo.textrecognizer

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lee el texto de una foto, aquí en el celular.
 *
 * Usa el lector de Google (ML Kit). La foto NO sale del teléfono: no hay
 * ninguna llamada a internet en todo este archivo. Es lo que permite que el
 * escáner gratuito no cueste nada y funcione sin señal.
 *
 * Este módulo solo LEE. No sabe qué es una boleta, ni qué es un total, ni
 * qué es un comercio: eso lo decide utils/receiptParser.ts. Aquí se entrega
 * el texto crudo y las coordenadas, y nada más.
 */
class TextRecognizerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) {
      "No hay contexto de Android disponible"
    }

  override fun definition() = ModuleDefinition {
    Name("TextRecognizer")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      recognize(uri, promise)
    }
  }

  private fun recognize(uri: String, promise: Promise) {
    try {
      val image = InputImage.fromFilePath(context, Uri.parse(uri))
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer.process(image)
        .addOnSuccessListener { visionText ->
          try {
            promise.resolve(toJson(visionText))
          } catch (e: Throwable) {
            promise.reject("PARSE_ERROR", e.message ?: "No se pudo ordenar el texto", e)
          } finally {
            recognizer.close()
          }
        }
        .addOnFailureListener { e ->
          recognizer.close()
          promise.reject("OCR_ERROR", e.message ?: "El lector no pudo con la imagen", e)
        }
    } catch (e: Throwable) {
      // Suele ser una ruta que ya no existe, o una imagen corrupta.
      promise.reject("IMAGE_ERROR", e.message ?: "No se pudo abrir la imagen", e)
    }
  }

  /**
   * Ordena las líneas como se leerían con el ojo y las devuelve como texto
   * JSON.
   *
   * El lector de Google agrupa el texto en "bloques" y los devuelve en un
   * orden que NO es el de lectura: en una boleta puede darte primero la
   * columna de precios y después la de productos. Si se usara ese orden tal
   * cual, el precio de la leche acabaría al lado del pan.
   *
   * Una boleta es una sola columna, así que el orden correcto sale de la
   * posición: primero las líneas de arriba, y las que están a la misma
   * altura, de izquierda a derecha. Se consideran "a la misma altura" las
   * que se solapan más de la mitad de su alto, porque una foto tomada a
   * pulso siempre sale un poco torcida y dos líneas de la misma fila nunca
   * coinciden al píxel.
   */
  private fun toJson(visionText: com.google.mlkit.vision.text.Text): String {
    data class Line(val text: String, val x: Int, val y: Int, val w: Int, val h: Int)

    val lines = mutableListOf<Line>()
    for (block in visionText.textBlocks) {
      for (line in block.lines) {
        val box = line.boundingBox ?: continue
        val text = line.text.trim()
        if (text.isEmpty()) continue
        lines.add(Line(text, box.left, box.top, box.width(), box.height()))
      }
    }

    val ordered = lines.sortedWith(
      Comparator { a, b ->
        val tolerance = minOf(a.h, b.h) / 2
        val sameRow = kotlin.math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) <= tolerance
        if (sameRow) a.x.compareTo(b.x) else a.y.compareTo(b.y)
      }
    )

    val array = JSONArray()
    for (line in ordered) {
      array.put(
        JSONObject().apply {
          put("text", line.text)
          put("x", line.x)
          put("y", line.y)
          put("w", line.w)
          put("h", line.h)
        }
      )
    }

    return JSONObject().apply {
      put("text", ordered.joinToString("\n") { it.text })
      put("lines", array)
    }.toString()
  }
}
