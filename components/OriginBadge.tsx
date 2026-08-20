import { Text, View } from "react-native";
import { PenLine, Download, BadgeCheck, GitMerge, Zap } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { originOf, type Transaction } from "@/types";

// Insignia que dice de dónde salió un movimiento:
//   🟡 Manual · 🔵 Importado · 🟢 Verificado · 🟢 Fusionado
// Los movimientos escritos a mano (la mayoría) son "manual"; no le
// ponemos insignia a esos para no llenar la pantalla de etiquetas — solo
// se muestra cuando hubo importación de por medio.
const STYLES = {
  manual: { Icon: PenLine, color: "#f59e0b", bg: "bg-amber-50 dark:bg-noche-2", text: "text-amber-600 dark:text-amber-400", key: "origin.manual" },
  imported: { Icon: Download, color: "#0ea5e9", bg: "bg-sky-50 dark:bg-noche-2", text: "text-sky-600 dark:text-sky-400", key: "origin.imported" },
  verified: { Icon: BadgeCheck, color: "#059669", bg: "bg-emerald-50 dark:bg-noche-2", text: "text-emerald-600 dark:text-emerald-400", key: "origin.verified" },
  merged: { Icon: GitMerge, color: "#059669", bg: "bg-emerald-50 dark:bg-noche-2", text: "text-emerald-600 dark:text-emerald-400", key: "origin.merged" },
  auto: { Icon: Zap, color: "#8b5cf6", bg: "bg-violet-50 dark:bg-noche-2", text: "text-violet-600 dark:text-violet-400", key: "origin.auto" },
} as const;

export default function OriginBadge({
  transaction,
  hideManual = false,
}: {
  transaction: Transaction;
  hideManual?: boolean;
}) {
  const { t } = useAppData();
  const origin = originOf(transaction);
  if (origin === "manual" && hideManual) return null;

  const s = STYLES[origin];
  return (
    <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${s.bg}`}>
      <s.Icon size={12} color={s.color} />
      <Text className={`text-[11px] font-bold ${s.text}`}>{t(s.key)}</Text>
    </View>
  );
}
