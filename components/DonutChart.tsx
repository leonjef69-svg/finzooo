import { useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const MIN_VISIBLE_FRACTION = 0.012;
const WIDTH = 316;
const HEIGHT = 360;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

/**
 * Todas las categorías quedan visibles alrededor de la rosquilla. Cuando hay
 * más categorías, tanto los círculos como la rosquilla se compactan un poco;
 * nunca se omite una categoría ni se la esconde en una lista aparte.
 */
export default function DonutChart({ data }: { data: Slice[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const count = data.length;
  // Se aprovecha el alto disponible de la tarjeta: los círculos pueden ser
  // legibles aun cuando haya bastantes categorías, sin quedar pegados.
  const bubble = count >= 12 ? 44 : count >= 9 ? 50 : count >= 7 ? 58 : 68;
  const radius = count >= 12 ? 54 : count >= 9 ? 58 : count >= 7 ? 62 : 68;
  const orbitX = WIDTH / 2 - bubble / 2 - 5;
  const orbitY = HEIGHT / 2 - bubble / 2 - 5;
  const visualValues = data.map((item) => Math.max(item.value, total * MIN_VISIBLE_FRACTION));
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total <= 0) return null;

  return (
    <View style={{ width: WIDTH, height: HEIGHT, maxWidth: "100%" }}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {data.map((item, index) => {
          const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
          const bubbleX = CENTER_X + Math.cos(angle) * orbitX;
          const bubbleY = CENTER_Y + Math.sin(angle) * orbitY;
          const ringX = CENTER_X + Math.cos(angle) * (radius + 10);
          const ringY = CENTER_Y + Math.sin(angle) * (radius + 10);
          // No son radios rectos: cada enlace sale tangente a la rosquilla y
          // se curva hacia su círculo, como una llamada visual ordenada.
          const tangentX = -Math.sin(angle);
          const tangentY = Math.cos(angle);
          const bend = (index % 2 === 0 ? 1 : -1) * Math.min(30, 13 + count);
          const controlOneX = ringX + tangentX * bend;
          const controlOneY = ringY + tangentY * bend;
          const controlTwoX = bubbleX - tangentX * bend * 0.55;
          const controlTwoY = bubbleY - tangentY * bend * 0.55;
          return (
            <Path
              key={`line-${item.id}`}
              d={`M ${ringX} ${ringY} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${bubbleX} ${bubbleY}`}
              stroke={item.color}
              strokeWidth={1.15}
              strokeOpacity={0.82}
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
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={active ? 25 : 21}
              strokeOpacity={selected == null || active ? 1 : 0.34}
              strokeDasharray={`${dash} ${gap}`}
              rotation={rotation}
              origin={`${CENTER_X}, ${CENTER_Y}`}
              onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            />
          );
        })}
      </Svg>

      {data.map((item, index) => {
        const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
        const left = CENTER_X + Math.cos(angle) * orbitX - bubble / 2;
        const top = CENTER_Y + Math.sin(angle) * orbitY - bubble / 2;
        const Icon = item.Icon;
        const percentage = (item.value / total) * 100;
        const iconSize = bubble >= 50 ? 20 : bubble >= 42 ? 17 : 14;
        const textSize = bubble >= 50 ? 13 : bubble >= 42 ? 11 : 9;
        return (
          <TouchableOpacity
            key={`bubble-${item.id}`}
            onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}: ${percentage < 1 ? "menos de 1" : Math.round(percentage)} por ciento`}
            style={{
              position: "absolute",
              left,
              top,
              width: bubble,
              height: bubble,
              borderRadius: bubble / 2,
              borderWidth: 2.25,
              borderColor: item.color,
              backgroundColor: "#171719",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {Icon ? <Icon size={iconSize} color={item.color} strokeWidth={2.35} /> : null}
            <Text style={{ marginTop: 1, color: "#ffffff", fontSize: textSize, fontWeight: "800" }}>
              {percentage < 1 ? "<1%" : `${Math.round(percentage)}%`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
