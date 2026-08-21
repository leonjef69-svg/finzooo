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
  /**
   * CUANTOS AVISOS DE UNA APP DE DINERO, Y CUANDO EL ULTIMO.
   *
   * Aparte del total a proposito: `lastPackage` guarda solo la ULTIMA app, asi que un Yape
   * quedaba tapado por el WhatsApp siguiente y no habia forma de saber si habia llegado.
   * "Yape aviso y no supimos leerlo" y "Yape no aviso" son dos problemas distintos con dos
   * arreglos distintos, y desde la pantalla se veian igual.
   */
  moneySeen: number;
  lastMoneyPackage: string;
  lastMoneyAt: number;
  /** Las ultimas apps que avisaron, por nombre corto y separadas por coma. */
  ultimasApps: string;
  enabled: boolean;
  queued: number;
  // Por qué la voz habló o se calló con el último aviso: "hablo",
  // "sin-monto", "es-salida", "no-es-movimiento", "apagado"... Sin esto,
  // "no dijo nada" se ve igual con cualquiera de esos motivos, y averiguar
  // cuál era costaba hacer un yapeo de verdad y volver a empezar.
  lastSpeak: string;
  lastSpeakAt: number;
};

type NativeShape = {
  isPermissionGranted: () => boolean;
  openPermissionSettings: () => void;
  isEnabled: () => boolean;
  setEnabled: (value: boolean) => void;
  isSpeakEnabled: () => boolean;
  setSpeakEnabled: (value: boolean) => void;
  /** Enciende el motor de voz ya. Ver calentarVoz en el modulo de Android. */
  calentarVoz: () => void;
  isSpeakOutgoing: () => boolean;
  setSpeakOutgoing: (value: boolean) => void;
  /** La moneda elegida ("PEN", "MXN"...), para que la voz la diga en palabras. */
  setMoneda: (value: string) => void;
  drain: () => Promise<string>;
  clear: () => Promise<void>;
  stats: () => string;
  requestRebind: () => boolean;
  vozSinEspera: () => boolean;
  probarVoz: (texto: string) => Promise<string>;
  volumenDeAvisos: () => number;
  abrirAjustesDeVoz: () => boolean;
  abrirAjustesDeSonido: () => boolean;
  abrirAjustesDeBateria: () => boolean;
  addListener: (evento: string, cb: () => void) => { remove: () => void };
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

/** ¿La persona encendió la función dentro de Fino? */
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
 * debe impedir que Fino se abra.
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
    moneySeen: 0,
    lastMoneyPackage: "",
    lastMoneyAt: 0,
    ultimasApps: "",
    enabled: false,
    queued: 0,
    lastSpeak: "",
    lastSpeakAt: 0,
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

/**
 * Lo que puede faltarle a un celular para que la voz se oiga.
 *
 * "sin-apk" es de este lado: el APK instalado no trae el probador. Los otros los devuelve
 * Android. Ver ProbadorDeVoz.kt.
 */
export type ResultadoDeLaVoz =
  | "ok"
  | "sin-motor"
  | "sin-espanol"
  | "sin-volumen"
  | "sin-apk";

/**
 * Dice una frase AHORA y cuenta que paso.
 *
 * Es lo unico que separa "la app no intento hablar" de "este celular no puede hablar", que
 * desde fuera se ven igual: silencio.
 */
export async function probarVoz(texto: string): Promise<ResultadoDeLaVoz> {
  if (!Native?.probarVoz) return "sin-apk";
  try {
    return (await Native.probarVoz(texto)) as ResultadoDeLaVoz;
  } catch {
    return "sin-motor";
  }
}

/**
 * El volumen del canal de AVISOS, de 0 a 100. Con un APK anterior devuelve -1.
 *
 * Va aparte del de multimedia: el celular puede tener la musica alta y los avisos en cero,
 * y entonces la voz habla y no se oye. Es de los fallos mas dificiles de adivinar sin verlo.
 */
export function volumenDeAvisos(): number {
  if (!Native?.volumenDeAvisos) return -1;
  try {
    return Native.volumenDeAvisos();
  } catch {
    return -1;
  }
}

/** Abre los ajustes de Android donde se instala y elige la voz. */
export function abrirAjustesDeVoz(): boolean {
  if (!Native?.abrirAjustesDeVoz) return false;
  try {
    return Native.abrirAjustesDeVoz();
  } catch {
    return false;
  }
}

/** Abre los de sonido, para subir el volumen de los avisos. */
export function abrirAjustesDeSonido(): boolean {
  if (!Native?.abrirAjustesDeSonido) return false;
  try {
    return Native.abrirAjustesDeSonido();
  } catch {
    return false;
  }
}

/** Abre la ficha de Fino en los ajustes, donde se quita el ahorro de bateria. */
export function abrirAjustesDeBateria(): boolean {
  if (!Native?.abrirAjustesDeBateria) return false;
  try {
    return Native.abrirAjustesDeBateria();
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

/**
 * Si el celular DICE en voz alta lo que acaba de llegar.
 *
 * Lo hace el servicio de notificaciones, no la app: asi suena EN EL MOMENTO
 * en que llega el yapeo, aunque Fino este cerrada. Hecho desde la app, el
 * aviso llegaria al abrirla —horas despues— y ya no serviria de nada.
 *
 * Falso tambien si el APK es anterior a esto: es codigo nativo y no llega en
 * las actualizaciones por internet, asi que el interruptor no aparece.
 */
export function isSpeakEnabled(): boolean {
  if (!Native?.isSpeakEnabled) return false;
  try {
    return Native.isSpeakEnabled();
  } catch {
    return false;
  }
}

/**
 * Enciende el motor de voz sin esperar al primer yapeo.
 *
 * Se llama al arrancar la app y cada vez que vuelve al frente: el motor tarda 2 a 4 segundos
 * en despertar, y quien va a yapear casi siempre pasa por aqui antes. Si el APK es anterior a
 * esto, la funcion no existe y no pasa nada — por eso el "?.".
 */
export function calentarVoz(): void {
  try {
    Native?.calentarVoz?.();
  } catch {
    // Un motor que no se pudo adelantar habla igual, solo que un poco despues.
  }
}

export function setSpeakEnabled(value: boolean): void {
  try {
    Native?.setSpeakEnabled?.(value);
  } catch {
    // Sin la parte nativa no hay nada que guardar.
  }
}

/** Si tambien habla cuando SALE dinero, no solo cuando entra. */
export function isSpeakOutgoing(): boolean {
  if (!Native?.isSpeakOutgoing) return false;
  try {
    return Native.isSpeakOutgoing();
  } catch {
    return false;
  }
}

export function setSpeakOutgoing(value: boolean): void {
  try {
    Native?.setSpeakOutgoing?.(value);
  } catch {
    // Igual que arriba.
  }
}

/**
 * Le dice al servicio qué moneda está puesta, para que la voz la DIGA.
 *
 * La voz leía "S/ 1" tal cual y el celular pronunciaba "ese ene uno": el símbolo no es una
 * palabra. Quien habla es el servicio de Android, con Fino cerrada, así que no puede mirar
 * los ajustes de la app — hay que dejárselo escrito de antemano.
 *
 * Se manda al arrancar la app y cada vez que se cambia la moneda. En un celular con una
 * versión vieja de la app este método no existe: no pasa nada, se sigue diciendo "soles".
 */
export function setMoneda(value: string): void {
  try {
    Native?.setMoneda?.(value);
  } catch {
    // Igual que arriba.
  }
}

/**
 * Avisa EN EL MOMENTO en que el celular captura un aviso de dinero.
 *
 * Antes la app preguntaba "¿llegó algo?" cada ocho segundos. Funcionaba, pero
 * con la pantalla delante el movimiento tardaba en salir y eso se ve como que
 * no se registró.
 *
 * Devuelve la forma de darse de baja. Si el APK no trae esta parte —o no es
 * Android— devuelve una baja que no hace nada, y la app se queda con el
 * repaso cada ocho segundos, que sigue ahí como red.
 */
export function onCapture(cb: () => void): { remove: () => void } {
  if (!Native?.addListener) return { remove: () => {} };
  try {
    return Native.addListener("onCapture", cb);
  } catch {
    return { remove: () => {} };
  }
}

/** Si este APK trae la voz. Con uno anterior, el interruptor no se enseña. */
export const canSpeak = isSupported && typeof Native?.isSpeakEnabled === "function";

/**
 * Si este APK trae la voz ARREGLADA: la que reconoce el espacio duro de Yape
 * y deja dicho por qué se calló.
 *
 * No basta con `canSpeak`: el APK anterior también la traía, pero muda con un
 * yapeo de verdad. Sin poder distinguirlos por pantalla, un arreglo ya hecho
 * parece roto y se arregla dos veces — ya pasó.
 *
 * Se detecta por el motivo en el diagnóstico, que el anterior no manda.
 */
/**
 * Si este APK trae la voz SIN ESPERA: motor precalentado y en su propio hilo.
 *
 * Los APK del 2 de agosto por la tarde ya traían la voz, pero tardaban unos
 * segundos en hablar. Sin una marca que los distinga, "sigue tardando" no dice
 * si el arreglo llegó a instalarse o si no sirvió — y averiguarlo cuesta un
 * yapeo de verdad y otra ronda entera.
 */
export const hasVozSinEspera = typeof Native?.vozSinEspera === "function";

export const hasSpeakReason = (() => {
  if (!canSpeak) return false;
  try {
    return "lastSpeak" in (JSON.parse(Native!.stats()) as Record<string, unknown>);
  } catch {
    return false;
  }
})();
