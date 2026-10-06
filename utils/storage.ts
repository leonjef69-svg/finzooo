import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptText, encryptText } from "@/utils/encryption";

export const STORAGE_KEYS = {
  profile: "finzo:profile",
  budgets: "finzo:budgets",
  categoryBudgets: "finzo:categoryBudgets",
  transactions: "finzo:transactions",
  deletedTransactionIds: "finzo:deletedTransactionIds",
  goals: "finzo:goals",
  deletedGoalIds: "finzo:deletedGoalIds",
  isPremium: "finzo:isPremium",
  themeMode: "finzo:themeMode",
  // Preferencia visual del dispositivo, independiente de la cuenta y del modo claro/oscuro.
  visualStyle: "finzo:visualStyle",
  merchantLearned: "finzo:merchantLearned",
  // Meses en los que el "Saldo anterior" se muestra en cero, cada uno por
  // separado (lista de claves "AAAA-MM"). Poner uno en cero no afecta a
  // ningún otro mes.
  carryoverCleared: "finzo:carryoverCleared",
  // Registro de las últimas notificaciones capturadas y qué se hizo con
  // cada una. Solo sirve para la pantalla de diagnóstico de la captura
  // automática; no se sube a la nube.
  autoCaptureLog: "finzo:autoCaptureLog",
  /**
   * ESTAS TRES VIVÍAN SOLO EN SU PROPIO ARCHIVO, y por eso se quedaron fuera del
   * borrado al cerrar sesión (encontrado el 07/08/2026).
   *
   * Consecuencia real: alguien cerraba sesión y la siguiente cuenta que entrara en
   * ese celular heredaba las categorías que la persona anterior había creado, sus
   * nombres y colores, **y sus fotos**. Datos de una cuenta a la vista de otra.
   *
   * Pasó porque la lista de lo que se borra está aquí y estas claves estaban
   * escritas en utils/categoriasPropias, utils/categoryCustom y
   * utils/iconosFavoritos. Cada archivo sabía la suya y esta lista no las conocía.
   * Ahora se declaran aquí y esos archivos las leen de aquí: una clave nueva entra
   * en el borrado sola.
   */
  categoriasPropias: "finzo:categoriasPropias",
  categoryCustom: "finzo:categoryCustom",
  iconosFavoritos: "finzo:iconosFavoritos",
  // Fechas de los bloques sincronizados; evita que un teléfono con una copia
  // antigua pise presupuesto, calendario o categorías al subir otro cambio.
  cloudSyncMeta: "finzo:cloudSyncMeta",
  /**
   * A QUIÉN LE MANDAS LOS REPORTES. **Y ESTA ES LA CUARTA QUE FALTABA** (18/08/2026).
   *
   * Vivía como una constante privada dentro de `utils/sendContacts.ts`, así que no estaba
   * aquí y por eso **no entraba en el borrado al cerrar sesión** — exactamente el mismo
   * agujero que tuvieron las tres de arriba el 07/08, y por el mismo motivo: una clave
   * declarada en su propio archivo es una clave que esta lista no conoce.
   *
   * Lo que dejaba: alguien cierra sesión, entra otra cuenta en ese celular, y **hereda los
   * nombres, correos y teléfonos de las personas a las que la anterior le mandaba sus
   * reportes**. Son datos de terceros, no suyos, y es lo más delicado que guarda la app.
   *
   * Se descubrió el 18/08/2026 comprobando otra cosa: si estos contactos viajaban a la nube
   * (no viajan — se quedan en el aparato, y por eso NO se declaran como recogidos en Play).
   *
   * Declarada aquí, la prueba que recorre STORAGE_KEYS obliga sola a que esté en el borrado.
   */
  sendContacts: "finzo:sendContacts",
  /**
   * EL CALENDARIO DE PAGOS (18/08/2026). Netflix, la luz, el agua, el sueldo.
   *
   * Es de la CUENTA y no del aparato: quien cambia de celular espera que sus recibos sigan
   * ahí. Por eso viaja en la copia de la nube y por eso entra en el borrado de más abajo.
   */
  pagosProgramados: "finzo:pagosProgramados",
  /**
   * Tarjetas, compras, cuotas y pagos relacionados. Es información de la
   * cuenta: se cifra y se borra al cerrar sesión.
   */
  creditCards: "finzo:creditCards",
  /**
   * Cuándo se activó la prueba gratuita de Premium. Solo de este celular: no viaja
   * a la nube. Ver utils/pruebaPremium.
   */
  pruebaPremium: "finzo:pruebaPremium",
  /**
   * MODO NEGOCIO (V1, 07/08/2026). Los negocios, sus productos y sus ventas.
   *
   * VAN EN SU PROPIA CLAVE Y NO DENTRO DE "transactions", y eso es la decisión de
   * arquitectura de todo el Modo Negocio, no un detalle de guardado.
   *
   * Lo que se pidió es que la plata del negocio NO se mezcle con la personal *"ni en los
   * totales"*. Había dos formas de conseguirlo:
   *
   *   · Marcar cada movimiento con su negocio, y **filtrar en los 16 sitios** que leen
   *     movimientos. Si se olvida uno, la plata del negocio se suma a los totales
   *     personales y no se nota hasta que las cuentas no cuadren.
   *   · Guardarlos aparte, y que el camino personal no los vea nunca.
   *
   * Se eligió lo segundo: así no mezclarse **no depende de acordarse de filtrar**, depende
   * de que los datos no estén ahí. En una app de dinero eso vale más que la elegancia.
   *
   * Y las tres están en el borrado de abajo desde el primer día, por lo que pasó el
   * 07/08/2026 con las categorías propias: una clave que vive solo en su archivo se queda
   * fuera del borrado, y la cuenta siguiente hereda los datos de la anterior.
   */
  negocios: "finzo:negocios",
  productos: "finzo:productos",
  ventas: "finzo:ventas",
  movimientosNegocio: "finzo:movimientosNegocio",
  // Cajas de dinero independientes. No reutilizan Modo Negocio: una caja puede
  // ser Casa, Viaje o Ana y solo contiene entradas y salidas propias.
  cajasDinero: "finzo:cajasDinero",
  // La indicación inicial del botón + pertenece a la cuenta y se oculta tras
  // el primer uso. Se borra al cerrar sesión para no heredarla entre cuentas.
  plusHint: "finzo:plusHint",
  // Avisos que ya se revisaron en Inicio. Es solo estado local para el punto
  // rojo de la campana; no se comparte ni se sincroniza con la nube.
  homeNotificationSeen: "finzo:homeNotificationSeen",
  personalReturnPending: "finzo:personalReturnPending",
} as const;

/** Retira automáticamente los datos falsos que dejaron versiones antiguas. */
export async function clearRetiredAlternateData(): Promise<void> {
  const obsoleteKeys = Object.values(STORAGE_KEYS).map((key) =>
    key.replace(/^finzo:/, "finzo:decoy:"),
  );
  await AsyncStorage.multiRemove(obsoleteKeys).catch(() => undefined);
}

// Inventario común al borrado activo y al archivo cifrado por cuenta.
// themeMode y visualStyle pertenecen al dispositivo y quedan fuera.
export const ACCOUNT_STORAGE_KEYS = [
        STORAGE_KEYS.profile,
        STORAGE_KEYS.budgets,
        STORAGE_KEYS.categoryBudgets,
        STORAGE_KEYS.transactions,
        STORAGE_KEYS.deletedTransactionIds,
        STORAGE_KEYS.goals,
        STORAGE_KEYS.deletedGoalIds,
        STORAGE_KEYS.isPremium,
        STORAGE_KEYS.merchantLearned,
        STORAGE_KEYS.carryoverCleared,
        STORAGE_KEYS.autoCaptureLog,
        // Las tres que faltaban. Sin ellas, la cuenta siguiente heredaba las
        // categorías, la personalización y las fotos de la anterior. Ver la nota
        // en STORAGE_KEYS.
        STORAGE_KEYS.categoriasPropias,
        STORAGE_KEYS.categoryCustom,
        STORAGE_KEYS.iconosFavoritos,
        STORAGE_KEYS.cloudSyncMeta,
        // Y la cuarta, encontrada el 18/08/2026: son correos y teléfonos de OTRAS
        // personas. Ver la nota en STORAGE_KEYS.
        STORAGE_KEYS.sendContacts,
        // El calendario es de la cuenta: sus recibos no pueden quedar a la vista de quien
        // entre después en este celular.
        STORAGE_KEYS.pagosProgramados,
        STORAGE_KEYS.creditCards,
        // La prueba gratuita también: es de la cuenta que se va, no del aparato.
        // Dejándola, la cuenta siguiente entraría con la prueba ya gastada.
        STORAGE_KEYS.pruebaPremium,
        // El negocio es de la cuenta, no del aparato: sus ventas y sus precios no pueden
        // quedar a la vista de quien entre después. Ver la nota en STORAGE_KEYS.
        STORAGE_KEYS.negocios,
        STORAGE_KEYS.productos,
        STORAGE_KEYS.ventas,
        STORAGE_KEYS.movimientosNegocio,
        STORAGE_KEYS.cajasDinero,
        STORAGE_KEYS.plusHint,
        STORAGE_KEYS.homeNotificationSeen,
        STORAGE_KEYS.personalReturnPending,
        // Integraciones y tareas que pertenecen a la cuenta, aunque sus claves
        // vivan fuera del almacén principal.
        "finzo:scheduledExport",
        "finzo:scheduledExport.proxima",
        "finzo:scheduledExport.lastExport",
        "finzo:scheduledExport.lastTap",
        "finzo:exportacionEnFondo.ultimo",
        "finzo:carpetaExportacion",
        "finzo:capturaPendiente",
        "finzo:avisosEncendidos",
        "@fino/credit-v1",
      ];

const accountKeySet = new Set(ACCOUNT_STORAGE_KEYS);
let accountStorageAvailable = false;
let accountAccessVersion = 0;

/** Ningún dato de cuenta se carga hasta comprobar quién inició sesión. */
export function setAccountStorageAvailable(available: boolean): void {
  if (accountStorageAvailable === available) return;
  accountAccessVersion += 1;
  accountStorageAvailable = available;
  if (!available) discardPendingSaves();
}

/** Permite rechazar respuestas antiguas, incluso A → B → A. Solo lectura. */
export function getAccountStorageSession(): number | null {
  return accountStorageAvailable ? accountAccessVersion : null;
}

function canAccessKey(key: string): boolean {
  return !accountKeySet.has(key) || accountStorageAvailable;
}

export async function clearAccountData(): Promise<void> {
  discardPendingSaves();
  await waitForInFlightWrites();
  // Las claves con el prefijo antiguo se incluyen para limpiar también
  // cualquier dato falso que haya quedado de versiones anteriores.
  const allKeys = Array.from(new Set(ACCOUNT_STORAGE_KEYS.flatMap((key) => [
    key,
    key.replace(/^finzo:/, "finzo:decoy:"),
  ])));
  try {
    await AsyncStorage.multiRemove(allKeys);
    // La primera versión del módulo de tarjetas guardaba fuera del almacén
    // central. Se retira también al cerrar sesión para que nunca pase a la
    // siguiente cuenta, incluso si todavía no alcanzó a migrarse.
    await AsyncStorage.removeItem("@fino/credit-v1");
  } catch {
    // Algunos fabricantes fallan al borrar muchas claves juntas. Se vuelve
    // a intentar una por una para no dejar datos de la cuenta anterior.
    const results = await Promise.allSettled(
      [...allKeys, "@fino/credit-v1"].map((key) =>
        AsyncStorage.removeItem(key),
      ),
    );
    if (results.some((result) => result.status === "rejected")) {
      reportStorageWriteError();
      throw new Error("account-local-data-clear-failed");
    }
  }
  unreadableLocalData = false;
  failedWriteKeys.clear();
}

// Un fallo de lectura no es una lista vacía. Conservamos el texto cifrado
// original e impedimos cualquier guardado local o respaldo de datos parciales
// hasta que se pueda abrir de nuevo. El bloqueo vive en memoria: al reiniciar,
// Android vuelve a intentar leer la llave y los datos originales.
let unreadableLocalData = false;
type StorageReadErrorListener = () => void;
let storageReadErrorListener: StorageReadErrorListener | null = null;

export function hasUnreadableLocalData(): boolean {
  return unreadableLocalData;
}

export function subscribeStorageReadErrors(listener: StorageReadErrorListener): () => void {
  storageReadErrorListener = listener;
  if (unreadableLocalData) listener();
  return () => {
    if (storageReadErrorListener === listener) storageReadErrorListener = null;
  };
}

function markUnreadableLocalData(): void {
  if (unreadableLocalData) return;
  unreadableLocalData = true;
  discardPendingSaves();
  storageReadErrorListener?.();
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  if (!canAccessKey(key)) return fallback;
  const version = accountAccessVersion;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const decrypted = await decryptText(raw);
    if (accountKeySet.has(key) && (version !== accountAccessVersion || !canAccessKey(key))) return fallback;
    if (decrypted != null) {
      const parsed = JSON.parse(decrypted) as T;
      // Los datos AES-CBC antiguos siguen siendo legibles, pero se actualizan
      // en segundo plano al formato autenticado v2 en la primera lectura.
      if (!raw.startsWith("v2:")) saveJSON(key, parsed);
      return parsed;
    }
    // Dato guardado antes de activar el cifrado: lo leemos tal cual por
    // esta vez (la próxima vez que se guarde, va a quedar cifrado).
    const parsed = JSON.parse(raw) as T;
    saveJSON(key, parsed);
    return parsed;
  } catch {
    markUnreadableLocalData();
    return fallback;
  }
}

// Guardados agrupados ("debounce") por clave.
//
// Por qué: cifrar es una operación pesada que corre en el mismo hilo que
// la interfaz — con AES sobre TODA la lista de movimientos. Antes, cada
// cambio de estado disparaba su guardado al instante, así que un solo
// toque podía provocar varios cifrados completos seguidos y la app se
// sentía trabada. Ahora los cambios que ocurren juntos se agrupan y se
// cifran UNA sola vez.
//
// El retardo es corto (400 ms) a propósito: suficiente para agrupar la
// ráfaga de cambios de una misma acción, pero lo bastante breve como para
// que un cierre normal de la app no alcance a perder nada. Para los casos
// donde sí hace falta certeza (cerrar sesión, borrar cuenta), existe
// flushPendingSaves() más abajo.
const DEBOUNCE_MS = 400;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, unknown>();
const pendingEpochs = new Map<string, number>();
const writeEpochs = new Map<string, number>();
let writeQueue: Promise<unknown> = Promise.resolve();
const inFlightWrites = new Set<Promise<unknown>>();
const failedWriteKeys = new Set<string>();
type StorageWriteErrorListener = () => void;
let storageWriteErrorListener: StorageWriteErrorListener | null = null;
let lastStorageWriteErrorAt = 0;

/** Permite que la interfaz avise si Android no pudo guardar un cambio. */
export function subscribeStorageWriteErrors(listener: StorageWriteErrorListener): () => void {
  storageWriteErrorListener = listener;
  return () => {
    if (storageWriteErrorListener === listener) storageWriteErrorListener = null;
  };
}

function reportStorageWriteError(): void {
  const now = Date.now();
  // Varias partes de una misma acción se guardan juntas. Un solo aviso es
  // suficiente y evita llenar la pantalla con el mismo error.
  if (now - lastStorageWriteErrorAt < 5_000) return;
  lastStorageWriteErrorAt = now;
  storageWriteErrorListener?.();
}

function trackWrite<T>(promise: Promise<T>): Promise<T> {
  inFlightWrites.add(promise);
  void promise.then(() => inFlightWrites.delete(promise), () => inFlightWrites.delete(promise));
  return promise;
}

async function waitForInFlightWrites(): Promise<void> {
  while (inFlightWrites.size) await Promise.allSettled([...inFlightWrites]);
}

function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(work, work);
  writeQueue = result.then(() => undefined, () => undefined);
  return trackWrite(result);
}

function cancelPendingKey(key: string): void {
  const timer = pendingTimers.get(key);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(key); pendingValues.delete(key); pendingEpochs.delete(key);
}

function writeNow(key: string, value: unknown, epoch = writeEpochs.get(key) ?? 0): Promise<void> {
  if (!canAccessKey(key)) return Promise.resolve();
  const version = accountAccessVersion;
  if (unreadableLocalData) {
    failedWriteKeys.add(key);
    reportStorageWriteError();
    return Promise.resolve();
  }
  return enqueueWrite(() => encryptText(JSON.stringify(value))
    .then(async (encrypted) => {
      if (!canAccessKey(key) || (accountKeySet.has(key) && version !== accountAccessVersion) || epoch !== (writeEpochs.get(key) ?? 0)) return false;
      if (unreadableLocalData) throw new Error("local-data-unreadable");
      await AsyncStorage.setItem(key, encrypted);
      return true;
    })
    .then((written) => { if (written) failedWriteKeys.delete(key); })
    .then(() => undefined)
    .catch(() => {
      failedWriteKeys.add(key);
      reportStorageWriteError();
    }));
}

/**
 * Variante inmediata y comprobable para datos que una pantalla espera haber
 * guardado antes de volver atrás. También cancela una escritura anterior en
 * cola para impedir que llegue después y pise el valor nuevo.
 */
export function saveJSONNow(key: string, value: unknown): Promise<boolean> {
  return trackWrite(saveJSONNowUntracked(key, value));
}

async function saveJSONNowUntracked(key: string, value: unknown): Promise<boolean> {
  if (!canAccessKey(key)) return false;
  const version = accountAccessVersion;
  const epoch = writeEpochs.get(key) ?? 0;
  const target = key;
  cancelPendingKey(target);
  if (unreadableLocalData) {
    failedWriteKeys.add(target);
    reportStorageWriteError();
    return false;
  }
  return enqueueWrite(async () => { try {
    const encrypted = await encryptText(JSON.stringify(value));
    if (!canAccessKey(key) || (accountKeySet.has(key) && version !== accountAccessVersion) || epoch !== (writeEpochs.get(key) ?? 0)) return false;
    if (unreadableLocalData) throw new Error("local-data-unreadable");
    await AsyncStorage.setItem(target, encrypted);
    failedWriteKeys.delete(target);
    return true;
  } catch {
    failedWriteKeys.add(target);
    reportStorageWriteError();
    return false;
  } });
}

export type PreparedLocalBatch = {
  entries: [string, unknown][];
  stillValid: () => boolean;
  committed: () => void;
};

/** Android: el módulo instalado escribe el lote en una transacción SQLite.
 * Preparar/cifrar todo antes; ninguna escritura vieja pasa por encima del lote.
 * El llamador no habilita operaciones de varias claves en plataformas sin esa
 * garantía. Una sola clave conserva el comportamiento previo de AsyncStorage.
 */
export function saveJSONBatchNow(keys: string[], prepare: () => PreparedLocalBatch): Promise<boolean> {
  const version = accountAccessVersion;
  if (!keys.length || new Set(keys).size !== keys.length || keys.some(key => !canAccessKey(key)) || unreadableLocalData) return Promise.resolve(false);
  return enqueueWrite(async () => {
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (version !== accountAccessVersion || unreadableLocalData || keys.some(key => !canAccessKey(key))) return false;
        const batch = prepare();
        if (batch.entries.length !== keys.length || batch.entries.some(([key]) => !keys.includes(key)) || new Set(batch.entries.map(([key]) => key)).size !== keys.length) throw new Error("local-batch-invalid");
        const encrypted: [string, string][] = [];
        for (const [key, value] of batch.entries) encrypted.push([key, await encryptText(JSON.stringify(value))]);
        if (version !== accountAccessVersion || unreadableLocalData || keys.some(key => !canAccessKey(key))) return false;
        let before: Map<string, string | null>;
        try { before = new Map(await AsyncStorage.multiGet(keys)); }
        catch { markUnreadableLocalData(); throw new Error("local-batch-source-unreadable"); }
        if (version !== accountAccessVersion || unreadableLocalData || keys.some(key => !canAccessKey(key))) return false;
        if (!batch.stillValid()) continue;
        let writeError: unknown;
        try { await AsyncStorage.multiSet(encrypted); } catch (error) { writeError = error; }
        // El resultado perdido después del commit también se confirma leyendo
        // exactamente el texto cifrado enviado; nunca se repite dinero a ciegas.
        let saved: Map<string, string | null>;
        try { saved = new Map(await AsyncStorage.multiGet(keys)); }
        catch { markUnreadableLocalData(); throw new Error("local-batch-unconfirmed"); }
        if (encrypted.some(([key, value]) => saved.get(key) !== value)) {
          if (encrypted.some(([key, value]) => before.get(key) !== value && saved.get(key) === value)) markUnreadableLocalData();
          throw writeError ?? new Error("local-batch-not-saved");
        }
        for (const key of keys) {
          writeEpochs.set(key, (writeEpochs.get(key) ?? 0) + 1);
          cancelPendingKey(key); failedWriteKeys.delete(key);
        }
        if (version !== accountAccessVersion || keys.some(key => !canAccessKey(key))) return false;
        batch.committed();
        return true;
      }
      return false;
    } catch (error) {
      if (error instanceof Error && ["private-box-source-changed", "private-box-invalid-patch", "private-box-id-conflict"].includes(error.message)) return false;
      for (const key of keys) failedWriteKeys.add(key);
      reportStorageWriteError(); return false;
    }
  });
}

export function saveJSON(key: string, value: unknown): void {
  if (!canAccessKey(key)) return;
  if (unreadableLocalData) {
    reportStorageWriteError();
    return;
  }
  const target = key;
  pendingValues.set(target, value);
  pendingEpochs.set(target, writeEpochs.get(target) ?? 0);

  const existing = pendingTimers.get(target);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    target,
    setTimeout(() => {
      pendingTimers.delete(target);
      const pending = pendingValues.get(target);
      const epoch = pendingEpochs.get(target);
      pendingValues.delete(target);
      pendingEpochs.delete(target);
      writeNow(target, pending, epoch);
    }, DEBOUNCE_MS)
  );
}

// Escribe YA todo lo que estuviera esperando su turno, y espera a que
// termine. Se usa antes de acciones que no admiten perder nada a medias:
// cerrar sesión y eliminar la cuenta (ambas borran el almacenamiento
// justo después, así que un guardado pendiente llegaría tarde y
// reescribiría datos de la sesión anterior).
export async function flushPendingSaves(): Promise<void> {
  const queued: [string, unknown, number][] = [];
  for (const [key, timer] of pendingTimers) {
    clearTimeout(timer);
    const value = pendingValues.get(key);
    pendingValues.delete(key);
    queued.push([key, value, pendingEpochs.get(key) ?? 0]);
    pendingEpochs.delete(key);
  }
  pendingTimers.clear();
  // El valor más reciente en cola se escribe después de un guardado anterior
  // que ya empezó, aunque cifrar ese anterior haya tardado más.
  await waitForInFlightWrites();
  const writes = queued.map(([key, value, epoch]) => writeNow(key, value, epoch));
  await Promise.all(writes);
  await waitForInFlightWrites();
}

export async function flushPendingSavesChecked(): Promise<boolean> {
  await flushPendingSaves();
  return !unreadableLocalData && failedWriteKeys.size === 0;
}

// Cancela los guardados pendientes SIN escribirlos. Se usa al borrar los
// datos de la cuenta: lo que quedara en cola pertenece a la sesión que se
// está cerrando y volvería a escribir en disco lo que se acaba de borrar.
export function discardPendingSaves(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer);
  pendingTimers.clear();
  pendingValues.clear();
  pendingEpochs.clear();
}
