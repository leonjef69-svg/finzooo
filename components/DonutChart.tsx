import { useState, type ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useColorScheme } from "nativewind";
import {
  ajustarValoresRosquilla,
  calcularTamanoBurbujaRosquilla,
  crearCurvaConectorRosquilla,
  distribuirAngulosEtiquetas,
  textoPorcentajeRosquilla,
} from "@/utils/donutGeometry";

type Slice = {
  id: string;
  name: string;
  value: number;
  color: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

// El gráfico usa casi todo el ancho de la tarjeta. Así las llamadas laterales
// tienen aire y no se necesita una tarjeta innecesariamente alta.
const WIDTH = 340;
const HEIGHT = 320;
const CENTER_X = WIDTH / 2;
const CENTER_Y = 156;

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
  const preferredBubble = Math.max(18, Math.min(56, Math.round(66 - count * 1.5)));
  const bubble = calcularTamanoBurbujaRosquilla(count, preferredBubble, WIDTH);
  const radius = Math.max(52, Math.min(66, Math.round(74 - count * 1.7)));
  // Con una sola categoría, la etiqueta queda debajo de la rosquilla. Se deja
  // suficiente separación para que la línea que la une con su segmento se vea.
  const centerY = count === 1 ? 118 : count <= 4 ? 146 : CENTER_Y;
  const height = count === 1 ? 280 : count <= 4 ? 300 : HEIGHT;
  const orbitX = WIDTH / 2 - bubble / 2 - 5;
  // En vez de dibujar un círculo vertical enorme, se abre la composición hacia
  // los lados. Conserva la separación de los rótulos y reduce 60 px de alto.
  const orbitY = count === 1 ? 126 : count <= 4 ? 102 + (56 - bubble) * 0.3 : 112 + (70 - bubble) * 0.4;
  const visualValues = ajustarValoresRosquilla(data.map((item) => item.value), total);
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const sectors = visualValues.map((value) => {
    const start = -Math.PI / 2 + (accumulated / visualTotal) * Math.PI * 2;
    const middle = start + (value / visualTotal) * Math.PI;
    accumulated += value;
    return { start, middle, value };
  });
  // La separación se calcula por el tamaño real de las etiquetas y se
  // distribuye alrededor del círculo, incluso al cruzar el punto de inicio.
  const smallestOrbit = Math.max(1, Math.min(orbitX, orbitY));
  const labelDistance = bubble + 8;
  const minimumLabelGap = 2 * Math.asin(Math.min(1, labelDistance / (2 * smallestOrbit)));
  const bubbleAngles = distribuirAngulosEtiquetas(
    sectors.map((sector) => sector.middle),
    minimumLabelGap,
  );

  if (total <= 0) return null;

  return (
    <View style={{ width: WIDTH, height, maxWidth: "100%" }}>
      <Svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        {data.map((item, index) => {
          const sector = sectors[index];
          const bubbleAngle = bubbleAngles[index];
          const bubbleX = CENTER_X + Math.cos(bubbleAngle) * orbitX;
          const bubbleY = centerY + Math.sin(bubbleAngle) * orbitY;
          // El conector comienza en el segmento de su color y se abre en
          // abanico de inmediato, incluso cuando varios montos son diminutos.
          const route = crearCurvaConectorRosquilla({
            centerX: CENTER_X,
            centerY,
            sourceAngle: sector.middle,
            labelAngle: bubbleAngle,
            bubbleX,
            bubbleY,
            bubbleSize: bubble,
            sourceRadius: radius + 11,
          });
          return (
            <Path
              key={`line-${item.id}`}
              d={`M ${route.inicio.x} ${route.inicio.y} C ${route.control1.x} ${route.control1.y}, ${route.control2.x} ${route.control2.y}, ${route.fin.x} ${route.fin.y}`}
              fill="none"
              stroke={item.color}
              strokeWidth={count === 1 ? 1.8 : 1.1}
              strokeOpacity={count === 1 ? 1 : 0.9}
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
              cy={centerY}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={active ? 22 : 18}
              strokeOpacity={selected == null || active ? 1 : 0.34}
              strokeDasharray={`${dash} ${gap}`}
              rotation={rotation}
              origin={`${CENTER_X}, ${centerY}`}
              onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            />
          );
        })}
      </Svg>

      {data.map((item, index) => {
        const bubbleAngle = bubbleAngles[index];
        const left = CENTER_X + Math.cos(bubbleAngle) * orbitX - bubble / 2;
        const top = centerY + Math.sin(bubbleAngle) * orbitY - bubble / 2;
        const Icon = item.Icon;
        const percentageText = textoPorcentajeRosquilla(item.value, total);
        const percentageAccessible = percentageText === "<1%"
          ? "menos de 1 por ciento"
          : percentageText === ">99%" ? "más de 99 por ciento" : percentageText;
        const iconSize = bubble >= 56 ? 19 : bubble >= 48 ? 16 : bubble >= 36 ? 12 : bubble >= 26 ? 10 : 8;
        const textSize = bubble >= 56 ? 12 : bubble >= 48 ? 11 : bubble >= 36 ? 9 : bubble >= 26 ? 8 : 7;
        return (
          <TouchableOpacity
            key={`bubble-${item.id}`}
            className="bg-white dark:bg-noche-2"
            onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}: ${percentageAccessible}`}
            style={{
              position: "absolute",
              left,
              top,
              width: bubble,
              height: bubble,
              borderRadius: bubble / 2,
              borderWidth: 2.25,
              borderColor: item.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {Icon ? <Icon size={iconSize} color={item.color} strokeWidth={2.35} /> : null}
            <Text numberOfLines={1} style={{ marginTop: 2, color: colorScheme === "dark" ? "#ffffff" : "#0f172a", fontSize: textSize, fontWeight: "800" }}>
              {percentageText}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
