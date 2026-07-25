import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

export default function LineChartSimple({
  data,
  width = 280,
  height = 130,
  color = "#0ea5e9",
  fmt,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const padding = 6;
  const coords = data.map((v, i) => {
    const x = i * stepX;
    const y = padding + (height - padding * 2) * (1 - (v - min) / range);
    return { x, y, v };
  });
  const points = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const active = selected != null ? coords[selected] : null;

  return (
    <View style={{ width, height: height + 24 }}>
      {active && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: Math.min(Math.max(active.x - 40, 0), width - 80),
            width: 80,
            alignItems: "center",
          }}
        >
          <View className="bg-slate-900 rounded-lg px-2 py-1">
            <Text className="text-white text-[11px] font-extrabold">{fmt(active.v)}</Text>
          </View>
        </View>
      )}
      <Svg width={width} height={height} style={{ marginTop: 24 }}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((p, i) => (
          // Un solo círculo que es a la vez el puntito visible y la zona
          // que se puede tocar (nunca del todo transparente, porque en
          // Android lo transparente del todo no se puede tocar).
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={selected === i ? 8 : 10}
            fill={color}
            fillOpacity={selected === i ? 1 : 0.3}
            stroke="#ffffff"
            strokeWidth={selected === i ? 2 : 0}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
          />
        ))}
      </Svg>
    </View>
  );
}
