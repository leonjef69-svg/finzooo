import { router } from "expo-router";
import DeleteAccount from "@/screens/DeleteAccount";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function DeleteAccountRoute() {
  const { deleteAccount } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return (
    <DeleteAccount
      onBack={safeBack}
      onConfirm={async (password) => {
        await deleteAccount(password);
        router.replace("/login");
      }}
    />
  );
}
