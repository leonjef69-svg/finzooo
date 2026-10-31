import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronLeft,
  CloudUpload,
  Crown,
  FileUp,
  Fingerprint,
  MegaphoneOff,
  Mic,
  MessageSquare,
  Palette,
  Sparkles,
  Store,
  TriangleAlert,
  UsersRound,
  Zap,
  Info,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";
import { anunciosActivos } from "@/constants/anuncios";
import { AHORRO_PRO_ANUAL, PRECIOS } from "@/constants/precios";
import { comprarPlan, comprasDisponibles, restaurarCompra, type PlanDeCompra } from "@/utils/compras";
import { DURACION_PRUEBA_HORAS, diaDeLaFecha, pruebaTerminaEn } from "@/utils/pruebaPremium";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { ENTRY_FONT } from "@/components/EntryUI";
import { settingsColors } from "@/components/SettingsUI";
import { TELEGRAM_ENABLED } from "@/constants/features";

type PlanVista = "plus" | "pro";
type PeriodoPro = "mensual" | "anual";

export default function Premium({
  onBack,
  isPremium,
  isTesterPremium,
}: {
  onBack: () => void;
  isPremium: boolean;
  isTesterPremium: boolean;
}) {
  const {
    t,
    monthNames,
    userCurrency,
    pruebaInicio,
    pruebaHoras,
    activarPruebaPremium,
    showToast,
    visualStyle,
  } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const colors = settingsColors(visualStyle, dark);
  const [plan, setPlan] = useState<PlanVista>("pro");
  const [periodo, setPeriodo] = useState<PeriodoPro>("mensual");
  const [comprando, setComprando] = useState<PlanDeCompra | null>(null);
  const [preguntandoPrueba, setPreguntandoPrueba] = useState(false);
  const [activandoPrueba, setActivandoPrueba] = useState(false);

  const enPrueba = pruebaHoras > 0;
  const pruebaUsada = pruebaInicio != null;
  const autoRegistroDisponible = hayRegistroAutomatico(userCurrency);
  const sinAnuncios = anunciosActivos();

  const enSoles = (importe: number) => `S/ ${importe.toFixed(2)}`;
  const precioMensual = enSoles(PRECIOS.mensualNormal);
  const precioAnual = enSoles(PRECIOS.anual);
  const precioPlus = enSoles(PRECIOS.plusMensual);
  const ahorroAnual = enSoles(AHORRO_PRO_ANUAL);
  const precioSeleccionado = plan === "plus"
    ? precioPlus
    : periodo === "anual" ? precioAnual : precioMensual;
  const unidadPrecio = plan === "plus" ? t("premium.porMes") : periodo === "anual" ? t("premium.porAno") : t("premium.porMes");

  const cuandoTermina = (() => {
    const ahora = Date.now();
    const fin = pruebaTerminaEn(pruebaInicio, ahora);
    if (fin == null) return "";
    const cuando = new Date(fin);
    const hora = cuando.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const dia = diaDeLaFecha(fin, ahora);
    if (dia === "hoy") return t("premium.terminaHoy", { hora });
    if (dia === "manana") return t("premium.terminaManana", { hora });
    return t("premium.terminaOtro", {
      hora,
      dia: cuando.getDate(),
      mes: monthNames[cuando.getMonth()],
    });
  })();

  const plusBenefits = [
    ...(autoRegistroDisponible ? [{ Icon: Zap, label: t("premium.perkYape"), detail: t("premium.appsPeruBolivia"), wide: true }] : []),
    { Icon: MegaphoneOff, label: t("premium.plusNoAds") },
    { Icon: Palette, label: t("premium.visualStyles") },
  ];
  const proBenefits = [
    ...(autoRegistroDisponible ? [{ Icon: Zap, label: t("premium.perkYape"), detail: t("premium.appsPeruBolivia"), wide: true }] : []),
    { Icon: MegaphoneOff, label: t("premium.plusNoAds") },
    { Icon: Palette, label: t("premium.visualStyles") },
    { Icon: CloudUpload, label: t("premium.perkCloudSync") },
    { Icon: CalendarClock, label: t("premium.perkAutoExport") },
    { Icon: FileUp, label: t("premium.perkImportExport") },
    { Icon: Store, label: t("premium.perkBusiness") },
    { Icon: UsersRound, label: t("premium.perkFamilyBoxes") },
    { Icon: Mic, label: t("premium.perkVoiceShort") },
    { Icon: Fingerprint, label: t("premium.perkLock") },
    ...(TELEGRAM_ENABLED ? [{ Icon: MessageSquare, label: t("premium.perkTelegram") }] : []),
    { Icon: ChartNoAxesCombined, label: t("premium.reportsAdvice") },
  ];
  const beneficios = plan === "pro" ? proBenefits : plusBenefits;

  async function confirmarPrueba() {
    if (activandoPrueba) return;
    setActivandoPrueba(true);
    try {
      const activada = await activarPruebaPremium();
      setPreguntandoPrueba(false);
      if (activada) showToast(t("premium.pruebaActiva", { horas: DURACION_PRUEBA_HORAS }));
      else showToast(t("premium.pruebaUsada"));
    } catch {
      showToast(t("premium.pruebaError"));
    } finally {
      setActivandoPrueba(false);
    }
  }

  async function comprar(periodoElegido: PlanDeCompra) {
    if (comprando) return;
    setComprando(periodoElegido);
    try {
      await comprarPlan(periodoElegido);
    } catch {
      showToast(t("premium.compraNoDisponible"));
    } finally {
      setComprando(null);
    }
  }

  async function restaurar() {
    try {
      await restaurarCompra();
      showToast(t("premium.restaurada"));
    } catch {
      showToast(t("premium.compraNoDisponible"));
    }
  }

  function mostrarInfoRegistro() {
    Alert.alert(
      t("premium.autoRegInfoTitle"),
      t("premium.autoRegInfoText"),
      [{ text: t("premium.entendido") }],
    );
  }

  const fondo = dark ? "#000000" : "#f7f5ee";
  const textoBoton = dark ? "#142018" : "#ffffff";

  return (
    <View style={{ flex: 1, backgroundColor: fondo, paddingTop: insets.top }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1 }}>
        <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={8}
            onPress={onBack}
            style={{ position: "absolute", left: 14, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 21, color: colors.text }}>Fino</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", marginBottom: 18 }}>
            <Text accessibilityRole="header" style={{ fontFamily: ENTRY_FONT.medium, fontSize: 15, lineHeight: 22, textAlign: "center", color: colors.text }}>
              {t("premium.planPitch")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {(["plus", "pro"] as const).map((option) => {
              const selected = plan === option;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPlan(option)}
                  activeOpacity={0.8}
                  style={{ flex: 1, minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface }}
                >
                  {option === "plus"
                    ? <Sparkles size={26} color={colors.accent} strokeWidth={2.2} />
                    : <Crown size={26} color={colors.iconDetail} strokeWidth={2.2} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 16, color: colors.text }}>
                      {option === "plus" ? t("premium.plusName") : t("premium.proName")}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: ENTRY_FONT.regular, fontSize: 11, color: colors.muted, marginTop: 1 }}>
                      {option === "plus" ? `${precioPlus} ${t("premium.porMes")}` : t("premium.allBenefits")}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14 }}>
            {autoRegistroDisponible && (
              <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBackground, marginRight: 10 }}>
                  <Zap size={25} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 14, color: colors.text }}>{t("premium.perkYape")}</Text>
                  <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 11, color: colors.muted, marginTop: 2 }}>{t("premium.appsPeruBolivia")}</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("premium.autoRegInfoTitle")} onPress={mostrarInfoRegistro} hitSlop={8} style={{ padding: 4 }}>
                  <Info size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 7 }}>
              {beneficios.filter(item => item.label !== t("premium.perkYape")).map(({ Icon, label, detail }, index) => {
                return (
                  <View
                    key={`${label}-${index}`}
                    accessibilityLabel={label}
                    style={{ width: "48%", minHeight: detail ? 48 : 42, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}
                  >
                    <View style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBackground }}>
                      <Icon size={22} color={colors.accent} strokeWidth={2.1} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 12, lineHeight: 16, color: colors.text }}>{label}</Text>
                      {detail ? <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 10, lineHeight: 13, color: colors.muted, marginTop: 1 }}>{detail}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginTop: 10, marginBottom: 12 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexShrink: 1 }}>
                <Text accessibilityLiveRegion="polite" style={{ fontFamily: ENTRY_FONT.bold, fontSize: 28, lineHeight: 34, color: colors.text }}>
                  {precioSeleccionado}
                </Text>
                <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 12, color: colors.muted, marginTop: 1 }}>{unidadPrecio}</Text>
              </View>
              {plan === "pro" && (
                <View style={{ flexDirection: "row", padding: 3, borderRadius: 15, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border }}>
                  {(["mensual", "anual"] as const).map(period => {
                    const selected = periodo === period;
                    return (
                      <TouchableOpacity key={period} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPeriodo(period)} style={{ minWidth: 62, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 12, alignItems: "center", backgroundColor: selected ? colors.accent : "transparent" }}>
                        <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 11, color: selected ? textoBoton : colors.muted }}>{t(`premium.${period}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {plan === "pro" && periodo === "anual" && (
              <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 8 }}>
                {t("premium.savingsAnnual", { ahorro: ahorroAnual })}
              </Text>
            )}
            <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 10, lineHeight: 14, color: colors.muted, marginTop: plan === "pro" && periodo === "anual" ? 3 : 8 }}>
              {t("premium.priceProposal")}
            </Text>
            {!sinAnuncios && (
              <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 10, lineHeight: 14, color: colors.muted, marginTop: 3 }}>{t("premium.noAdsCurrentNote")}</Text>
            )}

            {enPrueba ? (
              <View style={{ minHeight: 48, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.iconBackground }}>
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 13, color: colors.text }}>{t("premium.pruebaActiva", { horas: pruebaHoras })}</Text>
              </View>
            ) : isPremium ? (
              <View style={{ minHeight: 48, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: colors.iconBackground }}>
                <CheckCircle2 size={18} color={colors.accent} />
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 13, color: colors.text }}>{t(isTesterPremium ? "premium.testerActive" : "premium.alreadyPremium")}</Text>
              </View>
            ) : comprasDisponibles() && plan === "pro" ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => comprar(periodo)} disabled={comprando !== null} activeOpacity={0.85}
                style={{ minHeight: 50, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: colors.accent, opacity: comprando !== null ? 0.6 : 1 }}>
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 14, color: textoBoton }}>{comprando === periodo ? t("common.loading") : `${t("premium.elegirPlan")} ${t("premium.proName")}`}</Text>
                <ArrowRight size={19} color={textoBoton} />
              </TouchableOpacity>
            ) : !pruebaUsada ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => setPreguntandoPrueba(true)} activeOpacity={0.85}
                style={{ minHeight: 50, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: colors.accent }}>
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 14, color: textoBoton }}>{t("premium.probarGratis", { horas: DURACION_PRUEBA_HORAS })}</Text>
                <ArrowRight size={19} color={textoBoton} />
              </TouchableOpacity>
            ) : (
              <View style={{ minHeight: 48, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.soft }}>
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 13, color: colors.muted }}>{t("premium.llegaPronto")}</Text>
              </View>
            )}
          </View>

          {comprasDisponibles() && (
            <TouchableOpacity accessibilityRole="button" onPress={restaurar} style={{ alignSelf: "center", paddingHorizontal: 14, paddingVertical: 12, marginTop: 2 }}>
              <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 12, color: colors.accent }}>{t("premium.restaurar")}</Text>
            </TouchableOpacity>
          )}

          {(isPremium || enPrueba) && cuandoTermina !== "" && (
            <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 12, textAlign: "center", color: colors.muted, marginTop: 9 }}>{cuandoTermina}</Text>
          )}

          {preguntandoPrueba && (
            <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <TriangleAlert size={18} color={colors.iconDetail} />
                <Text style={{ flex: 1, fontFamily: ENTRY_FONT.bold, fontSize: 14, color: colors.text }}>{t("premium.pruebaTitulo")}</Text>
              </View>
              <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 7 }}>
                {t("premium.pruebaTexto", { horas: DURACION_PRUEBA_HORAS })}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity onPress={() => setPreguntandoPrueba(false)} style={{ flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.soft }}>
                  <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 12, color: colors.text }}>{t("nuevaCat.cancelar")}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmarPrueba} disabled={activandoPrueba} style={{ flex: 1, minHeight: 42, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.accent, opacity: activandoPrueba ? 0.6 : 1 }}>
                  <CheckCircle2 size={15} color={textoBoton} />
                  <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 12, color: textoBoton }}>{activandoPrueba ? t("common.loading") : t("premium.pruebaSi")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </View>
    </View>
  );
}
