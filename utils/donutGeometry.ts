const FULL_TURN = Math.PI * 2;

/** El porcentaje describe el dinero real, incluidos los importes diminutos. */
export function textoPorcentajeRosquilla(value: number, total: number) {
  if (total <= 0) return "0%";
  const percentage = (value / total) * 100;
  if (percentage < 1) return "<1%";
  if (percentage < 100 && Math.round(percentage) === 100) return ">99%";
  return `${Math.round(percentage)}%`;
}

type Punto = { x: number; y: number };

/** Espaciado por longitud del contorno, también si la rueda necesita más alto. */
function puntosEnOrbita(count: number, orbitX: number, orbitY: number): Punto[] {
  if (count <= 0) return [];
  const samples = 720;
  const points: (Punto & { distance: number })[] = [];
  let distance = 0;
  for (let index = 0; index <= samples; index++) {
    const angle = -Math.PI / 2 + FULL_TURN * index / samples;
    const point = { x: Math.cos(angle) * orbitX, y: Math.sin(angle) * orbitY };
    const previous = points[index - 1];
    if (previous) distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    points.push({ ...point, distance });
  }
  let sample = 1;
  return Array.from({ length: count }, (_, index) => {
    const target = distance * index / count;
    while (sample < samples && points[sample].distance < target) sample++;
    const previous = points[sample - 1];
    const next = points[sample];
    const fraction = (target - previous.distance) / Math.max(1e-9, next.distance - previous.distance);
    return { x: previous.x + (next.x - previous.x) * fraction, y: previous.y + (next.y - previous.y) * fraction };
  });
}

/**
 * Todos los controles mantienen el mismo tamaño y dejan aire entre ellos.
 * Muchas categorías amplían la órbita vertical en lugar de reducir los iconos.
 */
export function calcularDistribucionRueda(count: number, requestedWidth = 340) {
  const width = Math.max(180, Math.min(420, requestedWidth));
  const bubble = width < 280 ? 48 : count <= 8 ? 60 : 56;
  const orbitX = (width - bubble) / 2 - 4;
  let orbitY = Math.max(orbitX, 108);
  let positions = puntosEnOrbita(count, orbitX, orbitY);
  const separated = (points: Punto[]) => points.every((point, index) => points.slice(index + 1).every(other => Math.hypot(point.x - other.x, point.y - other.y) >= bubble + 8));
  while (!separated(positions)) {
    orbitY += 12;
    positions = puntosEnOrbita(count, orbitX, orbitY);
  }
  const centerX = width / 2;
  const centerY = orbitY + bubble / 2 + 4;
  return {
    width, height: centerY * 2, centerX, centerY, bubble,
    radius: Math.max(24, Math.min(64, orbitX - bubble / 2 - 18)),
    positions: positions.map(point => ({ x: centerX + point.x, y: centerY + point.y })),
  };
}
