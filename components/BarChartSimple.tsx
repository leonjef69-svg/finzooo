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
    // Alto un poco mayor que antes porque ahora cada barra lleva su monto
    // encima, y ese texto también ocupa.
    <View className="flex-row items-end justify-around" style={{ height: 152 }}>
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
            {/* El monto va SIEMPRE visible, no solo al tocar la barra.
                Antes había que tocar cada mes para ver su número, así que
                de un vistazo solo se podían comparar alturas — y a ojo, la
                diferencia entre dos barras parecidas no se sabe si son S/
                80 y S/ 90 o S/ 80 y S/ 150. */}
            <Text
              numberOfLines={1}
              className={`text-[11px] mb-1 ${
                isActive
                  ? "font-extrabold text-slate-900 dark:text-slate-100"
                  : "font-bold text-slate-500 dark:text-slate-300"
              }`}
            >
              {fmt(d.value)}
            </Text>
            <View
              className={`w-8 rounded-t-lg ${isActive ? "bg-emerald-600" : "bg-emerald-500"}`}
              style={{ height: Math.max(4, (d.value / max) * 100) }}
            />
            <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-2">{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
