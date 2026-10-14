import { isLinkedSpaceTransfer, type CompactTransferRow, type LinkedSpaceMovement, type PersonalTransferMovement } from "@/utils/linkedTransfers";
import { horaDe } from "@/utils/format";
import { minutosDeHora } from "@/utils/ordenarMovimientos";

/** Agrupa solo la presentación por fecha guardada, sin convertirla a UTC ni tocar datos. */
export function movementRowsByDay<T>(
  items: readonly T[], dateOf: (item: T) => string, rowsOf: (dayItems: T[]) => CompactTransferRow<T>[],
): (CompactTransferRow<T> & { groupItems: T[] })[] {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const day = dateOf(item);
    const group = days.get(day) ?? [];
    group.push(item);
    days.set(day, group);
  }
  return [...days.keys()].sort().reverse().flatMap(day => {
    const groupItems = days.get(day)!;
    return rowsOf(groupItems).map(row => ({ ...row, key: `${day}:${row.key}`, groupItems }));
  });
}

/** El encabezado pertenece al primer movimiento visible, también después de filtrar. */
export function startsMovementDay<T>(rows: readonly T[], index: number, dateOf: (row: T) => string): boolean {
  return index === 0 || dateOf(rows[index - 1]) !== dateOf(rows[index]);
}

export function movementDayLabel(iso: string, monthNames: readonly string[]): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!monthNames[month - 1] || day < 1 || day > lastDay) return iso;
  return `${day} ${monthNames[month - 1]} ${year}`;
}

/** Un resumen puede tener varias horas reales; muestra su intervalo, no una hora nueva. */
export function movementTimeLabel(times: readonly (string | undefined)[]): string {
  const known = [...new Set(times.filter((time): time is string => Boolean(time) && minutosDeHora(time) >= 0))]
    .sort((a, b) => minutosDeHora(a) - minutosDeHora(b));
  return known.length > 1 ? `${known[0]} — ${known[known.length - 1]}` : known[0] ?? "";
}

export function personalMovementRowTime<T extends PersonalTransferMovement & { time?: string }>(row: CompactTransferRow<T>): string {
  if (!row.transferGroup) return row.item.time ?? "";
  const target = row.item.internalTransferSpaceId || row.item.internalTransferSpaceName || "legacy";
  return movementTimeLabel((row.groupItems ?? [row.item]).filter(item => item.internalTransfer === row.item.internalTransfer
    && (item.internalTransferSpaceId || item.internalTransferSpaceName || "legacy") === target).map(item => item.time));
}

export function linkedMovementRowTime<T extends LinkedSpaceMovement>(row: CompactTransferRow<T>): string {
  return movementTimeLabel((row.transferGroup ? (row.groupItems ?? [row.item]).filter(isLinkedSpaceTransfer) : [row.item])
    .map(item => item.creadoEn == null ? "" : horaDe(item.creadoEn)));
}
