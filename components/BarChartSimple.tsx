import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function BarChartSimple({
  data,
  fmt,
}: {
  data: { label: string; value: number }[];
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="flex-row items-end justify-around" style={{ height: 140 }}>
      {data.map((d, i) => {
        const isActive = selected === i;
        return (
          <TouchableOpacity
            key={d.label}
            activeOpacity={0.75}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
            className="items-center"
            style={{ justifyContent: "flex-end", height: "100%" }}
          >
            {isActive && (
              <Text className="text-[11px] font-extrabold text-slate-900 dark:text-slate-100 mb-1">{fmt(d.value)}</Text>
            )}
            <View
              className={`w-8 rounded-t-lg ${isActive ? "bg-emerald-600" : "bg-emerald-500"}`}
              style={{ height: Math.max(4, (d.value / max) * 110) }}
            />
            <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-2">{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
