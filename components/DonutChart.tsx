import { useMemo, useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { calcularDistribucionRueda, crearConectorRosquilla, crearSectoresVisibles, textoPorcentajeRosquilla } from "@/utils/donutGeometry";
import { ENTRY_FONT } from "@/components/EntryUI";
import { useAppData } from "@/contexts/AppDataContext";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

/** Todas las categorías tienen bloque y conector; los importes nunca se ajustan. */
export default function DonutChart({ data, formatValue, totalLabel, width = 340 }: {
  data: Slice[];
  formatValue: (value: number) => string;
  totalLabel: string;
  width?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { t } = useAppData();
  const items = useMemo(() => data.filter(item => Number.isFinite(item.value) && item.value > 0), [data]);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const count = items.length;
  const layout = useMemo(() => calcularDistribucionRueda(count, width), [count, width]);
  const { centerX, centerY, radius, bubble, positions } = layout;
  const selectedItem = items.find(item => item.id === selected);
  const selectedId = selectedItem?.id ?? null;
  const circumference = 2 * Math.PI * radius;
  const { sectors } = useMemo(() => crearSectoresVisibles(items.map(item => item.value)), [items]);
  const toggle = (id: string) => setSelected(current => current === id ? null : id);
  const centerLabel = selectedItem?.name ?? t("reports.allCategories");
  const amountLabel = selectedItem?.name ?? totalLabel;
  const centerValue = formatValue(selectedItem?.value ?? total);
  const selectedPercentage = selectedItem ? textoPorcentajeRosquilla(selectedItem.value, total) : "100%";
  const describePercentage = (percentage: string) => percentage === "<1%"
    ? t("reports.lessThanOnePercent")
    : percentage === ">99%" ? t("reports.moreThan99Percent") : percentage;
  const centerWidth = Math.max(36, (radius - 12) * 2);
  const compactCenter = radius < 44;

  if (total <= 0) return null;

  return (
    <View style={{ width: layout.width, maxWidth: "100%" }}>
      <View style={{ width: layout.width, height: layout.height }}>
      <Svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
        {items.map((item, index) => (
          <Path key={`line-${item.id}`}
            d={crearConectorRosquilla(sectors[index].middle, positions[index], layout).path}
            fill="none" stroke={item.color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
            strokeOpacity={selectedId == null || selectedId === item.id ? 1 : 0.25} />
        ))}
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
              strokeWidth={20}
              strokeOpacity={selectedId == null || active ? 1 : 0.2}
              strokeDasharray={`${dash} ${circumference - dash}`}
              rotation={sector.start * 180 / Math.PI + separation / circumference * 180}
              origin={`${centerX}, ${centerY}`}
              onPress={() => toggle(item.id)}
            />
          );
        })}
      </Svg>

      <View pointerEvents="none" accessible accessibilityLiveRegion="polite"
        accessibilityLabel={`${centerLabel}, ${describePercentage(selectedPercentage)}`}
        style={{ position: "absolute", left: centerX - centerWidth / 2, top: centerY - Math.min(38, radius - 12), width: centerWidth, height: Math.min(76, (radius - 12) * 2), alignItems: "center", justifyContent: "center", gap: 4 }}>
        {!compactCenter ? <Text className="text-slate-500 dark:text-slate-300" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}
          style={{ fontFamily: ENTRY_FONT.medium, fontSize: 12, lineHeight: 16, textAlign: "center" }}>{centerLabel}</Text> : null}
        <Text className="text-slate-900 dark:text-slate-100" style={{ fontFamily: ENTRY_FONT.bold, fontSize: compactCenter ? 15 : 22, ...(selectedItem ? { color: selectedItem.color } : {}) }}>{selectedPercentage}</Text>
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
      <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${amountLabel}: ${centerValue}`}
        className="bg-slate-50 dark:bg-noche-3 rounded-2xl" style={{ width: "100%", padding: 12, marginTop: 10 }}>
        <Text className="text-slate-500 dark:text-slate-300" style={{ fontFamily: ENTRY_FONT.medium, fontSize: 13, textAlign: "center", marginBottom: 4 }}>{amountLabel}</Text>
        <Text selectable className="text-slate-900 dark:text-slate-100"
          style={{ fontFamily: ENTRY_FONT.bold, fontSize: Math.max(16, Math.min(26, (layout.width - 24) / Math.max(1, centerValue.length * 0.61))), textAlign: "center" }}>{centerValue}</Text>
      </View>
    </View>
  );
}
