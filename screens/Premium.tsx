import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ChevronLeft,
  Crown,
  Check,
  CheckCircle2,
  Rocket,
  Timer,
  TriangleAlert,
} from "lucide-react-native";
import { ANUAL_POR_MES, PRECIOS } from "@/constants/precios";
import { useAppData } from "@/contexts/AppDataContext";
import { DURACION_PRUEBA_HORAS } from "@/utils/pruebaPremium";

/**
 * FINZO PREMIUM: las dos columnas, el precio y la prueba gratuita.
 *
 * EL DISEÑO LO PIDIÓ EL USUARIO CON TRES MAQUETAS (07/08/2026)
 *
 * Antes era una sola columna: la lista de lo gratis y debajo la de lo Premium, una
 * detrás de otra. Con eso no se puede comparar —para saber qué se gana hay que
 * recordar la lista de arriba mientras se lee la de abajo— y no había ni precio ni
 * forma de probarlo.
 *
 * Ahora: el selector de mensual/anual arriba, las dos columnas LADO A LADO, el botón
 * grande y la prueba de 24 horas con su aviso.
 *
 * EL PAGO NO EXISTE TODAVÍA, Y LA PANTALLA LO DICE
 *
 * No hay cobro integrado. Un botón "ADQUIRIR VERSIÓN PREMIUM" que no cobra y no lo
 * advierte es lo que hace que alguien se sienta engañado, así que debajo va una
 * línea pequeña diciéndolo. Ver constants/precios.
 *
 * LA LISTA DE LO PREMIUM ES LA DE VERDAD, NO LA DE LA MAQUETA
 *
 * Las maquetas traían "Categorías con emojis" y "Recordatorio de exportación". Los
 * emojis se quitaron de la app entera el 03/08/2026 y el recordatorio pasó a ser
 * "Exportación automática" el 05/08. Copiarlas habría puesto la pantalla a prometer
 * cosas que no existen, que es justo el tipo de texto que se ha estado limpiando
 * estos días.
 */
export default function Premium({
  onBack,
  isPremium,
  onUpgrade,
}: {
  onBack: () => void;
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const { t, fmt, pruebaInicio, pruebaHoras, activarPruebaPremium, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  /** Mensual o anual. Arranca en mensual, que es el que lleva la promoción. */
  const [plan, setPlan] = useState<"mensual" | "anual">("mensual");
  /** Si se está preguntando por la prueba gratuita, en la propia pantalla. */
  const [preguntandoPrueba, setPreguntandoPrueba] = useState(false);

  const enPrueba = pruebaHoras > 0;
  const pruebaUsada = pruebaInicio != null;

  const GRATIS = [
    t("premium.freeTransactions"),
    t("premium.freeHistory"),
    t("premium.freeReports"),
    t("premium.freeBudget"),
    t("premium.freeCarryover"),
    t("premium.freeSearch"),
    t("premium.freeTheme"),
    t("premium.freeSync"),
  ];

  // La primera línea es "todo lo del plan gratis": sin ella, la columna de Premium
  // se lee como una lista DISTINTA y no como la de al lado más cosas.
  const PREMIUM = [
    t("premium.todoElGratis"),
    t("premium.perkCategoryBudgets"),
    t("premium.perkSavingsGoals"),
    t("premium.perkAI"),
    t("premium.perkExportPdf"),
    t("premium.perkExportExcel"),
    t("premium.perkImport"),
    t("premium.perkAutoExport"),
    t("premium.perkYape"),
    t("premium.perkVoice"),
    t("premium.perkLock"),
  ];

  function confirmarPrueba() {
    setPreguntandoPrueba(false);
    // La regla de "una sola vez" la hace cumplir el contexto, no este botón: un
    // botón escondido es una decisión de pantalla y esto es de la cuenta.
    if (activarPruebaPremium()) showToast(t("premium.pruebaActiva", { horas: DURACION_PRUEBA_HORAS }));
    else showToast(t("premium.pruebaUsada"));
  }

  return (
    <LinearGradient
      colors={["#0f172a", "#064e3b"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
      style={{ paddingTop: insets.top }}
    >
      <StatusBar style="light" />
      <View className="flex-row items-center px-5 pt-2 pb-1">
        <TouchableOpacity
          onPress={onBack}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <ChevronLeft size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center pb-5">
          <View className="w-14 h-14 rounded-3xl bg-amber-400 items-center justify-center mb-3">
            <Crown size={26} color="#ffffff" />
          </View>
          <Text className="text-white text-xl font-extrabold">{t("premium.title")}</Text>
          <Text className="text-emerald-100 text-sm mt-1">{t("premium.subtitle")}</Text>
        </View>

        {/* EL SELECTOR, ARRIBA.
            Va antes de las columnas porque decide el precio que se lee dentro: al
            revés, se leería un precio y luego se descubriría que era el del otro
            plan. El mensual lleva su etiqueta de promoción. */}
        <View className="flex-row gap-3 px-5 mb-4">
          {(["mensual", "anual"] as const).map((cual) => {
            const activo = plan === cual;
            return (
              <TouchableOpacity
                key={cual}
                onPress={() => setPlan(cual)}
                className={`flex-1 rounded-2xl p-3 border-[1.5px] ${
                  activo ? "bg-emerald-600 border-emerald-400" : "bg-white/5 border-white/15"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm font-extrabold ${activo ? "text-white" : "text-white/70"}`}>
                    {t(cual === "mensual" ? "premium.mensual" : "premium.anual")}
                  </Text>
                  {cual === "mensual" && (
                    <View className="bg-amber-400 rounded-full px-2 py-0.5">
                      <Text className="text-[9px] font-extrabold text-slate-900">
                        {t("premium.promo")}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={`text-[11px] leading-4 mt-1 ${activo ? "text-emerald-50" : "text-white/50"}`}>
                  {cual === "mensual"
                    ? t("premium.mensualDetalle", {
                        antes: fmt(PRECIOS.mensualNormal),
                        ahora: fmt(PRECIOS.mensualPromo),
                      })
                    : t("premium.anualDetalle", {
                        precio: fmt(PRECIOS.anual),
                        porMes: fmt(ANUAL_POR_MES),
                      })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* LAS DOS COLUMNAS, LADO A LADO.
            Es el cambio que pidió: comparar de un vistazo en vez de recordar la
            lista de arriba mientras se lee la de abajo. */}
        <View className="flex-row gap-3 px-5">
          <View className="flex-1 bg-white/95 rounded-3xl p-4">
            <View className="flex-row items-center gap-1.5">
              <View className="bg-slate-200 rounded px-1.5 py-0.5">
                <Text className="text-[9px] font-extrabold text-slate-600">FREE</Text>
              </View>
              <Text className="text-slate-900 text-sm font-extrabold">
                {t("premium.freeSectionTitle")}
              </Text>
            </View>
            <Text className="text-slate-900 text-lg font-extrabold mt-2">{fmt(0)}</Text>
            <Text className="text-slate-500 text-[10px]">{t("premium.paraSiempre")}</Text>

            <Text className="text-slate-400 text-[9px] font-extrabold mt-3 mb-2">
              {t("premium.incluye")}
            </Text>
            <View className="gap-2">
              {GRATIS.map((linea) => (
                <View key={linea} className="flex-row gap-1.5">
                  <Check size={12} color="#059669" strokeWidth={3} />
                  <Text className="text-[11px] leading-4 text-slate-600 flex-1">{linea}</Text>
                </View>
              ))}
            </View>

            {/* "Plan actual" solo cuando de verdad es el plan actual. Con Premium
                puesto sería mentira, y es la clase de texto que se ha estado
                limpiando estos días. */}
            {!isPremium && (
              <View className="bg-emerald-50 rounded-xl py-2 items-center mt-4">
                <Text className="text-emerald-700 text-[11px] font-extrabold">
                  {t("premium.planActual")}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-1 bg-emerald-800 rounded-3xl p-4 border-[1.5px] border-emerald-500">
            <View className="flex-row items-center gap-1.5">
              <Crown size={13} color="#fcd34d" />
              <Text className="text-amber-300 text-sm font-extrabold">
                {t("premium.premiumSectionTitle")}
              </Text>
            </View>
            <View className="flex-row items-end mt-2">
              <Text className="text-white text-lg font-extrabold">
                {fmt(plan === "mensual" ? PRECIOS.mensualPromo : PRECIOS.anual)}
              </Text>
              <Text className="text-emerald-100 text-[10px] mb-0.5">
                {t(plan === "mensual" ? "premium.porMesTresMeses" : "premium.porAno")}
              </Text>
            </View>
            {/* El precio de antes, tachado, SOLO en el plan que lo tiene. En el anual
                no hay "antes": inventarlo sería un descuento falso. */}
            {plan === "mensual" && (
              <Text className="text-emerald-200/60 text-[10px] line-through">
                {t("premium.antes", { precio: fmt(PRECIOS.mensualNormal) })}
              </Text>
            )}

            <Text className="text-emerald-200/70 text-[9px] font-extrabold mt-3 mb-2">
              {t("premium.incluye")}
            </Text>
            <View className="gap-2">
              {PREMIUM.map((linea) => (
                <View key={linea} className="flex-row gap-1.5">
                  <Check size={12} color="#fcd34d" strokeWidth={3} />
                  <Text className="text-[11px] leading-4 text-white/90 flex-1">{linea}</Text>
                </View>
              ))}
            </View>

            {isPremium && (
              <View className="bg-emerald-500/25 rounded-xl py-2 items-center mt-4">
                <Text className="text-emerald-100 text-[11px] font-extrabold">
                  {t("premium.planActual")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* EL BOTÓN GRANDE. Con Premium puesto no dice "adquirir": dice que ya lo
            tienes, que es lo que hacía la pantalla anterior y hay que conservar. */}
        <View className="px-5 mt-5">
          {isPremium ? (
            <View className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 bg-emerald-500">
              <CheckCircle2 size={18} color="#ffffff" />
              <Text className="text-white font-extrabold">{t("premium.alreadyPremium")}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={onUpgrade}>
              <LinearGradient
                colors={["#f59e0b", "#d97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2"
                style={{ borderRadius: 16, overflow: "hidden" }}
              >
                <Rocket size={17} color="#ffffff" />
                <Text className="text-white font-extrabold">{t("premium.adquirir")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* QUE NO SE COBRA, DICHO. Ver la nota de arriba y constants/precios. */}
          {!isPremium && (
            <Text className="text-white/40 text-[10px] text-center mt-2">
              {t("premium.sinCobro")}
            </Text>
          )}
        </View>

        {/* LA PRUEBA GRATUITA.
            Solo si no hay Premium y no se ha usado. Con Premium puesto no tendría
            nada que ofrecer, y usada sería un botón que solo puede decir "no". */}
        {enPrueba ? (
          <View className="mx-5 mt-4 rounded-2xl border border-dashed border-emerald-400/60 py-3 flex-row items-center justify-center gap-2">
            <Timer size={15} color="#6ee7b7" />
            <Text className="text-emerald-200 text-xs font-extrabold">
              {t("premium.pruebaActiva", { horas: pruebaHoras })}
            </Text>
          </View>
        ) : !isPremium && !pruebaUsada ? (
          preguntandoPrueba ? (
            /* EL AVISO VA EN LA PROPIA PANTALLA, no en una ventana del sistema: así
               se puede leer cuánto dura y que es una sola vez con el precio todavía
               a la vista, que es lo que hace falta para decidir. */
            <View className="mx-5 mt-4 rounded-2xl bg-white/95 p-4">
              <View className="flex-row items-center gap-2">
                <TriangleAlert size={16} color="#d97706" />
                <Text className="text-slate-900 text-sm font-extrabold">
                  {t("premium.pruebaTitulo")}
                </Text>
              </View>
              <Text className="text-slate-600 text-[11px] leading-5 mt-2">
                {t("premium.pruebaTexto", { horas: DURACION_PRUEBA_HORAS })}
              </Text>
              <View className="flex-row gap-2.5 mt-3">
                <TouchableOpacity
                  onPress={() => setPreguntandoPrueba(false)}
                  className="flex-1 py-3 rounded-xl items-center bg-slate-100"
                >
                  <Text className="text-slate-600 text-xs font-extrabold">
                    {t("nuevaCat.cancelar")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmarPrueba}
                  className="flex-1 py-3 rounded-xl items-center flex-row justify-center gap-1.5 bg-emerald-600"
                >
                  <CheckCircle2 size={14} color="#ffffff" />
                  <Text className="text-white text-xs font-extrabold">{t("premium.pruebaSi")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setPreguntandoPrueba(true)}
              className="mx-5 mt-4 rounded-2xl border border-dashed border-emerald-400/60 py-3.5 flex-row items-center justify-center gap-2"
            >
              <Timer size={15} color="#6ee7b7" />
              <Text className="text-emerald-200 text-xs font-extrabold">
                {t("premium.probarGratis", { horas: DURACION_PRUEBA_HORAS })}
              </Text>
            </TouchableOpacity>
          )
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}
