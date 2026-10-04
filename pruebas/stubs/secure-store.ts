const values = new Map<string, string>();
let failReads = false;
let failWriteKey: string | null = null;
let failDeleteKey: string | null = null;

export function setReadFailure(value: boolean): void {
  failReads = value;
}

export function setWriteFailureKey(key: string | null): void {
  failWriteKey = key;
}

export function setDeleteFailureKey(key: string | null): void {
  failDeleteKey = key;
}

export async function getItemAsync(key: string) {
  if (failReads) throw new Error("secure-store-unavailable");
  return values.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string) {
  if (key === failWriteKey) throw new Error("secure-store-write-failed");
  values.set(key, value);
}

export async function deleteItemAsync(key: string) {
  if (key === failDeleteKey) throw new Error("secure-store-delete-failed");
  values.delete(key);
}
