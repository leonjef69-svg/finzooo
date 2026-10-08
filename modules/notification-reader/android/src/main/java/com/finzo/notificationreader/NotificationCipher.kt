package com.finzo.notificationreader

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Clave local no exportada; no requiere PIN/huella para capturar en segundo plano. */
internal object NotificationCipher {
  const val PREFIX = "nr1:"
  private const val ALIAS = "finzo.notification-reader.v1"

  @Synchronized
  private fun key(create: Boolean): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing = store.getKey(ALIAS, null)
    if (existing != null) return existing as? SecretKey
      ?: throw IllegalStateException("notification-key-invalid")
    // No generar una llave nueva al intentar abrir algo cifrado: no repararía
    // los datos y ocultaría que se perdió acceso a la llave original.
    if (!create) throw IllegalStateException("notification-key-unavailable")
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .setUserAuthenticationRequired(false)
        .build())
    }.generateKey()
  }

  fun seal(field: String, plain: String, createKey: Boolean = true): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    // Android genera un IV aleatorio nuevo; nunca reutilizar uno de descifrado.
    cipher.init(Cipher.ENCRYPT_MODE, key(createKey))
    cipher.updateAAD("finzo.notification-reader:$field".toByteArray(Charsets.UTF_8))
    val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
    return PREFIX + Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
      Base64.encodeToString(encrypted, Base64.NO_WRAP)
  }

  fun open(field: String, encoded: String): String {
    require(encoded.startsWith(PREFIX)) { "notification-cipher-format" }
    val parts = encoded.removePrefix(PREFIX).split(":")
    require(parts.size == 2 && parts.all { it.matches(Regex("[A-Za-z0-9+/]+={0,2}")) }) {
      "notification-cipher-format"
    }
    val iv = Base64.decode(parts[0], Base64.NO_WRAP)
    val encrypted = Base64.decode(parts[1], Base64.NO_WRAP)
    require(iv.size == 12 && encrypted.size >= 16) { "notification-cipher-format" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, iv))
    cipher.updateAAD("finzo.notification-reader:$field".toByteArray(Charsets.UTF_8))
    return cipher.doFinal(encrypted).toString(Charsets.UTF_8)
  }
}
