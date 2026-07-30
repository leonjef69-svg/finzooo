import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// Espacio a la izquierda para los montos del eje, y alturas del dibujo.
const AXIS_W = 42;
const PLOT_H = 140;
const LABEL_BAND = 32; // sitio libre arriba para los montos escritos
const DAYS_H = 26; // sitio abajo para los números de los días
const ROW_H = 14; // separación entre los dos renglones de montos
const MIN_GAP = 32; // hueco mínimo entre dos montos del mismo renglón
const ROWS = 2;

// Lo mismo para los números de los días, que son más angostos: dos dígitos
// a 9px ocupan unos 14px.
const DAY_W = 18;
const DAY_ROW_H = 11;

// A partir de cuántos días con gasto se deja de numerarlos uno por uno.
// Con pocos, saber CUÁLES fueron es justo lo que se quiere ver. Cuando casi
// todos los días tienen gasto, esa pregunta ya no significa nada y treinta
// números pegados no se leen: ahí se vuelve a las marcas de 5 en 5.
const MAX_NUMBERED_DAYS = 12;

export type DayBar = { day: number; amount: number };

/**
 * Redondea el techo del eje a un número "bonito".
 *
 * Sin esto, un día de S/ 36 pondría marcas en 9, 18, 27, 36. Nadie lee un
 * eje así. Se busca un paso de 1, 2, 2,5 o 5 (por 10, 100, 1000...) para que
 * las marcas caigan en cifras redondas.
 */
export function niceMax(value: number, steps: number): number {
  if (value <= 0) return steps;
  const raw = value / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * steps;
}

/**
 * Reparte etiquetas en varios renglones para que no se pisen.
 *
 * El problema: con 31 días cada barra mide unos 9px de ancho, y un monto
 * escrito ocupa unos 32px. No caben uno al lado del otro.
 *
 * La solución son renglones a distinta altura. Dos etiquetas solo chocan si
 * comparten renglón, así que dos días pegados —como el 28 y el 29, que es
 * justo el caso real— caen uno en cada renglón y se leen los dos. La que no
 * quepa en ninguno se queda fuera.
 *
 * El orden de la lista es la prioridad: lo primero entra seguro, lo último
 * solo si sobra sitio. Se compara contra TODAS las etiquetas ya puestas en
 * el renglón, no solo la anterior, para poder pasar cosas desordenadas
 * (primero los días con gasto, después los de los extremos).
 *
 * Devuelve, para cada etiqueta que entra, en qué renglón va.
 */
export function placeInRows(
  items: { index: number; x: number }[],
  minGap: number,
  rows: number
): Map<number, number> {
  const plan = new Map<number, number>();
  const used: number[][] = Array.from({ length: rows }, () => []);
  for (const item of items) {
    for (let row = 0; row < rows; row++) {
      if (used[row].every((x) => Math.abs(item.x - x) >= minGap)) {
        plan.set(item.index, row);
        used[row].push(item.x);
        break;
      }
    }
  }
  return plan;
}

/** Dónde escribir cada monto cuando se enciende "Ver montos". */
export function planAmounts(data: DayBar[], colW: number): Map<number, number> {
  const conGasto = data
    .map((d, i) => ({ index: i, x: i * colW + colW / 2, amount: d.amount }))
    .filter((it) => it.amount > 0);
  return placeInRows(conGasto, MIN_GAP, ROWS);
}

/**
 * Qué días llevan su número debajo.
 *
 * Antes eran marcas fijas de 5 en 5 (1, 5, 10, 15...), y eso dejaba las
 * barras que importan sin número: con gasto el 28 y el 29, los números más
 * cercanos eran el 25 y el 30, así que no había forma de saber de qué día
 * era cada barra sin tocarla.
 *
 * Ahora se numeran LOS DÍAS EN QUE SE GASTÓ, en orden. Los extremos del mes
 * (el 1 y el último) se añaden en gris flojo si sobra sitio, para no perder
 * de vista dónde empieza y dónde acaba el mes.
 */
export function planDays(
  data: DayBar[],
  colW: number
): { plan: Map<number, number>; strong: Set<number> } {
  const xOf = (i: number) => i * colW + colW / 2;
  const conGasto = data
    .map((d, i) => ({ index: i, x: xOf(i), amount: d.amount }))
    .filter((it) => it.amount > 0);

  if (conGasto.length > MAX_NUMBERED_DAYS) {
    // Mes cargado: marcas de 5 en 5, que es lo legible.
    const cada5 = data
      .map((d, i) => ({ index: i, x: xOf(i), day: d.day }))
      .filter((it) => it.day === 1 || it.day % 5 === 0);
    return { plan: placeInRows(cada5, DAY_W, 1), strong: new Set() };
  }

  const strong = new Set(conGasto.map((it) => it.index));
  const extremos = [0, data.length - 1]
    .filter((i) => !strong.has(i))
    .map((i) => ({ index: i, x: xOf(i) }));

  return { plan: placeInRows([...conGasto, ...extremos], DAY_W, ROWS), strong };
}

/**
 * Gasto de cada día del mes, en barras que suben desde el suelo.
 *
 * Cada barra es un día y su altura es lo que se gastó ESE día — no un
 * acumulado. Un mes con gasto en dos días muestra dos barras y el resto al
 * ras, sin planicies que haya que explicar.
 *
 * Los días sin gasto se dibujan igual, como una rayita al ras del suelo:
 * marcan que ese día existió y se puede tocar, en vez de dejar huecos que
 * parecen datos perdidos.
 */
export default function DailyBarsChart({
  data,
  fmt,
  width,
  today,
  hint,
  formatSelected,
  showAmountsLabel,
  hideAmountsLabel,
}: {
  data: DayBar[];
  fmt: (n: number) => string;
  width: number;
  /** Día de hoy, para resaltar su barra. 0 si el mes ya pasó. */
  today: number;
  /** Lo que se lee arriba mientras no hay ninguna barra tocada. */
  hint: string;
  formatSelected: (day: number, amount: number) => string;
  showAmountsLabel: string;
  hideAmountsLabel: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);

  if (data.length === 0) return null;

  const plotW = Math.max(1, width - AXIS_W - 6);
  const STEPS = 4;
  const top = niceMax(Math.max(...data.map((d) => d.amount), 0), STEPS);
  const colW = plotW / data.length;

  const hOf = (amount: number) => (amount > 0 ? Math.max(5, (amount / top) * PLOT_H) : 2);
  const yOfValue = (v: number) => PLOT_H * (1 - v / top);

  const plan = showAmounts ? planAmounts(data, colW) : new Map<number, number>();
  const days = planDays(data, colW);
  const activo = selected != null ? data[selected] : null;

  return (
    <View>
      {/* El detalle del día tocado va aquí, en un sitio fijo. Antes era un
          globo flotando sobre la barra, que se cruzaba con los montos
          escritos; en una línea fija siempre se lee y siempre está en el
          mismo lugar. */}
      <View className="flex-row items-center justify-between mb-1.5 gap-2">
        <Text
          numberOfLines={1}
          className={`flex-1 text-[11px] ${
            activo
              ? "font-extrabold text-slate-900 dark:text-slate-100"
              : "text-slate-500 dark:text-slate-300"
          }`}
        >
          {activo ? formatSelected(activo.day, activo.amount) : hint}
        </Text>
        <TouchableOpacity
          onPress={() => setShowAmounts((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
            {showAmounts ? hideAmountsLabel : showAmountsLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ width, height: LABEL_BAND + PLOT_H + DAYS_H }}>
        {/* Montos del eje vertical */}
        {Array.from({ length: STEPS + 1 }, (_, k) => {
          const v = (top / STEPS) * k;
          return (
            <Text
              key={k}
              style={{
                position: "absolute",
                top: LABEL_BAND + yOfValue(v) - 6,
                left: 0,
                width: AXIS_W - 6,
              }}
              className="text-[9px] text-slate-400 text-right"
            >
              {fmt(v)}
            </Text>
          );
        })}

        {/* Rejilla: una raya por cada monto del eje */}
        {Array.from({ length: STEPS + 1 }, (_, k) => (
          <View
            key={k}
            style={{
              position: "absolute",
              top: LABEL_BAND + yOfValue((top / STEPS) * k),
              left: AXIS_W,
              width: plotW,
              height: 1,
              backgroundColor: "#94a3b8",
              opacity: k === 0 ? 0.35 : 0.15,
            }}
          />
        ))}

        {/* Las barras */}
        <View
          style={{
            position: "absolute",
            top: LABEL_BAND,
            left: AXIS_W,
            width: plotW,
            height: PLOT_H,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          {data.map((d, i) => {
            const h = hOf(d.amount);
            const row = plan.get(i);
            const isSelected = selected === i;
            const isToday = today > 0 && d.day === today;
            return (
              <View key={d.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                {row != null && (
                  <Text
                    numberOfLines={1}
                    style={{ position: "absolute", bottom: h + 3 + row * ROW_H, width: MIN_GAP + 12 }}
                    className={`text-[9px] font-bold text-center ${
                      isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {fmt(d.amount)}
                  </Text>
                )}
                <View
                  style={{ height: h, width: "60%", minWidth: 3 }}
                  className={`rounded-t ${
                    isSelected
                      ? "bg-emerald-400"
                      : d.amount > 0
                        ? isToday
                          ? "bg-emerald-500"
                          : "bg-emerald-600"
                        : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              </View>
            );
          })}
        </View>

        {/* Los días. Los que tuvieron gasto van en negro; el 1 y el último,
            en gris flojo, solo si sobra sitio.
            Se pegan al borde para que no se salgan del dibujo: en un mes de
            30 días el "30" caía 7px afuera. */}
        <View style={{ position: "absolute", top: LABEL_BAND + PLOT_H, left: AXIS_W, width: plotW, height: DAYS_H }}>
          {data.map((d, i) => {
            const row = days.plan.get(i);
            if (row == null) return null;
            const fuerte = days.strong.has(i);
            return (
              <View
                key={d.day}
                style={{
                  position: "absolute",
                  top: row * DAY_ROW_H,
                  left: Math.min(Math.max(i * colW + colW / 2 - DAY_W / 2, 0), plotW - DAY_W),
                  width: DAY_W,
                  alignItems: "center",
                }}
              >
                <Text
                  className={`text-[9px] ${
                    selected === i
                      ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                      : fuerte
                        ? "text-slate-700 dark:text-slate-200 font-bold"
                        : "text-slate-400"
                  }`}
                >
                  {d.day}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Zonas para tocar, encima de todo el área de barras.
            Van aparte del dibujo porque la barra de un día sin gasto mide 2px
            de alto y sería imposible de acertar con el dedo; así responde la
            columna entera, de arriba abajo. */}
        <View
          style={{
            position: "absolute",
            top: LABEL_BAND,
            left: AXIS_W,
            width: plotW,
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
    </View>
  );
}
