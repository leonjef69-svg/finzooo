import { Image, View } from "react-native";
import { COLOR_HEX_600 } from "@/constants/colors";
import type { IconComponent } from "@/constants/categories";

/**
 * El cuadrito de color de una categoría, con su dibujo dentro.
 *
 * SI LA PERSONA LE PUSO UNA FOTO, MANDA LA FOTO.
 *
 * Antes no: este cuadrito dibujaba SIEMPRE el icono de líneas. Quien le ponía
 * su propia foto a "Comida" la veía al elegir la categoría, en el micrófono y
 * en el escáner... pero en Inicio, el Historial y el Detalle seguía saliendo
 * el tenedor genérico.
 *
 * O sea: se personalizaba la categoría y media app lo ignoraba. Y no se
 * notaba enseguida, porque cada pantalla por separado se veía bien — solo
 * comparando dos se ve que no coinciden.
 *
 * El emoji NO se usa aquí a propósito: en una lista larga los dibujos de
 * líneas se leen mejor y se ven ordenados. Lo que había que arreglar era la
 * foto, no el estilo.
 */
export default function IconBadge({
  Icon,
  color,
  size = 44,
  image,
}: {
  Icon: IconComponent;
  color: string;
  size?: number;
  /** La foto propia de la categoría, si tiene. La pone catInfo. */
  image?: string;
}) {
  return (
    <View
      className={`bg-${color}-100 rounded-2xl items-center justify-center shrink-0 overflow-hidden`}
      style={{ width: size, height: size }}
    >
      {image ? (
        // Llena el cuadrito entero: una foto con aire alrededor dentro de un
        // recuadro de color se ve como un error, no como una foto.
        <Image source={{ uri: image }} style={{ width: size, height: size }} />
      ) : (
        <Icon size={size * 0.45} color={COLOR_HEX_600[color] || "#475569"} strokeWidth={2.2} />
      )}
    </View>
  );
}
