import { useAppData } from "@/contexts/AppDataContext";
import type { MiembroFamilia } from "@/utils/cloudFamilia";
import { UserMinus, UsersRound, X } from "lucide-react-native";
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Modal from "@/components/PrivateModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SpaceMembersSheet({
  familyName,
  members,
  visible,
  canManage = false,
  onRemove,
  onClose,
}: {
  familyName: string;
  members: MiembroFamilia[];
  visible: boolean;
  canManage?: boolean;
  onRemove?: (member: MiembroFamilia) => void;
  onClose: () => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const orderedMembers = [...members].sort((a, b) => {
    if (a.rol !== b.rol) return a.rol === "owner" ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          className="rounded-t-[28px] bg-white px-5 pt-3 dark:bg-noche"
          style={{ maxHeight: "72%", paddingBottom: Math.max(insets.bottom, 16) + 12 }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-slate-300 dark:bg-slate-600" />
          <View className="mb-3 flex-row items-center justify-between">
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t("family.members")}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm text-slate-500 dark:text-slate-300">
                {familyName}
              </Text>
            </View>
            <View className="mr-2 flex-row items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-950">
              <UsersRound size={15} color="#059669" />
              <Text className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                {members.length}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-2"
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {orderedMembers.length ? orderedMembers.map(member => (
              <View
                key={member.uid}
                className="mb-2 min-h-14 flex-row items-center rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <UsersRound size={17} color="#059669" />
                </View>
                <View className="ml-2.5 min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {member.nombre}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {member.rol === "owner" ? t("common.administrator") : t("family.member")}
                  </Text>
                </View>
                {canManage && member.rol !== "owner" && onRemove ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${t("family.removeMember")}: ${member.nombre}`}
                    onPress={() => onRemove(member)}
                    className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950"
                  >
                    <UserMinus size={17} color="#e11d48" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )) : (
              <Text className="py-5 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("family.noMembers")}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
