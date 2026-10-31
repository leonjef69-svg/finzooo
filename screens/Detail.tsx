import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRightLeft, Tag, Calendar, Wallet2, StickyNote, Trash2, Pencil } from "lucide-react-native";
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
import MissingItem from "@/components/MissingItem";
import { personalTransferStatuses } from "@/utils/linkedTransfers";
import { returnedTransferHistoryIds, removableLegacyReturnIds } from "@/utils/personalHistory";

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
  const { fmt, t, monthNames, transactions, deletedTransactionIds } = useAppData();
  const [confirm, setConfirm] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f4f0e8" : "#0f172a";
  if (!transaction) return <MissingItem onBack={onBack} />;
  const c = catInfo(transaction.category);
  const linkedCreditPayment = transaction.method === "credit-card-payment";
  const managedTransfer = Boolean(transaction.internalTransfer);
  const returnedCompletely = managedTransfer && returnedTransferHistoryIds(transactions, transaction.id).length > 0;
  const legacyReturn = managedTransfer && removableLegacyReturnIds(transactions, deletedTransactionIds).has(transaction.id);
  const transferStatus = managedTransfer
    ? transaction.type === "income" ? returnedCompletely || legacyReturn ? "returned" : "partial" : personalTransferStatuses(transactions).get(transaction.id) || "pending"
    : null;
  const transferSpace = transaction.internalTransferSpaceName || t(transaction.internalTransfer === "family" ? "spaces.family" : "spaces.boxes");
  const transferDirection = transaction.type === "expense"
    ? t("transfer.personalToSpace", { name: transferSpace })
    : t("transfer.spaceToPersonal", { name: transferSpace });

  const rows = [
    { Icon: managedTransfer ? ArrowRightLeft : Tag, label: managedTransfer ? t("transfer.internal") : t("detail.category"), value: managedTransfer ? transferDirection : t(c.label) },
    { Icon: Calendar, label: t("detail.date"), value: fmtDate(transaction.date, monthNames) },
    { Icon: Wallet2, label: t("detail.method"), value: methodLabel(transaction.method, t) },
    { Icon: StickyNote, label: t("detail.notes"), value: transaction.notes || t("detail.noNotes") },
  ];

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold" style={{ color: primaryTextColor }}>{t("detail.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
      <View className="px-6 items-center pt-4 pb-6">
        <IconBadge Icon={managedTransfer ? ArrowRightLeft : c.icon} color={managedTransfer ? "#2563eb" : c.color} size={64} image={managedTransfer ? undefined : c.image} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.62}
          className={`text-3xl font-extrabold mt-4 ${managedTransfer ? "text-blue-600 dark:text-blue-300" : transaction.type === "expense" ? "text-rose-500 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}
        >
          {managedTransfer ? (transaction.type === "expense" ? "→ " : "↩ ") : transaction.type === "expense" ? "-" : "+"}
          {fmt(transaction.amount)}
        </Text>
        <Text className="text-slate-500 dark:text-slate-300 text-sm mt-1">{managedTransfer ? transferDirection : transaction.description || t(c.label)}</Text>
        {managedTransfer ? <Text className="mt-2 text-sm font-bold text-blue-600 dark:text-blue-300">{t(`transfer.${transferStatus}`)} · {t("transfer.notIncomeExpense")}</Text> : null}
        <View className="mt-3">
          <OriginBadge transaction={transaction} hideManual />
        </View>
      </View>

      <View className="px-6 gap-3">
        {rows.map(({ Icon, label, value }) => (
          <View key={label} className="flex-row items-center gap-3 bg-slate-50 dark:bg-noche-2 rounded-2xl p-3.5">
            <View className="w-9 h-9 rounded-xl bg-white dark:bg-noche-2 items-center justify-center border-[1.5px] border-slate-200 dark:border-noche-borde">
              <Icon size={16} color="#64748b" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold">{label}</Text>
              <Text className="text-sm font-bold" style={{ color: primaryTextColor }}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
      </ScrollView>

      {managedTransfer ? (
        <View className="mt-auto mx-6 mb-8 rounded-2xl bg-teal-50 px-4 py-3 dark:bg-teal-950">
          <Text className="text-center text-sm font-semibold text-teal-700 dark:text-teal-200">
            {t(legacyReturn ? "history.deleteLegacyReturnBody" : returnedCompletely ? "history.removeTransferBody" : "history.returnBeforeRemove", { amount: fmt(transaction.amount) })}
          </Text>
          {(returnedCompletely || legacyReturn) && <TouchableOpacity onPress={() => setConfirm(true)} accessibilityRole="button" className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-white py-3 dark:bg-noche-2"><Trash2 size={16} color="#f43f5e" /><Text className="text-sm font-bold text-rose-500 dark:text-rose-300">{t(legacyReturn ? "history.deleteLegacyReturn" : "history.removeRecord")}</Text></TouchableOpacity>}
        </View>
      ) : <View className="mt-auto px-6 pb-8 pt-4 flex-row gap-3">
        <TouchableOpacity
          onPress={() => setConfirm(true)}
          className="flex-1 py-3.5 rounded-2xl bg-rose-50 flex-row items-center justify-center gap-2"
        >
          <Trash2 size={16} color="#f43f5e" />
          <Text className="font-bold text-rose-500 dark:text-rose-300">{t("common.delete")}</Text>
        </TouchableOpacity>
        {!linkedCreditPayment && (
          <TouchableOpacity
            onPress={onEdit}
            className="flex-1 py-3.5 rounded-2xl bg-slate-900 flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.edit")}
          >
            <Pencil size={16} color="#ffffff" />
            <Text className="font-bold text-white">{t("common.edit")}</Text>
          </TouchableOpacity>
        )}
      </View>}

      <ConfirmDialog
        visible={confirm}
        title={t(legacyReturn ? "history.deleteLegacyReturn" : managedTransfer ? "history.removeTitle" : "detail.confirmDeleteTitle")}
        message={t(legacyReturn ? "history.deleteLegacyReturnBody" : managedTransfer ? "history.removeTransferBody" : "common.cannotUndo", { amount: fmt(transaction.amount) })}
        confirmLabel={t(legacyReturn ? "common.delete" : managedTransfer ? "history.removeRecord" : "common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirm(false)}
        onConfirm={() => onDelete(transaction.id)}
      />
    </View>
  );
}
