package android.security.keystore;
import java.security.spec.AlgorithmParameterSpec;
public final class KeyGenParameterSpec implements AlgorithmParameterSpec {
  public final String alias;
  public int bits = 256;
  public boolean randomIV = true, authenticate = false;
  private KeyGenParameterSpec(String value) { alias = value; }
  public static class Builder {
    private final KeyGenParameterSpec value;
    public Builder(String alias, int purposes) { value = new KeyGenParameterSpec(alias); }
    public Builder setKeySize(int n) { value.bits=n; return this; }
    public Builder setBlockModes(String... modes) { return this; }
    public Builder setEncryptionPaddings(String... pads) { return this; }
    public Builder setRandomizedEncryptionRequired(boolean n) { value.randomIV=n; return this; }
    public Builder setUserAuthenticationRequired(boolean n) { value.authenticate=n; return this; }
    public KeyGenParameterSpec build() { return value; }
  }
}
