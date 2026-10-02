import assert from "node:assert/strict";
import { ajustarValoresRosquilla, distribuirAngulosEtiquetas } from "@/utils/donutGeometry";

const montos = [10_000_000_000, 1, 1, 1, 1];
const total = montos.reduce((sum, value) => sum + value, 0);
const visuales = ajustarValoresRosquilla(montos, total);
const totalVisual = visuales.reduce((sum, value) => sum + value, 0);
assert.ok(visuales[0] / totalVisual > 0.9, "la categoría de diez cifras conserva la mayor parte de la dona");
for (const montoVisible of visuales.slice(1)) {
  assert.ok(montoVisible / totalVisual > 0.01, "cada categoría pequeña conserva un segmento visible");
}
assert.ok(totalVisual <= total * 1.16, "hacer visibles las categorías pequeñas no infla la dona sin límite");

const bubble = 56;
const orbitX = 137;
const orbitY = 102;
const minimumGap = 2 * Math.asin((bubble + 8) / (2 * Math.min(orbitX, orbitY)));
const labelAngles = distribuirAngulosEtiquetas([4.70, 4.705, 1.56, 1.565, 1.57], minimumGap);
const positions = labelAngles.map((angle) => ({
  x: 170 + Math.cos(angle) * orbitX,
  y: 146 + Math.sin(angle) * orbitY,
}));

for (let first = 0; first < positions.length; first++) {
  for (let second = first + 1; second < positions.length; second++) {
    const distance = Math.hypot(
      positions[first].x - positions[second].x,
      positions[first].y - positions[second].y,
    );
    assert.ok(
      distance >= bubble + 7,
      `las etiquetas quedan separadas incluso al cruzar el inicio de la dona (${first}, ${second}: ${distance.toFixed(2)} px; ángulos ${labelAngles.join(",")})`,
    );
  }
}

console.log("✓ Los segmentos pequeños se ven, el monto dominante conserva su proporción y las etiquetas no se amontonan.");
