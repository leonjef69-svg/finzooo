import type { User } from "firebase/auth";
import LocalAccountDiagnostic from "@/screens/LocalAccountDiagnostic";
import { auth } from "@/utils/firebase";
import { isLocalAccountDiagnosticMode } from "@/utils/localAccountDiagnosticMode";
import { isLocalAccountRecoveryEnabled } from "@/utils/localAccountRecoveryPermission";
import { LocalAccountVaultError, prepareLocalAccount } from "@/utils/localAccountVault";

async function recoverAccount(user: User): Promise<void> {
  if (!isLocalAccountDiagnosticMode() || !isLocalAccountRecoveryEnabled() || auth.currentUser !== user) {
    throw new LocalAccountVaultError("owner", "session");
  }
  // Se escribe únicamente el identificador confirmado; no se reemplaza
  // el perfil, no se abre la nube ni se modifica ningún bloque financiero.
  await prepareLocalAccount(user.uid, user.email, { recoverUnidentifiedLegacyFor: user });
}

export default function LocalAccountRecovery() {
  return <LocalAccountDiagnostic recoverAccount={recoverAccount} />;
}
