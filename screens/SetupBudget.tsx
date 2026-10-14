import { useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ENTRY_COLORS, ENTRY_FONT, EntryButton, EntryHeading, EntryScreen, entryStyles } from "@/components/EntryUI";
import { Bell, ChevronRight, Globe2, WalletCards } from "lucide-react-native";
import { currencySymbolFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { currencyFlagFor, languageFlagFor } from "@/utils/decorativeFlags";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { amountInputError, parseAmountInput, sanitizeSafeAmountInput } from "@/utils/amount";
import { irUnaVez } from "@/utils/nav";
import { useSetupNotifications } from "@/utils/setupNotifications";

export default function SetupBudget({ onSaved }: { onSaved: (amount: number) => void | Promise<void> }) {
  const { userCurrency, userLanguage, t, monthNames } = useAppData();
  const [amount, setAmount] = useState("");
  const { notificationsEnabled, notificationBusy, notificationErrorKey, enableNotifications } = useSetupNotifications(auth.currentUser?.uid ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveBusy = useRef(false);
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const parsed = parseAmountInput(amount, userCurrency);
  const amountError = amountInputError(amount, userCurrency);
  const disabled = (!!amount && parsed <= 0) || !!amountError || saving || notificationBusy || !auth.currentUser;

  async function saveSetup() {
    if (saveBusy.current || disabled) return;
    saveBusy.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await onSaved(amount ? parsed : 0);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("setup.saveFailed"));
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  return (
    <EntryScreen center>
      <EntryHeading title={t("setup.configureTitle")} subtitle={t("setup.subtitle")} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("settings.language")} disabled={saving} onPress={() => { if (!saveBusy.current) irUnaVez("/language"); }} style={[entryStyles.card, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }]}>
        <Globe2 size={20} color={ENTRY_COLORS.olive} /><Text style={[entryStyles.text, { flex: 1 }]}>{t("settings.language")}</Text>
        <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{languageFlagFor(userLanguage)}</Text>
        <Text style={[entryStyles.muted, { maxWidth: "38%" }]}>{languageLabelFor(userLanguage)}</Text><ChevronRight size={17} color={ENTRY_COLORS.muted} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("settings.currency")} disabled={saving} onPress={() => { if (!saveBusy.current) irUnaVez("/currency"); }} style={[entryStyles.card, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }]}>
        <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{currencyFlagFor(userCurrency)}</Text><Text style={[entryStyles.text, { flex: 1 }]}>{t("settings.currency")}</Text>
        <Text style={entryStyles.muted}>{currencySymbolFor(userCurrency)} · {userCurrency}</Text><ChevronRight size={17} color={ENTRY_COLORS.muted} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("settings.notifications")} disabled={saving || notificationBusy} onPress={() => { if (!saveBusy.current) void enableNotifications(); }} style={[entryStyles.card, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }]}>
        <Bell size={20} color={ENTRY_COLORS.olive} /><Text style={[entryStyles.text, { flex: 1 }]}>{t("settings.notifications")}</Text>
        <Text style={entryStyles.muted}>{t(notificationsEnabled ? "setup.notificationsOn" : "setup.notificationsOff")}</Text><ChevronRight size={17} color={ENTRY_COLORS.muted} />
      </TouchableOpacity>
      {notificationErrorKey ? <Text accessibilityRole="alert" style={entryStyles.error}>{t(notificationErrorKey)}</Text> : null}
      <View style={[entryStyles.card, { marginTop: 6, marginBottom: 10 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><WalletCards size={20} color={ENTRY_COLORS.olive} /><Text style={[entryStyles.text, { flex: 1, fontFamily: ENTRY_FONT.bold }]}>{t("setup.monthlyBudget")}</Text><Text style={entryStyles.muted}>{t("entry.optional")}</Text></View>
        <Text style={[entryStyles.muted, { marginTop: 4 }]}>{monthLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: ENTRY_COLORS.line, marginTop: 5 }}>
          <Text style={entryStyles.text}>{currencySymbolFor(userCurrency)}</Text>
          <TextInput disableFullscreenUI keyboardType="decimal-pad" accessibilityLabel={t("setup.monthlyBudget")} value={amount} editable={!saving}
            onChangeText={(v) => {
              const safe = sanitizeSafeAmountInput(v, userCurrency);
              const [whole = "", decimals] = safe.split(".");
              const normalized = whole.replace(/^0+(?=\d)/, "");
              setAmount(decimals === undefined ? normalized : `${normalized || "0"}.${decimals}`);
            }}
            placeholder="0.00" placeholderTextColor={ENTRY_COLORS.muted}
            style={{ flex: 1, minWidth: 0, paddingVertical: 10, color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.bold, fontSize: 23 }} />
        </View>
        <Text style={[entryStyles.muted, { marginTop: 8 }]}>{t("entry.budgetLater")}</Text>
      </View>
      {amountError ? <Text accessibilityRole="alert" style={entryStyles.error}>{t(amountError === "tooLarge" ? "toast.amountTooLarge" : "toast.amountDecimals")}</Text> : null}
      {saveError ? <Text accessibilityRole="alert" style={entryStyles.error}>{saveError}</Text> : null}
      <View style={{ marginTop: 16 }}><EntryButton label={t("setup.start")} onPress={saveSetup} disabled={disabled} loading={saving} /></View>
    </EntryScreen>
  );
}
