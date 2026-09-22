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

function diferenciaAngular(desde: number, hasta: number) {
  return Math.atan2(Math.sin(hasta - desde), Math.cos(hasta - desde));
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
  // No hay posiciones ni tamaños fijos por categoría. Al añadir o quitar una,
  // todo se reequilibra gradualmente: pocas categorías ganan presencia y una
  // lista extensa se compacta sin que se superpongan sus rótulos.
  const bubble = count <= 7 ? 62 : Math.max(44, Math.min(70, Math.round(74 - count * 2.2)));
  const radius = Math.max(54, Math.min(70, Math.round(80 - count * 1.6)));
  const orbitX = WIDTH / 2 - bubble / 2 - 5;
  // En vez de dibujar un círculo vertical enorme, se abre la composición hacia
  // los lados. Conserva la separación de los rótulos y reduce 60 px de alto.
  const orbitY = 112 + (70 - bubble) * 0.4;
  const visualValues = data.map((item) => Math.max(item.value, total * MIN_VISIBLE_FRACTION));
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const sectors = visualValues.map((value) => {
    const start = -Math.PI / 2 + (accumulated / visualTotal) * Math.PI * 2;
    const middle = start + (value / visualTotal) * Math.PI;
    accumulated += value;
    return { start, middle, value };
  });
  // Cada círculo mira primero al centro de SU segmento, no a una posición
  // arbitraria. Cuando dos categorías pequeñas están juntas, se separan solo
  // lo necesario para que no se toquen; así las líneas son cortas y legibles.
  const minimumLabelGap = bubble >= 62 ? 0.52 : bubble >= 50 ? 0.42 : 0.36;
  const bubbleAngles = sectors.reduce<number[]>((angles, sector, index) => {
    if (index === 0) return [sector.middle];
    return [...angles, Math.max(sector.middle, angles[index - 1] + minimumLabelGap)];
  }, []);

  if (total <= 0) return null;

  return (
    <View style={{ width: WIDTH, height: HEIGHT, maxWidth: "100%" }}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {data.map((item, index) => {
          const sector = sectors[index];
          const bubbleAngle = bubbleAngles[index];
          const bubbleX = CENTER_X + Math.cos(bubbleAngle) * orbitX;
          const bubbleY = CENTER_Y + Math.sin(bubbleAngle) * orbitY;
          // La línea empieza exactamente en el centro del segmento del mismo
          // color. Antes salía de una posición fija, por eso parecía pertenecer
          // a otra categoría cuando los montos tenían tamaños distintos.
          const ringX = CENTER_X + Math.cos(sector.middle) * (radius + 11);
          const ringY = CENTER_Y + Math.sin(sector.middle) * (radius + 11);
          // El enlace termina en el borde del círculo (nunca lo atraviesa) y
          // se curva apenas cuando dos categorías son vecinas. Esta geometría
          // evita los rizos que antes aparecían con varias categorías azules.
          const lineX = bubbleX - ringX;
          const lineY = bubbleY - ringY;
          const lineLength = Math.max(1, Math.hypot(lineX, lineY));
          const directionX = lineX / lineLength;
          const directionY = lineY / lineLength;
          const bubbleEdgeX = bubbleX - directionX * (bubble / 2 + 1);
          const bubbleEdgeY = bubbleY - directionY * (bubble / 2 + 1);
          const bend = Math.max(-10, Math.min(10, diferenciaAngular(sector.middle, bubbleAngle) * 5));
          const middleX = (ringX + bubbleEdgeX) / 2;
          const middleY = (ringY + bubbleEdgeY) / 2;
          const controlX = middleX - directionY * bend;
          const controlY = middleY + directionX * bend;
          return (
            <Path
              key={`line-${item.id}`}
              d={`M ${ringX} ${ringY} Q ${controlX} ${controlY}, ${bubbleEdgeX} ${bubbleEdgeY}`}
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
        const bubbleAngle = bubbleAngles[index];
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
