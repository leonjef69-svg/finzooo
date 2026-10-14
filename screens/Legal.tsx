import { Text, View } from "react-native";
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from "@/constants/legal";
import { useAppData } from "@/contexts/AppDataContext";
import LegalAcceptancePanel from "@/components/LegalAcceptancePanel";
import { ENTRY_COLORS, ENTRY_FONT, EntryHeading, EntryScreen, entryStyles } from "@/components/EntryUI";

export default function Legal({ onBack }: { onBack: () => void }) {
  const { t } = useAppData();
  return (
    <EntryScreen onBack={onBack}>
      <EntryHeading title={t("settings.legal")} />
      <Text style={[entryStyles.text, { fontFamily: ENTRY_FONT.bold, marginBottom: 10 }]}>{t("legal.privacyHeader")}</Text>
      <Text selectable style={entryStyles.text}>{PRIVACY_POLICY}</Text>
      <View style={{ height: 1, backgroundColor: ENTRY_COLORS.line, marginVertical: 25 }} />
      <Text style={[entryStyles.text, { fontFamily: ENTRY_FONT.bold, marginBottom: 10 }]}>{t("legal.termsHeader")}</Text>
      <Text selectable style={entryStyles.text}>{TERMS_AND_CONDITIONS}</Text>
      <View style={{ marginTop: 22 }}><LegalAcceptancePanel allowAccept /></View>
    </EntryScreen>
  );
}
