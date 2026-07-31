import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

/**
 * La linea de tendencia pequeña de las tarjetas de Ingresos y Gastos.
 *
 * Dibuja el ACUMULADO del mes, día a día, no el gasto suelto de cada día.
 * Es una decisión, no un descuido: con los sueltos, un mes normal se ve como
 * una sierra de picos y valles donde no se distingue nada. El acumulado
 * responde a la pregunta que de verdad se hace de un vistazo — "¿voy más
 * rápido o más lento que otras veces?" — porque su pendiente ES el ritmo.
 *
 * Un día sin movimientos deja la línea plana, que es exactamente lo que pasó
 * ese día. No se inventa ni se suaviza nada.
 */
export function acumular(valores: number[]): number[] {
  let suma = 0;
  return valores.map((v) => (suma += v));
}

/**
 * Convierte los valores en la orden de dibujo de la línea.
 *
 * Se separa de la pintura para poder comprobarla: que ningún punto se salga
 * del recuadro es una cuenta, no algo que haya que mirar a ojo.
 */
export function buildPath(valores: number[], w: number, h: number, pad = 2): string {
  if (valores.length === 0) return "";
  const max = Math.max(...valores);
  const min = Math.min(...valores, 0);
  const rango = max - min;
  const usable = h - pad * 2;

  const punto = (i: number) => {
    const x = valores.length === 1 ? w / 2 : (i / (valores.length - 1)) * w;
    // Sin rango (todo igual, o todo cero) la línea va abajo del todo: es lo
    // honesto. Centrarla insinuaría un valor intermedio que no existe.
    const y = rango === 0 ? h - pad : h - pad - ((valores[i] - min) / rango) * usable;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };

  return valores.map((_, i) => `${i === 0 ? "M" : "L"}${punto(i)}`).join(" ");
}

export default function Sparkline({
  values,
  color,
  width,
  height = 46,
}: {
  values: number[];
  color: string;
  width: number;
  height?: number;
}) {
  const acumulado = acumular(values);
  const linea = buildPath(acumulado, width, height);
  if (!linea) return <View style={{ width, height }} />;

  // El relleno de debajo es la misma línea cerrada contra el suelo.
  const relleno = `${linea} L${width.toFixed(2)},${height} L0,${height} Z`;
  const id = `grad-${color.replace("#", "")}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={relleno} fill={`url(#${id})`} />
      <Path d={linea} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
