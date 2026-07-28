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

export default function LineChartSimple({
  data,
  labels,
  width = 280,
  height = 130,
  color = "#0ea5e9",
  fmt,
}: {
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length === 0) return null;

  const plotW = Math.max(1, width - PAD_X * 2);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const baseY = PAD_TOP + plotH;

  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = plotW / Math.max(1, data.length - 1);

  const coords = data.map((v, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + plotH * (1 - (v - min) / range),
    v,
  }));

  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  // La misma línea, pero cerrada hacia abajo para poder pintarla por dentro
  // con un degradado suave: así se lee como un gráfico y no como un alambre.
  const areaPath =
    `${linePath} L${coords[coords.length - 1].x},${baseY} L${coords[0].x},${baseY} Z`;

  const active = selected != null ? coords[selected] : null;
  const activeLabel = selected != null && labels ? labels[selected] : null;

  return (
    <View style={{ width, height: height + TOOLTIP_H + LABEL_H }}>
      {/* Globo con el monto del punto tocado */}
      {active && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: Math.min(Math.max(active.x - 45, 0), Math.max(0, width - 90)),
            width: 90,
            alignItems: "center",
          }}
        >
          <View className="bg-slate-900 dark:bg-slate-700 rounded-lg px-2 py-1">
            <Text className="text-white text-[11px] font-extrabold">{fmt(active.v)}</Text>
          </View>
        </View>
      )}

      <Svg width={width} height={height} style={{ marginTop: TOOLTIP_H }}>
        <Defs>
          <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Línea guía del suelo, para dar referencia visual */}
        <Line
          x1={PAD_X}
          y1={baseY}
          x2={PAD_X + plotW}
          y2={baseY}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />

        <Path d={areaPath} fill="url(#lineFill)" />

        {/* Guía vertical hasta el punto tocado */}
        {active && (
          <Line
            x1={active.x}
            y1={active.y}
            x2={active.x}
            y2={baseY}
            stroke={color}
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        )}

        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={selected === i ? 6 : 3.5}
            fill={selected === i ? color : "#ffffff"}
            stroke={color}
            strokeWidth={selected === i ? 2.5 : 2}
          />
        ))}
      </Svg>

      {/* Día de cada punto, centrado exactamente bajo su punto */}
      {labels && (
        <View style={{ height: LABEL_H }}>
          {labels.map((label, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: coords[i].x - 16,
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
        {coords.map((_, i) => (
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
