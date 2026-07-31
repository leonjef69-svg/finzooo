import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// La linea que se dibuja sola. Se crea una sola vez, fuera del componente:
// crearla dentro haria una clase nueva en cada dibujado y la animacion se
// reiniciaria sola.
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * La línea de tendencia de las tarjetas de Ingresos y Gastos.
 *
 * QUÉ DIBUJA
 *
 * El ACUMULADO del mes, día a día, no el movimiento suelto de cada día. Con
 * los sueltos, un mes normal se ve como una sierra donde no se distingue
 * nada. El acumulado responde a la pregunta que se hace de un vistazo —¿voy
 * más rápido o más lento?— porque su pendiente ES el ritmo.
 *
 * POR QUÉ PARECÍA ESTÁTICA
 *
 * Un mes con tres movimientos en los últimos días da una línea pegada al
 * suelo durante 28 días y un salto al final. Es exactamente lo que pasó, pero
 * visualmente está muerta: se dedica el 95% del ancho a días sin nada, y
 * añadir un gasto nuevo casi no la mueve.
 *
 * Dos cosas lo arreglan, y ninguna inventa datos:
 *
 *   1. Un punto en cada día que SÍ tuvo movimiento. Aunque la línea apenas
 *      suba, el punto nuevo aparece y se ve.
 *   2. Se puede tocar. Al arrastrar el dedo se elige un día y arriba sale su
 *      fecha y su monto real. Deja de ser un adorno.
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
  const puntos = pointsOf(valores, w, h, pad);
  if (puntos.length === 0) return "";
  return puntos.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** Dónde cae cada día dentro del recuadro. */
export function pointsOf(valores: number[], w: number, h: number, pad = 2): [number, number][] {
  if (valores.length === 0) return [];
  const max = Math.max(...valores);
  const min = Math.min(...valores, 0);
  const rango = max - min;
  const usable = h - pad * 2;

  return valores.map((v, i) => {
    const x = valores.length === 1 ? w / 2 : (i / (valores.length - 1)) * w;
    // Sin rango (todo igual, o todo cero) la línea va abajo del todo: es lo
    // honesto. Centrarla insinuaría un valor intermedio que no existe.
    const y = rango === 0 ? h - pad : h - pad - ((v - min) / rango) * usable;
    return [x, y];
  });
}

/**
 * Lo que mide la línea, sumando tramo a tramo.
 *
 * Hace falta para animarla: el truco para que una línea se dibuje sola es
 * pintarla toda de guiones, con un guión tan largo como ella entera, y luego
 * ir corriendo ese guión desde fuera hasta su sitio. Sin saber cuánto mide,
 * no se puede.
 */
export function polylineLength(puntos: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    const dx = puntos[i][0] - puntos[i - 1][0];
    const dy = puntos[i][1] - puntos[i - 1][1];
    total += Math.hypot(dx, dy);
  }
  // Nunca cero: se usa como divisor y como largo del guión.
  return Math.max(1, total);
}

/** Qué día cae bajo el dedo. */
export function dayAtX(x: number, total: number, w: number): number {
  if (total <= 1 || w <= 0) return 0;
  const i = Math.round((x / w) * (total - 1));
  return Math.max(0, Math.min(total - 1, i));
}

export default function Sparkline({
  values,
  color,
  width,
  height = 46,
  monthNames,
  monthIndex,
  fmt,
  dayOffset = 0,
}: {
  /** Lo movido cada día del mes. Una posición por día. */
  values: number[];
  color: string;
  width: number;
  height?: number;
  monthNames?: string[];
  monthIndex?: number;
  fmt?: (n: number) => string;
  /** Que dia del mes es la primera posicion. La linea puede empezar en el
   *  dia 12 si antes no hubo nada, y entonces al tocar hay que decir 12. */
  dayOffset?: number;
}) {
  const [elegido, setElegido] = useState<number | null>(null);
  const avance = useSharedValue(0);

  const acumulado = acumular(values);
  const puntos = pointsOf(acumulado, width, height);
  const linea = buildPath(acumulado, width, height);

  // El trazo se rehace cada vez que la línea cambia de forma, que es lo que
  // pasa al anotar un movimiento nuevo. La comparación es sobre el texto de
  // la orden de dibujo: si es igual, nada cambió y no hay que reanimar.
  const largo = polylineLength(puntos);
  useEffect(() => {
    avance.value = 0;
    avance.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [linea, avance]);

  const trazo = useAnimatedProps(() => ({
    strokeDashoffset: largo * (1 - avance.value),
  }));

  if (!linea) return <View style={{ width, height }} />;

  const relleno = `${linea} L${width.toFixed(2)},${height} L0,${height} Z`;
  const id = `grad-${color.replace("#", "")}`;

  // Solo los días que tuvieron algo llevan punto. Marcar los 31 llenaría la
  // línea de puntos y no diría nada.
  const conMovimiento = values
    .map((v, i) => (v > 0 ? i : -1))
    .filter((i) => i >= 0);

  const dia = elegido;
  const etiqueta =
    dia !== null && monthNames && monthIndex !== undefined && fmt
      ? values[dia] > 0
        ? `${dia + 1 + dayOffset} ${monthNames[monthIndex].slice(0, 3).toLowerCase()} · ${fmt(values[dia])}`
        : `${dia + 1 + dayOffset} ${monthNames[monthIndex].slice(0, 3).toLowerCase()} · —`
      : null;

  function tocar(x: number) {
    setElegido(dayAtX(x, values.length, width));
  }

  return (
    <View>
      {/* La etiqueta ocupa su sitio siempre, aunque esté vacía: si apareciera
          y desapareciera, la tarjeta daría un salto al tocarla. */}
      <Text
        className="text-[10px] font-semibold text-slate-500 dark:text-slate-400"
        style={{ height: 14 }}
        numberOfLines={1}
      >
        {etiqueta ?? ""}
      </Text>
      <View
        style={{ width, height }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => tocar(e.nativeEvent.locationX)}
        onResponderMove={(e) => tocar(e.nativeEvent.locationX)}
        onResponderRelease={() => setElegido(null)}
        onResponderTerminate={() => setElegido(null)}
      >
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.28" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={relleno} fill={`url(#${id})`} />
          {/* La línea se dibuja sola de izquierda a derecha cada vez que los
              datos cambian. Antes aparecía ya hecha, y con un mes de
              movimientos pequeños el cambio era de unos pocos píxeles: la
              gráfica parecía la misma de siempre aunque acabaras de anotar un
              gasto. Ahora se ve crecer. */}
          <AnimatedPath
            d={linea}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeDasharray={largo}
            animatedProps={trazo}
          />

          {/* Un punto por cada día con movimiento. Es lo que hace que un
              gasto nuevo se vea aunque la línea apenas suba. */}
          {conMovimiento.map((i) => (
            <Circle key={i} cx={puntos[i][0]} cy={puntos[i][1]} r={2.5} fill={color} />
          ))}

          {dia !== null && (
            <>
              <Line
                x1={puntos[dia][0]}
                y1={0}
                x2={puntos[dia][0]}
                y2={height}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <Circle
                cx={puntos[dia][0]}
                cy={puntos[dia][1]}
                r={4}
                fill={color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </>
          )}
        </Svg>
      </View>
    </View>
  );
}
