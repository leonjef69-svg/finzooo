import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tag, Calendar, Wallet2, StickyNote, Trash2, Pencil } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import IconBadge from "@/components/IconBadge";
import OriginBadge from "@/components/OriginBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { catInfo } from "@/constants/categories";
import { methodLabel } from "@/constants/i18n";
import { fmtDate } from "@/utils/format";
import { useAppData } from "@/contexts/AppDataContext";
import type { Transaction } from "@/types";
import BackButton from "@/components/BackButton";
import FotoDelMovimiento from "@/components/FotoDelMovimiento";

export default function Detail({
  transaction,
  onBack,
  onEdit,
  onDelete,
}: {
  transaction: Transaction | undefined;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: number) => void;
}) {
  const { fmt, t, monthNames, addOrUpdateTransaction } = useAppData();
  const [confirm, setConfirm] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  if (!transaction) return null;
  const c = catInfo(transaction.category);

  const rows = [
    { Icon: Tag, label: t("detail.category"), value: t(c.label) },
    { Icon: Calendar, label: t("detail.date"), value: fmtDate(transaction.date, monthNames) },
    { Icon: Wallet2, label: t("detail.method"), value: methodLabel(transaction.method, t) },
    { Icon: StickyNote, label: t("detail.notes"), value: transaction.notes || t("detail.noNotes") },
  ];

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold" style={{ color: primaryTextColor }}>{t("detail.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 8 }}>
      <View className="px-6 items-center pt-4 pb-6">
        <IconBadge Icon={c.icon} color={c.color} size={64} image={c.image} />
        <Text
          className={`text-3xl font-extrabold mt-4 ${
            transaction.type === "expense" ? "text-rose-500" : "text-emerald-600"
          }`}
        >
          {transaction.type === "expense" ? "-" : "+"}
          {fmt(transaction.amount)}
        </Text>
        <Text className="text-slate-500 dark:text-slate-300 text-sm mt-1">{transaction.description || t(c.label)}</Text>
        <View className="mt-3">
          <OriginBadge transaction={transaction} hideManual />
        </View>
      </View>

      <View className="px-6 gap-3">
        {rows.map(({ Icon, label, value }) => (
          <View key={label} className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5">
            <View className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 items-center justify-center border-[1.5px] border-slate-200 dark:border-slate-700">
              <Icon size={16} color="#64748b" />
            </View>
            <View>
              <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold">{label}</Text>
              <Text className="text-sm font-bold" style={{ color: primaryTextColor }}>{value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* LA FOTO DE LA BOLETA (12/08/2026). Se puede cambiar por otra o quitarla desde aqui:
          la foto se toma con prisa al pagar y sale movida mas veces de las que uno querria.
          Cambiarla guarda el movimiento al instante — no hay boton de guardar en esta
          pantalla, y pedir uno solo para esto seria un paso de mas. */}
      <View className="px-6 mt-4">
        <FotoDelMovimiento
          ruta={transaction.photo}
          onChange={(ruta) => addOrUpdateTransaction({ ...transaction, photo: ruta })}
        />
      </View>
      </ScrollView>

      <View className="px-6 pb-8 pt-4 flex-row gap-3">
        <TouchableOpacity
          onPress={() => setConfirm(true)}
          className="flex-1 py-3.5 rounded-2xl bg-rose-50 flex-row items-center justify-center gap-2"
        >
          <Trash2 size={16} color="#f43f5e" />
          <Text className="font-bold text-rose-500">{t("common.delete")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onEdit}
          className="flex-1 py-3.5 rounded-2xl bg-slate-900 flex-row items-center justify-center gap-2"
        >
          <Pencil size={16} color="#ffffff" />
          <Text className="font-bold text-white">{t("common.edit")}</Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={confirm}
        title={t("detail.confirmDeleteTitle")}
        message={t("common.cannotUndo")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirm(false)}
        onConfirm={() => onDelete(transaction.id)}
      />
    </View>
  );
}
