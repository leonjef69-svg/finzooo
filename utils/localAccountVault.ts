import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { decryptText, encryptText } from "@/utils/encryption";
import { deleteLegalAcceptance } from "@/utils/legalAcceptance";
import { auth } from "@/utils/firebase";
import { isLocalAccountRecoveryEnabled } from "@/utils/localAccountRecoveryPermission";
import {
  ACCOUNT_STORAGE_KEYS,
  clearAccountData,
  flushPendingSaves,
  flushPendingSavesChecked,
  hasUnreadableLocalData,
  setAccountStorageAvailable,
  STORAGE_KEYS,
} from "@/utils/storage";

const OWNER_KEY = "finzo:localAccountOwner:v1";
const PREFIX = "finzo:localAccountVault:v1:";
type Owner = { uid: string; mode: "active" | "archived" };
type Snapshot = { version: 1; uid: string; entries: [string, string | null][] };
type StoredSnapshot = { version: 1 | 2 | 3; uid: string; entries: [string, string | null][] };
type Manifest = { version: 1; current: string; previous?: string };
type PreparationOptions = { recoverUnidentifiedLegacyFor?: NonNullable<typeof auth.currentUser> };
type ReadDetail = "owner" | "profile" | "active-block" | "manifest" | "snapshot-missing"
  | "snapshot-decrypt" | "snapshot-format" | "snapshot-block" | "profile-missing"
  | "source-changed" | "recovery-ineligible" | "archive-missing" | "empty-active-archive-missing";
const keys = [...new Set(ACCOUNT_STORAGE_KEYS)];
const emailKey = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();
const accountPrefix = (uid: string) => `${PREFIX}${encodeURIComponent(uid)}:`;
const manifestKey = (uid: string) => `${accountPrefix(uid)}manifest`;

export class LocalAccountVaultError extends Error {
  constructor(public readonly reason: "owner" | "verification" | "read" | "write",
    public readonly ownerDetail?: "unidentified" | "session",
    public readonly readDetail?: ReadDetail) {
    super(`local-account-${reason}`);
    this.name = "LocalAccountVaultError";
  }
  get messageKey(): string {
    if (this.reason === "verification") return "localAccount.verifyBeforeRestore";
    if (this.reason !== "owner") return "localAccount.restoreFailed";
    if (this.ownerDetail === "unidentified") return "localAccount.ownerUnidentified";
    if (this.ownerDetail === "session") return "localAccount.sessionInterrupted";
    return "localAccount.ownerMismatch";
  }
}

// El trabajo de fondo y los cambios de cuenta comparten esta cola. No se
// archiva una cuenta en mitad de un registro automático.
let operation = Promise.resolve();
export function withLocalAccountOperation<T>(action: () => Promise<T>): Promise<T> {
  const result = operation.then(action, action);
  operation = result.then(() => undefined, () => undefined);
  return result;
}

async function readOwner(): Promise<Owner | null> {
  const raw = await AsyncStorage.getItem(OWNER_KEY);
  if (!raw) return null;
  try {
    const text = await decryptText(raw);
    if (!text) throw new Error();
    const owner = JSON.parse(text) as Owner;
    if (!owner.uid || !["active", "archived"].includes(owner.mode)) throw new Error();
    return owner;
  } catch { throw new LocalAccountVaultError("read", undefined, "owner"); }
}

async function removeUnconfirmedOwner(raw: string, previousRaw: string | null = null): Promise<void> {
  setAccountStorageAvailable(false);
  try {
    if (await AsyncStorage.getItem(OWNER_KEY) === raw) {
      if (previousRaw === null) await AsyncStorage.removeItem(OWNER_KEY);
      else await AsyncStorage.setItem(OWNER_KEY, previousRaw);
      if (await AsyncStorage.getItem(OWNER_KEY) !== previousRaw) throw new LocalAccountVaultError("write");
    }
  } catch { throw new LocalAccountVaultError("write"); }
}

async function writeOwner(owner: Owner, assertCurrentSession?: () => void,
  expected?: { ownerRaw: string | null; profileRaw: string | null }): Promise<string> {
  const previousRaw = assertCurrentSession ? await AsyncStorage.getItem(OWNER_KEY) : null;
  assertCurrentSession?.();
  if (expected && previousRaw !== expected.ownerRaw) throw new LocalAccountVaultError("read", undefined, "source-changed");
  const raw = await encryptText(JSON.stringify(owner));
  assertCurrentSession?.();
  if (expected) {
    const fresh = new Map(await AsyncStorage.multiGet([OWNER_KEY, STORAGE_KEYS.profile]));
    assertCurrentSession?.();
    if (fresh.get(OWNER_KEY) !== expected.ownerRaw || fresh.get(STORAGE_KEYS.profile) !== expected.profileRaw) {
      throw new LocalAccountVaultError("read", undefined, "source-changed");
    }
  }
  try {
    await AsyncStorage.setItem(OWNER_KEY, raw);
    assertCurrentSession?.();
    if (await AsyncStorage.getItem(OWNER_KEY) !== raw) throw new LocalAccountVaultError("write");
    assertCurrentSession?.();
  } catch (error) {
    if (assertCurrentSession) {
      // La adjudicación nueva se retira; una restauración conserva el dueño
      // anterior exacto y su copia, para recuperar una interrupción sin mezclar.
      await removeUnconfirmedOwner(raw, previousRaw);
    }
    throw error;
  }
  return raw;
}

async function readProfile(onRaw?: (raw: string | null) => void): Promise<{ hasOnboarded?: boolean; userEmail?: string } | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.profile);
  onRaw?.(raw);
  if (!raw) return null;
  try {
    const text = await decryptText(raw);
    const profile = JSON.parse(text ?? raw);
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new Error();
    return profile;
  } catch { throw new LocalAccountVaultError("read", undefined, "profile"); }
}

async function hasUnownedAccountData(): Promise<boolean> {
  const otherKeys = keys.filter((key) => key !== STORAGE_KEYS.profile && key !== "finzo:avisosEncendidos");
  for (const [, raw] of await AsyncStorage.multiGet(otherKeys)) {
    if (raw === null) continue;
    try {
      const value = JSON.parse(await decryptText(raw) ?? raw);
      if (Array.isArray(value) ? value.length > 0 : value && typeof value === "object" ? Object.keys(value).length > 0 : Boolean(value)) return true;
    } catch { throw new LocalAccountVaultError("read", undefined, "active-block"); }
  }
  return false;
}

async function readManifest(uid: string): Promise<Manifest | null> {
  const raw = await AsyncStorage.getItem(manifestKey(uid));
  if (!raw) return null;
  try {
    const text = await decryptText(raw);
    if (!text) throw new Error();
    const manifest = JSON.parse(text) as Manifest;
    if (manifest.version !== 1 || !manifest.current?.startsWith(accountPrefix(uid)) || manifest.current === manifestKey(uid) || (manifest.previous && !manifest.previous.startsWith(accountPrefix(uid)))) throw new Error();
    return manifest;
  } catch { throw new LocalAccountVaultError("read", undefined, "manifest"); }
}

async function readSnapshot(uid: string): Promise<Snapshot | null> {
  const manifest = await readManifest(uid);
  if (!manifest) return null;
  const raw = await AsyncStorage.getItem(manifest.current);
  if (!raw) throw new LocalAccountVaultError("read", undefined, "snapshot-missing");
  const text = await decryptText(raw);
  if (!text) throw new LocalAccountVaultError("read", undefined, "snapshot-decrypt");
  let detail: ReadDetail = "snapshot-format";
  try {
    const snapshot = JSON.parse(text) as StoredSnapshot;
    const expectedKeys = keys.filter(key =>
      (snapshot.version !== 1 || key !== STORAGE_KEYS.personalReturnPending) &&
      (snapshot.version === 3 || key !== STORAGE_KEYS.businessDeleted));
    if (![1, 2, 3].includes(snapshot.version) || snapshot.uid !== uid || !Array.isArray(snapshot.entries) || snapshot.entries.length !== expectedKeys.length) throw new Error();
    detail = "snapshot-block";
    const seen = new Set<string>();
    const entries: Snapshot["entries"] = [];
    for (const entry of snapshot.entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || !expectedKeys.includes(entry[0]) || seen.has(entry[0]) || (entry[1] !== null && typeof entry[1] !== "string")) throw new Error();
      seen.add(entry[0]);
      if (entry[1] === null) entries.push([entry[0], null]);
      else {
        if (!entry[1].startsWith(`${manifest.current}:`)) throw new Error();
        const value = await AsyncStorage.getItem(entry[1]);
        if (!value) throw new Error();
        const decoded = await decryptText(value);
        if (!decoded) throw new Error();
        JSON.parse(decoded);
        // El lector antiguo de tarjetas todavía espera JSON directo. La copia
        // sigue cifrada; al devolverla se conserva su formato de migración.
        entries.push([entry[0], entry[0] === "@fino/credit-v1" ? decoded : value]);
      }
    }
    if (snapshot.version === 1) entries.push([STORAGE_KEYS.personalReturnPending, null]);
    if (snapshot.version < 3) entries.push([STORAGE_KEYS.businessDeleted, null]);
    return { version: 1, uid, entries };
  } catch { throw new LocalAccountVaultError("read", undefined, detail); }
}

async function saveSnapshot(uid: string): Promise<void> {
  if (hasUnreadableLocalData() || !await flushPendingSavesChecked()) throw new LocalAccountVaultError("write");
  setAccountStorageAvailable(false);
  await flushPendingSaves();
  const entries = (await AsyncStorage.multiGet(keys)).map(([key, raw]) => [key, raw] as [string, string | null]);
  // Verificar también los originales: una clave dañada no es un dato vacío.
  for (const [, raw] of entries) {
    if (raw === null) continue;
    try { JSON.parse(await decryptText(raw) ?? raw); }
    catch { throw new LocalAccountVaultError("read", undefined, "active-block"); }
  }
  const generation = `${accountPrefix(uid)}${Crypto.randomUUID()}`;
  const old = await readManifest(uid);
  try {
  const refs: StoredSnapshot["entries"] = [];
  // Una clave por bloque evita reunir todo el historial y las fotos en una
  // única fila grande de AsyncStorage (Android limita el tamaño de lectura).
  for (let index = 0; index < entries.length; index++) {
    const [key, original] = entries[index];
    if (original === null) { refs.push([key, null]); continue; }
    const value = original.startsWith("v2:") ? original : await encryptText(await decryptText(original) ?? original);
    const ref = `${generation}:${index}`;
    await AsyncStorage.setItem(ref, value);
    if (await AsyncStorage.getItem(ref) !== value) throw new LocalAccountVaultError("write");
    refs.push([key, ref]);
  }
  const text = JSON.stringify({ version: 3, uid, entries: refs } satisfies StoredSnapshot);
  const raw = await encryptText(text);
  await AsyncStorage.setItem(generation, raw);
  if (await decryptText(await AsyncStorage.getItem(generation) ?? "") !== text) throw new LocalAccountVaultError("write");
  // El puntero se cambia SOLO cuando la generación completa se leyó de vuelta.
  // Una interrupción antes deja los datos activos y la copia anterior intactos.
  const manifest = await encryptText(JSON.stringify({ version: 1, current: generation, previous: old?.current }));
  await AsyncStorage.setItem(manifestKey(uid), manifest);
  if (await AsyncStorage.getItem(manifestKey(uid)) !== manifest) throw new LocalAccountVaultError("write");
  if (old?.previous) {
    const obsolete = (await AsyncStorage.getAllKeys()).filter((key) => key === old.previous || key.startsWith(`${old.previous}:`));
    await AsyncStorage.multiRemove(obsolete).catch(() => undefined);
  }
  } catch (error) {
    // Una copia sin puntero confirmado no es recuperable y no debe llenar el
    // teléfono tras varios reintentos. Los originales siguen intactos.
    const manifest = await readManifest(uid).catch(() => null);
    if (manifest?.current !== generation) {
      const incomplete = await AsyncStorage.getAllKeys().catch(() => []);
      await AsyncStorage.multiRemove(incomplete.filter((key) => key === generation || key.startsWith(`${generation}:`))).catch(() => undefined);
    }
    throw error;
  }
}

async function restore(uid: string, snapshot: Snapshot | null, assertCurrentSession: () => void): Promise<void> {
  assertCurrentSession();
  setAccountStorageAvailable(false);
  await clearAccountData();
  assertCurrentSession();
  if (snapshot) {
    for (const [key, raw] of snapshot.entries) {
      assertCurrentSession();
      if (raw !== null) {
        await AsyncStorage.setItem(key, raw);
        assertCurrentSession();
      }
    }
    const restored = new Map(await AsyncStorage.multiGet(keys));
    assertCurrentSession();
    if (snapshot.entries.some(([key, raw]) => restored.get(key) !== raw)) throw new LocalAccountVaultError("write");
  }
  // Hasta aquí el dueño anterior sigue registrado. Tras una interrupción,
  // el arranque volverá a restaurar antes de habilitar lecturas o escrituras.
  await writeOwner({ uid, mode: "active" }, assertCurrentSession);
  assertCurrentSession();
  setAccountStorageAvailable(true);
}

async function prepare(uid: string, email?: string | null, openingUser = auth.currentUser, options?: PreparationOptions): Promise<boolean> {
  let owner: Owner | null;
  const assertCurrentSession = () => {
    if (!openingUser || openingUser.uid !== uid || auth.currentUser !== openingUser) {
      // Un intento viejo no retira el acceso de otro dueño activo confirmado.
      // Datos sin dueño o de una sesión anterior siguen inaccesibles.
      if (!owner || owner.mode !== "active" || owner.uid !== auth.currentUser?.uid) setAccountStorageAvailable(false);
      throw new LocalAccountVaultError("owner", "session");
    }
  };
  owner = await readOwner();
  assertCurrentSession();
  const recoveryRequested = !!options?.recoverUnidentifiedLegacyFor;
  let recoveryProfileRaw: string | null = null;
  const profile = await readProfile(recoveryRequested ? raw => { recoveryProfileRaw = raw; } : undefined);
  assertCurrentSession();
  const assertRecoveryPermission = () => {
    assertCurrentSession();
    if (!isLocalAccountRecoveryEnabled()) throw new LocalAccountVaultError("owner", "unidentified");
    if (options?.recoverUnidentifiedLegacyFor !== openingUser || !emailKey(openingUser?.email)
      || emailKey(openingUser?.email) !== emailKey(email)) throw new LocalAccountVaultError("owner", "session");
    if (!openingUser?.emailVerified || !openingUser.providerData.some(provider => provider.providerId === "google.com")) {
      throw new LocalAccountVaultError("verification");
    }
  };
  if (recoveryRequested) {
    assertRecoveryPermission();
    // Solo este legado sin dueño/correo y configurado. Una autorización manual
    // nunca entra por las rutas de cambio, archivo o restauración de cuentas.
    if (owner || !profile || profile.hasOnboarded !== true || emailKey(profile.userEmail)) {
      setAccountStorageAvailable(false);
      throw new LocalAccountVaultError("read", undefined, "recovery-ineligible");
    }
  }
  if (owner?.mode === "active" && !profile) {
    // Perfil ausente no significa cuenta vacía. No sustituir datos activos
    // por una copia vieja ni borrar los bloques que siguen en el teléfono.
    const remainingData = await hasUnownedAccountData();
    assertCurrentSession();
    if (remainingData) {
      setAccountStorageAvailable(false);
      throw new LocalAccountVaultError("read", undefined, "profile-missing");
    }
  }
  if (!owner) {
    // Migración de la instalación anterior: los datos se vinculan solo al
    // correo confirmado de la sesión real, no al correo escrito en registro.
    if (profile?.hasOnboarded) {
      setAccountStorageAvailable(false);
      if (!emailKey(profile.userEmail) && !recoveryRequested) throw new LocalAccountVaultError("owner", "unidentified");
      if (!emailKey(email)) throw new LocalAccountVaultError("owner", "session");
      if (!recoveryRequested && emailKey(profile.userEmail) !== emailKey(email)) throw new LocalAccountVaultError("owner");
      const assertLegacySession = () => {
        assertCurrentSession();
        if (recoveryRequested) assertRecoveryPermission();
        if (!openingUser || auth.currentUser !== openingUser || openingUser.uid !== uid ||
          !emailKey(openingUser.email) || emailKey(openingUser.email) !== emailKey(recoveryRequested ? email : profile.userEmail)) {
          throw new LocalAccountVaultError("owner", "session");
        }
        if (!openingUser.emailVerified) throw new LocalAccountVaultError("verification");
      };
      assertLegacySession();
      // Un perfil activo anterior no se reemplaza por una copia archivada.
      // La adjudicación espera al cifrado y vuelve a comprobar la sesión.
      const claimedOwner = await writeOwner({ uid, mode: "active" }, assertLegacySession,
        recoveryRequested ? { ownerRaw: null, profileRaw: recoveryProfileRaw } : undefined);
      try {
        assertLegacySession();
        setAccountStorageAvailable(true);
        return profile.hasOnboarded === true;
      } catch (error) {
        await removeUnconfirmedOwner(claimedOwner);
        throw error;
      }
    } else {
      const unowned = await hasUnownedAccountData();
      assertCurrentSession();
      if (unowned) {
        setAccountStorageAvailable(false);
        throw new LocalAccountVaultError("owner", "unidentified");
      }
      const saved = await readSnapshot(uid);
      assertCurrentSession();
      if (saved) await restore(uid, saved, assertCurrentSession);
      else {
        await writeOwner({ uid, mode: "active" }, assertCurrentSession);
        assertCurrentSession();
        setAccountStorageAvailable(true);
      }
    }
  } else if (owner.uid === uid && owner.mode === "active" && profile) {
    assertCurrentSession();
    setAccountStorageAvailable(true);
  } else {
    if (owner.mode === "active" && owner.uid !== uid) {
      // Una cuenta que abandonó la configuración puede tener dueño, pero
      // aún no perfil ni archivo. Arriba se comprueba que no queden datos
      // sin perfil; aquí se conserva también esa cuenta vacía antes de
      // cambiar, con la misma confirmación de copia que una cuenta completa.
      await saveSnapshot(owner.uid);
      assertCurrentSession();
    }
    if (owner.uid !== uid || owner.mode === "archived") {
      // No borrar datos de otra cuenta si su copia no se puede comprobar.
      if (!await readSnapshot(owner.uid)) throw new LocalAccountVaultError("read", undefined,
        owner.mode === "active" && !profile ? "empty-active-archive-missing" : "archive-missing");
      assertCurrentSession();
      if (owner.mode === "active") await writeOwner({ uid: owner.uid, mode: "archived" }, assertCurrentSession);
    }
    const saved = await readSnapshot(uid);
    assertCurrentSession();
    await restore(uid, saved, assertCurrentSession);
  }
  const restoredProfile = await readProfile();
  assertCurrentSession();
  return restoredProfile?.hasOnboarded === true;
}

export function prepareLocalAccount(uid: string, email?: string | null, options?: PreparationOptions): Promise<boolean> {
  const openingUser = auth.currentUser;
  return withLocalAccountOperation(() => prepare(uid, email, openingUser, options));
}

export function archiveLocalAccount(uid: string, email?: string | null): Promise<void> {
  return withLocalAccountOperation(async () => {
    const owner = await readOwner();
    if (owner && (owner.uid !== uid || owner.mode !== "active")) throw new LocalAccountVaultError("owner");
    if (!owner) await prepare(uid, email);
    await saveSnapshot(uid);
    await writeOwner({ uid, mode: "archived" });
    setAccountStorageAvailable(false);
  });
}

/** Si Firebase no pudo cerrar la sesión, mantener también los cambios en memoria. */
export function resumeLocalAccount(uid: string): Promise<void> {
  return withLocalAccountOperation(async () => {
    const owner = await readOwner();
    if (owner && owner.uid !== uid) throw new LocalAccountVaultError("owner");
    await writeOwner({ uid, mode: "active" });
    setAccountStorageAvailable(true);
  });
}

/** Solo las elecciones previas al registro pueden leerse sin una sesión. */
export async function allowPreAccountPreferences(): Promise<boolean> {
  setAccountStorageAvailable(false);
  if (await readOwner()) return false;
  if ((await readProfile())?.hasOnboarded || await hasUnownedAccountData()) return false;
  setAccountStorageAvailable(true);
  return true;
}

/** Un trabajo de fondo jamás restaura una cuenta que cerró sesión. */
export async function allowBackgroundAccount(uid: string, email?: string | null): Promise<boolean> {
  const owner = await readOwner();
  if (owner?.mode === "archived" || (owner && owner.uid !== uid)) return false;
  if (!owner) await prepare(uid, email);
  else setAccountStorageAvailable(true);
  return true;
}

export async function deleteLocalAccountVault(uid: string): Promise<void> {
  await deleteLegalAcceptance(uid);
  const storedKeys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(storedKeys.filter((key) => key.startsWith(accountPrefix(uid))));
  if ((await readOwner())?.uid === uid) await AsyncStorage.removeItem(OWNER_KEY);
}
