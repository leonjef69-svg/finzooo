const FULL_TURN = Math.PI * 2;
const MINIMUM_VISUAL_FRACTION = 0.02;
const MAX_VISUAL_UPLIFT = 0.16;

/**
 * Da un mínimo visible a los segmentos pequeños sin permitir que el ajuste
 * añada más del 16% del total original a la rosquilla.
 */
export function ajustarValoresRosquilla(values: number[], total: number) {
  if (total <= 0 || values.length === 0) return values;

  // Un segmento de 1.2% apenas ocupa unos píxeles y su línea parece salir
  // junto a las demás. Con 2% conserva una porción visible; en el caso de
  // una categoría dominante y cuatro pequeñas, la dominante aún ocupa más
  // del 92% de la dona.
  const minimumValue = total * MINIMUM_VISUAL_FRACTION;
  const requiredUplift = values.reduce(
    (sum, value) => sum + Math.max(0, minimumValue - value),
    0,
  );
  const allowedUplift = total * MAX_VISUAL_UPLIFT;
  const upliftScale = requiredUplift > 0 ? Math.min(1, allowedUplift / requiredUplift) : 0;

  return values.map((value) => value + Math.max(0, minimumValue - value) * upliftScale);
}

/** El texto describe el porcentaje real, nunca el tamaño visual del segmento. */
export function textoPorcentajeRosquilla(value: number, total: number) {
  if (total <= 0) return "0%";
  const percentage = (value / total) * 100;
  if (percentage < 1) return "<1%";
  // Evita que, por redondeo, una categoría deje de mostrar las demás que sí
  // tienen movimiento y aparecen en la dona.
  if (percentage < 100 && Math.round(percentage) === 100) return ">99%";
  return `${Math.round(percentage)}%`;
}

type Punto = { x: number; y: number };

export type CurvaConectorRosquilla = {
  inicio: Punto;
  control1: Punto;
  control2: Punto;
  fin: Punto;
};

/**
 * Hace que los conectores salgan en abanico, en vez de correr paralelos por
 * varios píxeles desde segmentos diminutos. Los desplazamientos se limitan y
 * conservan el orden angular entre el segmento y su etiqueta.
 */
export function crearCurvaConectorRosquilla({
  centerX,
  centerY,
  sourceAngle,
  labelAngle,
  bubbleX,
  bubbleY,
  bubbleSize,
  sourceRadius,
}: {
  centerX: number;
  centerY: number;
  sourceAngle: number;
  labelAngle: number;
  bubbleX: number;
  bubbleY: number;
  bubbleSize: number;
  sourceRadius: number;
}): CurvaConectorRosquilla {
  const radialX = Math.cos(sourceAngle);
  const radialY = Math.sin(sourceAngle);
  const inicio = {
    x: centerX + radialX * sourceRadius,
    y: centerY + radialY * sourceRadius,
  };
  const toBubbleX = bubbleX - inicio.x;
  const toBubbleY = bubbleY - inicio.y;
  const length = Math.max(1, Math.hypot(toBubbleX, toBubbleY));
  const directionX = toBubbleX / length;
  const directionY = toBubbleY / length;
  const fin = {
    x: bubbleX - directionX * (bubbleSize / 2 + 1),
    y: bubbleY - directionY * (bubbleSize / 2 + 1),
  };

  const angleDifference = Math.atan2(
    Math.sin(labelAngle - sourceAngle),
    Math.cos(labelAngle - sourceAngle),
  );
  const fan = Math.max(-44, Math.min(44, angleDifference * 58));
  const sourceTangentX = -radialY;
  const sourceTangentY = radialX;
  const labelTangentX = -Math.sin(labelAngle);
  const labelTangentY = Math.cos(labelAngle);

  return {
    inicio,
    control1: {
      x: inicio.x + radialX * 20 + sourceTangentX * fan * 0.82,
      y: inicio.y + radialY * 20 + sourceTangentY * fan * 0.82,
    },
    control2: {
      x: fin.x - directionX * 26 + labelTangentX * fan * 0.36,
      y: fin.y - directionY * 26 + labelTangentY * fan * 0.36,
    },
    fin,
  };
}

/**
 * Reduce las etiquetas solo cuando la cantidad de categorías lo exige para
 * que puedan repartirse alrededor de la dona sin tocarse. La órbita vuelve a
 * calcularse con cada tamaño porque el borde del gráfico depende del círculo.
 */
export function calcularTamanoBurbujaRosquilla(
  count: number,
  preferredSize: number,
  width = 340,
) {
  if (count <= 1) return preferredSize;

  let size = preferredSize;
  while (size > 18) {
    const orbitX = width / 2 - size / 2 - 5;
    const orbitY = count <= 4
      ? 102 + (56 - size) * 0.3
      : 112 + (70 - size) * 0.4;
    const smallestOrbit = Math.max(1, Math.min(orbitX, orbitY));
    const distanceBetweenLabels = 2 * smallestOrbit * Math.sin(Math.PI / count);
    if (distanceBetweenLabels >= size + 6) return size;
    size -= 1;
  }
  return size;
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
