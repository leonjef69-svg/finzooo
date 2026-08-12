// EL REGISTRO AUTOMÁTICO SOLO EXISTE DONDE EXISTE YAPE (11/08/2026)
//
// Decisión suya, dicha así: *"el registro automático solo estará disponible en país Perú y
// Bolivia y sus monedas; si no está en ninguno de los 2, ocúltalo. Ejemplo: yo pongo Colombia
// o Argentina, no deben poder visualizar ni usar esa función"*.
//
// Y es correcto. Finzo lee **avisos de Yape**, y Yape no está en Colombia, Argentina, Chile,
// México, Brasil, España ni Estados Unidos. Ahí la función no falla: no tiene nada que leer.
// Enseñarla es prometer algo que nunca va a pasar, y lo peor de una función así no es que no
// sirva — es que la persona la enciende, da un permiso de leer TODAS sus notificaciones, y se
// queda esperando movimientos que no van a llegar nunca.
//
// SE MIRA LA MONEDA, NO EL PAÍS
//
// El país pone el idioma y la moneda de una vez, pero los dos ajustes sueltos siguen ahí
// debajo, así que se puede tener España con soles. La moneda es lo que de verdad dice en qué
// dinero se mueve alguien, y es lo que él nombró: "Perú y Bolivia **y sus monedas**".

/** Las monedas de los países donde Yape funciona. */
const CON_YAPE = ["PEN", "BOB"];

/**
 * ¿Tiene sentido el registro automático con esta moneda?
 *
 * Cuando devuelve falso, la fila no se enseña en Ajustes y la pantalla no se deja abrir. No se
 * apaga nada de lo que ya estuviera funcionando: quien lo tenía encendido y se cambia de país
 * no pierde lo capturado, solo deja de ver la puerta.
 */
export function hayRegistroAutomatico(moneda: string): boolean {
  return CON_YAPE.includes(moneda);
}
