package android.content;
public class Context {
  public static final int MODE_PRIVATE = 0;
  public final MemoryPreferences storage = new MemoryPreferences();
  public SharedPreferences getSharedPreferences(String name, int mode) { return storage; }
}
