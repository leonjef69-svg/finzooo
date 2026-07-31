import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, ChevronLeft, Cloud, Info, Mail, Share2 } from "lucide-react-native";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  applySchedule,
  loadSchedule,
  saveSchedule,
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

  useEffect(() => {
    let alive = true;
    loadSchedule().then((s) => {
      if (!alive) return;
      setSchedule(s);
      setLoaded(true);
    });
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

    if (!ok) {
      // Que el permiso falle en silencio sería lo peor que puede pasar aquí:
      // la pantalla mostraría "cada lunes a las 9:00" y no llegaría nunca
      // nada. Se avisa y se deja la frecuencia en "Nunca" para que lo que se
      // ve siga siendo verdad.
      showToast(t("schedExport.noPermission"));
      const off = { ...next, frequency: "off" as const };
      setSchedule(off);
      saveSchedule(off);
      return;
    }

    if (next.frequency === "off") showToast(t("schedExport.savedOff"));
    else showToast(t("schedExport.saved", { when: describir(next) }));
  }

  function describir(s: ScheduledExport): string {
    const time = hhmm(s.hour, s.minute);
    if (s.frequency === "daily") return t("schedExport.whenDaily", { time });
    if (s.frequency === "weekly")
      return t("schedExport.whenWeekly", { day: t(`weekday.${s.weekday}`), time });
    return t("schedExport.whenMonthly", { day: String(s.day), time });
  }

  const FRECUENCIAS: { id: ExportFrequency; label: string }[] = [
    { id: "off", label: t("schedExport.off") },
    { id: "daily", label: t("schedExport.daily") },
    { id: "weekly", label: t("schedExport.weekly") },
    { id: "monthly", label: t("schedExport.monthly") },
  ];

  const activo = schedule.frequency !== "off";

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
        {/* QUÉ HACE Y QUÉ NO.
            Va arriba del todo y no escondido al final: alguien que activa
            "exportación automática" espera que le llegue el archivo al
            correo dormido. Si eso no va a pasar, tiene que saberlo antes de
            confiar en ello y no un mes después. */}
        <View
          className="rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 mb-5"
          style={CARD_SHADOW}
        >
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

        {activo && (
          <>
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

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("exportPdf.destinationLabel")}
            </Text>
            <View className="flex-row gap-2.5 mb-3">
              {([
                { id: "share", label: t("exportPdf.destShare"), Icon: Share2 },
                { id: "mail", label: t("exportPdf.destMail"), Icon: Mail },
                { id: "drive", label: t("exportPdf.destDrive"), Icon: Cloud },
              ] as const).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => update({ destination: o.id })}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl border-[1.5px] ${
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
              <View className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-[1.5px] border-emerald-600 p-3.5 mb-3">
                <Text className="text-xs text-emerald-800 dark:text-emerald-200 leading-5">
                  {t("schedExport.driveNote")}
                </Text>
              </View>
            )}

            <View className="flex-row items-center gap-2 mt-2">
              <BarChart3 size={15} color="#059669" />
              <Text className="flex-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {describir(schedule)}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
