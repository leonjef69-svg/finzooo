import { useEffect, useSyncExternalStore, type SetStateAction } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";
import { loadHomeVisibility, readHomeVisibility, subscribeHomeVisibility, updateHomeVisibility } from "@/utils/homeVisibility";

export function useHomeVisibility(enabled: boolean) {
  const { showToast, t } = useAppData();
  const uid = auth.currentUser?.uid, session = getAccountStorageSession();
  const snapshot = useSyncExternalStore(subscribeHomeVisibility, readHomeVisibility, readHomeVisibility);
  useEffect(() => { if (enabled) void loadHomeVisibility().catch(() => undefined); }, [enabled, uid, session]);
  function report(result: Promise<boolean>) {
    void result.then(ok => {
      if (!ok && auth.currentUser?.uid === uid && getAccountStorageSession() === session) showToast(t("localAccount.saveFailed"));
    });
  }
  function setHideBalance(next: SetStateAction<boolean>) {
    if (auth.currentUser?.uid !== uid || getAccountStorageSession() !== session) return;
    report(updateHomeVisibility(previous => ({ ...previous, hideAmounts: typeof next === "function" ? next(previous.hideAmounts) : next })));
  }
  function setCollapsedPreviousBalanceMonths(next: SetStateAction<string[]>) {
    if (auth.currentUser?.uid !== uid || getAccountStorageSession() !== session) return;
    report(updateHomeVisibility(previous => ({ ...previous,
      collapsedPreviousBalanceMonths: typeof next === "function" ? next(previous.collapsedPreviousBalanceMonths) : next })));
  }
  return { visibilityReady: snapshot.ready, hideBalance: !snapshot.ready || snapshot.hideAmounts, setHideBalance,
    collapsedPreviousBalanceMonths: snapshot.collapsedPreviousBalanceMonths, setCollapsedPreviousBalanceMonths };
}
