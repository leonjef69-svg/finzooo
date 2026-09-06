/**
 * El selector tiene cuatro opciones. En una pantalla estrecha se ordenan 2 x 2;
 * solo pasan a una fila cuando cada texto conserva una zona táctil cómoda.
 * La letra ampliada necesita el mismo trato aunque el teléfono sea ancho.
 */
export function columnasFrecuenciaExportacion(width: number, fontScale: number): 2 | 4 {
  const anchoUtil = Math.max(0, width - 40);
  const anchoNecesario = 440 * Math.max(1, fontScale);
  return anchoUtil >= anchoNecesario ? 4 : 2;
}
