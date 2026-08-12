// VER LO TUYO ES GRATIS. CREAR COSAS NUEVAS ES PREMIUM. (decisión suya, 08/08/2026)
//
// EL PROBLEMA QUE ESTO ARREGLA, CONTADO COMO PASARÍA
//
// Alguien baja Fino, activa la prueba de 24 horas, crea su bodega, mete sus productos y anota
// las ventas de todo un día. Al día siguiente se acaba la prueba y **no puede abrir su propia
// bodega**. Y tampoco puede pagar para recuperarla, porque el cobro todavía no existe.
//
// Eso no se siente como "no tengo las funciones extra": se siente como que la app le secuestró
// su trabajo. Esa persona no paga — desinstala.
//
// Y hay un motivo que no es solo de justicia: **quien puede ver su negocio y no tocarlo tiene
// un recordatorio diario de lo que se está perdiendo.** Quien se queda fuera, se olvida de la
// app en una semana. Lo que vale no es mirar lo de ayer: es registrar lo de hoy, que es el uso
// diario. Eso sigue siendo Premium.
//
// LAS TRES RESPUESTAS, Y POR QUÉ SON TRES Y NO DOS
//
//   abierto      → tiene Premium. Todo.
//   soloLectura  → no tiene Premium PERO tiene datos ahí. Puede mirar, no tocar.
//   cerrado      → no tiene Premium y no tiene nada guardado.
//
// El tercero importa: **sin datos no hay nada que enseñar**, así que dejar entrar sería una
// pantalla vacía en vez de la explicación de para qué sirve Premium. Ahí el candado hace su
// trabajo — vender— y no le quita nada a nadie.

/** Qué puede hacer alguien en una pantalla Premium. */
export type EstadoDelCandado = "abierto" | "soloLectura" | "cerrado";

/**
 * Decide qué se puede hacer.
 *
 * `tieneDatos` es lo que la persona ya creó AHÍ, no en toda la app: quien tiene metas de ahorro
 * pero ningún negocio debe poder ver sus metas y encontrarse el candado en el negocio. Con un
 * "tiene datos" global, crear cualquier cosa abriría todas las puertas.
 */
export function candadoPremium(esPremium: boolean, tieneDatos: boolean): EstadoDelCandado {
  if (esPremium) return "abierto";
  return tieneDatos ? "soloLectura" : "cerrado";
}

/**
 * ¿Se puede CREAR o CAMBIAR algo aquí?
 *
 * Existe aparte de la función de arriba, y es a propósito: las pantallas preguntan esto
 * decenas de veces —en cada botón— y comparar textos en cada sitio es como acaba colándose un
 * `!== "cerrado"` donde tenía que ir `=== "abierto"`. Con eso, alguien sin Premium podría
 * registrar ventas.
 */
export function puedeTocar(estado: EstadoDelCandado): boolean {
  return estado === "abierto";
}
