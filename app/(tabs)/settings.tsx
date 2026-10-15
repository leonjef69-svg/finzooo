import { router } from "expo-router";
import { useRef } from "react";
import { Alert } from "react-native";
import { irUnaVez } from "@/utils/nav";
import Settings from "@/screens/Settings";
import { useAppData } from "@/contexts/AppDataContext";

export default function SettingsTab() {
  const cerrandoSesion = useRef(false);
  const {
    userEmail,
    userCurrency,
    userLanguage,
    isPremium,
    cloudBackupEnabled,
    isTesterPremium,
    logout,
    showToast,
    t,
  } = useAppData();

  async function cerrarSesion(skipBackup = false) {
    if (cerrandoSesion.current) return;
    cerrandoSesion.current = true;
    try {
      await logout(skipBackup ? { skipBackup: true } : undefined);
      router.replace("/login");
    } catch (error) {
      cerrandoSesion.current = false;
      if (!skipBackup && error instanceof Error && error.name === "BackupBeforeLogoutError") {
        Alert.alert(t("settings.logoutBackupFailedTitle"), t("settings.logoutBackupFailedBody"), [
          { text: t("settings.logoutKeepData"), style: "cancel" },
          { text: t("settings.logoutWithoutBackup"), style: "destructive", onPress: confirmacionFinal },
        ]);
        return;
      }
      showToast(error instanceof Error ? error.message : t("settings.logoutError"));
    }
  }

  function confirmacionFinal() {
    Alert.alert(t("settings.logoutFinalTitle"), t("settings.logoutFinalBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.logoutWithoutBackup"), style: "destructive", onPress: () => void cerrarSesion(true) },
    ]);
  }

  return (
    <Settings
      userEmail={userEmail}
      userCurrency={userCurrency}
      onCurrency={() => irUnaVez("/currency")}
      userLanguage={userLanguage}
      onLanguage={() => irUnaVez("/language")}
      isPremium={isPremium}
      isTesterPremium={isTesterPremium}
      onCategoryBudgets={() => irUnaVez("/category-budgets")}
      onExportPdf={() => irUnaVez("/export-pdf")}
      onScheduledExport={() => irUnaVez("/scheduled-export")}
      onImport={() => irUnaVez("/import")}
      onAutoCapture={() => irUnaVez("/auto-capture")}
      onLogout={() => {
        if (cerrandoSesion.current) return;
        Alert.alert(
          t("settings.logout"),
          t(isPremium
            ? cloudBackupEnabled ? "settings.logoutConfirmBody" : "settings.logoutConfirmBodyCloudPaused"
            : "settings.logoutConfirmBodyFree"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("settings.logout"),
              style: "destructive",
              onPress: () => void cerrarSesion(),
            },
          ],
        );
      }}
      onPremium={() => irUnaVez("/premium")}
      onSavings={() => irUnaVez("/savings")}
      onAppLock={() => irUnaVez("/app-lock")}
      onChangePassword={() => irUnaVez("/change-password")}
      onDeleteAccount={() => irUnaVez("/delete-account")}
      onAbout={() => irUnaVez("/about")}
      onVoiceHelp={() => irUnaVez("/voice-help")}
      onTelegram={() => irUnaVez("/telegram" as never)}
      onLegal={() => irUnaVez("/legal")}
    />
  );
}
