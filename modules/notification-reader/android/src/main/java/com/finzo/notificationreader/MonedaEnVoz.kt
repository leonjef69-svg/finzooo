package com.finzo.notificationreader

/**
 * QUE EL CELULAR DIGA "UN SOL" Y NO "ESE ENE UNO" (11/08/2026)
 *
 * Reportado probando un yapeo de verdad: la voz leia el aviso bien, pero donde Yape escribe
 * "S/ 1" el celular decia **"S 1"**. El simbolo de la moneda no es una palabra, y el sistema
 * de voz lo lee letra por letra o se lo salta.
 *
 * Y no vale poner "soles" a secas: la app funciona en varios paises y cada uno tiene lo suyo.
 * Un boliviano tiene que oir "bolivianos", no "soles".
 *
 * POR QUE ESTA EN ANDROID Y NO EN LA APP
 *
 * Porque la voz habla con Fino CERRADA, desde el servicio que escucha las notificaciones. Ahi
 * no hay nada de JavaScript corriendo. La moneda elegida se le pasa al servicio cuando la
 * persona la cambia (ver NotificationStore.setMoneda) y aqui se usa.
 *
 * LO QUE NO HACE, A PROPOSITO
 *
 * No convierte cantidades. "S/ 2.50" queda "2.50 soles" y no "2 soles con 50 centimos": convertir
 * cifras es la clase de arreglo bonito que un dia dice un monto equivocado, y un monto
 * equivocado dicho en voz alta es peor que un simbolo mal leido. La unica excepcion es el
 * uno exacto: se dice "un sol", porque leer el digito hace que Android diga "uno sol".
 */
object MonedaEnVoz {

  /**
   * Como se escribe cada moneda y como se lee, en singular y en plural.
   *
   * Los simbolos son los mismos de constants/currencies.ts en la app. Estan repetidos aqui
   * porque este codigo corre sin JavaScript, y una prueba vigila que las dos listas no se
   * separen: si manana se añade una moneda alla y no aqui, la voz volveria a deletrear.
   */
  private data class Moneda(val simbolos: List<String>, val singular: String, val plural: String)

  private val MONEDAS = mapOf(
    "PEN" to Moneda(listOf("S/.", "S/"), "sol", "soles"),
    "USD" to Moneda(listOf("US$", "$"), "dolar", "dolares"),
    "MXN" to Moneda(listOf("MX$", "$"), "peso", "pesos"),
    "COP" to Moneda(listOf("COL$", "$"), "peso", "pesos"),
    "ARS" to Moneda(listOf("AR$", "$"), "peso", "pesos"),
    "CLP" to Moneda(listOf("CL$", "$"), "peso", "pesos"),
    "BOB" to Moneda(listOf("Bs.", "Bs"), "boliviano", "bolivianos"),
    "BRL" to Moneda(listOf("R$"), "real", "reais"),
    "EUR" to Moneda(listOf("€"), "euro", "euros")
  )

  /** Las monedas que se saben decir. Solo para la prueba que las compara con las de la app. */
  fun conocidas(): Set<String> = MONEDAS.keys

  /**
   * Cambia el simbolo por la palabra, dejando el numero donde estaba.
   *
   * "Te yapearon S/ 50 de Juan" -> "Te yapearon 50 soles de Juan"
   * "Te yapearon S/ 1 de Juan"  -> "Te yapearon un sol de Juan"
   *
   * EL SIMBOLO VA DELANTE Y LA PALABRA DETRAS. En español el simbolo se escribe antes del
   * numero pero se dice despues, y por eso no basta con sustituir una cosa por otra: hay que
   * mover el numero delante. Sustituyendo en el sitio saldria "soles 50", que suena a robot.
   *
   * Si no se reconoce la moneda o el texto no la lleva, se devuelve igual. Nunca se inventa.
   */
  fun conPalabras(texto: String, moneda: String): String {
    val m = MONEDAS[moneda] ?: return texto
    var salida = texto
    var cambioMonto = false

    // Los simbolos van de mas largo a mas corto: si "S/" se cambiara antes que "S/.", el
    // punto quedaria suelto en medio de la frase.
    for (simbolo in m.simbolos.sortedByDescending { it.length }) {
      val patron = Regex(Regex.escape(simbolo) + """\s*(\d+(?:[.,]\d+)?)""")
      salida = patron.replace(salida) { encontrado ->
        val numero = encontrado.groupValues[1]
        cambioMonto = true
        if (esUno(numero)) "un " + m.singular else numero + " " + m.plural
      }
    }

    // Yape escribe "un pago por S/ 1". Una vez que el monto ya esta identificado, para la
    // voz suena natural como "un pago de un sol". Esto solo modifica lo pronunciado: el aviso
    // original, el analisis y el movimiento guardado siguen exactamente iguales.
    if (cambioMonto) {
      salida = Regex("""(?i)\bpago\s+por\s+""").replace(salida, "pago de ")
    }
    return salida
  }

  /**
   * ¿El numero vale exactamente uno?
   *
   * "1", "1.00" y "1,0" son uno. "1.50" no. Se mira asi y no convirtiendo a numero porque el
   * separador decimal cambia de pais y una conversion mal hecha diria "1 sol" donde hay 1,50.
   */
  private fun esUno(numero: String): Boolean {
    val partes = numero.split(".", ",")
    if (partes[0].trimStart('0').let { if (it.isEmpty()) "0" else it } != "1") return false
    if (partes.size == 1) return true
    return partes[1].all { it == '0' }
  }
}
