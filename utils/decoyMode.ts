// MODO SEÑUELO
//
// Fino admite dos PIN. El de verdad abre la app normal. El señuelo abre una
// versión con movimientos inventados, para el caso de que alguien obligue a
// abrir la aplicación: lo que verá es una cuenta creíble pero falsa.
//
// Este archivo solo guarda el interruptor. Está aparte, y no dentro de
// storage.ts o cloudSync.ts, porque los DOS necesitan consultarlo y si
// viviera en uno de ellos se importarían entre sí en círculo.
//
// Tres decisiones de diseño que sostienen todo lo demás:
//
// 1. El interruptor vive SOLO en memoria. No se guarda en ningún sitio. Al
//    cerrar la app se olvida solo, y por tanto no deja ni rastro de que el
//    modo exista. Guardarlo sería dejar la prueba escrita en el teléfono.
//
// 2. No hay forma de salir del modo señuelo desde dentro de la app. Ni
//    botón, ni gesto, ni ajuste. Se sale cerrando la app y entrando con el
//    PIN de verdad. Un botón de "salir del señuelo" sería exactamente la
//    pista que delata que hay algo escondido.
//
// 3. Solo se enciende. `activate()` no tiene pareja. Volver atrás sin
//    reiniciar dejaría a la app leyendo un almacén y escribiendo en otro.

let active = false;

/** ¿Estamos enseñando la cuenta falsa ahora mismo? */
export function isDecoyActive(): boolean {
  return active;
}

/**
 * Enciende el modo señuelo.
 *
 * A partir de aquí, TODO lo que la app guarde o lea va a un almacén aparte
 * (ver el prefijo en utils/storage.ts) y la nube queda cortada en seco (ver
 * el candado en utils/cloudSync.ts).
 */
export function activate(): void {
  active = true;
}

/**
 * Vuelve a la cuenta real.
 *
 * Solo se llama desde un sitio: cuando la app está bloqueada y se escribe el
 * PIN de verdad. Quien la llama TIENE que recargar los datos justo después,
 * o la app se quedaría mostrando lo falso mientras escribe en lo real.
 */
export function deactivate(): void {
  active = false;
}
