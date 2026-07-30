import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

// Espacio a la izquierda para los montos del eje, y alturas del dibujo.
const AXIS_W = 42;
const PLOT_H = 150;
const PAD_TOP = 10;
const TOOLTIP_H = 26;
const LABEL_H = 16;

export type DayPoint = { day: number; total: number | null };

/**
 * Redondea el techo del eje a un número "bonito".
 *
 * Sin esto, un mes de S/ 56 pondría el techo en 56 y las marcas saldrían en
 * 14, 28, 42... Nadie lee un eje así. Se busca un paso de 1, 2, 2,5 o 5
 * (por 10, 100, 1000...) para que las marcas caigan en cifras redondas.
 */
function niceMax(value: number, steps: number): number {
  if (value <= 0) return steps;
  const raw = value / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * steps;
}

/**
 * Gasto acumulado del mes: cuánto llevabas gastado cada día.
 *
 * La línea sube y no baja nunca, porque suma lo del día anterior. Se corta
 * en el día de hoy; de ahí sigue punteado hacia dónde se llega si se
 * mantiene el ritmo — eso es una estimación y va marcado como tal en la
 * leyenda, no mezclado con lo real.
 */
export default function SpendingChart({
  data,
  projection,
  fmt,
  width,
  today,
  showAmountsLabel,
  hideAmountsLabel,
}: {
  data: DayPoint[];
  /** Estimación desde hoy hasta fin de mes. null si no aplica. */
  projection: (number | null)[] | null;
  fmt: (n: number) => string;
  width: number;
  today: number;
  showAmountsLabel: string;
  hideAmountsLabel: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);

  if (data.length === 0) return null;

  const plotW = Math.max(1, width - AXIS_W - 8);
  const baseY = PAD_TOP + PLOT_H;

  const reales = data.map((d) => d.total).filter((v): v is number => v != null);
  const proyectados = (projection ?? []).filter((v): v is number => v != null);
  const STEPS = 4;
  const top = niceMax(Math.max(...reales, ...proyectados, 0), STEPS);
  const stepX = plotW / Math.max(1, data.length - 1);

  const xOf = (i: number) => AXIS_W + i * stepX;
  const yOf = (v: number) => PAD_TOP + PLOT_H * (1 - v / top);

  const puntos = data.map((d, i) => (d.total == null ? null : { x: xOf(i), y: yOf(d.total) }));
  const dibujados = puntos.filter((p): p is { x: number; y: number } => p != null);

  const linea = puntos
    .map((p, i) => (p ? `${i === 0 || !puntos[i - 1] ? "M" : "L"}${p.x},${p.y}` : ""))
    .filter(Boolean)
    .join(" ");
  const area =
    dibujados.length > 1
      ? `${linea} L${dibujados[dibujados.length - 1].x},${baseY} L${dibujados[0].x},${baseY} Z`
      : "";

  const lineaProy = projection
    ? projection
        .map((v, i) => (v == null ? "" : `${i === 0 || projection[i - 1] == null ? "M" : "L"}${xOf(i)},${yOf(v)}`))
        .filter(Boolean)
        .join(" ")
    : "";

  // Un punto se dibuja donde el total CAMBIÓ, o sea donde hubo un gasto —
  // más el de hoy. En los días sin movimiento no hay nada que señalar.
  const esGasto = (i: number) => {
    const v = data[i].total;
    if (v == null) return false;
    if (i === 0) return v > 0;
    const prev = data[i - 1].total;
    return prev == null ? v > 0 : v !== prev;
  };
  let ultimo = -1;
  puntos.forEach((p, i) => {
    if (p) ultimo = i;
  });
  const conPunto = data.map((_, i) => i).filter((i) => puntos[i] && (esGasto(i) || i === ultimo));

  // Montos escritos: solo con el botón encendido, salteando los que caigan a
  // menos de 46px del anterior para que no se solapen. Siempre el de hoy.
  const conMonto = new Set<number>();
  if (showAmounts) {
    let lastX = Infinity;
    for (let k = conPunto.length - 1; k >= 0; k--) {
      const i = conPunto[k];
      if (lastX - xOf(i) >= 46 || k === conPunto.length - 1) {
        conMonto.add(i);
        lastX = xOf(i);
      }
    }
  }

  const activo = selected != null ? puntos[selected] : null;
  const activoValor = selected != null ? data[selected].total : null;
  const hoyIdx = data.findIndex((d) => d.day === today);

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

      <View style={{ width, height: TOOLTIP_H + PAD_TOP + PLOT_H + LABEL_H }}>
        {/* Globo del punto tocado */}
        {activo && activoValor != null && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: Math.min(Math.max(activo.x - 50, 0), Math.max(0, width - 100)),
              width: 100,
              alignItems: "center",
            }}
          >
            <View className="bg-slate-900 dark:bg-slate-700 rounded-lg px-2.5 py-1">
              <Text className="text-white text-[11px] font-extrabold">
                {data[selected as number].day} · {fmt(activoValor)}
              </Text>
            </View>
          </View>
        )}

        {/* Montos del eje vertical */}
        {Array.from({ length: STEPS + 1 }, (_, k) => {
          const v = (top / STEPS) * k;
          return (
            <Text
              key={k}
              style={{
                position: "absolute",
                top: TOOLTIP_H + yOf(v) - 6,
                left: 0,
                width: AXIS_W - 6,
              }}
              className="text-[9px] text-slate-400 text-right"
            >
              {fmt(v)}
            </Text>
          );
        })}

        {/* Montos sobre los puntos, con el botón encendido */}
        {[...conMonto].map((i) => {
          const p = puntos[i];
          const v = data[i].total;
          if (!p || v == null) return null;
          return (
            <Text
              key={i}
              style={{
                position: "absolute",
                top: TOOLTIP_H + Math.max(0, p.y - 17),
                left: Math.min(Math.max(p.x - 28, AXIS_W - 10), Math.max(0, width - 56)),
                width: 56,
              }}
              className="text-[9px] font-bold text-slate-600 dark:text-slate-200 text-center"
            >
              {fmt(v)}
            </Text>
          );
        })}

        <Svg width={width} height={PAD_TOP + PLOT_H} style={{ marginTop: TOOLTIP_H }}>
          <Defs>
            <LinearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#10b981" stopOpacity={0.3} />
              <Stop offset="1" stopColor="#10b981" stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Rejilla: una raya por cada monto del eje */}
          {Array.from({ length: STEPS + 1 }, (_, k) => {
            const y = yOf((top / STEPS) * k);
            return (
              <Line
                key={k}
                x1={AXIS_W}
                y1={y}
                x2={AXIS_W + plotW}
                y2={y}
                stroke="#94a3b8"
                strokeOpacity={k === 0 ? 0.35 : 0.15}
                strokeWidth={1}
              />
            );
          })}

          {/* Marca de hoy */}
          {hoyIdx >= 0 && (
            <Line
              x1={xOf(hoyIdx)}
              y1={PAD_TOP}
              x2={xOf(hoyIdx)}
              y2={baseY}
              stroke="#94a3b8"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}

          {area ? <Path d={area} fill="url(#spendFill)" /> : null}

          {/* Estimación de aquí a fin de mes */}
          {lineaProy ? (
            <Path
              d={lineaProy}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5,5"
              strokeLinecap="round"
            />
          ) : null}

          <Path
            d={linea}
            fill="none"
            stroke="#10b981"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {conPunto.map((i) => {
            const p = puntos[i];
            if (!p) return null;
            return (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={selected === i ? 5.5 : 3.5}
                fill={selected === i ? "#10b981" : "#ffffff"}
                stroke="#10b981"
                strokeWidth={2}
              />
            );
          })}
        </Svg>

        {/* Los días, cada 5 */}
        <View style={{ height: LABEL_H }}>
          {data.map((d, i) =>
            d.day === 1 || d.day % 5 === 0 ? (
              <View
                key={d.day}
                style={{ position: "absolute", left: xOf(i) - 12, width: 24, alignItems: "center" }}
              >
                <Text
                  className={`text-[9px] ${
                    selected === i ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-400"
                  }`}
                >
                  {d.day}
                </Text>
              </View>
            ) : null
          )}
        </View>

        {/* Zonas para tocar: una columna por día, aparte del dibujo, porque
            los círculos del SVG no responden de forma fiable en Android. */}
        <View
          style={{
            position: "absolute",
            top: TOOLTIP_H,
            left: AXIS_W,
            width: plotW,
            height: PAD_TOP + PLOT_H,
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
