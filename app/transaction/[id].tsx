import { useLocalSearchParams } from "expo-router";
import Detail from "@/screens/Detail";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";
import { useEffect, useRef } from "react";
import { auth } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";

export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction, showToast, t } = useAppData();
  const deleting = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const transaction = transactions.find((t) => String(t.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <Detail
      transaction={transaction}
      onBack={safeBack}
      onEdit={() => irUnaVez(`/transaction/${id}/edit`)}
      onDelete={async (txId) => {
        if (deleting.current) return;
        const task = captureAccountTask(auth.currentUser?.uid ?? "", () => mounted.current);
        if (!task.current()) return;
        deleting.current = true;
        try { if (await task.wait(() => deleteTransaction(txId)) && task.current()) safeBack(); }
        catch { if (task.current()) showToast(t("toast.localSaveFailed")); }
        finally { deleting.current = false; }
      }}
    />
  );
}
