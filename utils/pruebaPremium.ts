// LA PRUEBA GRATUITA DE PREMIUM: 24 HORAS, UNA SOLA VEZ
//
// Pedida el 07/08/2026 como parte del rediseño de la pantalla de Premium: un botón
// "Probar Premium gratis por 24 horas" y, al tocarlo, un aviso que dice cuánto dura,
// que solo se puede usar una vez y que no hace falta tarjeta.
//
// POR QUÉ ESTO NO TOCA EL PREMIUM DE VERDAD
//
// Son dos cosas separadas a propósito:
//
//   · el Premium "de la cuenta", que es el que se guarda y viaja a la nube;
//   · esta prueba, cuyo inicio también viaja con la cuenta para que reinstalar
//     o cambiar de celular no permita usarla otra vez.
//
// La pantalla ve UNA sola respuesta —"¿tiene Premium ahora mismo?"— que es la suma
// de las dos. Si estuvieran mezcladas, al caducar la prueba se apagaría también el
// Premium de quien ya lo tenía: alguien que lo tiene desde antes tocaría "probar"
// por curiosidad y al día siguiente lo habría perdido.
//
// El disco permite usarla sin conexión; la copia de la cuenta evita reiniciarla
// borrando los datos de la aplicación.

import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";

/**
 * Cuánto dura, en milisegundos.
 *
 * El texto de la pantalla dice "24 horas", así que este número y ese texto tienen
 * que decir lo mismo. Hay una prueba que compara los dos.
 */
export const DURACION_PRUEBA_MS = 24 * 60 * 60 * 1000;
export const DURACION_PRUEBA_HORAS = 24;

/**
 * Cuándo se activó la prueba, o null si no se ha usado nunca.
 *
 * Se guarda como objeto y no como número suelto para poder añadirle algo más
 * adelante —por ejemplo de qué versión venía— sin tener que convertir lo que ya
 * hubiera guardado en los celulares.
 *
 * Sin "export": solo la usan las dos funciones de abajo, y un tipo exportado que
 * nadie importa es una pieza que parece pública y no lo es.
 */
type PruebaPremium = { inicio: number | null };

/**
 * ¿La prueba está corriendo AHORA?
 *
 * Se le pasa el momento actual en vez de leer el reloj aquí dentro: así se puede
 * comprobar con números el borde exacto —el milisegundo en que caduca— en vez de
 * esperar 24 horas.
 */
export function pruebaVigente(inicio: number | null, ahora: number): boolean {
  if (inicio == null) return false;
  // Un inicio en el futuro no vale. Pasa de verdad: basta que alguien mueva la
  // fecha del teléfono hacia atrás después de activarla. Sin esta línea, la prueba
  // se quedaría "vigente" para siempre.
  if (inicio > ahora) return false;
  return ahora - inicio < DURACION_PRUEBA_MS;
}

/**
 * ¿Ya se usó, esté vigente o caducada?
 *
 * Es lo que hace que sea "una sola vez". Se mira que exista un inicio, no que la
 * prueba esté corriendo: si se mirara lo segundo, al caducar se podría volver a
 * activar y serían 24 horas cada día.
 */
export function pruebaYaUsada(inicio: number | null): boolean {
  return inicio != null;
}

/**
 * CUÁNDO TERMINA LA PRUEBA, no cuánto le queda.
 *
 * Pedido suyo (13/08/2026). Antes solo se decía "quedan 24 h", y eso obliga a hacer la cuenta
 * mentalmente y encima con un número redondeado hacia arriba: a falta de treinta minutos ponía
 * "queda 1 h". Una hora concreta se entiende sin pensar y no se puede malinterpretar.
 *
 * Devuelve el instante exacto, o null si no hay prueba corriendo.
 */
export function pruebaTerminaEn(inicio: number | null, ahora: number): number | null {
  if (!pruebaVigente(inicio, ahora)) return null;
  return inicio! + DURACION_PRUEBA_MS;
}

/**
 * Si ese instante cae hoy, mañana, o más lejos.
 *
 * Se compara por DÍA DEL CALENDARIO, no por horas de diferencia. Son cosas distintas: a las
 * 11 de la noche, algo que pasa dentro de tres horas es "mañana" aunque falte menos que un
 * "hoy" de la mañana. Quien lee la pantalla piensa en días, no en restas.
 */
export function diaDeLaFecha(cuando: number, ahora: number): "hoy" | "manana" | "otro" {
  const dia = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diferencia = Math.round((dia(cuando) - dia(ahora)) / (24 * 60 * 60 * 1000));
  if (diferencia <= 0) return "hoy";
  if (diferencia === 1) return "manana";
  return "otro";
}

/** Cuánto le queda, en milisegundos. Cero si no está vigente. */
export function pruebaRestanteMs(inicio: number | null, ahora: number): number {
  if (!pruebaVigente(inicio, ahora)) return 0;
  return inicio! + DURACION_PRUEBA_MS - ahora;
}

/**
 * Cuánto le queda dicho en horas, para la pantalla.
 *
 * Se REDONDEA HACIA ARRIBA: con 30 minutos restantes, "queda 1 hora" es verdad y
 * "quedan 0 horas" no. Hacia abajo, la última hora de prueba se anunciaría como
 * ninguna y parecería que ya caducó.
 */
export function pruebaHorasRestantes(inicio: number | null, ahora: number): number {
  const ms = pruebaRestanteMs(inicio, ahora);
  return ms === 0 ? 0 : Math.ceil(ms / (60 * 60 * 1000));
}

export async function loadPrueba(): Promise<number | null> {
  const guardado = await loadJSON<PruebaPremium>(STORAGE_KEYS.pruebaPremium, { inicio: null });
  const inicio = guardado?.inicio;
  // Cualquier cosa que no sea un número se trata como "no usada". Un valor raro de
  // una versión anterior no puede dejar a alguien sin poder probar, ni regalarle
  // Premium para siempre.
  return typeof inicio === "number" && Number.isFinite(inicio) ? inicio : null;
}

export function savePrueba(inicio: number | null): void {
  saveJSON(STORAGE_KEYS.pruebaPremium, { inicio });
}
