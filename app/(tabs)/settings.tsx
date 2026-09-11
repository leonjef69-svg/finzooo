import { router } from "expo-router";
import { irUnaVez } from "@/utils/nav";
import Settings from "@/screens/Settings";
import { useAppData } from "@/contexts/AppDataContext";

export default function SettingsTab() {
  const {
    userName,
    userEmail,
    userPhoto,
    updateProfileInfo,
    userCurrency,
    userLanguage,
    isPremium,
    logout,
    showToast,
  } = useAppData();
  return (
    <Settings
      userName={userName}
      userEmail={userEmail}
      userPhoto={userPhoto}
      onSaveProfile={updateProfileInfo}
      userCurrency={userCurrency}
      onCurrency={() => irUnaVez("/currency")}
      userLanguage={userLanguage}
      onLanguage={() => irUnaVez("/language")}
      onCountry={() => irUnaVez("/country")}
      isPremium={isPremium}
      onCategoryBudgets={() => irUnaVez("/category-budgets")}
      onCategoryStyle={() => irUnaVez("/category-style")}
      onExportPdf={() => irUnaVez("/export-pdf")}
      onScheduledExport={() => irUnaVez("/scheduled-export")}
      onImport={() => irUnaVez("/import")}
      onAutoCapture={() => irUnaVez("/auto-capture")}
      onLogout={async () => {
        try {
          await logout();
          router.replace("/login");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "No se pudo cerrar sesión. Vuelve a intentarlo.");
        }
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
