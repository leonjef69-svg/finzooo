import { auth } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";
import { familyMutationPending, familyMutationVersion } from "@/utils/familyMutation";
import { shareSpaceRead } from "@/utils/spaceRead";
import type { EspacioFamilia } from "@/utils/cloudFamilia";
import type { CajaCompartida } from "@/utils/cloudCajasCompartidas";

type Kind = "family" | "box";
type Catalog = { user: typeof auth.currentUser; session: number; revision: number; at: number;
  rows?: EspacioFamilia[] | CajaCompartida[]; pending?: Promise<unknown> };
const catalogs = new Map<Kind, Catalog>();
const MAX_AGE_MS = 30_000;

function current(kind: Kind, entry: Catalog): boolean {
  const age = Date.now() - entry.at;
  return age >= 0 && !!entry.user && auth.currentUser === entry.user && getAccountStorageSession() === entry.session
    && !familyMutationPending(entry.user.uid, entry.session, kind)
    && familyMutationVersion(entry.user.uid, entry.session, kind) === entry.revision;
}

/** Nombres para pintar antes; nunca acredita saldos, ausencias ni membresías. */
function peek(kind: Kind, uid: string) {
  const entry = catalogs.get(kind);
  if (!entry || entry.user?.uid !== uid || !current(kind, entry)) return undefined;
  return entry.rows;
}
export const peekFamilyCatalog = (uid: string) => peek("family", uid) as EspacioFamilia[] | undefined;
export const peekBoxCatalog = (uid: string) => peek("box", uid) as CajaCompartida[] | undefined;

/** Solo dos catálogos pequeños, una vez por ventana. Sin historiales ni escrituras. */
export function warmSpaceCatalogs(uid: string): void {
  const user = auth.currentUser, session = getAccountStorageSession();
  if (!uid || !user || user.uid !== uid || session === null) return;
  for (const kind of ["family", "box"] as const) {
    if (familyMutationPending(uid, session, kind)) continue;
    const previous = catalogs.get(kind);
    if (previous && current(kind, previous) && (previous.pending || (previous.rows && Date.now() - previous.at < MAX_AGE_MS))) continue;
    const revision = familyMutationVersion(uid, session, kind);
    const entry: Catalog = { user, session, revision, at: Date.now() };
    catalogs.set(kind, entry);
    const work = kind === "family"
      ? () => import("@/utils/cloudFamilia").then(m => m.listarFamilias(uid))
      : () => import("@/utils/cloudCajasCompartidas").then(m => m.listarCajasCompartidas(uid));
    entry.pending = shareSpaceRead<EspacioFamilia[] | CajaCompartida[]>({ uid, session, revision, key: `${kind}:list` }, work)
      .then(rows => { if (catalogs.get(kind) === entry && current(kind, entry)) { entry.rows = rows; entry.at = Date.now(); } })
      .catch(() => { if (catalogs.get(kind) === entry) catalogs.delete(kind); })
      .finally(() => { entry.pending = undefined; });
  }
}
