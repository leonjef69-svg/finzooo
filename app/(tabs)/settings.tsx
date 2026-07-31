import { router } from "expo-router";
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
  } = useAppData();
  return (
    <Settings
      userName={userName}
      userEmail={userEmail}
      userPhoto={userPhoto}
      onSaveProfile={updateProfileInfo}
      userCurrency={userCurrency}
      onCurrency={() => router.push("/currency")}
      userLanguage={userLanguage}
      onLanguage={() => router.push("/language")}
      onCountry={() => router.push("/country")}
      isPremium={isPremium}
      onCategoryBudgets={() => router.push("/category-budgets")}
      onExportPdf={() => router.push("/export-pdf")}
      onScheduledExport={() => router.push("/scheduled-export")}
      onImport={() => router.push("/import")}
      onAutoCapture={() => router.push("/auto-capture")}
      onLogout={async () => {
        await logout();
        router.replace("/login");
      }}
      onPremium={() => router.push("/premium")}
      onSavings={() => router.push("/savings")}
      onAppLock={() => router.push("/app-lock")}
      onChangePassword={() => router.push("/change-password")}
      onDeleteAccount={() => router.push("/delete-account")}
      onAbout={() => router.push("/about")}
      onLegal={() => router.push("/legal")}
    />
  );
}
