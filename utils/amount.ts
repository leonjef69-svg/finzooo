// Limpieza de lo que la persona escribe en un campo de dinero.
//
// Por qué existe este archivo: antes cada pantalla repetía la misma línea
//   v.replace(/[^0-9.]/g, "")
// en siete lugares distintos, y esa línea tenía dos fallos:
//
//   1. BORRABA la coma en vez de entenderla como decimal. Quien escribía
//      "1,50" —como se escribe en Argentina, España, Colombia o Chile—
//      terminaba guardando 150. Cien veces más de lo que quiso poner.
//
//   2. Dejaba pasar varios puntos ("1.2.3"), y parseFloat lo recortaba en
//      silencio a 1.2 sin avisar de nada.
//
// Al estar en un solo sitio, el arreglo vale para toda la app y no puede
// volver a quedar a medias en una pantalla.
export function sanitizeAmountInput(raw: string): string {
  // La coma se trata como separador decimal, no se descarta.
  let s = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");

  // Solo se admite un punto decimal: manda el primero y los siguientes se
  // ignoran, así "1.2.3" queda en "1.23" en vez de recortarse a "1.2".
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  return s;
}

// Convierte a número lo ya limpiado. Devuelve 0 ante cualquier cosa que no
// sea un número válido, para que nunca se guarde NaN en un movimiento.
export function parseAmountInput(raw: string): number {
  const n = parseFloat(sanitizeAmountInput(raw));
  return Number.isFinite(n) ? n : 0;
}
