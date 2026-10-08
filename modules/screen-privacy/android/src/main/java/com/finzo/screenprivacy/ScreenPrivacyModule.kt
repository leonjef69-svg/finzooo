package com.finzo.screenprivacy

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenPrivacyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenPrivacy")
    AsyncFunction("setProtected") { value: Boolean ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("screen-privacy-no-activity")
      ScreenPrivacy.setProtected(activity, value)
    }.runOnQueue(Queues.MAIN)
  }
}
