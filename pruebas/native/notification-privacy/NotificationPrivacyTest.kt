package com.finzo.notificationreader
import android.content.Context
import java.security.Security
import org.json.JSONArray
import org.json.JSONObject

fun main() {
  Security.addProvider(TestKeystore())
  val context = Context()
  val p = context.storage
  NotificationStore.setEnabled(context, true)
  val text = "Maria privada recibió S/ 123.45"
  val item = JSONObject().put("text", text).put("postedAt", 1729000000000L).put("captureId", "capture-1")
  val dedupe = "com.bcp.innovacxion.yapeapp|key|time|$text"
  check(NotificationStore.add(context, item, dedupe))
  check(p.disk.values.none { it.toString().contains(text) }) { "Texto financiero visible en preferencias persistidas" }
  check(p.getString("queue", "").startsWith("nr1:"))
  check(p.getString("seen", "").startsWith("nr1:"))
  check(!NotificationStore.add(context, item, dedupe)) { "Cifrado repite una captura" }
  val first = NotificationStore.drain(context)
  check(JSONArray(first).getJSONObject(0).getString("text") == text)
  check(p.getString("inFlight", "").startsWith("nr1:"))
  p.reload()
  check(NotificationStore.drain(context) == first) { "Reinicio pierde el lote sin confirmar" }
  val before = p.disk.toMap()
  TestKeystore.unavailable = true
  check(runCatching { NotificationStore.drain(context) }.isFailure)
  check(runCatching { NotificationStore.ackDrain(context) }.isFailure) { "Confirma y borra un lote ilegible" }
  check(p.disk == before) { "Fallo de llave reemplaza datos" }
  TestKeystore.unavailable = false
  check(NotificationStore.drain(context) == first)
  NotificationStore.ackDrain(context)
  check(NotificationStore.drain(context) == "[]")

  val legacy = Context()
  legacy.storage.seed("enabled", true)
  legacy.storage.seed("queue", JSONArray().put(item).toString())
  legacy.storage.seed("seen", JSONArray().put(dedupe).toString())
  check(JSONObject(NotificationStore.stats(legacy)).getInt("queued") == 1)
  check(legacy.storage.getString("queue", "").startsWith("nr1:"))
  check(legacy.storage.getString("seen", "").startsWith("nr1:")) { "No migra marcas antiguas sin otro Yape" }
  check(!NotificationStore.add(legacy, item, dedupe))
  check(legacy.storage.getString("seen", "").startsWith("nr1:"))
  check(JSONArray(NotificationStore.drain(legacy)).length() == 1)

  NotificationStore.noteSeen(context, "com.private.chat", false)
  val stats = JSONObject(NotificationStore.stats(context))
  check(stats.getInt("totalSeen") > 0)
  check(p.disk.values.none { it.toString().contains("com.private.chat") }) { "Guarda nombre de otra app" }
  check(stats.optString("lastPackage").isEmpty() && stats.optString("ultimasApps").isEmpty())

  val encoded = NotificationCipher.seal("queue", JSONArray().put(item).toString())
  val second = NotificationCipher.seal("queue", JSONArray().put(item).toString())
  check(encoded != second) { "Reutiliza IV/cifrado" }
  check(runCatching { NotificationCipher.open("seen", encoded) }.isFailure) { "No autentica el campo" }
  val tampered = encoded.dropLast(4) + "AAAA"
  check(runCatching { NotificationCipher.open("queue", tampered) }.isFailure)
  check(TestKeystore.lastSpec.bits == 256 && TestKeystore.lastSpec.randomIV && !TestKeystore.lastSpec.authenticate)
  val generated = TestKeystore.generated
  val savedKeys = TestKeystore.keys.toMap()
  TestKeystore.keys.clear()
  check(runCatching { NotificationCipher.open("queue", encoded) }.isFailure)
  check(TestKeystore.generated == generated) { "Inventa llave al leer datos antiguos" }
  val pendingWithoutKey = Context()
  pendingWithoutKey.storage.seed("enabled", true)
  pendingWithoutKey.storage.seed("inFlight", encoded)
  val pendingBefore = pendingWithoutKey.storage.disk.toMap()
  check(runCatching { NotificationStore.add(pendingWithoutKey, item, "new-with-old-pending") }.isFailure)
  check(TestKeystore.generated == generated && pendingWithoutKey.storage.disk == pendingBefore)
  TestKeystore.keys.putAll(savedKeys)

  val damaged = Context()
  damaged.storage.seed("queue", "[broken")
  val damagedBefore = damaged.storage.disk.toMap()
  check(runCatching { NotificationStore.drain(damaged) }.isFailure)
  check(damaged.storage.disk == damagedBefore)
  val full = Context()
  full.storage.seed("queue", JSONArray().put(item).toString())
  full.storage.failCommit = true
  val fullBefore = full.storage.disk.toMap()
  check(runCatching { NotificationStore.drain(full) }.isFailure)
  check(full.storage.disk == fullBefore)
  check(full.storage.all == fullBefore) { "Fallo de migracion dejo solo la cache cifrada" }
  full.storage.reload(); full.storage.failCommit = false
  check(JSONArray(NotificationStore.drain(full)).length() == 1)
  val chained = Context()
  val wrapped = NotificationPreferences(chained.storage, setOf("queue"))
  check(wrapped.edit().putBoolean("enabled", true).putLong("time", 1)
    .putInt("count", 1).putFloat("rate", 1f).putStringSet("other", mutableSetOf("safe"))
    .remove("absent").putString("queue", JSONArray().put(item).toString()).commit())
  check(chained.storage.getString("queue", "").startsWith("nr1:"))
  check(JSONArray(wrapped.getString("queue", null)).getJSONObject(0).getString("text") == text)
  val oldNames = Context()
  oldNames.storage.seed("lastPkg", "com.private.chat")
  oldNames.storage.seed("ultimasApps", "com.private.chat,com.private.mail")
  NotificationStore.stats(oldNames)
  check(!oldNames.storage.contains("lastPkg") && !oldNames.storage.contains("ultimasApps"))
  val failedSave = Context()
  NotificationStore.setEnabled(failedSave, true)
  NotificationStore.add(failedSave, item, dedupe)
  val failedBefore = failedSave.storage.disk.toMap()
  failedSave.storage.failCommit = true
  check(runCatching { NotificationStore.drain(failedSave) }.isFailure)
  check(failedSave.storage.disk == failedBefore)
  check(failedSave.storage.all == failedBefore) { "Fallo de reclamo vacio la cache" }
  failedSave.storage.reload(); failedSave.storage.failCommit = false
  check(JSONArray(NotificationStore.drain(failedSave)).length() == 1)
  failedSave.storage.failCommit = true
  val beforeAck = failedSave.storage.disk.toMap()
  check(runCatching { NotificationStore.ackDrain(failedSave) }.isFailure)
  check(failedSave.storage.disk == beforeAck)
  check(failedSave.storage.all == beforeAck) { "Fallo de confirmacion retiro el lote en memoria" }
  failedSave.storage.reload(); failedSave.storage.failCommit = false
  check(JSONArray(NotificationStore.drain(failedSave)).length() == 1)
  val failedAdd = Context()
  NotificationStore.setEnabled(failedAdd, true)
  val addBefore = failedAdd.storage.disk.toMap()
  failedAdd.storage.failCommit = true
  check(runCatching { NotificationStore.add(failedAdd, item, dedupe) }.isFailure)
  check(failedAdd.storage.disk == addBefore && failedAdd.storage.all == addBefore)
  failedAdd.storage.failCommit = false
  check(NotificationStore.add(failedAdd, item, dedupe)) { "Reintento se considero duplicado sin persistir" }
  NotificationStore.setEnabled(context, false)
  val cleared = p.disk.toMap()
  NotificationStore.noteSeen(context, "com.private.chat", false)
  check(!NotificationStore.add(context, item, "after-disable"))
  check(p.disk == cleared)
  println("Buzon Kotlin ORIGINAL con JSON/JCE reales: cifrado, migracion, duplicados, reinicio, llave/firma/dato/guardado fallidos y apagado comprobados. SharedPreferences/Keystore adaptados, NO Android real.")
}
