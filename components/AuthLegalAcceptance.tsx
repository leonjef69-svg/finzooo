import { Text, TouchableOpacity, View } from "react-native";
import { LEGAL_LAST_UPDATED } from "@/constants/legal";
import { irUnaVez } from "@/utils/nav";

/** Elección explícita antes de un acceso que pueda crear una cuenta, no un recibo legal. */
export default function AuthLegalAcceptance({ accepted, onChange, disabled, t }: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled: boolean;
  t: (key: string) => string;
}) {
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
        <View className={`w-6 h-6 rounded-md border-2 items-center justify-center ${accepted ? "bg-amber-700 border-amber-700" : "bg-white border-slate-500"}`}>
          {accepted ? <Text accessible={false} className="text-white font-bold">✓</Text> : null}
        </View>
        <Text className="flex-1 text-xs text-slate-700">{t("auth.legalAccept")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={t("register.legalLink")}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => irUnaVez("/legal")}
        className="justify-center py-2"
        style={{ minHeight: 44 }}
      >
        <Text className="text-xs font-bold text-amber-800 underline">{t("register.legalLink")}</Text>
        <Text className="text-xs text-slate-600">{LEGAL_LAST_UPDATED}</Text>
      </TouchableOpacity>
    </View>
  );
}
