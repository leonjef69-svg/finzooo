package com.finzo.notificationreader

import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale

/** Se ejecuta antes de persistir o anunciar un aviso, también con Fino cerrada. */
object NotificationPrivacy {
  const val VERSION = 1

  private val SECURITY_HINTS = listOf(
    "codigo de verificacion", "codigo de seguridad", "clave temporal", "no compartas",
    "operacion en curso", "autocompletado la clave", "generado y autocompletado",
    "codigo de acceso", "clave de verificacion", "verification code", "security code",
    "one time password", "one time code"
  )

  fun isSecurityNotice(title: String, text: String): Boolean {
    val normalized = Normalizer.normalize("$title $text", Normalizer.Form.NFD)
      .replace(Regex("\\p{M}+"), "")
      .lowercase(Locale.ROOT)
      .replace(Regex("[^a-z0-9\\s\\p{Z}]"), " ")
      .replace(Regex("[\\s\\p{Z}]+"), " ")
      .trim()
    return SECURITY_HINTS.any { normalized.contains(it) }
  }

  /** La marca contra duplicados no conserva otra copia del texto del aviso. */
  fun dedupeHash(key: String): String {
    if (Regex("^sha256:[a-f0-9]{64}$").matches(key)) return key
    val bytes = MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
    return "sha256:" + bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
  }
}
