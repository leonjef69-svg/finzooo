import { Text, TouchableOpacity, View } from "react-native";
import { LEGAL_LAST_UPDATED } from "@/constants/legal";
import { irUnaVez } from "@/utils/nav";
import { ENTRY_FONT, useEntryTheme } from "@/components/EntryUI";

/** Elección explícita antes de un acceso que pueda crear una cuenta, no un recibo legal. */
export default function AuthLegalAcceptance({ accepted, onChange, disabled, t, showLink = true, light = true, warm = false }: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled: boolean;
  t: (key: string) => string;
  showLink?: boolean;
  light?: boolean;
  warm?: boolean;
}) {
  const { colors: ENTRY_COLORS } = useEntryTheme();
  return (
    <View className="mb-3">
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityLabel={t("auth.legalAccept")}
        accessibilityState={{ checked: accepted, disabled }}
        disabled={disabled}
        onPress={() => onChange(!accepted)}
        activeOpacity={0.8}
        className="flex-row items-center gap-2 py-2"
        style={{ minHeight: 48 }}
      >
        <View style={warm ? { backgroundColor: accepted ? ENTRY_COLORS.olive : ENTRY_COLORS.paper, borderColor: accepted ? ENTRY_COLORS.olive : ENTRY_COLORS.muted } : undefined} className={`w-6 h-6 rounded-md border-2 items-center justify-center ${accepted ? "bg-amber-700 border-amber-700" : "bg-white border-slate-500 dark:bg-noche-3"}`}>
          {accepted ? <Text accessible={false} className="text-white font-bold">✓</Text> : null}
        </View>
        <Text style={warm ? { fontFamily: ENTRY_FONT.regular, color: ENTRY_COLORS.muted, fontSize: 12 } : undefined} className={`flex-1 text-xs text-slate-700 $ dark:text-slate-100{light ? "" : "dark:text-slate-200"}`}>{t("auth.legalAccept")}</Text>
      </TouchableOpacity>
      {showLink ? <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={t("register.legalLink")}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => irUnaVez("/legal")}
        className="justify-center py-2"
        style={{ minHeight: 44 }}
      >
        <Text style={warm ? { fontFamily: ENTRY_FONT.bold, color: ENTRY_COLORS.olive } : undefined} className="text-xs font-bold text-amber-800 underline">{t("register.legalLink")}</Text>
        <Text className="text-xs text-slate-600 dark:text-slate-300">{LEGAL_LAST_UPDATED}</Text>
      </TouchableOpacity> : null}
    </View>
  );
}
