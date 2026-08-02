// Comprueba que las etiquetas de días no se encimen en NINGÚN mes.
// El fallo real: en un mes de 31 días se etiquetaban el 30 y el 31, que
// caen a 8 píxeles uno del otro, y se leía "301".

const PAD_X = 16;
const WIDTH = 280;
const CAJA = 26; // ancho de la cajita de cada etiqueta

function etiquetas(daysInMonth) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return days.map((d) => {
    const esUltimoConHueco = d === daysInMonth && daysInMonth % 5 >= 3;
    return d === 1 || d % 5 === 0 || esUltimoConHueco ? String(d) : "";
  });
}

let fallos = 0;
// Todos los largos de mes que existen, incluido febrero bisiesto.
for (const dim of [28, 29, 30, 31]) {
  const labels = etiquetas(dim);
  const plotW = WIDTH - PAD_X * 2;
  const stepX = plotW / (dim - 1);

  const puestas = labels
    .map((l, i) => (l === "" ? null : { l, centro: PAD_X + i * stepX }))
    .filter(Boolean);

  let choque = null;
  for (let k = 1; k < puestas.length; k++) {
    const hueco = puestas[k].centro - puestas[k - 1].centro;
    if (hueco < CAJA) choque = `${puestas[k - 1].l} y ${puestas[k].l} a ${hueco.toFixed(1)}px`;
  }

  const lista = puestas.map((p) => p.l).join(",");
  const ok = choque === null;
  if (!ok) fallos++;
  console.log(`  ${ok ? "OK   " : "FALLA"} mes de ${dim} dias  ->  ${lista}${choque ? `   CHOQUE: ${choque}` : ""}`);

  // El último día siempre debe quedar identificable: o lleva etiqueta, o
  // la última que hay está a menos de 5 días de él.
  const ultimaEtiqueta = Math.max(...labels.map((l, i) => (l === "" ? -1 : i + 1)));
  if (dim - ultimaEtiqueta > 4) {
    console.log(`  FALLA mes de ${dim}: la ultima etiqueta es ${ultimaEtiqueta}, muy lejos del final`);
    fallos++;
  }
}

console.log(fallos === 0 ? "\nSin choques en ningun mes" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;
