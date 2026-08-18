import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptText, encryptText } from "@/utils/encryption";
import { isDecoyActive } from "@/utils/decoyMode";

/**
 * Traduce una clave según el modo en que esté la app.
 *
 * Esta línea es todo el modo señuelo, del lado del guardado. Con el señuelo
 * encendido, "finzo:transactions" pasa a ser "finzo:decoy:transactions", y a
 * partir de ahí la app entera —Inicio, Historial, Reportes, exportar, el
 * escáner— trabaja sobre otro conjunto de datos sin enterarse de nada.
 *
 * Se hace aquí, en el punto más bajo, y no en cada pantalla, precisamente
 * para que ninguna pantalla pueda olvidarse. Todo lo que se guarda pasa por
 * estas funciones; no hay ninguna otra puerta.
 *
 * Los datos reales quedan intactos bajo sus claves de siempre: el señuelo no
 * los borra ni los toca, solo mira a otro lado.
 */
function actualKey(key: string): string {
  return isDecoyActive() ? key.replace(/^finzo:/, "finzo:decoy:") : key;
}

export const STORAGE_KEYS = {
  profile: "finzo:profile",
  budgets: "finzo:budgets",
  categoryBudgets: "finzo:categoryBudgets",
  transactions: "finzo:transactions",
  goals: "finzo:goals",
  isPremium: "finzo:isPremium",
  themeMode: "finzo:themeMode",
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
} as const;

// Borra todos los datos de la cuenta de golpe (operación atómica y
// esperada). themeMode se conserva porque es preferencia del dispositivo,
// no de la cuenta.
export async function clearAccountData(): Promise<void> {
  // Primero se descartan los guardados en cola: son de la sesión que se
  // está cerrando y, si llegaran después del borrado, volverían a escribir
  // en el celular los datos que acabamos de eliminar.
  discardPendingSaves();
  try {
    await AsyncStorage.multiRemove(
      [
        STORAGE_KEYS.profile,
        STORAGE_KEYS.budgets,
        STORAGE_KEYS.categoryBudgets,
        STORAGE_KEYS.transactions,
        STORAGE_KEYS.goals,
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
        // Y la cuarta, encontrada el 18/08/2026: son correos y teléfonos de OTRAS
        // personas. Ver la nota en STORAGE_KEYS.
        STORAGE_KEYS.sendContacts,
        // La prueba gratuita también: es de la cuenta que se va, no del aparato.
        // Dejándola, la cuenta siguiente entraría con la prueba ya gastada.
        STORAGE_KEYS.pruebaPremium,
        // El negocio es de la cuenta, no del aparato: sus ventas y sus precios no pueden
        // quedar a la vista de quien entre después. Ver la nota en STORAGE_KEYS.
        STORAGE_KEYS.negocios,
        STORAGE_KEYS.productos,
        STORAGE_KEYS.ventas,
        STORAGE_KEYS.movimientosNegocio,
      ].map(actualKey)
    );
  } catch {
    // Si falla el borrado, los saveJSON individuales de abajo sirven de
    // respaldo — la cuenta sigue sin datos relevantes.
  }
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(actualKey(key));
    if (raw == null) return fallback;
    const decrypted = await decryptText(raw);
    if (decrypted != null) {
      return JSON.parse(decrypted) as T;
    }
    // Dato guardado antes de activar el cifrado: lo leemos tal cual por
    // esta vez (la próxima vez que se guarde, va a quedar cifrado).
    return JSON.parse(raw) as T;
  } catch {
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

function writeNow(key: string, value: unknown): Promise<void> {
  return encryptText(JSON.stringify(value))
    .then((encrypted) => AsyncStorage.setItem(key, encrypted))
    .catch(() => {
      // Si falla el guardado (ej. sin espacio), la app sigue funcionando
      // normalmente, solo que ese cambio no quedó guardado.
    });
}

export function saveJSON(key: string, value: unknown): void {
  // La clave se traduce AQUÍ, al entrar en la cola, y no al escribir. Es
  // deliberado: si se tradujera al final, un guardado encolado justo antes
  // de cambiar de modo se escribiría en el almacén equivocado — datos
  // reales dentro del señuelo, o al revés.
  const target = actualKey(key);
  pendingValues.set(target, value);

  const existing = pendingTimers.get(target);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    target,
    setTimeout(() => {
      pendingTimers.delete(target);
      const pending = pendingValues.get(target);
      pendingValues.delete(target);
      writeNow(target, pending);
    }, DEBOUNCE_MS)
  );
}

// Escribe YA todo lo que estuviera esperando su turno, y espera a que
// termine. Se usa antes de acciones que no admiten perder nada a medias:
// cerrar sesión y eliminar la cuenta (ambas borran el almacenamiento
// justo después, así que un guardado pendiente llegaría tarde y
// reescribiría datos de la sesión anterior).
export async function flushPendingSaves(): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const [key, timer] of pendingTimers) {
    clearTimeout(timer);
    const value = pendingValues.get(key);
    pendingValues.delete(key);
    writes.push(writeNow(key, value));
  }
  pendingTimers.clear();
  await Promise.all(writes);
}

// Cancela los guardados pendientes SIN escribirlos. Se usa al borrar los
// datos de la cuenta: lo que quedara en cola pertenece a la sesión que se
// está cerrando y volvería a escribir en disco lo que se acaba de borrar.
export function discardPendingSaves(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer);
  pendingTimers.clear();
  pendingValues.clear();
}
