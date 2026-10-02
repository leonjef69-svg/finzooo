import assert from "node:assert/strict";
import {
  ajustarValoresRosquilla,
  calcularTamanoBurbujaRosquilla,
  crearCurvaConectorRosquilla,
  distribuirAngulosEtiquetas,
  textoPorcentajeRosquilla,
} from "@/utils/donutGeometry";

const montos = [9_999_999_999, 8, 5, 3, 1];
const total = montos.reduce((sum, value) => sum + value, 0);
const visuales = ajustarValoresRosquilla(montos, total);
const totalVisual = visuales.reduce((sum, value) => sum + value, 0);
assert.ok(visuales[0] / totalVisual > 0.9, "la categoría dominante conserva más del 90% de la dona");
for (const [index, montoVisible] of visuales.slice(1).entries()) {
  assert.ok(montoVisible / totalVisual > 0.015, `la categoría pequeña ${index + 1} conserva un segmento visible`);
  assert.ok(montos[index + 1] / total < 0.01, "el porcentaje mostrado puede seguir siendo el dato real menor a 1%");
}
assert.ok(totalVisual <= total * 1.16, "hacer visibles las categorías pequeñas no infla la dona sin límite");
assert.deepEqual(montos, [9_999_999_999, 8, 5, 3, 1], "el ajuste visual no cambia los montos originales");
assert.deepEqual(
  montos.map((monto) => textoPorcentajeRosquilla(monto, total)),
  [">99%", "<1%", "<1%", "<1%", "<1%"],
  "las etiquetas muestran porcentajes reales y no redondean categorías distintas a 100%",
);
assert.equal(textoPorcentajeRosquilla(10, 10), "100%", "100% se conserva cuando sí existe una sola categoría");

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

// Las cuatro porciones pequeñas se colocan juntas en la parte superior cuando
// la dominante va al final. Sus rutas deben empezar en ángulos distintos y
// curvarse hacia las etiquetas, no quedar como una sola línea gruesa.
const escenarioAbanico = [8, 5, 3, 1, 9_999_999_999];
const sumaAbanico = escenarioAbanico.reduce((sum, value) => sum + value, 0);
const valoresAbanico = ajustarValoresRosquilla(escenarioAbanico, sumaAbanico);
let acumuladoAbanico = 0;
const angulosOrigen = valoresAbanico.map((value) => {
  const inicio = -Math.PI / 2 + (acumuladoAbanico / totalVisual) * Math.PI * 2;
  const medio = inicio + (value / totalVisual) * Math.PI;
  acumuladoAbanico += value;
  return medio;
});
const angulosDestino = distribuirAngulosEtiquetas(angulosOrigen, minimumGap);
const rutas = angulosOrigen.map((sourceAngle, index) => {
  const labelAngle = angulosDestino[index];
  const x = 170 + Math.cos(labelAngle) * orbitX;
  const y = 156 + Math.sin(labelAngle) * orbitY;
  return crearCurvaConectorRosquilla({
    centerX: 170,
    centerY: 156,
    sourceAngle,
    labelAngle,
    bubbleX: x,
    bubbleY: y,
    bubbleSize: bubble,
    sourceRadius: 77,
  });
});

for (let index = 0; index < 4; index++) {
  const sourceGap = Math.hypot(
    rutas[index].inicio.x - rutas[index + 1].inicio.x,
    rutas[index].inicio.y - rutas[index + 1].inicio.y,
  );
  assert.ok(sourceGap >= 7, `las porciones pequeñas tienen puntos de salida distinguibles (${sourceGap.toFixed(1)} px)`);
}
assert.ok(
  rutas.slice(0, 4).some((route) => Math.hypot(route.control1.x - route.inicio.x, route.control1.y - route.inicio.y) > 24),
  "los conectores abren pronto hacia su etiqueta para que no se vean amontonados",
);

for (const count of [2, 5, 10, 20, 30]) {
  const desired = Math.max(18, Math.min(56, Math.round(66 - count * 1.5)));
  const size = calcularTamanoBurbujaRosquilla(count, desired);
  const xOrbit = 170 - size / 2 - 5;
  const yOrbit = count <= 4 ? 102 + (56 - size) * 0.3 : 112 + (70 - size) * 0.4;
  const smallest = Math.min(xOrbit, yOrbit);
  const gap = 2 * Math.asin(Math.min(1, (size + 8) / (2 * smallest)));
  const angles = distribuirAngulosEtiquetas(
    Array.from({ length: count }, (_, index) => index < count - 1 ? -Math.PI / 2 + index * 0.001 : 1.2),
    gap,
  );
  const points = angles.map((angle) => ({
    x: 170 + Math.cos(angle) * xOrbit,
    y: 156 + Math.sin(angle) * yOrbit,
  }));
  for (let first = 0; first < points.length; first++) {
    for (let second = first + 1; second < points.length; second++) {
      const distance = Math.hypot(points[first].x - points[second].x, points[first].y - points[second].y);
      assert.ok(distance >= size + 5, `${count} categorías: las etiquetas no chocan (${distance.toFixed(1)} px para círculos de ${size} px)`);
    }
  }
}

console.log("✓ Los segmentos pequeños se ven; el monto y el porcentaje reales permanecen intactos; etiquetas y conectores se distinguen.");
