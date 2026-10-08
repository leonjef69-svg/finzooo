package com.finzo.notificationreader

import android.content.SharedPreferences
import org.json.JSONArray

/** Solo protege las listas financieras; contadores/interruptores no leen el buzón. */
internal class NotificationPreferences(
  private val delegate: SharedPreferences,
  private val protectedFields: Set<String>,
) : SharedPreferences by delegate {
  companion object { private val lock = Any() }

  private fun seal(key: String, plain: String): String = NotificationCipher.seal(
    key, plain,
    // Si queda cualquier lote cifrado, no inventar otra clave al añadir o
    // migrar una lista distinta: conservar la posibilidad de recuperación.
    createKey = protectedFields.none { delegate.getString(it, null)?.startsWith(NotificationCipher.PREFIX) == true },
  )

  override fun getString(key: String, defValue: String?): String? = synchronized(lock) {
    val raw = delegate.getString(key, defValue) ?: return@synchronized null
    if (key !in protectedFields || raw == "[]") return@synchronized raw
    val legacy = !raw.startsWith(NotificationCipher.PREFIX)
    val plain = if (legacy) raw else NotificationCipher.open(key, raw)
    // Una lista dañada NO es una lista vacía. Sin este guard se sobrescribiría.
    JSONArray(plain)
    if (legacy) {
      val encoded = seal(key, plain)
      if (!delegate.edit().putString(key, encoded).commit() || delegate.getString(key, null) != encoded) {
        // Android puede cambiar su caché aunque commit devuelva false. No dejar
        // una migración solo en memoria aparentando persistencia en el reintento.
        runCatching { delegate.edit().putString(key, raw).commit() }
        throw IllegalStateException("notification-migration-unconfirmed")
      }
    }
    plain
  }

  override fun getAll(): MutableMap<String, *> = synchronized(lock) {
    val values = mutableMapOf<String, Any?>()
    values.putAll(delegate.all)
    protectedFields.filter { values.containsKey(it) }.forEach { values[it] = getString(it, null) }
    values
  }

  override fun edit(): SharedPreferences.Editor {
    val editor = delegate.edit()
    val touched = mutableSetOf<String>()
    var clearAll = false
    // Todos los encadenamientos devuelven ESTE editor, no el delegado sin cifrar.
    return object : SharedPreferences.Editor {
      override fun putString(key: String, value: String?): SharedPreferences.Editor = apply {
        touched.add(key)
        if (key in protectedFields && value != null && value != "[]") {
          JSONArray(value)
          editor.putString(key, seal(key, value))
        } else editor.putString(key, value)
      }
      override fun putStringSet(key: String, value: MutableSet<String>?): SharedPreferences.Editor = apply {
        require(key !in protectedFields) { "notification-list-type" }
        touched.add(key)
        editor.putStringSet(key, value)
      }
      override fun putInt(key: String, value: Int): SharedPreferences.Editor = apply { touched.add(key); editor.putInt(key, value) }
      override fun putLong(key: String, value: Long): SharedPreferences.Editor = apply { touched.add(key); editor.putLong(key, value) }
      override fun putFloat(key: String, value: Float): SharedPreferences.Editor = apply { touched.add(key); editor.putFloat(key, value) }
      override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor = apply { touched.add(key); editor.putBoolean(key, value) }
      override fun remove(key: String): SharedPreferences.Editor = apply { touched.add(key); editor.remove(key) }
      override fun clear(): SharedPreferences.Editor = apply { clearAll = true; editor.clear() }
      override fun commit(): Boolean = synchronized(lock) {
        val before = delegate.all.toMap()
        fun restore() {
          // Restaurar solo lo tocado, no sobreescribir ajustes independientes.
          val undo = delegate.edit()
          if (clearAll) undo.clear()
          val keys = if (clearAll) before.keys + touched else touched
          keys.forEach { key ->
            when (val value = before[key]) {
              null -> undo.remove(key)
              is String -> undo.putString(key, value)
              is Boolean -> undo.putBoolean(key, value)
              is Int -> undo.putInt(key, value)
              is Long -> undo.putLong(key, value)
              is Float -> undo.putFloat(key, value)
              is Set<*> -> undo.putStringSet(key, value.filterIsInstance<String>().toMutableSet())
            }
          }
          undo.commit()
        }
        try {
          editor.commit().also { if (!it) runCatching { restore() } }
        } catch (error: Exception) {
          runCatching { restore() }
          throw error
        }
      }
      override fun apply() { synchronized(lock) { editor.apply() } }
    }
  }
}
