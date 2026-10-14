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
  const illustrationHeight = Math.max(180, Math.min(390, height * (height < 720 ? 0.34 : 0.44)));
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
      <EntryScreen center contentStyle={{ paddingTop: 0 }}>
        <View style={{ height: illustrationHeight, marginBottom: 16 }}>
          <View style={{ position: "absolute", width: 194, height: 182, backgroundColor: ENTRY_COLORS.soft, borderRadius: 90, alignSelf: "center", top: 35 }} />
          <Image source={require("../assets/images/onboarding/fino-welcome-person.webp")} resizeMode="contain" style={{ position: "absolute", height: "100%", width: Math.min(220, illustrationHeight * 0.78), alignSelf: "center", bottom: 0 }} />
          <View style={{ position: "absolute", left: 0, top: 30, transform: [{ rotate: "-5deg" }] }}><Feature icon={<BusFront size={16} color={ENTRY_COLORS.olive} />} title={t("entry.bus")} subtitle={`− ${fmt(2.5)}`} /></View>
          <View style={{ position: "absolute", right: 0, top: 13, transform: [{ rotate: "5deg" }] }}><Feature icon={<Utensils size={16} color={ENTRY_COLORS.olive} />} title={t("onboarding.food")} subtitle={`− ${fmt(18.5)}`} /></View>
          <View style={{ position: "absolute", left: 0, bottom: 38, transform: [{ rotate: "-3deg" }] }}><Feature wide icon={<ChartPie size={16} color={ENTRY_COLORS.olive} />} title={t("onboarding.budget")} subtitle={t("entry.thisMonth")} /></View>
          <View style={{ position: "absolute", right: 0, bottom: 13, transform: [{ rotate: "3deg" }] }}><Feature icon={<PiggyBank size={16} color={ENTRY_COLORS.olive} />} title={t("onboarding.savings")} subtitle={`+ ${fmt(20)}`} /></View>
        </View>
        <Text style={[entryStyles.title, { fontSize: width < 350 ? 28 : 31, lineHeight: width < 350 ? 32 : 35, textAlign: "center" }]}>{t("onboarding.tagline")}</Text>
        <Text style={[entryStyles.subtitle, { textAlign: "center", marginBottom: 12 }]}>{t("onboarding.subtitle")}</Text>
        <View style={{ paddingTop: 18 }}>
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

function Feature({ icon, title, subtitle, wide = false }: { icon: ReactNode; title: string; subtitle: string; wide?: boolean }) {
  return (
    <View style={{ width: wide ? 128 : 111, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: ENTRY_COLORS.line, borderRadius: 14, backgroundColor: ENTRY_COLORS.paper, padding: 8 }}>
      <View style={{ width: 25, height: 25, backgroundColor: ENTRY_COLORS.soft, borderRadius: 9, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.bold, fontSize: 11 }}>{title}</Text><Text numberOfLines={1} style={{ color: ENTRY_COLORS.muted, fontFamily: ENTRY_FONT.regular, fontSize: 11 }}>{subtitle}</Text></View>
    </View>
  );
}
