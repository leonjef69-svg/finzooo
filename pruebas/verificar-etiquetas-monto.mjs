// Comprueba que cada punto lleve su monto y que ninguna cifra se apile
// sobre otra, en varios patrones de gasto.

const PAD_X = 16;
const WIDTH = 280;
const HEIGHT = 130;
const MIN_SEP = 42; // separacion a partir de la cual caben las dos arriba
const CAJA = 60;

function simular(gastosPorDia, daysInMonth, today) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  let acc = 0;
  const real = days.map((d) => {
    if (d > today) return null;
    acc += gastosPorDia[d] ?? 0;
    return acc;
  });

  const isStep = (i) => {
    const v = real[i];
    if (v == null) return false;
    if (i === 0) return v > 0;
    const p = real[i - 1];
    return p == null ? v > 0 : v !== p;
  };
  let lastDrawn = -1;
  real.forEach((v, i) => { if (v != null) lastDrawn = i; });

  const drawnIdx = real
    .map((v, i) => (v != null && (isStep(i) || i === lastDrawn) ? i : -1))
    .filter((i) => i >= 0);

  const stepX = (WIDTH - PAD_X * 2) / (daysInMonth - 1);
  const labelSide = new Map();

  if (drawnIdx.length <= 8) {
    drawnIdx.forEach((i, k) => {
      const x = PAD_X + i * stepX;
      const prevX = k > 0 ? PAD_X + drawnIdx[k - 1] * stepX : -Infinity;
      const juntos = x - prevX < MIN_SEP;
      const ladoAnterior = k > 0 ? labelSide.get(drawnIdx[k - 1]) : undefined;
      labelSide.set(i, juntos && ladoAnterior === "above" ? "below" : "above");
    });
  } else {
    const elegidos = [];
    let lastLabelX = Infinity;
    for (let k = drawnIdx.length - 1; k >= 0; k--) {
      const i = drawnIdx[k];
      const x = PAD_X + i * stepX;
      if (lastLabelX - x >= MIN_SEP || k === drawnIdx.length - 1) {
        elegidos.push(i);
        lastLabelX = x;
      }
    }
    elegidos.reverse().forEach((i) => labelSide.set(i, "above"));
  }

  if (drawnIdx.length > 1 && !isStep(lastDrawn)) {
    const anterior = drawnIdx[drawnIdx.length - 2];
    if (real[anterior] === real[lastDrawn]) labelSide.delete(lastDrawn);
  }

  const etiquetas = [...labelSide.entries()].map(([i, side]) => ({
    dia: i + 1, v: real[i], side, x: PAD_X + i * stepX,
  }));
  return { real, drawnIdx, etiquetas, stepX, lastDrawn };
}

// Dos etiquetas se pisan si estan del MISMO lado y sus cajas se solapan.
function haySolape(etiquetas) {
  for (let a = 0; a < etiquetas.length; a++) {
    for (let b = a + 1; b < etiquetas.length; b++) {
      const A = etiquetas[a], B = etiquetas[b];
      if (A.side !== B.side) continue;
      if (Math.abs(A.x - B.x) < CAJA * 0.6) return `dia${A.dia} y dia${B.dia} (${A.side})`;
    }
  }
  return null;
}

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(48)} ${d}`);
  if (!ok) fallos++;
}

// --- Caso real del usuario: dias 28 y 29 de julio, seguidos ---
{
  const r = simular({ 28: 36, 29: 20 }, 31, 29);
  check("puntos: solo 28 y 29", r.drawnIdx.map((i) => i + 1).join(",") === "28,29");
  check("LOS DOS llevan monto", r.etiquetas.length === 2,
    r.etiquetas.map((e) => `dia${e.dia}=S/${e.v}(${e.side})`).join(" "));
  check("montos acumulados correctos",
    r.etiquetas[0]?.v === 36 && r.etiquetas[1]?.v === 56);
  check("uno arriba y otro abajo", r.etiquetas[0]?.side !== r.etiquetas[1]?.side);
  check("no se pisan", haySolape(r.etiquetas) === null, haySolape(r.etiquetas) ?? "");
}

// --- Gasto repartido en 5 dias separados ---
{
  const r = simular({ 3: 10, 9: 10, 14: 10, 21: 10, 27: 10 }, 30, 29);
  check("5 dias: los 5 con monto", r.etiquetas.length === 5,
    r.etiquetas.map((e) => `${e.dia}:S/${e.v}`).join(" "));
  check("sube escalonado", r.etiquetas.map((e) => e.v).join(",") === "10,20,30,40,50");
  check("ninguno se pisa", haySolape(r.etiquetas) === null, haySolape(r.etiquetas) ?? "");
}

// --- Caso duro: gasto TODOS los dias ---
{
  const todos = {};
  for (let d = 1; d <= 29; d++) todos[d] = 5;
  const r = simular(todos, 31, 29);
  check("gasto diario: 29 puntos dibujados", r.drawnIdx.length === 29);
  check("solo se etiquetan los que caben", r.etiquetas.length <= 8, `${r.etiquetas.length} montos`);
  check("ninguno se pisa", haySolape(r.etiquetas) === null, haySolape(r.etiquetas) ?? "");
  check("hoy lleva monto", r.etiquetas.some((e) => e.dia === 29),
    r.etiquetas.map((e) => `${e.dia}:S/${e.v}`).join(" "));
  check("las etiquetas van de izquierda a derecha",
    r.etiquetas.every((e, k) => k === 0 || e.dia > r.etiquetas[k - 1].dia),
    r.etiquetas.map((e) => e.dia).join(","));
}

// --- Un solo gasto en el mes ---
{
  const r = simular({ 15: 40 }, 30, 20);
  check("un gasto: lleva monto", r.etiquetas.length >= 1,
    r.etiquetas.map((e) => `dia${e.dia}=S/${e.v}`).join(" "));
}

// --- Ninguna etiqueta se sale del dibujo por arriba o abajo ---
{
  const r = simular({ 28: 36, 29: 20 }, 31, 29);
  const max = Math.max(...r.real.filter((v) => v != null), 0) || 1;
  const PAD_TOP = 12, plotH = HEIGHT - 24;
  const fuera = r.etiquetas.filter((e) => {
    const y = PAD_TOP + plotH * (1 - e.v / max);
    const top = e.side === "above" ? Math.max(0, y - 19) : Math.min(HEIGHT - 14, y + 7);
    return top < 0 || top > HEIGHT - 10;
  });
  check("ninguna etiqueta se sale del alto", fuera.length === 0,
    fuera.map((e) => `dia${e.dia}`).join(",") || "todas dentro");
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;
