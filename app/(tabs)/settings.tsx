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
      onTheme={() => router.push("/theme")}
      isPremium={isPremium}
      onCategoryBudgets={() => router.push("/category-budgets")}
      onExportPdf={() => router.push("/export-pdf")}
      onImport={() => router.push("/import")}
      onAutoCapture={() => router.push("/auto-capture")}
      onLogout={async () => {
        await logout();
        router.replace("/login");
      }}
      onPremium={() => router.push("/premium")}
      onSavings={() => router.push("/savings")}
      onChangePassword={() => router.push("/change-password")}
      onDeleteAccount={() => router.push("/delete-account")}
      onAbout={() => router.push("/about")}
      onLegal={() => router.push("/legal")}
    />
  );
}
