import { useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useColorScheme } from "nativewind";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const MIN_VISIBLE_FRACTION = 0.012;
// El gráfico usa casi todo el ancho de la tarjeta. Así las llamadas laterales
// tienen aire y no se necesita una tarjeta innecesariamente alta.
const WIDTH = 340;
const HEIGHT = 320;
const CENTER_X = WIDTH / 2;
const CENTER_Y = 156;

function anglePromedio(angulos: number[]) {
  const vector = angulos.reduce(
    (total, angulo) => ({ x: total.x + Math.cos(angulo), y: total.y + Math.sin(angulo) }),
    { x: 0, y: 0 },
  );
  return Math.atan2(vector.y, vector.x);
}

/**
 * Todas las categorías quedan visibles alrededor de la rosquilla. Cuando hay
 * más categorías, tanto los círculos como la rosquilla se compactan un poco;
 * nunca se omite una categoría ni se la esconde en una lista aparte.
 */
export default function DonutChart({ data }: { data: Slice[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { colorScheme } = useColorScheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const count = data.length;
  // Se aprovecha el alto disponible de la tarjeta: los círculos pueden ser
  // legibles aun cuando haya bastantes categorías, sin quedar pegados.
  const bubble = count >= 16 ? 44 : count >= 12 ? 50 : count >= 9 ? 56 : count >= 7 ? 62 : 70;
  const radius = count >= 16 ? 54 : count >= 12 ? 58 : count >= 9 ? 62 : count >= 7 ? 66 : 70;
  const orbitX = WIDTH / 2 - bubble / 2 - 5;
  // En vez de dibujar un círculo vertical enorme, se abre la composición hacia
  // los lados. Conserva la separación de los rótulos y reduce 60 px de alto.
  const orbitY = 112 + (70 - bubble) * 0.4;
  const visualValues = data.map((item) => Math.max(item.value, total * MIN_VISIBLE_FRACTION));
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * radius;
  const sectorStep = (Math.PI * 2) / count;
  let accumulated = 0;
  const sectors = visualValues.map((value) => {
    const start = -Math.PI / 2 + (accumulated / visualTotal) * Math.PI * 2;
    const middle = start + (value / visualTotal) * Math.PI;
    accumulated += value;
    return { start, middle, value };
  });
  // Las burbujas se colocan en posiciones equidistantes para no chocar, pero
  // se rota toda la rueda hasta que cada una quede lo más cerca posible de su
  // propio segmento. De esa forma el orden se conserva y las líneas no cruzan.
  const slotOrigin = anglePromedio(sectors.map((sector, index) => sector.middle - index * sectorStep));

  if (total <= 0) return null;

  return (
    <View style={{ width: WIDTH, height: HEIGHT, maxWidth: "100%" }}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {data.map((item, index) => {
          const sector = sectors[index];
          const bubbleAngle = slotOrigin + index * sectorStep;
          const bubbleX = CENTER_X + Math.cos(bubbleAngle) * orbitX;
          const bubbleY = CENTER_Y + Math.sin(bubbleAngle) * orbitY;
          // La línea empieza exactamente en el centro del segmento del mismo
          // color. Antes salía de una posición fija, por eso parecía pertenecer
          // a otra categoría cuando los montos tenían tamaños distintos.
          const ringX = CENTER_X + Math.cos(sector.middle) * (radius + 11);
          const ringY = CENTER_Y + Math.sin(sector.middle) * (radius + 11);
          // No son radios rectos: cada enlace sale tangente a la rosquilla y
          // se curva hacia su círculo, como una llamada visual ordenada.
          const tangentX = -Math.sin(sector.middle);
          const tangentY = Math.cos(sector.middle);
          const bend = (index % 2 === 0 ? 1 : -1) * Math.min(30, 13 + count);
          const controlOneX = ringX + tangentX * bend;
          const controlOneY = ringY + tangentY * bend;
          const controlTwoX = bubbleX - tangentX * bend * 0.55;
          const controlTwoY = bubbleY - tangentY * bend * 0.55;
          return (
            <Path
              key={`line-${item.id}`}
              d={`M ${ringX} ${ringY} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${bubbleX} ${bubbleY}`}
              fill="none"
              stroke={item.color}
              strokeWidth={1.15}
              strokeOpacity={0.82}
            />
          );
        })}
        {data.map((item, index) => {
          const sector = sectors[index];
          const fraction = sector.value / visualTotal;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const rotation = (sector.start / Math.PI) * 180;
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
        const bubbleAngle = slotOrigin + index * sectorStep;
        const left = CENTER_X + Math.cos(bubbleAngle) * orbitX - bubble / 2;
        const top = CENTER_Y + Math.sin(bubbleAngle) * orbitY - bubble / 2;
        const Icon = item.Icon;
        const percentage = (item.value / total) * 100;
        const iconSize = bubble >= 62 ? 22 : bubble >= 50 ? 19 : bubble >= 44 ? 16 : 14;
        const textSize = bubble >= 62 ? 14 : bubble >= 50 ? 12 : bubble >= 44 ? 10 : 9;
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
              backgroundColor: colorScheme === "dark" ? "#171719" : "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {Icon ? <Icon size={iconSize} color={item.color} strokeWidth={2.35} /> : null}
            <Text numberOfLines={1} style={{ marginTop: 2, color: colorScheme === "dark" ? "#ffffff" : "#0f172a", fontSize: textSize, fontWeight: "800" }}>
              {percentage < 1 ? "<1%" : `${Math.round(percentage)}%`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
