import { router } from "expo-router";
import AddChooser from "@/screens/AddChooser";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ChooseTransactionTypeRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return (
    <AddChooser
      onClose={safeBack}
      onPick={(type) => router.replace(`/transaction/new?type=${type}`)}
    />
  );
}
