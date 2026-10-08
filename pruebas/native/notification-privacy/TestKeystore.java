package com.finzo.notificationreader;
import java.security.*;
import java.security.cert.Certificate;
import java.security.spec.AlgorithmParameterSpec;
import java.io.*;
import java.util.*;
import javax.crypto.*;
import android.security.keystore.KeyGenParameterSpec;
/** SOLO proveedor de llaves simulado. AES-GCM lo ejecuta JCE real, no este adaptador. */
public final class TestKeystore extends Provider {
  public static final Map<String, Key> keys = new HashMap<>();
  public static boolean unavailable = false;
  public static int generated = 0;
  public static KeyGenParameterSpec lastSpec;
  public TestKeystore() {
    super("AndroidKeyStore", "1.0", "Adaptador de prueba, no hardware Android");
    put("KeyStore.AndroidKeyStore", Store.class.getName());
    put("KeyGenerator.AES", Generator.class.getName());
  }
  public static final class Store extends KeyStoreSpi {
    public Key engineGetKey(String alias, char[] password) throws UnrecoverableKeyException {
      if(unavailable) throw new UnrecoverableKeyException("test-keystore-unavailable");
      return keys.get(alias);
    }
    public Certificate[] engineGetCertificateChain(String alias) { return null; }
    public Certificate engineGetCertificate(String alias) { return null; }
    public Date engineGetCreationDate(String alias) { return new Date(); }
    public void engineSetKeyEntry(String alias, Key key, char[] pwd, Certificate[] chain) { keys.put(alias,key); }
    public void engineSetKeyEntry(String alias, byte[] key, Certificate[] chain) { throw new UnsupportedOperationException(); }
    public void engineSetCertificateEntry(String alias, Certificate cert) { throw new UnsupportedOperationException(); }
    public void engineDeleteEntry(String alias) { keys.remove(alias); }
    public Enumeration<String> engineAliases() { return Collections.enumeration(keys.keySet()); }
    public boolean engineContainsAlias(String alias) { return keys.containsKey(alias); }
    public int engineSize() { return keys.size(); }
    public boolean engineIsKeyEntry(String alias) { return keys.containsKey(alias); }
    public boolean engineIsCertificateEntry(String alias) { return false; }
    public String engineGetCertificateAlias(Certificate cert) { return null; }
    public void engineStore(OutputStream stream, char[] pwd) {}
    public void engineLoad(InputStream stream, char[] pwd) {}
  }
  public static final class Generator extends KeyGeneratorSpi {
    private KeyGenParameterSpec spec;
    protected void engineInit(SecureRandom random) { throw new UnsupportedOperationException(); }
    protected void engineInit(int size, SecureRandom random) { throw new UnsupportedOperationException(); }
    protected void engineInit(AlgorithmParameterSpec params, SecureRandom random) { spec=(KeyGenParameterSpec)params; }
    protected SecretKey engineGenerateKey() {
      try {
        if(unavailable) throw new IllegalStateException("test-keystore-unavailable");
        KeyGenerator generator=KeyGenerator.getInstance("AES", "SunJCE");
        generator.init(spec.bits);
        SecretKey key=generator.generateKey();
        keys.put(spec.alias,key); generated++; lastSpec=spec;
        return key;
      } catch(GeneralSecurityException error) { throw new IllegalStateException(error); }
    }
  }
}
