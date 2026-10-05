import { httpsCallable } from "firebase/functions";
import { functions } from "@/utils/firebase";

type TrialResult = { activated: boolean; startedAt: number };

export async function activatePremiumTrialCloud(): Promise<TrialResult> {
  const result = await httpsCallable<{ hasLocalSetup: boolean }, TrialResult>(functions, "activatePremiumTrial")({ hasLocalSetup: true });
  const { activated, startedAt } = result.data;
  if (typeof activated !== "boolean" || !Number.isFinite(startedAt)) {
    throw new Error("premium-trial-invalid-response");
  }
  return { activated, startedAt };
}
