// Formato manual (sin depender de Intl/toLocaleString, que no siempre está
// disponible igual en todos los celulares) para que el número de moneda
// siempre se vea igual: "S/ 1,234.56". El símbolo SIEMPRE se recibe como
// parámetro (no se guarda "por fuera" de React) para garantizar que se
// actualice de inmediato en toda la app cuando alguien cambia su moneda.
export function fmt(n: number, symbol: string) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${symbol} ${withThousands}.${decPart}`;
}

export function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

// "13 jul." — recibe una fecha en formato "YYYY-MM-DD" y los nombres de
// mes del idioma actual (para que no dependa de un idioma fijo).
export function fmtDate(iso: string, monthNames: string[]) {
  const [, m, d] = String(iso ?? "").split("-").map(Number);
  const name = monthNames[m - 1];
  // Red de seguridad: si la fecha viene dañada (un movimiento guardado
  // antes de que el campo validara, o un dato corrupto), se muestra tal
  // cual en vez de tumbar la app. Antes esta línea hacía .slice() sobre
  // un valor inexistente y reventaba toda la pantalla — y como el dato ya
  // estaba guardado, volvía a reventar en cada arranque.
  if (!name || !Number.isFinite(d)) return String(iso ?? "");
  return `${d} ${name.slice(0, 3).toLowerCase()}.`;
}
