import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptText, encryptText } from "@/utils/encryption";

// Tiene exactamente la misma forma que AsyncStorage (setItem/getItem/
// removeItem), así que Firebase lo puede usar igual — pero por dentro,
// todo lo que guarda queda cifrado.
export const encryptedAsyncStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encryptText(value);
    await AsyncStorage.setItem(key, encrypted);
  },
  async getItem(key: string): Promise<string | null> {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return decryptText(raw);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
