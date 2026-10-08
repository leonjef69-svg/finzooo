package android.view
class WindowManager {
  class LayoutParams {
    var flags = 0
    companion object { const val FLAG_SECURE = 0x2000 }
  }
}
class Window {
  val attributes = WindowManager.LayoutParams()
  var ignoreUpdates = false
  var failUpdates = false
  fun addFlags(value: Int) {
    if (failUpdates) throw IllegalStateException("window-update-failed")
    if (!ignoreUpdates) attributes.flags = attributes.flags or value
  }
  fun clearFlags(value: Int) {
    if (failUpdates) throw IllegalStateException("window-update-failed")
    if (!ignoreUpdates) attributes.flags = attributes.flags and value.inv()
  }
}
