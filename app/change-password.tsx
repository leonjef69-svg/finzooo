import ChangePassword from "@/screens/ChangePassword";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ChangePasswordRoute() {
  const { changePassword } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <ChangePassword onBack={safeBack} onSubmit={changePassword} />;
}
