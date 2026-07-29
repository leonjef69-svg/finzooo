import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

// Espacio reservado alrededor del dibujo. Sin esto, el primer y el último
// punto quedaban justo en el borde y se veían cortados por la mitad.
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;
const TOOLTIP_H = 26;
const LABEL_H = 18;

// Una línea del gráfico. "null" en un punto significa que esa línea no
// existe ahí — así el gasto real se corta en el día de hoy y la proyección
// empieza justo donde aquel termina, sin inventar datos de días que
// todavía no han ocurrido.
export type ChartSeries = {
  values: (number | null)[];
  color: string;
  dashed?: boolean;
  /** Solo la línea principal lleva el degradado por debajo. */
  fill?: boolean;
  /** Solo la principal lleva puntos tocables. */
  dots?: boolean;
};

/** Parte la línea en tramos, saltándose los huecos (los "null"). */
function pathFrom(points: ({ x: number; y: number } | null)[]): string {
  const parts: string[] = [];
  let open = false;
  for (const p of points) {
    if (!p) {
      open = false;
      continue;
    }
    parts.push(`${open ? "L" : "M"}${p.x},${p.y}`);
    open = true;
  }
  return parts.join(" ");
}

export default function LineChartSimple({
  series,
  labels,
  width = 280,
  height = 130,
  fmt,
}: {
  series: ChartSeries[];
  labels?: string[];
  width?: number;
  height?: number;
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const count = series[0]?.values.length ?? 0;
  if (count === 0) return null;

  const plotW = Math.max(1, width - PAD_X * 2);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const baseY = PAD_TOP + plotH;

  // La escala mira TODAS las líneas: si solo mirara el gasto real, el ritmo
  // del presupuesto o la proyección se saldrían del cuadro por arriba.
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = Math.max(...allValues, 0);
  const range = max || 1;
  const stepX = plotW / Math.max(1, count - 1);

  const toPoints = (s: ChartSeries) =>
    s.values.map((v, i) =>
      v == null ? null : { x: PAD_X + i * stepX, y: PAD_TOP + plotH * (1 - v / range) }
    );

  const main = series[0];
  const mainPoints = toPoints(main);
  const mainPath = pathFrom(mainPoints);

  // Área bajo la línea principal, cerrada contra el suelo.
  const drawn = mainPoints.filter((p): p is { x: number; y: number } => p != null);
  const areaPath =
    main.fill && drawn.length > 1
      ? `${pathFrom(mainPoints)} L${drawn[drawn.length - 1].x},${baseY} L${drawn[0].x},${baseY} Z`
      : "";

  const activeValue = selected != null ? main.values[selected] : null;
  const activePoint = selected != null ? mainPoints[selected] : null;

  return (
    <View style={{ width, height: height + TOOLTIP_H + LABEL_H }}>
      {/* Globo con el monto del punto tocado */}
      {activePoint && activeValue != null && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: Math.min(Math.max(activePoint.x - 45, 0), Math.max(0, width - 90)),
            width: 90,
            alignItems: "center",
          }}
        >
          <View className="bg-slate-900 dark:bg-slate-700 rounded-lg px-2 py-1">
            <Text className="text-white text-[11px] font-extrabold">{fmt(activeValue)}</Text>
          </View>
        </View>
      )}

      <Svg width={width} height={height} style={{ marginTop: TOOLTIP_H }}>
        <Defs>
          <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={main.color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={main.color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Línea guía del suelo, para dar referencia visual */}
        <Line
          x1={PAD_X}
          y1={baseY}
          x2={PAD_X + plotW}
          y2={baseY}
          stroke={main.color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />

        {areaPath ? <Path d={areaPath} fill="url(#lineFill)" /> : null}

        {/* Guía vertical hasta el punto tocado */}
        {activePoint && (
          <Line
            x1={activePoint.x}
            y1={activePoint.y}
            x2={activePoint.x}
            y2={baseY}
            stroke={main.color}
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        )}

        {/* Las de referencia van primero, para que el gasto real quede
            encima y siempre se lea bien. */}
        {series.slice(1).map((s, si) => (
          <Path
            key={si}
            d={pathFrom(toPoints(s))}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5,5" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <Path
          d={mainPath}
          fill="none"
          stroke={main.color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {mainPoints.map((p, i) =>
          p ? (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={selected === i ? 6 : 3.5}
              fill={selected === i ? main.color : "#ffffff"}
              stroke={main.color}
              strokeWidth={selected === i ? 2.5 : 2}
            />
          ) : null
        )}
      </Svg>

      {/* Día de cada punto, centrado exactamente bajo su punto */}
      {labels && (
        <View style={{ height: LABEL_H }}>
          {labels.map((label, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: PAD_X + i * stepX - 16,
                width: 32,
                alignItems: "center",
              }}
            >
              <Text
                className={`text-[10px] ${
                  selected === i
                    ? "text-slate-900 dark:text-slate-100 font-bold"
                    : "text-slate-400 dark:text-slate-400"
                }`}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Zonas para tocar: una columna ancha por punto.
          Antes el toque estaba en el círculo del SVG, que en Android con la
          arquitectura nueva no siempre responde — por eso la gráfica "no
          hacía nada". Estas columnas son View normales y sí responden. */}
      <View
        style={{
          position: "absolute",
          top: TOOLTIP_H,
          left: 0,
          right: 0,
          height,
          flexDirection: "row",
        }}
      >
        {main.values.map((_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.6}
            style={{ flex: 1, height: "100%" }}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
          />
        ))}
      </View>
    </View>
  );
}
