import type { Month } from "@/types";

export function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

// Si el mes que se está viendo es el mes real actual, usa el día de hoy.
// Si no, usa el día 1 de ese mes (evita fechas "de mentira" fijas).
export function defaultDateForMonth(month: Month) {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === month.y && now.getMonth() === month.m;
  const day = isCurrentMonth ? now.getDate() : 1;
  const clampedDay = Math.min(day, daysInMonth(month.y, month.m));
  return `${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// ¿Es una fecha real en formato AAAA-MM-DD?
//
// No basta con que "parezca" una fecha: comprueba contra el calendario de
// verdad, así que rechaza 2026-02-30 o 2026-13-01. El campo de fecha era
// texto libre sin ninguna comprobación, y guardar ahí algo inválido
// tumbaba la app al intentar mostrar ese movimiento.
export function isValidISODate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  if (y < 1900 || y > 2200) return false;
  return day >= 1 && day <= daysInMonth(y, month - 1);
}

// Acepta la fecha como la escribe la gente y la deja en formato interno.
// "24/07/2026" y "24-07-2026" pasan a "2026-07-24". Si no reconoce el
// formato, devuelve el texto tal cual para que isValidISODate lo rechace
// y la persona vea el aviso en pantalla.
export function normalizeDateInput(raw: string): string {
  const s = raw.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const ymd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(s);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  return s;
}
