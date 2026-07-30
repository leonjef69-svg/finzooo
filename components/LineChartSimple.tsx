import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

// Espacio reservado alrededor del dibujo. Sin esto, el primer y el último
// punto quedaban justo en el borde y se veían cortados por la mitad.
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;
const TOOLTIP_H = 26;
const LABEL_H = 18;

// Una línea del gráfico. "null" en un punto significa que esa línea no
// existe ahí — así el gasto real se corta en el día de hoy y la proyección
// empieza justo donde aquel termina, sin inventar datos de días que
// todavía no han ocurrido.
export type ChartSeries = {
  values: (number | null)[];
  color: string;
  dashed?: boolean;
  /** Solo la línea principal lleva el degradado por debajo. */
  fill?: boolean;
  /** Solo la principal lleva puntos tocables. */
  dots?: boolean;
};

/** Parte la línea en tramos, saltándose los huecos (los "null"). */
function pathFrom(points: ({ x: number; y: number } | null)[]): string {
  const parts: string[] = [];
  let open = false;
  for (const p of points) {
    if (!p) {
      open = false;
      continue;
    }
    parts.push(`${open ? "L" : "M"}${p.x},${p.y}`);
    open = true;
  }
  return parts.join(" ");
}

export default function LineChartSimple({
  series,
  labels,
  width = 280,
  height = 130,
  fmt,
}: {
  series: ChartSeries[];
  labels?: string[];
  width?: number;
  height?: number;
  fmt: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const count = series[0]?.values.length ?? 0;
  if (count === 0) return null;

  const plotW = Math.max(1, width - PAD_X * 2);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const baseY = PAD_TOP + plotH;

  // La escala mira TODAS las líneas: si solo mirara el gasto real, el ritmo
  // del presupuesto o la proyección se saldrían del cuadro por arriba.
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = Math.max(...allValues, 0);
  const range = max || 1;
  const stepX = plotW / Math.max(1, count - 1);

  const toPoints = (s: ChartSeries) =>
    s.values.map((v, i) =>
      v == null ? null : { x: PAD_X + i * stepX, y: PAD_TOP + plotH * (1 - v / range) }
    );

  const main = series[0];
  const mainPoints = toPoints(main);
  const mainPath = pathFrom(mainPoints);

  // Área bajo la línea principal, cerrada contra el suelo.
  const drawn = mainPoints.filter((p): p is { x: number; y: number } => p != null);
  const areaPath =
    main.fill && drawn.length > 1
      ? `${pathFrom(mainPoints)} L${drawn[drawn.length - 1].x},${baseY} L${drawn[0].x},${baseY} Z`
      : "";

  const activeValue = selected != null ? main.values[selected] : null;
  const activePoint = selected != null ? mainPoints[selected] : null;

  // Último punto dibujado de la línea principal: es "hoy", y siempre lleva
  // círculo aunque ese día no tenga etiqueta debajo.
  let lastDrawn = -1;
  mainPoints.forEach((p, i) => {
    if (p) lastDrawn = i;
  });

  // Días en los que el total CAMBIÓ, o sea en los que de verdad se gastó.
  //
  // Antes los círculos salían en los días 1, 5, 10, 15... que son fechas
  // arbitrarias donde normalmente no pasó nada: eran adorno. Ahora cada
  // círculo marca un día con movimiento, así que verlo significa algo.
  const isStep = (i: number) => {
    const v = main.values[i];
    if (v == null) return false;
    if (i === 0) return v > 0;
    const prev = main.values[i - 1];
    return prev == null ? v > 0 : v !== prev;
  };

  // Los puntos que se dibujan: días con gasto, más hoy.
  const drawnIdx = mainPoints
    .map((p, i) => (p && (isStep(i) || i === lastDrawn) ? i : -1))
    .filter((i) => i >= 0);

  // Dónde va el monto de cada punto: encima o debajo.
  //
  // Con pocos puntos se etiquetan TODOS, alternando arriba/abajo cuando dos
  // caen juntos. Hacía falta: dos gastos en días seguidos quedan a 8px uno
  // del otro, y una cifra ocupa unos 35 — con las dos arriba, la primera se
  // perdía. Puestas una arriba y otra abajo, ambas se leen.
  //
  // Con muchos puntos (gasto casi diario) etiquetar todos sería ilegible, así
  // que se van salteando por distancia, siempre de derecha a izquierda para
  // que el total de hoy —el número que más importa— nunca se quede sin él.
  const labelSide = new Map<number, "above" | "below">();
  if (drawnIdx.length <= 8) {
    drawnIdx.forEach((i, k) => {
      const x = PAD_X + i * stepX;
      const prevX = k > 0 ? PAD_X + drawnIdx[k - 1] * stepX : -Infinity;
      const juntos = x - prevX < 42;
      const ladoAnterior = k > 0 ? labelSide.get(drawnIdx[k - 1]) : undefined;
      labelSide.set(i, juntos && ladoAnterior === "above" ? "below" : "above");
    });
  } else {
    const elegidos: number[] = [];
    let lastLabelX = Infinity;
    for (let k = drawnIdx.length - 1; k >= 0; k--) {
      const i = drawnIdx[k];
      const x = PAD_X + i * stepX;
      if (lastLabelX - x >= 42 || k === drawnIdx.length - 1) {
        elegidos.push(i);
        lastLabelX = x;
      }
    }
    // Se recorrió al revés para asegurar el de hoy; se ordena de izquierda
    // a derecha para que el resto del código no dependa de ese detalle.
    elegidos.reverse().forEach((i) => labelSide.set(i, "above"));
  }

  // Si hoy no hubo gasto, su monto es el mismo que el del último día con
  // movimiento: escribirlo dos veces es ruido. El punto de hoy se queda
  // (marca dónde estamos), pero sin repetir la cifra.
  if (drawnIdx.length > 1 && !isStep(lastDrawn)) {
    const anterior = drawnIdx[drawnIdx.length - 2];
    if (main.values[anterior] === main.values[lastDrawn]) labelSide.delete(lastDrawn);
  }

  return (
    <View style={{ width, height: height + TOOLTIP_H + LABEL_H }}>
      {/* Globo con el monto del punto tocado */}
      {activePoint && activeValue != null && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: Math.min(Math.max(activePoint.x - 45, 0), Math.max(0, width - 90)),
            width: 90,
            alignItems: "center",
          }}
        >
          <View className="bg-slate-900 dark:bg-slate-700 rounded-lg px-2 py-1">
            <Text className="text-white text-[11px] font-extrabold">{fmt(activeValue)}</Text>
          </View>
        </View>
      )}

      {/* El monto del techo de la escala, arriba a la izquierda. Ahí nunca
          estorba: la línea del gasto acumulado arranca abajo. */}
      <Text
        style={{ position: "absolute", top: TOOLTIP_H + 1, left: PAD_X + 2 }}
        className="text-[9px] text-slate-400"
      >
        {fmt(max)}
      </Text>

      {/* El monto encima de cada punto. Antes había que tocarlos uno por
          uno para ver cualquier cifra, así que los puntos no decían nada
          por sí solos. */}
      {[...labelSide.entries()].map(([i, side]) => {
        const p = mainPoints[i];
        const v = main.values[i];
        if (!p || v == null) return null;
        const top =
          side === "above"
            ? Math.max(0, p.y - 19)
            : Math.min(height - 14, p.y + 7);
        return (
          <Text
            key={i}
            style={{
              position: "absolute",
              top: TOOLTIP_H + top,
              left: Math.min(Math.max(p.x - 30, 0), Math.max(0, width - 60)),
              width: 60,
            }}
            className={`text-[10px] font-bold text-center ${
              selected === i ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-300"
            }`}
          >
            {fmt(v)}
          </Text>
        );
      })}

      <Svg width={width} height={height} style={{ marginTop: TOOLTIP_H }}>
        <Defs>
          <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={main.color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={main.color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Techo de la escala. Sin esta referencia no se sabe si la altura
            del dibujo son S/ 56 o S/ 5.000: el eje vertical no decía nada. */}
        <Line
          x1={PAD_X}
          y1={PAD_TOP}
          x2={PAD_X + plotW}
          y2={PAD_TOP}
          stroke={main.color}
          strokeOpacity={0.12}
          strokeWidth={1}
          strokeDasharray="3,4"
        />

        {/* Línea guía del suelo, para dar referencia visual */}
        <Line
          x1={PAD_X}
          y1={baseY}
          x2={PAD_X + plotW}
          y2={baseY}
          stroke={main.color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />

        {areaPath ? <Path d={areaPath} fill="url(#lineFill)" /> : null}

        {/* Guía vertical hasta el punto tocado */}
        {activePoint && (
          <Line
            x1={activePoint.x}
            y1={activePoint.y}
            x2={activePoint.x}
            y2={baseY}
            stroke={main.color}
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        )}

        {/* Las de referencia van primero, para que el gasto real quede
            encima y siempre se lea bien. */}
        {series.slice(1).map((s, si) => (
          <Path
            key={si}
            d={pathFrom(toPoints(s))}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5,5" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <Path
          d={mainPath}
          fill="none"
          stroke={main.color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Puntos solo en los días con etiqueta, en el de hoy y en el que
            se esté tocando. Dibujarlos todos —uno por día— llenaba la
            línea de 31 círculos blancos y se veía cargado. Tocar sigue
            funcionando en cualquier día: las zonas de toque son aparte. */}
        {mainPoints.map((p, i) => {
          if (!p) return null;
          // Solo donde significa algo: un día con gasto, hoy, o el tocado.
          const visible = selected === i || i === lastDrawn || isStep(i);
          if (!visible) return null;
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={selected === i ? 6 : 3.5}
              fill={selected === i ? main.color : "#ffffff"}
              stroke={main.color}
              strokeWidth={selected === i ? 2.5 : 2}
            />
          );
        })}
      </Svg>

      {/* Día de cada punto, centrado exactamente bajo su punto */}
      {labels && (
        <View style={{ height: LABEL_H }}>
          {labels.map((label, i) =>
            // Los días sin etiqueta no dibujan nada: con un punto por día
            // serían 31 cajas invisibles amontonadas.
            label === "" ? null : (
            <View
              key={i}
              // 26 de ancho y no 32: un "31" a 10px ocupa unos 12, así que
              // 32 era espacio de sobra que solo servía para que dos
              // etiquetas cercanas se pisaran. Con 26 caben las de
              // febrero, que quedaban a 27,6px una de otra.
              style={{
                position: "absolute",
                left: PAD_X + i * stepX - 13,
                width: 26,
                alignItems: "center",
              }}
            >
              <Text
                className={`text-[10px] ${
                  selected === i
                    ? "text-slate-900 dark:text-slate-100 font-bold"
                    : "text-slate-400 dark:text-slate-400"
                }`}
              >
                {label}
              </Text>
            </View>
            )
          )}
        </View>
      )}

      {/* Zonas para tocar: una columna ancha por punto.
          Antes el toque estaba en el círculo del SVG, que en Android con la
          arquitectura nueva no siempre responde — por eso la gráfica "no
          hacía nada". Estas columnas son View normales y sí responden. */}
      <View
        style={{
          position: "absolute",
          top: TOOLTIP_H,
          left: 0,
          right: 0,
          height,
          flexDirection: "row",
        }}
      >
        {main.values.map((_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.6}
            style={{ flex: 1, height: "100%" }}
            onPress={() => setSelected((prev) => (prev === i ? null : i))}
          />
        ))}
      </View>
    </View>
  );
}
