import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// Alto del área de barras y espacio para el globo del monto y los días.
const PLOT_H = 130;
const TOOLTIP_H = 28;
const LABEL_H = 16;

export type DayBar = { day: number; amount: number };

/**
 * Gasto de cada día del mes, en barras que suben desde el suelo.
 *
 * Por qué barras y no una línea: la línea dibujaba el ACUMULADO, así que en
 * un mes con gasto de dos o tres días salía plana casi todo el ancho y no se
 * entendía sin explicación. Una barra por día no tiene ese problema — donde
 * no gastaste no hay barra, y donde gastaste la altura dice cuánto.
 *
 * Los días sin gasto se dibujan igual, como una rayita al ras del suelo:
 * marcan que ese día existió y se puede tocar, en vez de dejar huecos que
 * parecen datos perdidos.
 */
export default function DailyBarsChart({
  data,
  fmt,
  today,
  showAmountsLabel,
  hideAmountsLabel,
}: {
  data: DayBar[];
  fmt: (n: number) => string;
  /** Día de hoy, para resaltarlo. 0 si el mes ya pasó. */
  today?: number;
  showAmountsLabel: string;
  hideAmountsLabel: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.amount), 0);
  const scale = max || 1;

  // Cuáles llevan el monto escrito al encender el botón.
  //
  // Solo los días con gasto, y saltándose los que caigan demasiado juntos:
  // con 31 barras en unos 280px, dos cifras a menos de 40px se solapan y no
  // se lee ninguna. Las que se saltan siguen mostrándose al tocar la barra.
  const withAmount = new Set<number>();
  if (showAmounts) {
    const stepX = 100 / data.length; // en % del ancho
    let lastPct = -Infinity;
    data.forEach((d, i) => {
      if (d.amount <= 0) return;
      const pct = i * stepX;
      if (pct - lastPct >= 14) {
        withAmount.add(i);
        lastPct = pct;
      }
    });
  }

  const active = selected != null ? data[selected] : null;

  return (
    <View>
      <View className="flex-row items-center justify-end mb-1">
        <TouchableOpacity
          onPress={() => setShowAmounts((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
            {showAmounts ? hideAmountsLabel : showAmountsLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Globo con el día y el monto de la barra tocada */}
      <View style={{ height: TOOLTIP_H }} className="justify-center">
        {active && (
          <View className="self-center bg-slate-900 dark:bg-slate-700 rounded-lg px-2.5 py-1">
            <Text className="text-white text-[11px] font-extrabold">
              {active.day} · {fmt(active.amount)}
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: PLOT_H, flexDirection: "row", alignItems: "flex-end" }}>
        {data.map((d, i) => {
          const isSelected = selected === i;
          const isToday = today != null && d.day === today;
          // Mínimo de 2 para que el día exista visualmente aunque valga 0.
          const h = d.amount > 0 ? Math.max(6, (d.amount / scale) * (PLOT_H - 24)) : 2;
          return (
            <View key={d.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              {withAmount.has(i) && !isSelected && (
                <Text
                  numberOfLines={1}
                  style={{ position: "absolute", bottom: h + 2, width: 46 }}
                  className="text-[9px] font-bold text-slate-500 dark:text-slate-300 text-center"
                >
                  {fmt(d.amount)}
                </Text>
              )}
              <View
                style={{ height: h, width: "58%", minWidth: 3 }}
                className={`rounded-t ${
                  isSelected
                    ? "bg-sky-400"
                    : d.amount > 0
                      ? isToday
                        ? "bg-sky-500"
                        : "bg-sky-600"
                      : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            </View>
          );
        })}
      </View>

      {/* Los días, cada 5. Con 31 no caben todos. */}
      <View style={{ height: LABEL_H, flexDirection: "row" }}>
        {data.map((d, i) => (
          <View key={d.day} style={{ flex: 1, alignItems: "center" }}>
            {d.day === 1 || d.day % 5 === 0 ? (
              <Text
                className={`text-[9px] ${
                  selected === i
                    ? "text-slate-900 dark:text-slate-100 font-bold"
                    : "text-slate-400"
                }`}
              >
                {d.day}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Zonas para tocar, encima de todo el área de barras.
          Van aparte del dibujo porque una barra de un día sin gasto mide 2px
          de alto y sería imposible de acertar con el dedo; así toda la
          columna responde, de arriba abajo. */}
      <View
        style={{
          position: "absolute",
          top: TOOLTIP_H,
          left: 0,
          right: 0,
          height: PLOT_H,
          flexDirection: "row",
        }}
      >
        {data.map((d, i) => (
          <TouchableOpacity
            key={d.day}
            activeOpacity={0.6}
            style={{ flex: 1, height: "100%" }}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
          />
        ))}
      </View>
    </View>
  );
}
