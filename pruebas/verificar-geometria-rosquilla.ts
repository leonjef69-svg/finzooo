import assert from "node:assert/strict";
import fs from "node:fs";
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
assert.ok(visuales[0] / totalVisual > 0.88, "la categoría dominante conserva claramente la mayor parte de la dona");
for (const [index, montoVisible] of visuales.slice(1).entries()) {
  assert.ok(montoVisible / totalVisual > 0.015, `la categoría pequeña ${index + 1} conserva un segmento visible`);
  assert.ok(montos[index + 1] / total < 0.01, "el porcentaje mostrado puede seguir siendo el dato real menor a 1%");
}
assert.ok(totalVisual <= total * 1.16, "cuatro porciones pequeñas no inflan la dona sin límite");
assert.ok(
  visuales.slice(1).reduce((sum, value) => sum + value, 0) / totalVisual <= 0.18,
  "las porciones pequeñas comparten un límite visual del 18%",
);
assert.deepEqual(montos, [9_999_999_999, 8, 5, 3, 1], "el ajuste visual no cambia los montos originales");
assert.deepEqual(
  montos.map((monto) => textoPorcentajeRosquilla(monto, total)),
  [">99%", "<1%", "<1%", "<1%", "<1%"],
  "las etiquetas muestran porcentajes reales y no redondean categorías distintas a 100%",
);
assert.equal(textoPorcentajeRosquilla(10, 10), "100%", "100% se conserva cuando sí existe una sola categoría");

// El caso de diez categorías: una cifra dominante y nueve montos mínimos.
// Se comprueba que cada segmento pequeño se distingue, sin quitarle la mayor
// parte de la dona a la categoría principal ni superar el presupuesto común.
const diezCategorias = [1_000_000_000_000, ...Array.from({ length: 9 }, (_, index) => index + 1)];
const diezVisuales = ajustarValoresRosquilla(
  diezCategorias,
  diezCategorias.reduce((sum, value) => sum + value, 0),
);
const totalDiezVisual = diezVisuales.reduce((sum, value) => sum + value, 0);
const colaDiezVisual = diezVisuales.slice(1).reduce((sum, value) => sum + value, 0);
assert.ok(diezVisuales[0] / totalDiezVisual > 0.81, "con diez categorías la dominante conserva más del 80% visual");
assert.ok(colaDiezVisual / totalDiezVisual <= 0.18 + 1e-9, "nueve porciones pequeñas no exceden el presupuesto común del 18%");
for (const value of diezVisuales.slice(1)) {
  assert.ok(value / totalDiezVisual >= 0.019, "cada una de las nueve porciones pequeñas queda cerca del 2% visual");
}

const sieteCategorias = [1_000_000_000_000, ...Array.from({ length: 6 }, () => 1)];
const sieteVisuales = ajustarValoresRosquilla(
  sieteCategorias,
  sieteCategorias.reduce((sum, value) => sum + value, 0),
);
const totalSieteVisual = sieteVisuales.reduce((sum, value) => sum + value, 0);
assert.ok(sieteVisuales[0] / totalSieteVisual > 0.84, "en la composición de la captura la categoría mayor sigue dominando");
for (const value of sieteVisuales.slice(1)) {
  assert.ok(value / totalSieteVisual > 0.02, "las seis porciones pequeñas de la captura se distinguen");
}

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
const totalAbanicoVisual = valoresAbanico.reduce((sum, item) => sum + item, 0);
const angulosOrigen = valoresAbanico.map((value) => {
  const inicio = -Math.PI / 2 + (acumuladoAbanico / totalAbanicoVisual) * Math.PI * 2;
  const medio = inicio + (value / totalAbanicoVisual) * Math.PI;
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

// También se prueba el diseño geométrico real de diez categorías, no solo diez
// puntos inventados. Los arranques de las porciones pequeñas deben quedar
// separados y las burbujas no deben tocarse.
{
  const count = diezVisuales.length;
  const bubbleSize = calcularTamanoBurbujaRosquilla(count, Math.round(66 - count * 1.5));
  const chartRadius = Math.max(52, Math.min(66, Math.round(74 - count * 1.7)));
  const orbitHorizontal = 340 / 2 - bubbleSize / 2 - 5;
  const orbitVertical = 112 + (70 - bubbleSize) * 0.4;
  const gap = 2 * Math.asin(Math.min(1, (bubbleSize + 8) / (2 * Math.min(orbitHorizontal, orbitVertical))));
  const starts: number[] = [];
  const middles: number[] = [];
  let accumulated = 0;
  for (const value of diezVisuales) {
    const start = -Math.PI / 2 + (accumulated / totalDiezVisual) * Math.PI * 2;
    starts.push(start);
    middles.push(start + (value / totalDiezVisual) * Math.PI);
    accumulated += value;
  }
  const labels = distribuirAngulosEtiquetas(middles, gap);
  const labelPoints = labels.map((angle) => ({
    x: 170 + Math.cos(angle) * orbitHorizontal,
    y: 156 + Math.sin(angle) * orbitVertical,
  }));
  for (let first = 0; first < count; first++) {
    for (let second = first + 1; second < count; second++) {
      const distance = Math.hypot(
        labelPoints[first].x - labelPoints[second].x,
        labelPoints[first].y - labelPoints[second].y,
      );
      assert.ok(distance >= bubbleSize + 5, "las diez burbujas separadas por segmentos reales no se enciman");
    }
  }
  for (let index = 1; index < count; index++) {
    const previousMiddle = starts[index] - (diezVisuales[index - 1] / totalDiezVisual) * Math.PI;
    const sourceGap = 2 * (chartRadius + 11) * Math.sin((middles[index] - previousMiddle) / 2);
    assert.ok(sourceGap >= 7, "los conectores de los nueve segmentos pequeños parten de puntos distinguibles");
  }
}

const donutChart = fs.readFileSync("components/DonutChart.tsx", "utf8");
assert.match(donutChart, /strokeWidth=\{1\.8\}/, "las líneas tienen un grosor visible en pantalla pequeña");
assert.match(donutChart, /strokeOpacity=\{1\}/, "las líneas conservan todo su contraste");
assert.ok(
  (donutChart.match(/stroke=\{item\.color\}/g) ?? []).length >= 2,
  "las líneas y porciones usan exactamente el mismo color de categoría",
);

console.log("✓ Los segmentos pequeños se ven; el monto y el porcentaje reales permanecen intactos; etiquetas y conectores se distinguen.");
