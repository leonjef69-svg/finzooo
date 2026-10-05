const store = new Map<string, string>();
let fault: { operation: string; keyPart: string } | null = null;
export function failNextStorageOperation(operation: string, keyPart: string): void {
  fault = { operation, keyPart };
}
function check(operation: string, key: string): void {
  if (fault?.operation === operation && key.includes(fault.keyPart)) {
    fault = null;
    throw new Error("test-storage-failure");
  }
}

export default {
  async getItem(key: string) {
    check("get", key);
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    check("set", key);
    store.set(key, value);
  },
  async removeItem(key: string) {
    check("remove", key);
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
