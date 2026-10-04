const store = new Map<string, string>();

export default {
  async getItem(key: string) {
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    store.set(key, value);
  },
  async removeItem(key: string) {
    store.delete(key);
  },
  async getAllKeys() {
    return [...store.keys()];
  },
  async multiGet(keys: string[]) {
    return keys.map((key) => [key, store.get(key) ?? null] as const);
  },
  async multiRemove(keys: string[]) {
    keys.forEach((key) => store.delete(key));
  },
};
