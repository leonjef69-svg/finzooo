import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

type Slice = { name: string; value: number; color: string };

export default function DonutChart({
  data,
  size = 160,
  fmt,
}: {
  data: Slice[];
  size?: number;
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  let offsetAcc = 0;

  if (total <= 0) return null;

  const active = selected != null ? data[selected] : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * c;
          const gap = c - dash;
          const rotation = (offsetAcc / total) * 360 - 90;
          offsetAcc += d.value;
          const isActive = selected === i;
          return (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              stroke={d.color}
              strokeWidth={isActive ? 24 : 20}
              strokeOpacity={selected == null || isActive ? 1 : 0.35}
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              rotation={rotation}
              origin={`${center}, ${center}`}
              onPress={() => setSelected((prev) => (prev === i ? null : i))}
            />
          );
        })}
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold" numberOfLines={1}>
          {active ? active.name : "Total"}
        </Text>
        <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100 text-center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{fmt(active ? active.value : total)}</Text>
      </View>
    </View>
  );
}
