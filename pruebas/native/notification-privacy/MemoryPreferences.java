package android.content;
import java.util.*;
/** IO observable, no implementación de cifrado ni reglas de captura. */
public final class MemoryPreferences implements SharedPreferences {
  public final Map<String, Object> memory = new HashMap<>();
  public final Map<String, Object> disk = new HashMap<>();
  public boolean failCommit = false;
  public void seed(String key, Object value) { memory.put(key, value); disk.put(key, value); }
  public void reload() { memory.clear(); memory.putAll(disk); }
  public Map<String, ?> getAll() { return new HashMap<>(memory); }
  public String getString(String key, String fallback) { return (String)memory.getOrDefault(key, fallback); }
  @SuppressWarnings("unchecked") public Set<String> getStringSet(String key, Set<String> fallback) { return (Set<String>)memory.getOrDefault(key, fallback); }
  public int getInt(String key, int fallback) { return (Integer)memory.getOrDefault(key, fallback); }
  public long getLong(String key, long fallback) { return (Long)memory.getOrDefault(key, fallback); }
  public float getFloat(String key, float fallback) { return (Float)memory.getOrDefault(key, fallback); }
  public boolean getBoolean(String key, boolean fallback) { return (Boolean)memory.getOrDefault(key, fallback); }
  public boolean contains(String key) { return memory.containsKey(key); }
  public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {}
  public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {}
  public Editor edit() { return new Editor() {
    private final Map<String, Object> changes = new HashMap<>();
    private boolean clear = false;
    public Editor putString(String k, String v) { changes.put(k,v); return this; }
    public Editor putStringSet(String k, Set<String> v) { changes.put(k,v); return this; }
    public Editor putInt(String k, int v) { changes.put(k,v); return this; }
    public Editor putLong(String k, long v) { changes.put(k,v); return this; }
    public Editor putFloat(String k, float v) { changes.put(k,v); return this; }
    public Editor putBoolean(String k, boolean v) { changes.put(k,v); return this; }
    public Editor remove(String k) { changes.put(k,null); return this; }
    public Editor clear() { clear = true; return this; }
    private void write(boolean persist) {
      if (clear) memory.clear();
      changes.forEach((k,v) -> { if(v==null) memory.remove(k); else memory.put(k,v); });
      if(persist) { disk.clear(); disk.putAll(memory); }
    }
    public boolean commit() { write(!failCommit); return !failCommit; }
    public void apply() { write(!failCommit); }
  }; }
}
