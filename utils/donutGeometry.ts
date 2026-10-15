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

/** Contorno circular que se alarga sin afilar sus extremos ni tapar iconos. */
function puntosEnOrbita(count: number, orbitX: number, orbitY: number): Punto[] {
  if (count <= 0) return [];
  const straight = orbitY - orbitX;
  const quarter = Math.PI * orbitX / 2;
  const perimeter = FULL_TURN * orbitX + straight * 4;
  const circular = (angle: number, y: number) => ({ x: Math.cos(angle) * orbitX, y: y + Math.sin(angle) * orbitX });
  return Array.from({ length: count }, (_, index) => {
    let distance = perimeter * index / count;
    if (distance <= quarter) return circular(-Math.PI / 2 + distance / orbitX, -straight);
    distance -= quarter;
    if (distance <= straight * 2) return { x: orbitX, y: -straight + distance };
    distance -= straight * 2;
    if (distance <= quarter * 2) return circular(distance / orbitX, straight);
    distance -= quarter * 2;
    if (distance <= straight * 2) return { x: -orbitX, y: straight - distance };
    distance -= straight * 2;
    return circular(Math.PI + distance / orbitX, -straight);
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
    width, height: centerY * 2, centerX, centerY, bubble, orbitX, orbitY,
    radius: Math.max(24, Math.min(58, orbitX - bubble / 2 - 22)),
    positions: positions.map(point => ({ x: centerX + point.x, y: centerY + point.y })),
  };
}

/** Ajuste de dibujo explícito: ninguna categoría positiva pierde su bloque. */
export function crearSectoresVisibles(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || !values.length) return { sectors: [], enlarged: false };
  const real = values.map(value => value / total);
  const minimum = Math.min(0.055, 0.8 / values.length);
  const fractions = Array<number>(values.length).fill(0);
  let pending = values.map((_, index) => index);
  let available = 1;
  while (pending.length) {
    const weight = pending.reduce((sum, index) => sum + real[index], 0);
    const small = pending.filter(index => real[index] * available / weight < minimum);
    if (!small.length) {
      pending.forEach(index => { fractions[index] = real[index] * available / weight; });
      break;
    }
    const fixed = new Set(small);
    small.forEach(index => { fractions[index] = minimum; available -= minimum; });
    pending = pending.filter(index => !fixed.has(index));
  }
  // El bloque inicial queda centrado en su icono superior. Ambos órdenes son
  // circulares y coinciden; esto permite abrir las líneas sin entrecruzarlas.
  let start = -Math.PI / 2 - fractions[0] * Math.PI;
  const sectors = fractions.map(fraction => {
    const sector = { start, middle: start + fraction * Math.PI, fraction };
    start += fraction * FULL_TURN;
    return sector;
  });
  return { sectors, enlarged: fractions.some((fraction, index) => fraction > real[index] + 1e-9) };
}

/**
 * Curvas en el anillo exterior: a igual avance radial conservan el orden de
 * los bloques y de los iconos. La frontera común respeta todas las burbujas.
 */
export function crearConectorRosquilla(sourceAngle: number, target: Punto,
  layout: ReturnType<typeof calcularDistribucionRueda>) {
  const { centerX, centerY, radius, bubble, orbitX, orbitY } = layout;
  const sourceRadius = radius + 10;
  const straight = orbitY - orbitX;
  const innerRadius = orbitX - bubble / 2;
  const targetX = target.x - centerX, targetY = target.y - centerY;
  const capY = Math.max(-straight, Math.min(straight, targetY));
  const normalLength = Math.hypot(targetX, targetY - capY);
  const endX = targetX - targetX / normalLength * bubble / 2;
  const endY = targetY - (targetY - capY) / normalLength * bubble / 2;
  let targetAngle = Math.atan2(endY, endX);
  while (targetAngle < -Math.PI / 2 - 1e-8) targetAngle += FULL_TURN;
  const radialLimit = (angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const side = innerRadius / Math.max(1e-12, Math.abs(cos));
    if (Math.abs(side * sin) <= straight) return side;
    return straight * Math.abs(sin) + Math.sqrt(Math.max(0, innerRadius * innerRadius - straight * straight * cos * cos));
  };
  const points = Array.from({ length: 65 }, (_, index) => {
    const progress = index / 64;
    const smooth = progress * progress * (3 - 2 * progress);
    const angle = sourceAngle + (targetAngle - sourceAngle) * smooth;
    const distance = sourceRadius + (radialLimit(angle) - sourceRadius) * progress;
    return { x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance };
  });
  return { points, path: points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ") };
}
