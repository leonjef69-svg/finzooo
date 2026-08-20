import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Barra de progreso que se mueve sola al cambiar el dato.
 *
 * POR QUÉ HACÍA FALTA
 *
 * La barra de antes SÍ cambiaba: el ancho se calculaba con los gastos de
 * verdad y se redibujaba en cuanto se anotaba uno. Pero saltaba de golpe, sin
 * transición. Un salto instantáneo del 50 al 60 en una tarjeta llena de
 * números no se ve: no hay movimiento que llame la atención, y quien vuelve a
 * la pantalla no puede distinguir "cambió" de "siempre estuvo así".
 *
 * Con 600 milisegundos de recorrido, el cambio se ve ocurrir. Es la
 * diferencia entre un dato correcto y un dato que se nota.
 *
 * La curva es easeOut: arranca rápido y frena al llegar. Es la que se usa
 * para algo que llega a su sitio, en vez de la lineal, que parece mecánica.
 */
export default function AnimatedBar({
  pct,
  color,
  height = 10,
}: {
  /** De 0 a 1. Por encima de 1 se topa: la barra no puede pasarse del riel. */
  pct: number;
  color: string;
  height?: number;
}) {
  const avance = useSharedValue(0);

  useEffect(() => {
    // Se topa aquí y no en quien llama, para que ninguna pantalla pueda
    // dibujar una barra que se salga del recuadro por pasarse del
    // presupuesto. El número de al lado sí dice la verdad completa.
    const objetivo = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
    avance.value = withTiming(objetivo, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, avance]);

  const estilo = useAnimatedStyle(() => ({ width: `${avance.value * 100}%` }));

  return (
    <View
      className="bg-slate-100 dark:bg-noche-3 overflow-hidden"
      style={{ height, borderRadius: height / 2 }}
    >
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: color }, estilo]}
      />
    </View>
  );
}
