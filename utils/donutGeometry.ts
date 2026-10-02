const FULL_TURN = Math.PI * 2;
const MAX_VISUAL_UPLIFT = 0.16;

/**
 * Da un mínimo visible a los segmentos pequeños sin permitir que el ajuste
 * añada más del 16% del total original a la rosquilla.
 */
export function ajustarValoresRosquilla(values: number[], total: number) {
  if (total <= 0 || values.length === 0) return values;

  const minimumValue = total * 0.012;
  const requiredUplift = values.reduce(
    (sum, value) => sum + Math.max(0, minimumValue - value),
    0,
  );
  const allowedUplift = total * MAX_VISUAL_UPLIFT;
  const upliftScale = requiredUplift > 0 ? Math.min(1, allowedUplift / requiredUplift) : 0;

  return values.map((value) => value + Math.max(0, minimumValue - value) * upliftScale);
}

/**
 * Separa las etiquetas siguiendo el orden angular de sus segmentos. El corte
 * se hace en el mayor espacio libre de la dona, evitando que las etiquetas
 * cercanas al inicio y al final de la lista se amontonen al cruzar 360 grados.
 */
export function distribuirAngulosEtiquetas(
  middleAngles: number[],
  requestedGap: number,
) {
  const count = middleAngles.length;
  if (count <= 1) return [...middleAngles];

  const normalized = middleAngles.map((angle, index) => ({
    index,
    angle: ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN,
  })).sort((a, b) => a.angle - b.angle);

  let largestGapIndex = 0;
  let largestGap = -1;
  for (let index = 0; index < count; index++) {
    const current = normalized[index].angle;
    const next = index === count - 1
      ? normalized[0].angle + FULL_TURN
      : normalized[index + 1].angle;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const minimumGap = Math.min(requestedGap, FULL_TURN / count);
  const firstIndex = (largestGapIndex + 1) % count;
  const ordered = Array.from({ length: count }, (_, offset) => normalized[(firstIndex + offset) % count]);
  const placed = new Array<number>(count);
  let previous = ordered[0].angle;
  let previousTarget = ordered[0].angle;
  let wrapOffset = 0;

  ordered.forEach((entry, index) => {
    if (index > 0 && entry.angle < previousTarget) wrapOffset += FULL_TURN;
    const target = entry.angle + wrapOffset;
    const angle = index === 0 ? target : Math.max(target, previous + minimumGap);
    placed[entry.index] = angle;
    previous = angle;
    previousTarget = entry.angle;
  });

  return placed;
}
