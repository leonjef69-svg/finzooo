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
  Timer,
  TriangleAlert,
} from "lucide-react-native";
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
}: {
  onBack: () => void;
  isPremium: boolean;
}) {
  const { t, fmt, pruebaInicio, pruebaHoras, activarPruebaPremium, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  // AQUÍ ESTABA "plan" (mensual o anual), y se fue con el selector de precios: sin precios
  // que elegir no hay plan que guardar. Vuelve cuando vuelva el cobro.
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

        {/* AQUÍ ESTABA EL SELECTOR MENSUAL / ANUAL CON SUS PRECIOS, Y SE QUITÓ (07/08/2026).
            No por diseño: **el cobro no existe**. No hay Play Billing ni pasarela, así que
            esos precios eran lo que COSTARÍA, no lo que se cobra — y Google trata como
            engañoso mostrar un precio y un botón de compra que no cobran. Era el bloqueo
            número uno para publicar.
            La comparación de abajo se queda: decir QUÉ trae Premium es informar, no
            prometer un pago. Lo que no puede estar es el precio ni el botón que compra.
            Cuando el cobro exista, el selector vuelve del historial: ver ESTADO.md. */}
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
            {/* Donde iba el precio va lo que de verdad se puede decir hoy. */}
            <Text className="text-white text-base font-extrabold mt-2">
              {t("premium.llegaPronto")}
            </Text>
            <Text className="text-emerald-100 text-[10px]">{t("premium.llegaProntoDetalle")}</Text>

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

        {/* AQUÍ ESTABA EL BOTÓN "ADQUIRIR", Y ERA EL BLOQUEO NÚMERO UNO PARA PUBLICAR.
            Lo que hacía ese botón era `setIsPremium(true)`: **regalaba Premium**. No fingía
            un pago —eso habría sido peor— y la pantalla lo avisaba con letra pequeña, pero
            aun así era un botón de compra sobre un precio, sin cobro detrás. Google lo trata
            como afirmación engañosa y es motivo de rechazo.
            Ahora no hay botón de compra. Lo que hay es la prueba de 24 horas de abajo, que es
            la forma honesta de que alguien vea las funciones: se prueba de verdad, no se
            promete nada, y no se cobra porque todavía no se puede cobrar.
            Cuando exista Play Billing, el botón vuelve del historial conectado al cobro de
            verdad — y entonces sí tendrá sentido volver a poner el precio. */}
        <View className="px-5 mt-5">
          {isPremium ? (
            <View className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 bg-emerald-500">
              <CheckCircle2 size={18} color="#ffffff" />
              <Text className="text-white font-extrabold">{t("premium.alreadyPremium")}</Text>
            </View>
          ) : (
            <View className="w-full py-4 rounded-2xl items-center bg-white/10 border border-white/15">
              <Text className="text-white/90 font-extrabold">{t("premium.llegaPronto")}</Text>
              <Text className="text-white/50 text-[10px] mt-1 px-6 text-center">
                {t("premium.sinCobro")}
              </Text>
            </View>
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
