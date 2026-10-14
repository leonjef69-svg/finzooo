import { useCallback, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BusFront, ChartPie, PiggyBank, Utensils } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import AuthLegalAcceptance from "@/components/AuthLegalAcceptance";
import { useEntryOperation, type EntryOperationGuard } from "@/utils/entryOperation";
import { ENTRY_COLORS, ENTRY_FONT, EntryButton, EntryLink, EntryPanel, EntryScreen, entryStyles } from "@/components/EntryUI";
import GoogleButton from "@/components/GoogleButton";

type Props = { onGoogle: (current?: EntryOperationGuard, accepted?: boolean) => Promise<void>; onCreateAccount: () => void | boolean; onLogin: () => void | boolean };

export default function Onboarding({ onGoogle, onCreateAccount, onLogin }: Props) {
  const { fmt, t } = useAppData();
  const { height, width } = useWindowDimensions();
  const illustrationHeight = Math.max(180, Math.min(430, height * (height < 720 ? 0.34 : 0.47)));
  const contentWidth = Math.min(width, 460) - 46;
  const cardWidth = Math.min(132, (contentWidth - 44) / 2);
  const budgetCardWidth = Math.min(160, (contentWidth - 44) / 2);
  const personWidth = Math.min(262, illustrationHeight * 0.87, contentWidth * 0.72);
  // Mantener el tamaño visible anterior (427 × 640), sin compartir su espacio
  // con las tarjetas. El flujo normal también separa filas con letra grande.
  const personHeight = Math.min(illustrationHeight, personWidth * 640 / 427);
  const fittedPersonWidth = personHeight * 427 / 640;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [googleLegalPending, setGoogleLegalPending] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const authBusy = useRef(false);
  const navigationBusy = useRef(false);
  const beginEntryOperation = useEntryOperation(() => {
    authBusy.current = false;
    setGoogleLoading(false);
  });
  useFocusEffect(useCallback(() => {
    navigationBusy.current = false;
    setNavigating(false);
  }, []));

  function navigate(action: () => void | boolean) {
    if (authBusy.current || navigationBusy.current) return;
    navigationBusy.current = true;
    setNavigating(true);
    try {
      // Un viaje descartado no cambia de pantalla y no recibirá otro enfoque
      // que quite este bloqueo. Mantener los botones utilizables para reintentar.
      if (action() === false) {
        navigationBusy.current = false;
        setNavigating(false);
      }
    } catch (error) {
      navigationBusy.current = false;
      setNavigating(false);
      throw error;
    }
  }

  async function continueWithGoogle() {
    if (authBusy.current || navigationBusy.current) return;
    if (googleLegalPending && !legalAccepted) { setGoogleError(t("auth.legalRequired")); return; }
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setGoogleError("");
    setGoogleLoading(true);
    try { await onGoogle(operationCurrent, legalAccepted); }
    catch (error) {
      if (!operationCurrent()) return;
      if (error instanceof Error && error.name === "GoogleLegalAcceptanceRequired") setGoogleLegalPending(true);
      else setGoogleError(error instanceof Error ? error.message : t("login.googleError"));
    }
    finally { if (operationCurrent()) { authBusy.current = false; setGoogleLoading(false); } }
  }

  return (
    <View style={{ flex: 1 }}>
      <EntryScreen contentStyle={{ paddingTop: 0 }}>
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 6 }}>
            <View style={{ transform: [{ rotate: "-5deg" }] }}><Feature width={cardWidth} icon={<BusFront size={24} color={ENTRY_COLORS.olive} />} title={t("entry.bus")} subtitle={`− ${fmt(2.5)}`} /></View>
            <View style={{ transform: [{ rotate: "5deg" }] }}><Feature width={cardWidth} icon={<Utensils size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.food")} subtitle={`− ${fmt(18.5)}`} /></View>
          </View>
          <View style={{ height: personHeight, alignItems: "center" }}>
            <View style={{ position: "absolute", width: Math.min(238, contentWidth * 0.76), height: Math.min(230, personHeight), backgroundColor: ENTRY_COLORS.soft, borderRadius: 120, top: Math.max(0, (personHeight - 230) / 2) }} />
            <Image source={require("../assets/images/onboarding/fino-welcome-person.webp")} resizeMode="contain" style={{ height: personHeight, width: fittedPersonWidth }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 6 }}>
            <View style={{ transform: [{ rotate: "-3deg" }] }}><Feature width={budgetCardWidth} icon={<ChartPie size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.budget")} subtitle={t("entry.thisMonth")} /></View>
            <View style={{ transform: [{ rotate: "3deg" }] }}><Feature width={cardWidth} icon={<PiggyBank size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.savings")} subtitle={`+ ${fmt(20)}`} /></View>
          </View>
        </View>
        <Text style={[entryStyles.title, { fontSize: width < 350 ? 28 : 31, lineHeight: width < 350 ? 32 : 35, textAlign: "center" }]}>{t("onboarding.tagline")}</Text>
        <Text style={[entryStyles.subtitle, { fontSize: 16, lineHeight: 24, textAlign: "center", marginBottom: 8 }]}>{t("onboarding.subtitle")}</Text>
        <View style={{ paddingTop: 14 }}>
        <EntryButton label={t("onboarding.createAccount")} onPress={() => navigate(onCreateAccount)} disabled={googleLoading || navigating} />
        {Platform.OS === "android" ? <GoogleButton label={t("onboarding.continueGoogle")} onPress={continueWithGoogle} loading={googleLoading} disabled={navigating} warm light /> : null}
        <EntryLink label={t("onboarding.haveAccount")} onPress={() => navigate(onLogin)} disabled={googleLoading || navigating} />
        {googleError ? <Text accessibilityRole="alert" style={entryStyles.error}>{googleError}</Text> : null}
        </View>
      </EntryScreen>
      {googleLegalPending ? <View style={StyleSheet.absoluteFill}><EntryPanel title={t("entry.beforeStarting")} closeLabel={t("common.close")} onBack={() => { if (!googleLoading) setGoogleLegalPending(false); }}>
        <Text style={[entryStyles.subtitle, { marginBottom: 12 }]}>{t("auth.legalRequiredForAccount")}</Text>
        <AuthLegalAcceptance accepted={legalAccepted} onChange={setLegalAccepted} disabled={googleLoading || navigating} t={t} warm />
        <EntryButton label={t("auth.acceptAndContinue")} onPress={continueWithGoogle} loading={googleLoading} disabled={!legalAccepted || navigating} />
      </EntryPanel></View> : null}
    </View>
  );
}

function Feature({ icon, title, subtitle, width }: { icon: ReactNode; title: string; subtitle: string; width: number }) {
  return (
    <View style={{ width, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: ENTRY_COLORS.line, borderRadius: 15, backgroundColor: ENTRY_COLORS.paper, padding: 9 }}>
      <View style={{ width: 34, height: 34, flexShrink: 0, backgroundColor: ENTRY_COLORS.soft, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flexShrink: 1 }}><Text numberOfLines={2} style={{ color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.bold, fontSize: 15 }}>{title}</Text><Text numberOfLines={2} style={{ color: ENTRY_COLORS.muted, fontFamily: ENTRY_FONT.regular, fontSize: 14 }}>{subtitle}</Text></View>
    </View>
  );
}
