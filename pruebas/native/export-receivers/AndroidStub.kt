package android.content

import com.finzo.exportscheduler.TestSignals

// Adaptadores JVM: no ejecutan el framework Android ni sus permisos.
abstract class BroadcastReceiver {
  abstract fun onReceive(context: Context, intent: Intent?)
}
class Context {
  fun startService(intent: Intent) {
    check(intent.target?.name == "com.finzo.exportscheduler.FinzoExportService")
    TestSignals.events.add("service")
  }
}
class Intent {
  var action: String? = null
  var target: Class<*>? = null
  constructor()
  constructor(context: Context, target: Class<*>) { this.target = target }
  fun setAction(action: String): Intent { this.action = action; return this }
  companion object { const val ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED" }
}
