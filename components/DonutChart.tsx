import { useMemo, useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { calcularDistribucionRueda, textoPorcentajeRosquilla } from "@/utils/donutGeometry";
import { ENTRY_FONT } from "@/components/EntryUI";
import { useAppData } from "@/contexts/AppDataContext";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

/** El anillo expresa los montos; los controles dan presencia pareja a cada categoría. */
export default function DonutChart({ data, formatValue, totalLabel, width = 340 }: {
  data: Slice[];
  formatValue: (value: number) => string;
  totalLabel: string;
  width?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { t } = useAppData();
  const items = data.filter(item => Number.isFinite(item.value) && item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const count = items.length;
  const layout = useMemo(() => calcularDistribucionRueda(count, width), [count, width]);
  const { centerX, centerY, radius, bubble, positions } = layout;
  const selectedItem = items.find(item => item.id === selected);
  const selectedId = selectedItem?.id ?? null;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const sectors = items.map(item => {
    const fraction = item.value / total;
    const start = -90 + accumulated / total * 360;
    accumulated += item.value;
    return { fraction, start, middle: (start + fraction * 180) * Math.PI / 180 };
  });
  const toggle = (id: string) => setSelected(current => current === id ? null : id);
  const centerLabel = selectedItem?.name ?? totalLabel;
  const centerValue = formatValue(selectedItem?.value ?? total);
  const selectedPercentage = selectedItem ? textoPorcentajeRosquilla(selectedItem.value, total) : null;
  const describePercentage = (percentage: string) => percentage === "<1%"
    ? t("reports.lessThanOnePercent")
    : percentage === ">99%" ? t("reports.moreThan99Percent") : percentage;
  const centerWidth = Math.max(36, (radius - 12) * 2);

  if (total <= 0) return null;

  return (
    <View style={{ width: layout.width, height: layout.height, maxWidth: "100%" }}>
      <Svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
        {items.map((item, index) => {
          const sector = sectors[index];
          const length = sector.fraction * circumference;
          // El hueco se limita por el propio segmento para no borrar porciones pequeñas.
          const separation = count > 1 ? Math.min(2, length * 0.12) : 0;
          const dash = length - separation;
          const active = selectedId === item.id;
          return (
            <Circle
              key={item.id}
              cx={centerX} cy={centerY} r={radius}
              fill="none" stroke={item.color}
              strokeWidth={active ? 22 : 16}
              strokeOpacity={selectedId == null || active ? 1 : 0.2}
              strokeDasharray={`${dash} ${circumference - dash}`}
              rotation={sector.start + separation / circumference * 180}
              origin={`${centerX}, ${centerY}`}
              onPress={() => toggle(item.id)}
            />
          );
        })}
        {selectedItem && sectors[items.indexOf(selectedItem)].fraction < 0.015 ? (
          <Circle
            cx={centerX + Math.cos(sectors[items.indexOf(selectedItem)].middle) * radius}
            cy={centerY + Math.sin(sectors[items.indexOf(selectedItem)].middle) * radius}
            r={3} fill={selectedItem.color}
          />
        ) : null}
      </Svg>

      <View pointerEvents="none" accessible accessibilityLiveRegion="polite"
        accessibilityLabel={`${centerLabel}: ${centerValue}${selectedPercentage ? `, ${describePercentage(selectedPercentage)}` : ""}`}
        style={{ position: "absolute", left: centerX - centerWidth / 2, top: centerY - 43, width: centerWidth, height: 86, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Text className="text-slate-500 dark:text-slate-300" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
          style={{ fontFamily: ENTRY_FONT.medium, fontSize: 12, lineHeight: 16, textAlign: "center" }}>{centerLabel}</Text>
        <Text className="text-slate-900 dark:text-slate-100" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65} maxFontSizeMultiplier={1.3}
          style={{ fontFamily: ENTRY_FONT.bold, fontSize: 17, textAlign: "center" }}>{centerValue}</Text>
        {selectedPercentage ? <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 13, color: selectedItem?.color }}>{selectedPercentage}</Text> : null}
      </View>

      {items.map((item, index) => {
        const Icon = item.Icon;
        const active = selectedId === item.id;
        const percentageText = textoPorcentajeRosquilla(item.value, total);
        return (
          <TouchableOpacity key={`bubble-${item.id}`} className="bg-white dark:bg-noche-2"
            onPress={() => toggle(item.id)} activeOpacity={0.75}
            accessibilityRole="button" accessibilityState={{ selected: active }}
            accessibilityLabel={`${item.name}: ${describePercentage(percentageText)}, ${formatValue(item.value)}`}
            style={{ position: "absolute", left: positions[index].x - bubble / 2, top: positions[index].y - bubble / 2, width: bubble, height: bubble, borderRadius: bubble / 2, borderWidth: active ? 3 : 1.5, borderColor: item.color, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {active ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: item.color, opacity: 0.12 }} /> : null}
            {Icon ? <Icon size={bubble >= 56 ? 23 : 20} color={item.color} strokeWidth={2.1} /> : null}
            <Text className="text-slate-900 dark:text-slate-100" numberOfLines={1} maxFontSizeMultiplier={1.3}
              style={{ marginTop: 3, fontFamily: ENTRY_FONT.bold, fontSize: bubble >= 56 ? 12 : 11 }}>{percentageText}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
