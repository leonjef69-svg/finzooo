import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react-native";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { randomUUID } from "expo-crypto";
import Modal from "@/components/PrivateModal";
import { useAppData } from "@/contexts/AppDataContext";
import { submitContentReport, type ContentReportInput, type ReportTarget } from "@/utils/contentReports";

const reasons = ["abuse", "harassment", "inappropriate", "other"] as const;
export default function ContentReportButton({ target }: { target: ReportTarget }) {
  const { t, showToast } = useAppData();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ContentReportInput["reason"]>("abuse");
  const [details, setDetails] = useState("");
  const lock = useRef(false), mounted = useRef(true), attempt = useRef<ContentReportInput | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const close = () => { if (!lock.current) setOpen(false); };
  async function send() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    // Una respuesta perdida reintenta el MISMO cuerpo/ID. Cerrar y volver
    // a abrir esta ficha tampoco descarta una denuncia incierta.
    try {
      const payload: ContentReportInput = attempt.current ?? { ...target, id: randomUUID(), reason, details, processingAccepted: true, policyVersion: "2026-10-08" };
      attempt.current = payload;
      await submitContentReport(payload);
      if (!mounted.current) return;
      attempt.current = null; setOpen(false); setDetails("");
      showToast(t("report.saved"));
    } catch (error) {
      if (!mounted.current) return;
      const code = (error as { details?: { reason?: string } })?.details?.reason;
      if (code && ["report-invalid", "report-limit", "report-unavailable", "report-permission", "report-account-closing", "report-source-changed"].includes(code)) attempt.current = null;
      if (code === "report-source-changed") { setOpen(false); setDetails(""); setReason("abuse"); }
      showToast(t(code === "report-limit" ? "report.limit" : code === "report-unavailable" ? "report.unavailable"
        : code === "report-source-changed" ? "report.changed" : "report.failed"));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t("report.title")}: ${target.expectedText || t("report.emptyText")}`} onPress={() => setOpen(true)} hitSlop={6} className="h-10 w-10 items-center justify-center">
      <Flag size={17} color="#64748b" />
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t("common.close")} className="absolute inset-0" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="justify-end">
        <ScrollView className="max-h-[80%] rounded-t-[28px] bg-white px-5 py-4 dark:bg-noche" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900 dark:text-white">{t("report.title")}</Text>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel={t("common.close")} disabled={busy} className="h-10 w-10 items-center justify-center"><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <Text className="my-3 text-sm text-slate-600 dark:text-slate-300">{t("report.notice")}</Text>
          <Text className="mb-2 rounded-lg bg-slate-100 p-2 text-sm text-slate-700 dark:bg-noche-2 dark:text-slate-200">{(attempt.current?.expectedText ?? target.expectedText) || t("report.emptyText")}</Text>
          {reasons.map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: reason === value, disabled: busy || !!attempt.current }} disabled={busy || !!attempt.current} onPress={() => setReason(value)} className="min-h-11 justify-center rounded-xl px-3">
            <Text className={reason === value ? "font-bold text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}>{t(`report.reason.${value}`)}</Text>
          </TouchableOpacity>)}
          <TextInput disableFullscreenUI accessibilityLabel={t("report.details")} value={details} onChangeText={setDetails} editable={!busy && !attempt.current} maxLength={500} multiline placeholder={t("report.details")} className="my-3 min-h-20 rounded-xl border border-slate-200 p-3 text-slate-900 dark:text-white" />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(attempt.current ? "report.retry" : "report.send")} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void send()} className="mb-6 min-h-12 items-center justify-center rounded-xl bg-emerald-600">
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-bold text-white">{t(attempt.current ? "report.retry" : "report.send")}</Text>}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </>;
}
