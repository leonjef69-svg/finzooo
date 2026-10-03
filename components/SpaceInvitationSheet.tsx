import { Copy, X } from "lucide-react-native";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";

export default function SpaceInvitationSheet({
  code,
  visible,
  onClose,
}: {
  code: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  async function copyCode() {
    try {
      const clipboard = await import("expo-clipboard");
      await clipboard.setStringAsync(code);
      showToast(t("family.codeCopied"));
    } catch {
      showToast(t("family.codeCopyFailed"));
    }
  }

  return (
    <Modal
      visible={visible && Boolean(code)}
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
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-slate-300 dark:bg-slate-600" />
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t("boxes.invitationCode")}
              </Text>
              <Text className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {t("family.codeExpires")}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("family.hideCode")}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-2"
            >
              <X size={19} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View className="my-2 items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950/40">
            <Text selectable className="text-3xl font-black tracking-[5px] text-emerald-700 dark:text-emerald-300">
              {code}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("family.copyCode")}
            onPress={() => void copyCode()}
            className="mt-2 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600"
          >
            <Copy size={17} color="#ffffff" />
            <Text className="font-extrabold text-white">{t("family.copyCode")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
