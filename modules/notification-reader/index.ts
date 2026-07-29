import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

// Una notificación tal como la capturó el servicio de Android, todavía sin
// interpretar.
export type CapturedNotification = {
  package: string;
  title: string;
  text: string;
  postedAt: number;
};

// Estado real del servicio de Android, para poder ver POR QUÉ no se captura
// nada cuando no se captura nada.
export type ReaderStats = {
  // ¿Android tiene enganchado el servicio AHORA? Es distinto de tener el
  // permiso: el permiso puede estar dado y el servicio caído.
  connected: boolean;
  connectedAt: number;
  // Cuántas notificaciones ha visto en total, de CUALQUIER app. Si esto es
  // 0, el servicio nunca arrancó. Si sube pero no se captura nada, el
  // servicio va bien y el problema es reconocer la app del banco.
  totalSeen: number;
  lastPackage: string;
  lastAt: number;
  enabled: boolean;
  queued: number;
};

type NativeShape = {
  isPermissionGranted: () => boolean;
  openPermissionSettings: () => void;
  isEnabled: () => boolean;
  setEnabled: (value: boolean) => void;
  drain: () => Promise<string>;
  clear: () => Promise<void>;
  stats: () => string;
  requestRebind: () => boolean;
};

// "Optional" porque este módulo solo existe en Android y solo dentro de una
// compilación de verdad. En iPhone, en Expo Go o en un APK viejo esto vale
// null, y todas las funciones de abajo responden como "no disponible" en vez
// de reventar la app.
const Native = requireOptionalNativeModule<NativeShape>("NotificationReader");

/**
 * Si esto es false, la función entera no existe en este dispositivo y la
 * pantalla de ajustes debe explicarlo en vez de ofrecer un interruptor que
 * no haría nada.
 */
export const isSupported = Platform.OS === "android" && Native != null;

/** ¿Android nos dio acceso a las notificaciones? */
export function isPermissionGranted(): boolean {
  if (!Native) return false;
  try {
    return Native.isPermissionGranted();
  } catch {
    return false;
  }
}

/** Abre la pantalla de Android donde se concede el acceso. */
export function openPermissionSettings(): void {
  try {
    Native?.openPermissionSettings();
  } catch {
    // Si el fabricante escondió esa pantalla no hay nada que hacer desde
    // aquí; la interfaz ya explica cómo llegar a mano.
  }
}

/** ¿La persona encendió la función dentro de Finzo? */
export function isEnabled(): boolean {
  if (!Native) return false;
  try {
    return Native.isEnabled();
  } catch {
    return false;
  }
}

export function setEnabled(value: boolean): void {
  try {
    Native?.setEnabled(value);
  } catch {
    // Sin módulo nativo no hay nada que encender.
  }
}

/**
 * Recoge todo lo capturado desde la última vez y vacía el buzón.
 * Devuelve lista vacía si no hay nada o si algo salió mal — nunca lanza,
 * porque se llama cada vez que la app vuelve al frente y un fallo aquí no
 * debe impedir que Finzo se abra.
 */
export async function drain(): Promise<CapturedNotification[]> {
  if (!Native) return [];
  try {
    const raw = await Native.drain();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is CapturedNotification =>
        n != null && typeof n.package === "string" && typeof n.postedAt === "number"
    );
  } catch {
    return [];
  }
}

/** Estado del servicio. Nunca lanza: si algo falla, devuelve todo en cero. */
export function stats(): ReaderStats {
  const empty: ReaderStats = {
    connected: false,
    connectedAt: 0,
    totalSeen: 0,
    lastPackage: "",
    lastAt: 0,
    enabled: false,
    queued: 0,
  };
  if (!Native) return empty;
  try {
    return { ...empty, ...(JSON.parse(Native.stats()) as Partial<ReaderStats>) };
  } catch {
    return empty;
  }
}

/**
 * Le pide a Android que vuelva a enganchar el servicio.
 * Es lo que suele arreglar que deje de capturar tras actualizar la app.
 */
export function requestRebind(): boolean {
  if (!Native) return false;
  try {
    return Native.requestRebind();
  } catch {
    return false;
  }
}

/** Vacía el buzón sin procesarlo (se usa al apagar la función). */
export async function clear(): Promise<void> {
  try {
    await Native?.clear();
  } catch {
    // Nada crítico: el buzón se sobrescribe solo con el tiempo.
  }
}
