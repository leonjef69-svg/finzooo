import { router, useLocalSearchParams } from "expo-router";
import SavingsDetail from "@/screens/SavingsDetail";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";
import { useEffect, useRef } from "react";
import { auth } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";

export default function SavingsDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, commitSavingsAction, isPremium, showToast, t } = useAppData();
  const deleting = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const goal = goals.find((g) => String(g.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <SavingsDetail
      goal={goal}
      onBack={safeBack}
      onEdit={() => irUnaVez(isPremium ? `/savings/form?id=${id}` : "/premium")}
      onDelete={async (goalId) => {
        if (!isPremium) return irUnaVez("/premium");
        if (deleting.current) return;
        const task = captureAccountTask(auth.currentUser?.uid ?? "", () => mounted.current);
        if (!task.current()) return;
        deleting.current = true;
        try { if (await task.wait(() => commitSavingsAction({ kind: "delete", goalId })) && task.current()) router.replace("/savings"); }
        catch { if (task.current()) showToast(t("toast.localSaveFailed")); }
        finally { deleting.current = false; }
      }}
      onAdd={() => irUnaVez(isPremium ? `/savings/move?id=${id}&mode=add` : "/premium")}
      onWithdraw={() => irUnaVez(isPremium ? `/savings/move?id=${id}&mode=use` : "/premium")}
    />
  );
}
