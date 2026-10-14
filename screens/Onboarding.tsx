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
  // Mantener el tamaño visible aprobado (427 × 640).
  const personHeight = Math.min(illustrationHeight, personWidth * 640 / 427);
  const fittedPersonWidth = personHeight * 427 / 640;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [googleLegalPending, setGoogleLegalPending] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [cardHeights, setCardHeights] = useState([64, 64, 64, 64]);
  function recordCardHeight(index: number, height: number) {
    if (!Number.isFinite(height)) return;
    const measured = Math.max(64, Math.ceil(height));
    setCardHeights(previous => previous[index] === measured ? previous : previous.map((value, i) => i === index ? measured : value));
  }
  const rotationPad = (cardWidth: number, cardHeight: number, degrees: number) => {
    const radians = degrees * Math.PI / 180;
    return (cardWidth * Math.sin(radians) + cardHeight * Math.cos(radians) - cardHeight) / 2;
  };
  const pads = [rotationPad(cardWidth, cardHeights[0], 5), rotationPad(cardWidth, cardHeights[1], 5),
    rotationPad(budgetCardWidth, cardHeights[2], 3), rotationPad(cardWidth, cardHeights[3], 3)];
  // El WebP tiene aire transparente sobre la cabeza y bajo los zapatos.
  // Reservar 10 puntos junto al contorno visible (filas 69..577 de 640),
  // incluyendo inclinación y altura real del texto, sin separar toda la imagen.
  const pictureTop = Math.max(0, Math.max(8 + cardHeights[0] + pads[0], cardHeights[1] + pads[1]) + 10 - personHeight * 69 / 640);
  const shoesBottom = pictureTop + personHeight * 577 / 640;
  const budgetTop = shoesBottom + 10 + pads[2];
  const savingsTop = shoesBottom + 18 + pads[3];
  const sceneHeight = Math.max(pictureTop + personHeight, budgetTop + cardHeights[2] + pads[2], savingsTop + cardHeights[3] + pads[3]) + 6;
  const circleSize = Math.min(272, contentWidth * 0.84, personHeight * 0.8);
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
        <View style={{ height: sceneHeight, marginBottom: 10 }}>
          <View testID="welcome-circle" style={{ position: "absolute", width: circleSize, height: circleSize, backgroundColor: ENTRY_COLORS.soft, borderRadius: circleSize / 2, alignSelf: "center", top: pictureTop + (personHeight - circleSize) / 2 }} />
          <Image source={require("../assets/images/onboarding/fino-welcome-person.webp")} resizeMode="contain" style={{ position: "absolute", height: personHeight, width: fittedPersonWidth, alignSelf: "center", top: pictureTop }} />
          <View style={{ position: "absolute", left: 14, top: 8, transform: [{ rotate: "-5deg" }] }}><Feature onHeight={height => recordCardHeight(0, height)} width={cardWidth} icon={<BusFront size={24} color={ENTRY_COLORS.olive} />} title={t("entry.bus")} subtitle={`− ${fmt(2.5)}`} /></View>
          <View style={{ position: "absolute", right: 14, top: 0, transform: [{ rotate: "5deg" }] }}><Feature onHeight={height => recordCardHeight(1, height)} width={cardWidth} icon={<Utensils size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.food")} subtitle={`− ${fmt(18.5)}`} /></View>
          <View style={{ position: "absolute", left: 14, top: budgetTop, transform: [{ rotate: "-3deg" }] }}><Feature onHeight={height => recordCardHeight(2, height)} width={budgetCardWidth} icon={<ChartPie size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.budget")} subtitle={t("entry.thisMonth")} /></View>
          <View style={{ position: "absolute", right: 14, top: savingsTop, transform: [{ rotate: "3deg" }] }}><Feature onHeight={height => recordCardHeight(3, height)} width={cardWidth} icon={<PiggyBank size={24} color={ENTRY_COLORS.olive} />} title={t("onboarding.savings")} subtitle={`+ ${fmt(20)}`} /></View>
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

function Feature({ icon, title, subtitle, width, onHeight }: { icon: ReactNode; title: string; subtitle: string; width: number; onHeight?: (height: number) => void }) {
  return (
    <View onLayout={event => onHeight?.(event.nativeEvent.layout.height)} style={{ width, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: ENTRY_COLORS.line, borderRadius: 15, backgroundColor: ENTRY_COLORS.paper, padding: 9 }}>
      <View style={{ width: 34, height: 34, flexShrink: 0, backgroundColor: ENTRY_COLORS.soft, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flexShrink: 1 }}><Text numberOfLines={2} style={{ color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.bold, fontSize: 15 }}>{title}</Text><Text numberOfLines={2} style={{ color: ENTRY_COLORS.muted, fontFamily: ENTRY_FONT.regular, fontSize: 14 }}>{subtitle}</Text></View>
    </View>
  );
}
