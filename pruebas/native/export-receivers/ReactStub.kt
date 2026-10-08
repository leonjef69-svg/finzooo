package com.facebook.react

import android.content.Context
import com.finzo.exportscheduler.TestSignals

object HeadlessJsTaskService {
  fun acquireWakeLockNow(context: Context) { TestSignals.events.add("wake") }
}
