package com.finzo.screenprivacy
import android.app.Activity
import android.view.WindowManager

fun main() {
  val activity = Activity()
  val secure = WindowManager.LayoutParams.FLAG_SECURE
  val unrelatedFlag = 0x400
  activity.window.attributes.flags = unrelatedFlag
  val listener = ScreenPrivacyPackage().createReactActivityLifecycleListeners(activity).single()
  listener.onCreate(activity, null)
  check(activity.window.attributes.flags == (unrelatedFlag or secure)) { "Arranque desprotegido" }
  check(ScreenPrivacy.setProtected(activity, false))
  check(activity.window.attributes.flags == unrelatedFlag) { "Se alteran otras banderas" }
  listener.onResume(activity)
  listener.onPause(activity)
  check(activity.window.attributes.flags == unrelatedFlag) { "Candado apagado no admite capturas" }
  check(ScreenPrivacy.setProtected(activity, true))
  activity.window.attributes.flags = unrelatedFlag
  listener.onPause(activity)
  check(activity.window.attributes.flags == (unrelatedFlag or secure)) { "Pausa deja miniatura sin proteger" }
  activity.window.attributes.flags = unrelatedFlag
  listener.onResume(activity)
  check(activity.window.attributes.flags == (unrelatedFlag or secure))
  val recreated = Activity()
  listener.onCreate(recreated, null)
  check(recreated.window.attributes.flags == secure) { "Recreacion pierde proteccion" }
  activity.window.ignoreUpdates = true
  check(!ScreenPrivacy.setProtected(activity, false)) { "Confirma cambio no aplicado" }
  activity.window.ignoreUpdates = false
  listener.onResume(activity)
  check(activity.window.attributes.flags == (unrelatedFlag or secure))
  activity.window.failUpdates = true
  val failure = runCatching { ScreenPrivacy.setProtected(activity, false) }.exceptionOrNull()
  check(failure?.message == "window-update-failed") { "Se esconde un fallo inesperado" }
  activity.window.failUpdates = false
  listener.onResume(activity)
  check(activity.window.attributes.flags == (unrelatedFlag or secure))
  check(ScreenPrivacy.setProtected(activity, false))
  listener.onCreate(recreated, null)
  check(recreated.window.attributes.flags == 0)
  println("Kotlin original: arranque, pausa, regreso, recreacion, candado apagado, flags ajenos y fallos comprobados. Ventanas adaptadas, no telefono real.")
}
