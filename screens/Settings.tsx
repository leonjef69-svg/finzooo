import { Platform, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, ChevronRight, Cloud, Crown, FileDown, FileUp, Lock, PiggyBank, PieChart, Coins, Globe2, KeyRound, LogOut, UserX, Info, Shield, Store, Zap, Mic, MessageSquare, Moon, Palette, Sun } from "lucide-react-native";
import * as voiceWidget from "@/modules/voice-widget";
import { useColorScheme } from "nativewind";
import { irUnaVez } from "@/utils/nav";
import { ENTRY_FONT } from "@/components/EntryUI";
import { SettingsRow as Row, SettingsSection, SettingsIcon, settingsColors } from "@/components/SettingsUI";
import { currencyLabelFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { currencyFlagFor, languageFlagFor } from "@/utils/decorativeFlags";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { useAppData } from "@/contexts/AppDataContext";
import { TELEGRAM_ENABLED } from "@/constants/features";
import { auth } from "@/utils/firebase";

export default function Settings({
  userEmail, userCurrency, onCurrency, userLanguage, onLanguage, isPremium,
  isTesterPremium, onCategoryBudgets, onExportPdf, onScheduledExport, onImport,
  onAutoCapture, onLogout, onPremium, onSavings, onAppLock, onChangePassword,
  onDeleteAccount, onAbout, onLegal, onVoiceHelp, onTelegram,
}: {
  userEmail: string; userCurrency: string; onCurrency: () => void;
  userLanguage: string; onLanguage: () => void; isPremium: boolean; isTesterPremium: boolean;
  onCategoryBudgets: () => void; onExportPdf: () => void; onScheduledExport: () => void;
  onImport: () => void; onAutoCapture: () => void; onLogout: () => void;
  onPremium: () => void; onSavings: () => void; onAppLock: () => void;
  onChangePassword: () => void; onDeleteAccount: () => void; onAbout: () => void;
  onLegal: () => void; onVoiceHelp: () => void; onTelegram: () => void;
}) {
  const { t, themeMode, updateThemeMode, visualStyle, updateVisualStyle, hasCloudAccount, cloudBackupEnabled, setCloudBackupEnabled, isPremium: premiumCloud, respaldoAlDia, respaldoFallo, autoCaptureOn, showToast, negocios, testerPremiumPendingVerification } = useAppData();
  const { colorScheme } = useColorScheme();
  const colors = settingsColors(visualStyle, colorScheme === "dark");
  const insets = useSafeAreaInsets();
  const negocioQueRecibe = negocios.find((n) => n.activo && n.destinoYapes === "negocio");
  const usaContrasena = auth.currentUser?.providerData.some(provider => provider.providerId === "password") ?? true;

  function addWidgetToHomeScreen(variant: voiceWidget.WidgetVariant) {
    const placed = voiceWidget.requestPin(variant);
    if (!placed) showToast(t("widget.manualHint"));
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 + insets.bottom }}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <Text accessibilityRole="header" style={{ fontFamily: ENTRY_FONT.bold, fontSize: 26, color: colors.text, marginHorizontal: 20, marginTop: 12, marginBottom: 12 }}>{t("settings.title")}</Text>

        <TouchableOpacity onPress={onPremium} accessibilityRole="button"
          accessibilityLabel={t("settings.proEntryTitle")} activeOpacity={0.85}
          style={{ marginHorizontal: 16, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.proBorder }}>
          <LinearGradient colors={colors.proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16, paddingVertical: 16, minHeight: 88 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.proIconBackground, alignItems: "center", justifyContent: "center" }}>
              <Crown size={30} strokeWidth={2.2} color={colors.proText} fill={colors.proFill} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 21, lineHeight: 27, color: colors.proText }}>
                {isTesterPremium ? t("settings.testerPremiumActive") : isPremium ? t("settings.premiumActive") : t("settings.proEntryTitle")}
              </Text>
              <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 14, lineHeight: 20, color: colors.proText, marginTop: 2 }}>{t("settings.proEntryHint")}</Text>
            </View>
            <ChevronRight size={23} color={colors.proText} />
          </LinearGradient>
        </TouchableOpacity>
        {testerPremiumPendingVerification ? <Text className="mx-5 mt-2 text-sm text-amber-700 dark:text-amber-300">{t("settings.testerPremiumNeedsConnection")}</Text> : null}

        <SettingsSection title={t("settings.sectionPersonalize")}>
          <Row Icon={Globe2} label={t("settings.language")} hint={languageLabelFor(userLanguage)} onPress={onLanguage}
            right={<Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 22 }}>{languageFlagFor(userLanguage)}</Text>} />
          <Row Icon={Coins} label={t("settings.currency")} hint={currencyLabelFor(userCurrency, t, userLanguage)} onPress={onCurrency}
            right={<Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 22 }}>{currencyFlagFor(userCurrency)}</Text>} />
          <Row Icon={themeMode === "dark" ? Moon : Sun} label={t("setup.appearance")}
            onPress={() => updateThemeMode(themeMode === "dark" ? "light" : "dark")}
            right={<View style={{ flexDirection: "row", gap: 4 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("setup.lightAppearance")} accessibilityState={{ selected: themeMode === "light" }} onPress={() => updateThemeMode("light")}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: themeMode === "light" ? colors.iconBackground : colors.soft, alignItems: "center", justifyContent: "center" }}><Sun size={22} color={themeMode === "light" ? colors.accent : colors.muted} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("setup.darkAppearance")} accessibilityState={{ selected: themeMode === "dark" }} onPress={() => updateThemeMode("dark")}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: themeMode === "dark" ? colors.iconBackground : colors.soft, alignItems: "center", justifyContent: "center" }}><Moon size={22} color={themeMode === "dark" ? colors.accent : colors.muted} /></TouchableOpacity>
            </View>} />
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <SettingsIcon Icon={Palette} />
              <Text style={{ flex: 1, fontFamily: ENTRY_FONT.bold, fontSize: 16, color: colors.text }}>{t("settings.visualStyle")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {(["classic", "peachOlive"] as const).map(style => <TouchableOpacity key={style} accessibilityRole="button"
                accessibilityLabel={t(style === "classic" ? "settings.visualClassic" : "settings.visualPeachOlive")}
                accessibilityState={{ selected: visualStyle === style }} onPress={() => updateVisualStyle(style)}
                style={{ flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: visualStyle === style ? colors.accent : colors.border, backgroundColor: visualStyle === style ? colors.iconBackground : colors.soft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 13, textAlign: "center", color: visualStyle === style ? colors.accent : colors.muted }}>{t(style === "classic" ? "settings.visualClassic" : "settings.visualPeachOlive")}</Text>
              </TouchableOpacity>)}
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title={t("settings.sectionFinances")}>
          <Row Icon={PieChart} label={t("categoryBudgets.rowLabel")} onPress={onCategoryBudgets} />
          <Row Icon={PiggyBank} label={t("settings.savingsGoals")} onPress={onSavings} premium />
          <Row Icon={CalendarClock} label={t("calendario.titulo")} onPress={() => irUnaVez("/calendario")} />
          <Row Icon={Store} label={t("negocios.rowLabel")}
            hint={negocioQueRecibe ? isPremium ? t("negocios.rowYapes", { nombre: negocioQueRecibe.nombre }) : t("negocios.rowYapesPausados") : undefined}
            onPress={() => irUnaVez(negocios.length === 1 ? `/negocio/${negocios[0].id}` : "/negocio")} premium />
        </SettingsSection>

        <SettingsSection title={t("settings.sectionData")}>
          <Row Icon={FileDown} label={t("exportPdf.exportDataTitle")} onPress={onExportPdf} premium />
          <Row Icon={FileUp} label={t("importSheet.rowLabel")} onPress={onImport} premium />
          <Row Icon={CalendarClock} label={t("schedExport.settingsRow")} onPress={onScheduledExport} premium />
        </SettingsSection>

        {hasCloudAccount ? <SettingsSection title={t("settings.sectionCloud")}>
          {premiumCloud ? <>
            <View style={{ flexDirection: "row", alignItems: "center", minHeight: 68, paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
              <SettingsIcon Icon={Cloud} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 16, lineHeight: 22, color: colors.text }}>{t("settings.backupSwitch")}</Text>
                <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>
                  {t(cloudBackupEnabled ? respaldoFallo === "pendiente" ? "settings.backupSaving" : respaldoFallo === "demora" ? "settings.backupWaiting" : respaldoAlDia ? "settings.backupDescription" : "settings.backupFailed" : "settings.backupPausedHint")}
                </Text>
              </View>
              <View accessible accessibilityLabel={t("settings.paidBadge")}
                style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.soft }}>
                <Crown size={18} strokeWidth={2.1} color={colors.accent} fill={colors.proFill} />
              </View>
              <Switch
                accessibilityLabel={t("settings.backupSwitch")}
                value={cloudBackupEnabled}
                onValueChange={(enabled) => { void setCloudBackupEnabled(enabled).catch(error => showToast(error instanceof Error ? error.message : t("toast.localSaveFailed"))); }}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#ffffff"
              />
            </View>
            {cloudBackupEnabled && !respaldoAlDia && respaldoFallo && respaldoFallo !== "pendiente" && respaldoFallo !== "demora" ? <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 13, lineHeight: 19, color: colorScheme === "dark" ? "#fcd34d" : "#92400e" }}>
              {t(
                respaldoFallo === "permisos"
                  ? auth.currentUser?.emailVerified === false ? "settings.backupNoPermission" : "settings.backupPermissionDenied"
                  : respaldoFallo === "sin-internet" ? "settings.backupNoInternet"
                    : respaldoFallo === "demasiado-grande" ? "settings.backupTooLarge"
                      : respaldoFallo === "datos-nube-invalidos" ? "settings.backupInvalid"
                        : respaldoFallo === "monedas-distintas" ? "settings.backupCurrencyConflict"
                          : respaldoFallo === "movimientos-en-conflicto" ? "settings.backupMovementConflict"
                            : respaldoFallo === "actualizacion-necesaria" ? "settings.backupUpdateRequired"
                              : respaldoFallo === "revision-caja-pendiente" ? "settings.backupBoxReview"
                                : "settings.backupFailedHint"
              )}
            </Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={t("settings.backupRetry")} onPress={() => { void setCloudBackupEnabled(true).catch(error => showToast(error instanceof Error ? error.message : t("toast.localSaveFailed"))); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ fontFamily: ENTRY_FONT.bold, color: colors.accent }}>{t("settings.backupRetry")}</Text></TouchableOpacity></View> : null}
          </> : <Row Icon={Cloud} label={t("settings.backupProTitle")} hint={t("settings.backupProHint")} onPress={onPremium} premium />}
        </SettingsSection> : null}

        <SettingsSection title={t("settings.sectionRecording")}>
          {Platform.OS === "android" && hayRegistroAutomatico(userCurrency) && (
            <Row Icon={Zap} label={t("autoCapture.rowLabel")} onPress={() => (isPremium ? onAutoCapture() : onPremium())} premium
              right={autoCaptureOn ? <Text style={{ fontFamily: ENTRY_FONT.medium, fontSize: 12, color: colors.accent }}>{t("autoCapture.rowOn")}</Text> : undefined} />
          )}
          {/* PRO: se conserva la protección y no se coloca un widget bloqueado. */}
          {Platform.OS === "android" && voiceWidget.isSupported && (
            <Row Icon={Mic} label={t("widget.rowLabel")} onPress={() => (isPremium ? addWidgetToHomeScreen("round") : onPremium())} premium />
          )}
          <Row Icon={MessageSquare} label={t("voiceHelp.rowLabel")} onPress={onVoiceHelp} premium />
          {/* PRO de Telegram permanece en pausa; no se activa con el rediseño. */}
          {TELEGRAM_ENABLED ? <Row Icon={MessageSquare} label={t("telegram.rowLabel")} onPress={() => (isPremium ? onTelegram() : onPremium())} premium /> : null}
        </SettingsSection>

        <SettingsSection title={t("settings.sectionSecurityAccount")}>
          {userEmail ? <Text selectable style={{ fontFamily: ENTRY_FONT.regular, fontSize: 13, lineHeight: 19, color: colors.muted, paddingHorizontal: 16, paddingVertical: 12 }}>{userEmail}</Text> : null}
          <Row Icon={Lock} label={t("lock.rowLabel")} onPress={onAppLock} premium />
          {usaContrasena ? <Row Icon={KeyRound} label={t("settings.changePassword")} onPress={onChangePassword} /> : null}
          <Row Icon={LogOut} label={t("settings.logout")} onPress={onLogout} />
          <Row Icon={UserX} label={t("settings.deleteAccount")} onPress={onDeleteAccount} danger />
        </SettingsSection>

        <SettingsSection title={t("settings.sectionInfo")}>
          <Row Icon={Info} label={t("settings.appInfo")} onPress={onAbout} />
          <Row Icon={Shield} label={t("settings.legal")} onPress={onLegal} />
        </SettingsSection>
      </View>
    </ScrollView>
  );
}
