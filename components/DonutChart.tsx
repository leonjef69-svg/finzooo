import { useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const MIN_VISIBLE_FRACTION = 0.012;
const SIZE = 316;
const HEIGHT = 286;
const CENTER_X = SIZE / 2;
const CENTER_Y = 143;
const RADIUS = 78;
const BUBBLE = 72;
const POSITIONS = [
  { left: 58, top: 0, angle: -130 },
  { left: 186, top: 0, angle: -52 },
  { left: 244, top: 98, angle: 0 },
  { left: 186, top: 202, angle: 52 },
  { left: 58, top: 202, angle: 130 },
  { left: 0, top: 98, angle: 180 },
];

/** La dona no repite el monto central: los sectores salen hacia afuera con
 * conectores, icono y porcentaje. Las categorías restantes siguen abajo. */
export default function DonutChart({ data }: { data: Slice[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const visualValues = data.map((item) => Math.max(item.value, total * MIN_VISIBLE_FRACTION));
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * RADIUS;
  const callouts = [...data].sort((a, b) => b.value - a.value).slice(0, POSITIONS.length);
  let offset = 0;

  if (total <= 0) return null;

  return (
    <View style={{ width: SIZE, height: HEIGHT, maxWidth: "100%" }}>
      <Svg width={SIZE} height={HEIGHT} viewBox={`0 0 ${SIZE} ${HEIGHT}`}>
        {callouts.map((item, index) => {
          const position = POSITIONS[index];
          const radians = (position.angle * Math.PI) / 180;
          const startX = CENTER_X + Math.cos(radians) * (RADIUS + 10);
          const startY = CENTER_Y + Math.sin(radians) * (RADIUS + 10);
          return (
            <Line
              key={`line-${item.id}`}
              x1={startX}
              y1={startY}
              x2={position.left + BUBBLE / 2}
              y2={position.top + BUBBLE / 2}
              stroke={item.color}
              strokeWidth={2}
              strokeOpacity={0.8}
            />
          );
        })}
        {data.map((item, index) => {
          const fraction = visualValues[index] / visualTotal;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const rotation = (offset / visualTotal) * 360 - 90;
          offset += visualValues[index];
          const active = selected === item.id;
          return (
            <Circle
              key={item.id}
              cx={CENTER_X}
              cy={CENTER_Y}
              r={RADIUS}
              fill="none"
              stroke={item.color}
              strokeWidth={active ? 26 : 22}
              strokeOpacity={selected == null || active ? 1 : 0.34}
              strokeDasharray={`${dash} ${gap}`}
              rotation={rotation}
              origin={`${CENTER_X}, ${CENTER_Y}`}
              onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            />
          );
        })}
      </Svg>

      {callouts.map((item, index) => {
        const position = POSITIONS[index];
        const Icon = item.Icon;
        const percentage = (item.value / total) * 100;
        return (
          <TouchableOpacity
            key={`bubble-${item.id}`}
            onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}: ${percentage < 1 ? "menos de 1" : Math.round(percentage)} por ciento`}
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: BUBBLE,
              height: BUBBLE,
              borderRadius: BUBBLE / 2,
              borderWidth: 2.5,
              borderColor: item.color,
              backgroundColor: "#171719",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {Icon ? <Icon size={21} color={item.color} strokeWidth={2.35} /> : null}
            <Text style={{ marginTop: 2, color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
              {percentage < 1 ? "<1%" : `${Math.round(percentage)}%`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
