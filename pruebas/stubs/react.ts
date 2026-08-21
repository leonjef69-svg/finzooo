/**
 * Sustituto de React con lo justo para probar un gancho a mano: `useRef`.
 *
 * Hace falta desde el 20/08/2026, para `utils/valorEstable`. Ese gancho es el que evita que
 * el contexto despierte a todas las pantallas en cada cambio, y la única forma de comprobar
 * que cumple su promesa es LLAMARLO — con una copia escrita a mano no se probaría nada.
 *
 * Una caja de React vive pegada a un componente y se reparte por orden de llamada. Aquí se
 * imita igual: una lista de cajas y un contador que se pone a cero en cada dibujado.
 */
const cajas: { current: unknown }[] = [];
let siguiente = 0;

export function useRef<T>(inicial: T): { current: T } {
  if (cajas[siguiente] === undefined) cajas[siguiente] = { current: inicial };
  return cajas[siguiente++] as { current: T };
}

/** Empieza otro dibujado del mismo componente: las cajas se conservan. */
export function nuevoDibujado(): void {
  siguiente = 0;
}

/** Empieza un componente desde cero: se tiran las cajas. */
export function nuevoComponente(): void {
  cajas.length = 0;
  siguiente = 0;
}

export default { useRef };
