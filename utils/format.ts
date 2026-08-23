// Formato manual (sin depender de Intl/toLocaleString, que no siempre está
// disponible igual en todos los celulares) para que el número de moneda
// siempre se vea igual: "S/ 1,234.56". El símbolo SIEMPRE se recibe como
// parámetro (no se guarda "por fuera" de React) para garantizar que se
// actualice de inmediato en toda la app cuando alguien cambia su moneda.
import { usaCentimos } from "@/constants/currencies";

const PUNTO_PARA_MILES = new Set(["CLP", "COP", "ARS", "BRL", "EUR"]);

export function fmt(n: number, symbol: string, currencyId = "PEN") {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const decimals = usaCentimos(currencyId) ? 2 : 0;
  const [intPart, decPart] = abs.toFixed(decimals).split(".");
  const thousands = PUNTO_PARA_MILES.has(currencyId) ? "." : ",";
  const decimal = thousands === "." ? "," : ".";
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${sign}${symbol} ${withThousands}${decPart == null ? "" : `${decimal}${decPart}`}`;
}

/** Formato corto para tarjetas y gráficos estrechos. */
export function fmtCompact(n: number, symbol: string, currencyId = "PEN") {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return fmt(n, symbol, currencyId);
  const divisor = abs >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = divisor === 1_000_000 ? "M" : "mil";
  const scaled = abs / divisor;
  const digits = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1;
  const shortNumber = scaled
    .toFixed(digits)
    .replace(".", PUNTO_PARA_MILES.has(currencyId) ? "," : ".");
  return `${sign}${symbol} ${shortNumber} ${suffix}`;
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

/**
 * La hora de un instante, "HH:MM", en la hora del celular.
 *
 * Se guarda ya escrita y no el instante crudo porque es lo unico que se
 * enseña: un numero de milisegundos habria que convertirlo en cada pantalla,
 * y bastaria olvidarse en una para que saliera la hora de Londres.
 */
export function horaDe(ms: number): string {
  const d = new Date(ms);
  const h24 = d.getHours();
  // En Peru la hora se lee en 12 horas con a.m./p.m. "14:35" obliga a hacer
  // la resta mentalmente; "2:35 p.m." se lee de golpe.
  //
  // El 0 de la medianoche es las 12 a.m., no las 0 a.m.: el resto (h % 12) da
  // cero y habria que leer "0:15 a.m.", que no dice nadie.
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minutos = String(d.getMinutes()).padStart(2, "0");
  return h12 + ":" + minutos + (h24 < 12 ? " a.m." : " p.m.");
}
