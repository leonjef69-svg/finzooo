package com.finzo.notificationreader

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService

/** Vuelve a enlazar el lector tras reiniciar Android o actualizar Fino. */
class FinzoRebindReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (!NotificationStore.isEnabled(context)) return
    try {
      NotificationListenerService.requestRebind(
        ComponentName(context, FinzoNotificationListener::class.java)
      )
    } catch (_: Throwable) {
      NotificationStore.noteSpeak(context, "lector-no-reconecto")
    }
  }
}
