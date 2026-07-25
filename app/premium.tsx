import Premium from "@/screens/Premium";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function PremiumRoute() {
  const { isPremium, setIsPremium, showToast } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return (
    <Premium
      onBack={safeBack}
      isPremium={isPremium}
      onUpgrade={() => {
        setIsPremium(true);
        showToast("¡Ahora eres Premium!");
        safeBack();
      }}
    />
  );
}
