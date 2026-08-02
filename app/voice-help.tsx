import VoiceHelp from "@/screens/VoiceHelp";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function VoiceHelpRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <VoiceHelp onBack={safeBack} />;
}
