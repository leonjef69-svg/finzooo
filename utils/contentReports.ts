import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";

export type ReportTarget = { kind: "family" | "box"; spaceId: string;
  targetType: "movement" | "member" | "space"; targetId: string; expectedText: string; expectedUid: string };
export type ContentReportInput = ReportTarget & { id: string;
  reason: "abuse" | "harassment" | "inappropriate" | "other"; details: string;
  processingAccepted: true; policyVersion: "2026-10-08" };

/** Confirmar guardado NO confirma recepción del correo por el operador. */
export async function submitContentReport(input: ContentReportInput): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !auth.currentUser?.emailVerified) throw new Error("report-auth");
  const task = captureAccountTask(uid);
  const response = await task.wait(() => httpsCallable<ContentReportInput,
    { id: string; saved: boolean; emailConfirmed: boolean }>(functions, "submitContentReport", { timeout: 30_000 })(input));
  if (!response.data || response.data.id !== input.id || response.data.saved !== true || response.data.emailConfirmed !== false) {
    throw new Error("report-response-invalid");
  }
}
