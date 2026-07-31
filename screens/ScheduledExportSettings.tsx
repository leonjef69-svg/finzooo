import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, ChevronLeft, Cloud, Info, Mail, Play, Share2 } from "lucide-react-native";
import Toggle from "@/components/Toggle";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import { isGmailInstalled } from "@/modules/share-to-app";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  RETRY_OPTIONS,
  applySchedule,
  buildFileName,
  loadSchedule,
  monthForSchedule,
  saveSchedule,
  toDateKey,
  type ExportDestination,
  type ExportFrequency,
  type ScheduledExport,
} from "@/utils/scheduledExport";

const HORAS = [6, 7, 8, 9, 12, 15, 18, 20, 21, 22];

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ScheduledExportSettings({ onBack }: { onBack: () => void }) {
  const { t, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const [schedule, setSchedule] = useState<ScheduledExport>(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  // Si el permiso de avisos está dado. Va al resumen del final: es la única
  // línea que la persona no controla desde aquí, y sin ella nada de lo demás
  // sirve.
  const [notifOk, setNotifOk] = useState(true);
  // Gmail solo se ofrece si de verdad está en el celular. Un botón "Gmail"
  // en un teléfono sin Gmail solo puede decepcionar.
  const [gmail, setGmail] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSchedule().then((s) => {
      if (!alive) return;
      setSchedule(s);
      setNotifOk(!s.enabled ? true : true);
      setLoaded(true);
    });
    setGmail(isGmailInstalled());
    return () => {
      alive = false;
    };
  }, []);

  // Cada cambio se guarda y se reprograma en el momento. No hay botón de
  // guardar a propósito: una pantalla de ajustes con botón de guardar es una
  // pantalla donde se puede salir creyendo que quedó puesto cuando no. Aquí
  // lo que se ve es lo que está programado.
  async function update(patch: Partial<ScheduledExport>) {
    if (!loaded) return;
    const next = { ...schedule, ...patch };

    // "Personalizado" sin ningún día elegido no programaría nada y la
    // pantalla seguiría diciendo que está activo. Se impide quitar el último.
    if (next.frequency === "custom" && next.customDays.length === 0) {
      showToast(t("schedExport.customEmpty"));
      return;
    }

    setSchedule(next);
    saveSchedule(next);

    // El texto del aviso se fija AHORA y se queda así hasta que se vuelva a
    // programar, así que no puede nombrar el mes: un aviso puesto en julio
    // seguiría diciendo "julio" en diciembre. El mes correcto lo calcula la
    // app al tocar el aviso, no el aviso mismo.
    const ok = await applySchedule(next, {
      title: t("schedExport.notifTitle"),
      body: t("schedExport.notifBody"),
    });
    setNotifOk(ok);

    if (!ok) {
      // Que el permiso falle en silencio sería lo peor que puede pasar aquí:
      // la pantalla mostraría "cada lunes a las 9:00" y no llegaría nunca
      // nada. Se avisa y se apaga el interruptor para que lo que se ve siga
      // siendo verdad.
      showToast(t("schedExport.noPermission"));
      const off = { ...next, enabled: false };
      setSchedule(off);
      saveSchedule(off);
      return;
    }

    if (!next.enabled) showToast(t("schedExport.savedOff"));
    else showToast(t("schedExport.saved", { when: describir(next) }));
  }

  function toggleDay(d: number) {
    const puestos = schedule.customDays.includes(d)
      ? schedule.customDays.filter((x) => x !== d)
      : [...schedule.customDays, d].sort();
    update({ customDays: puestos });
  }

  function describir(s: ScheduledExport): string {
    const time = hhmm(s.hour, s.minute);
    if (s.frequency === "daily") return t("schedExport.whenDaily", { time });
    if (s.frequency === "monthly") return t("schedExport.whenMonthly", { day: String(s.day), time });
    const dias =
      s.frequency === "weekly"
        ? t(`weekday.${s.weekday}`)
        : s.customDays.map((d) => t(`weekday.short.${d}`)).join(", ");
    return t("schedExport.whenWeekly", { day: dias, time });
  }

  const typeLabel =
    schedule.type === "expense"
      ? t("exportPdf.expenses")
      : schedule.type === "income"
        ? t("exportPdf.income")
        : t("exportPdf.all");

  // El nombre que va a tener el archivo, calculado igual que lo hará el
  // exportador. Se enseña debajo del campo para que nadie tenga que exportar
  // para descubrir cómo quedó.
  const nombreArchivo = useMemo(
    () =>
      buildFileName({
        mode: schedule.fileNameMode,
        custom: schedule.fileName,
        typeLabel,
        dateKey: toDateKey(new Date()),
        extension: schedule.format,
      }),
    [schedule.fileNameMode, schedule.fileName, schedule.format, typeLabel]
  );

  function probarAhora() {
    router.push({
      pathname: "/export-pdf",
      params: {
        month: monthForSchedule(schedule, new Date()),
        format: schedule.format,
        type: schedule.type,
        dest: schedule.destination,
        name: nombreArchivo,
        auto: "1",
      },
    });
  }

  const FRECUENCIAS: { id: ExportFrequency; label: string }[] = [
    { id: "daily", label: t("schedExport.daily") },
    { id: "weekly", label: t("schedExport.weekly") },
    { id: "monthly", label: t("schedExport.monthly") },
    { id: "custom", label: t("schedExport.custom") },
  ];

  // Tipado a mano y no con "as const": al meter Gmail con un condicional, el
  // "as const" se pierde y los identificadores vuelven a ser un string
  // cualquiera, con lo que update({ destination }) dejaría pasar cualquier
  // texto.
  const DESTINOS: { id: ExportDestination; label: string; Icon: typeof Share2 }[] = [
    { id: "share", label: t("exportPdf.destShare"), Icon: Share2 },
    { id: "mail", label: t("exportPdf.destMail"), Icon: Mail },
    ...(gmail ? [{ id: "gmail" as const, label: t("schedExport.destGmail"), Icon: Mail }] : []),
    { id: "drive", label: t("exportPdf.destDrive"), Icon: Cloud },
  ];

  const destLabel = DESTINOS.find((d) => d.id === schedule.destination)?.label ?? "";
  const freqLabel = FRECUENCIAS.find((f) => f.id === schedule.frequency)?.label ?? "";

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 items-center justify-center -ml-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("schedExport.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* EL INTERRUPTOR PRINCIPAL.
            Va primero y solo. Antes la pantalla arrancaba directamente con
            las opciones y había que buscar "Nunca" entre las frecuencias
            para apagarlo: apagar algo no debería estar escondido dentro de
            la lista de cómo encenderlo. */}
        <View
          className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-4 flex-row items-center gap-3"
          style={CARD_SHADOW}
        >
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("schedExport.masterLabel")}
            </Text>
            <Text
              className={`text-xs font-semibold mt-0.5 ${
                schedule.enabled ? "text-emerald-600" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {schedule.enabled ? t("schedExport.on") : t("schedExport.off")}
            </Text>
          </View>
          <Toggle on={schedule.enabled} onChange={(v: boolean) => update({ enabled: v })} />
        </View>

        {/* QUÉ HACE Y QUÉ NO.
            Alguien que activa esto espera que le llegue el archivo al correo
            dormido. Si eso no va a pasar, tiene que saberlo antes de confiar
            en ello y no un mes después. */}
        <View className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-5">
          <View className="flex-row gap-2.5">
            <Info size={16} color="#64748b" />
            <Text className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-5">
              {t("schedExport.explain")}
            </Text>
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 leading-4 mt-2.5 pl-[26px]">
            {t("schedExport.whyNotFull")}
          </Text>
        </View>

        {schedule.enabled && (
          <>
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.freqLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {FRECUENCIAS.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => update({ frequency: f.id })}
                  className={`px-4 py-2.5 rounded-xl border-[1.5px] ${
                    schedule.frequency === f.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.frequency === f.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {schedule.frequency === "weekly" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.weekdayLabel")}
                </Text>
                <View className="flex-row gap-1.5 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => update({ weekday: d })}
                      className={`flex-1 py-2.5 rounded-xl border-[1.5px] items-center ${
                        schedule.weekday === d
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          schedule.weekday === d ? "text-white" : "text-slate-600 dark:text-slate-200"
                        }`}
                      >
                        {t(`weekday.short.${d}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* PERSONALIZADO: varios días de la semana.
                Se hace así y no con un "cada N días" porque un "cada 3 días"
                se cuenta desde el momento de programarlo: se va corriendo por
                el calendario y se reinicia cada vez que se toca cualquier
                ajuste. Elegir días concretos cae siempre donde se espera. */}
            {schedule.frequency === "custom" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.customLabel")}
                </Text>
                <View className="flex-row gap-1.5 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const puesto = schedule.customDays.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => toggleDay(d)}
                        className={`flex-1 py-2.5 rounded-xl border-[1.5px] items-center ${
                          puesto
                            ? "bg-emerald-600 border-emerald-600"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            puesto ? "text-white" : "text-slate-600 dark:text-slate-200"
                          }`}
                        >
                          {t(`weekday.short.${d}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {schedule.frequency === "monthly" && (
              <>
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
                  {t("schedExport.dayLabel")}
                </Text>
                {/* Solo hasta el 28. Febrero no tiene 29, 30 ni 31, y un
                    aviso puesto en un día que no existe no llega: no falla,
                    simplemente no ocurre ese mes. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingRight: 8 }}
                  className="mb-5"
                >
                  {Array.from({ length: MAX_MONTH_DAY }, (_, i) => i + 1).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => update({ day: d })}
                      className={`w-11 py-2.5 rounded-xl border-[1.5px] items-center ${
                        schedule.day === d
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          schedule.day === d ? "text-white" : "text-slate-600 dark:text-slate-200"
                        }`}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.timeLabel")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 8 }}
              className="mb-5"
            >
              {HORAS.map((h) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => update({ hour: h, minute: 0 })}
                  className={`px-3.5 py-2.5 rounded-xl border-[1.5px] ${
                    schedule.hour === h
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      schedule.hour === h ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {hhmm(h, 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.formatLabel")}
            </Text>
            <View className="flex-row gap-2.5 mb-5">
              {([
                { id: "pdf", label: "PDF" },
                { id: "csv", label: "Excel (CSV)" },
              ] as const).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => update({ format: f.id })}
                  className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${
                    schedule.format === f.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.format === f.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.typeLabel")}
            </Text>
            <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-row mb-5">
              {([
                { id: "all", label: t("exportPdf.all") },
                { id: "expense", label: t("exportPdf.expenses") },
                { id: "income", label: t("exportPdf.income") },
              ] as const).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ type: o.id })}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    schedule.type === o.id ? "bg-emerald-600" : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.type === o.id ? "text-white" : "text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* NOMBRE DEL ARCHIVO.
                En automático la fecha va al final y en formato año-mes-día:
                así, al ordenar por nombre en Drive o en el explorador, los
                archivos quedan en orden cronológico solos. */}
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.fileNameLabel")}
            </Text>
            <View className="flex-row gap-2.5 mb-2.5">
              {([
                { id: "auto", label: t("schedExport.fileAuto") },
                { id: "custom", label: t("schedExport.fileCustom") },
              ] as const).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ fileNameMode: o.id })}
                  className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${
                    schedule.fileNameMode === o.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      schedule.fileNameMode === o.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {schedule.fileNameMode === "custom" && (
              <TextInput
                value={schedule.fileName}
                onChangeText={(v) => {
                  // Se guarda al escribir pero NO se reprograma el aviso en
                  // cada letra: el nombre no cambia cuándo suena. update()
                  // pediría permisos y mostraría un mensajito por cada tecla.
                  const next = { ...schedule, fileName: v };
                  setSchedule(next);
                  saveSchedule(next);
                }}
                placeholder={t("schedExport.filePlaceholder")}
                placeholderTextColor="#94a3b8"
                maxLength={60}
                className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 mb-2"
              />
            )}

            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-5">
              {t("schedExport.filePreview", { name: nombreArchivo })}
            </Text>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.destinationLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {DESTINOS.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ destination: o.id })}
                  className={`flex-row items-center gap-1.5 px-3.5 py-3 rounded-xl border-[1.5px] ${
                    schedule.destination === o.id
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <o.Icon size={15} color={schedule.destination === o.id ? "#ffffff" : "#64748b"} />
                  <Text
                    className={`text-xs font-bold ${
                      schedule.destination === o.id ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Drive es el único destino que puede funcionar solo, porque no
                necesita que nadie elija a quién mandarlo. Se dice justo aquí,
                al elegirlo, y no en un texto de ayuda general. */}
            {schedule.destination === "drive" && (
              <View className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-[1.5px] border-emerald-600 p-3.5 mb-5">
                <Text className="text-xs text-emerald-800 dark:text-emerald-200 leading-5">
                  {t("schedExport.driveNote")}
                </Text>
              </View>
            )}

            {/* REPETICIÓN.
                Un aviso se ve a las 9:00 con las manos ocupadas y se olvida a
                las 9:01. Esto lo vuelve a sacar más tarde, pero SOLO si ese
                día todavía no se exportó: si insistiera igual, se silenciaría
                en dos días y no serviría de nada. */}
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("schedExport.retryLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-1.5">
              {RETRY_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => update({ retryMinutes: m })}
                  className={`px-3.5 py-2.5 rounded-xl border-[1.5px] ${
                    schedule.retryMinutes === m
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      schedule.retryMinutes === m ? "text-white" : "text-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {m === 0 ? t("schedExport.retryOff") : t("schedExport.retryMinutes", { count: m })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-5">
              {t("schedExport.retryHint")}
            </Text>

            {/* RESUMEN.
                Antes solo se veía "cada día a las 09:00", y eso deja fuera el
                formato, qué exporta y a dónde va — que es justo lo que se
                olvida entre una visita y la siguiente. */}
            <View
              className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-4"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-extrabold text-slate-900 dark:text-slate-100 mb-2.5">
                {t("schedExport.summaryTitle")}
              </Text>
              {[
                freqLabel,
                hhmm(schedule.hour, schedule.minute),
                schedule.format === "pdf" ? "PDF" : "Excel (CSV)",
                typeLabel,
                destLabel,
                nombreArchivo,
                notifOk ? t("schedExport.summaryNotif") : t("schedExport.summaryNoNotif"),
              ].map((linea, i) => (
                <View key={i} className="flex-row items-center gap-2 py-1">
                  <Check size={14} color={i === 6 && !notifOk ? "#e11d48" : "#059669"} />
                  <Text
                    className={`flex-1 text-xs ${
                      i === 6 && !notifOk
                        ? "text-rose-500 font-semibold"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                    numberOfLines={1}
                  >
                    {linea}
                  </Text>
                </View>
              ))}
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {describir(schedule)}
              </Text>
            </View>

            {/* PROBAR AHORA.
                Sin esto, comprobar que la configuración funciona significaba
                esperar al día siguiente a las 9:00. Y si estaba mal, otro día
                más. */}
            <TouchableOpacity
              onPress={probarAhora}
              className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 border-[1.5px] border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
            >
              <Play size={17} color="#059669" />
              <Text className="text-emerald-700 dark:text-emerald-300 font-extrabold">
                {t("schedExport.testNow")}
              </Text>
            </TouchableOpacity>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
              {t("schedExport.testHint")}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
