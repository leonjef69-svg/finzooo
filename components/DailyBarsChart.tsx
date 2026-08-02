import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

// Espacio a la izquierda para los montos del eje, y alturas del dibujo.
const AXIS_W = 42;
const PLOT_H = 140;
const LABEL_BAND = 22; // sitio libre arriba para los montos escritos
const DAYS_H = 18; // sitio abajo para los números de los días
const AMOUNT_FONT = 10;
const DAY_FONT = 10;

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

/** Ancho aproximado de un texto corto. Sobra un poco, que es lo prudente. */
/**
 * Lo que ocupa un texto EN LA PANTALLA, a ojo.
 *
 * Lleva el sufijo Screen porque hay otra igual para el PDF, en
 * utils/exportPdfHtml, con numeros distintos: alli el texto lo dibuja un
 * WebView con otra fuente. Ver el comentario de aquella.
 */
export function textWidthScreen(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62 + 4;
}

/**
 * Cada cuántas barras se escribe una etiqueta.
 *
 * Si la etiqueta más ancha no cabe en una columna, se escribe una sí y otra
 * no —o una de cada tres— hasta que quepan. Así nunca se pisan y, sobre
 * todo, ninguna se mueve de su sitio: una etiqueta corrida señala la barra
 * de al lado, que es peor que no poner nada porque miente.
 */
export function labelStep(maxLabelW: number, colW: number): number {
  return Math.max(1, Math.ceil(maxLabelW / Math.max(1, colW)));
}

/**
 * Gasto de cada día del mes, en barras que suben desde el suelo.
 *
 * Solo salen LOS DÍAS EN QUE SE GASTÓ, en orden, igual que el gráfico de
 * meses solo enseña los meses con gasto. Antes se dibujaban los 31 días del
 * calendario y eso rompía todo lo demás: con 31 columnas cada una mide 9px,
 * y ni el número del día (13px) ni el monto (44px) caben ahí. Los números
 * acababan debajo de la barra equivocada y los montos, uno encima de otro o
 * directamente sin escribir.
 *
 * Con las barras que de verdad tienen algo que contar, cada una tiene sitio
 * de sobra para su día y su monto, y no hay nada que empujar ni descartar.
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
  /** Solo los días con gasto, en orden. */
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
  const [showAmounts, setShowAmounts] = useState(true);

  if (data.length === 0) return null;

  const plotW = Math.max(1, width - AXIS_W - 6);
  const STEPS = 4;
  const top = niceMax(Math.max(...data.map((d) => d.amount), 0), STEPS);
  const colW = plotW / data.length;

  const hOf = (amount: number) => Math.max(5, (amount / top) * PLOT_H);
  const yOfValue = (v: number) => PLOT_H * (1 - v / top);
  const heights = data.map((d) => hOf(d.amount));

  // Barras anchas cuando hay pocas, pero con tope: una sola barra ocupando
  // media pantalla no dice nada que no diga una de 28px.
  const barW = Math.max(6, Math.min(28, colW - 8));

  // Los montos van con su formato completo ("S/ 36.00") si caben; si no,
  // solo el número. La moneda ya la dice el eje de la izquierda.
  const anchoCompleto = Math.max(...data.map((d) => textWidthScreen(fmt(d.amount), AMOUNT_FONT)));
  const usarCompleto = anchoCompleto <= colW;
  const amountText = (n: number) =>
    usarCompleto ? fmt(n) : Number.isInteger(n) ? String(n) : n.toFixed(2);

  const anchoMonto = Math.max(...data.map((d) => textWidthScreen(amountText(d.amount), AMOUNT_FONT)));
  const pasoMonto = labelStep(anchoMonto, colW);
  const pasoDia = labelStep(textWidthScreen(String(data[data.length - 1].day), DAY_FONT), colW);

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

        {/* Las barras, con su monto encima y su día debajo */}
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
            const isSelected = selected === i;
            const isToday = today > 0 && d.day === today;
            return (
              <View key={d.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                {showAmounts && (i % pasoMonto === 0 || isSelected) && (
                  <Text
                    numberOfLines={1}
                    style={{
                      position: "absolute",
                      bottom: heights[i] + 3,
                      width: colW,
                      fontSize: AMOUNT_FONT,
                    }}
                    className={`font-bold text-center ${
                      isSelected ? "text-emerald-500" : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {amountText(d.amount)}
                  </Text>
                )}
                <View
                  style={{
                    height: heights[i],
                    width: barW,
                    // La barra tocada se ve de lejos: más clara que las
                    // demás y con un borde que la separa del fondo.
                    ...(isSelected
                      ? { backgroundColor: "#6ee7b7", borderWidth: 1.5, borderColor: "#047857" }
                      : null),
                  }}
                  className={`rounded-t ${
                    isSelected ? "" : isToday ? "bg-emerald-500" : "bg-emerald-600"
                  }`}
                />
                {(i % pasoDia === 0 || isSelected) && (
                  <Text
                    numberOfLines={1}
                    style={{
                      position: "absolute",
                      bottom: -DAYS_H + 2,
                      width: colW,
                      fontSize: DAY_FONT,
                    }}
                    className={`text-center ${
                      isSelected
                        ? "text-emerald-500 font-extrabold"
                        : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {d.day}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Zonas para tocar. Van aparte del dibujo para que responda la
            columna entera, de arriba abajo, y no solo la barra. */}
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
