import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";
import { hasAcceptedLegalDocuments, recordLegalAcceptanceForCurrentAccount, subscribeLegalAcceptance } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";
import { irUnaVez } from "@/utils/nav";
import AuthLegalAcceptance from "@/components/AuthLegalAcceptance";

/** Aviso, no muro: leer/devolver dinero/borrar cuenta sigue disponible sin aceptar. */
export default function LegalAcceptancePanel({ allowAccept = false }: { allowAccept?: boolean }) {
  useAppData();
  const [authRevision, setAuthRevision] = useState(0);
  useEffect(() => onAuthStateChanged(auth, () => setAuthRevision(value => value + 1)), []);
  const uid = auth.currentUser?.uid ?? "", session = getAccountStorageSession();
  if (!uid || session === null) return null;
  return <LegalAcceptanceForAccount key={`${uid}:${session}:${authRevision}`} uid={uid} session={session} allowAccept={allowAccept} />;
}

function LegalAcceptanceForAccount({ uid, session, allowAccept }: { uid: string; session: number; allowAccept: boolean }) {
  const { t } = useAppData();
  const [status, setStatus] = useState<"checking" | "required" | "accepted" | "failed">("checking");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true), lock = useRef(false), epoch = useRef(0);
  const current = () => mounted.current && auth.currentUser?.uid === uid && getAccountStorageSession() === session;

  useEffect(() => {
    mounted.current = true;
    async function refresh() {
      const revision = ++epoch.current;
      try {
        const accepted = await withTimeout(hasAcceptedLegalDocuments(uid));
        if (current() && revision === epoch.current) setStatus(accepted ? "accepted" : "required");
      } catch { if (current() && revision === epoch.current) setStatus("failed"); }
    }
    void refresh();
    const stop = subscribeLegalAcceptance(changed => { if (changed === uid) void refresh(); });
    return () => { mounted.current = false; stop(); };
    // La clave del padre captura UID/generación; no mantener respuestas de A en B.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, session]);

  async function accept() {
    if (!checked || lock.current || !current()) return;
    lock.current = true; setBusy(true); ++epoch.current;
    try {
      await withTimeout(recordLegalAcceptanceForCurrentAccount());
      if (current()) setStatus("accepted");
    } catch { if (current()) setStatus("failed"); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }

  if (status === "accepted" && !allowAccept) return null;
  return (
    <View className="rounded-2xl bg-slate-50 dark:bg-noche-2 px-4 py-3 mb-3">
      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100" accessibilityLiveRegion="polite">
        {t(status === "accepted" ? "legal.acceptanceSaved" : "legal.sharedRequired")}
      </Text>
      {status === "checking" ? <ActivityIndicator accessibilityLabel={t("legal.checking")} color="#059669" /> : null}
      {status === "failed" ? <Text className="text-xs text-rose-700 dark:text-rose-300 mt-2" accessibilityLiveRegion="polite">{t("legal.saveFailed")}</Text> : null}
      {status !== "accepted" && allowAccept ? <>
        <AuthLegalAcceptance accepted={checked} onChange={setChecked} disabled={busy || status === "checking"} t={t} showLink={false} light={false} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("legal.acceptSave")} accessibilityState={{ disabled: !checked || busy || status === "checking", busy }}
          disabled={!checked || busy || status === "checking"} onPress={accept} className={`rounded-xl bg-emerald-700 py-3 items-center ${!checked || busy || status === "checking" ? "opacity-60" : ""}`}>
          {busy ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{t("legal.acceptSave")}</Text>}
        </TouchableOpacity>
      </> : null}
      {status !== "accepted" && !allowAccept ? <TouchableOpacity accessibilityRole="link" onPress={() => irUnaVez("/legal")} className="py-3">
        <Text className="text-sm font-bold text-emerald-800 dark:text-emerald-300 underline">{t("legal.readAccept")}</Text>
      </TouchableOpacity> : null}
    </View>
  );
}
