package expo.modules.core.interfaces
import android.app.Activity
import android.content.Context
import android.os.Bundle
interface Package {
  fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener>
}
interface ReactActivityLifecycleListener {
  fun onCreate(activity: Activity, savedInstanceState: Bundle?) {}
  fun onResume(activity: Activity) {}
  fun onPause(activity: Activity) {}
}
