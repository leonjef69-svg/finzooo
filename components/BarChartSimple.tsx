import { useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

/**
 * Lo que ocupa cada mes. Con doce meses en una pantalla de celular tocarían a 26 px, y ahí
 * no cabe ni "S/ 1,240.00" ni el nombre del mes. Se le da a cada uno el sitio que necesita y
 * lo que no entre se alcanza deslizando de lado.
 */
// Las cantidades compactas de monedas grandes necesitan un poco más de ancho.
const COL_W = 72;

export default function BarChartSimple({
  data,
  fmt,
  width,
}: {
  data: { label: string; value: number }[];
  fmt: (n: number) => string;
  /** Lo que mide la tarjeta por dentro. Sin esto no se sabe si hace falta deslizar. */
  width?: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  /**
   * SE ABRE POR EL FINAL, NO POR ENERO.
   *
   * El mes que interesa es el último —el que se está viendo—, así que la lista arranca
   * desplazada del todo a la derecha. Abrirla en enero obligaría a deslizar cada vez solo
   * para llegar a donde uno ya estaba mirando.
   */
  const yaColocado = useRef(false);
  const scroll = useRef<ScrollView>(null);

  const anchoTotal = data.length * COL_W;
  const cabeTodo = width == null || anchoTotal <= width;

  const barras = (
    <View className="flex-row items-end" style={{ height: 152 }}>
      {data.map((d, i) => {
        const isActive = selected === i;
        return (
          <TouchableOpacity
            key={d.label}
            activeOpacity={0.75}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
            className="items-center"
            style={{ justifyContent: "flex-end", height: "100%", width: COL_W }}
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

  // Con pocos meses no hay nada que deslizar: se reparten por el ancho, como antes.
  if (cabeTodo) return <View className="items-center">{barras}</View>;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={(w) => {
        if (yaColocado.current) return;
        yaColocado.current = true;
        scroll.current?.scrollTo({ x: Math.max(0, w - (width ?? 0)), animated: false });
      }}
      ref={scroll}
    >
      {barras}
    </ScrollView>
  );
}
