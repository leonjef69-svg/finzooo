package com.finzo.screenprivacy

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Expo registra este Package mediante el autolinking de los módulos locales. */
class ScreenPrivacyPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context):
    List<ReactActivityLifecycleListener> = listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        ScreenPrivacy.apply(activity)
      }
      override fun onResume(activity: Activity) {
        ScreenPrivacy.apply(activity)
      }
      override fun onPause(activity: Activity) {
        ScreenPrivacy.apply(activity)
      }
    })
}
