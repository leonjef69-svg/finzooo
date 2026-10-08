package com.finzo.screenprivacy

import android.app.Activity
import android.view.WindowManager

/** Solo memoria del proceso; la configuración sigue viviendo en SecureStore. */
internal object ScreenPrivacy {
  // El primer fotograma se protege ANTES de que JavaScript lea el candado.
  private var protected = true

  fun apply(activity: Activity): Boolean {
    val window = activity.window
    val flag = WindowManager.LayoutParams.FLAG_SECURE
    if (protected) window.addFlags(flag) else window.clearFlags(flag)
    return ((window.attributes.flags and flag) != 0) == protected
  }

  fun setProtected(activity: Activity, value: Boolean): Boolean {
    val previous = protected
    protected = value
    try {
      if (apply(activity)) return true
    } catch (error: Exception) {
      // No conservar una decisión incompleta al recrear la Activity.
      protected = previous || value
      throw error
    }
    protected = previous || value
    return false
  }
}
