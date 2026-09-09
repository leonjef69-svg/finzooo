import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "@/utils/firebase";
import { crearCodigoFamilia } from "@/utils/familia";
import { isSafeMoneyAmount } from "@/utils/amount";

export type EspacioFamilia = {
  id: string;
  nombre: string;
  ownerUid: string;
  creadoEn: number;
};

export type MiembroFamilia = {
  uid: string;
  nombre: string;
  rol: "owner" | "member";
};

export type MovimientoFamilia = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  descripcion: string;
  method?: string;
  fecha: string;
  creadoEn: number;
  creadoPor: string;
  /** Débito enlazado en Personal; solo pertenece al dueño que hizo el aporte. */
  personalTransactionId?: number;
  personalOwnerUid?: string;
  personalReturnAmount?: number;
};

const alNumero = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return Date.now();
};

export async function cargarFamiliaActiva(uid: string): Promise<EspacioFamilia | null> {
  const indice = await getDoc(doc(db, "familyUsers", uid));
  const familyId = indice.exists() ? String(indice.data().activeFamilyId || "") : "";
  if (!familyId) return null;
  const espacio = await getDoc(doc(db, "familySpaces", familyId));
  if (!espacio.exists()) return null;
  const data = espacio.data();
  if (data.closed === true) return null;
  return { id: espacio.id, nombre: String(data.nombre || "Familia"), ownerUid: String(data.ownerUid), creadoEn: alNumero(data.creadoEn) };
}

export async function crearFamilia(uid: string, nombrePersona: string, nombreFamilia: string): Promise<EspacioFamilia> {
  const ref = doc(collection(db, "familySpaces"));
  const nombre = nombreFamilia.trim().slice(0, 35);
  if (!nombre) throw new Error("invalid-input");
  await runTransaction(db, async transaction => {
    transaction.set(ref, { nombre, ownerUid: uid, creadoEn: serverTimestamp() });
    transaction.set(doc(db, "familySpaces", ref.id, "members", uid), { uid, nombre: nombrePersona.trim().slice(0, 60), rol: "owner", unidoEn: serverTimestamp() });
    transaction.set(doc(db, "familyUsers", uid), { activeFamilyId: ref.id }, { merge: true });
  });
  return { id: ref.id, nombre, ownerUid: uid, creadoEn: Date.now() };
}

export async function crearInvitacionFamilia(uid: string, familiaId: string): Promise<string> {
  const codigo = crearCodigoFamilia();
  await setDoc(doc(db, "familyInvites", codigo), {
    familyId: familiaId,
    createdBy: uid,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    creadoEn: serverTimestamp(),
  });
  return codigo;
}

export async function renombrarFamilia(familiaId: string, nombre: string): Promise<void> {
  await updateDoc(doc(db, "familySpaces", familiaId), { nombre: nombre.trim().slice(0, 35) });
}

export async function cerrarFamilia(uid: string, familiaId: string): Promise<void> {
  const ref = doc(db, "familySpaces", familiaId);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists() || snap.data().ownerUid !== uid) throw new Error("not-owner");
    transaction.update(ref, { closing: true });
  });
  try {
    const movimientos = await listarMovimientosFamilia(familiaId);
    const saldo = movimientos.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
    if (Math.abs(saldo) > 0.000001) throw new Error("balance-not-zero");
    const miembros = await getDocs(collection(db, "familySpaces", familiaId, "members"));
    if (miembros.size > 450) throw new Error("too-many-members");
    await runTransaction(db, async transaction => {
      const [snap, ...indices] = await Promise.all([
        transaction.get(ref),
        ...miembros.docs.map(member => transaction.get(doc(db, "familyUsers", member.id))),
      ]);
      if (!snap.exists() || snap.data().ownerUid !== uid || snap.data().closing !== true) throw new Error("not-owner");
      transaction.update(ref, { closed: true, closing: false });
      miembros.docs.forEach((member, index) => {
        if (!indices[index]?.exists() || String(indices[index].data().activeFamilyId || "") !== familiaId) return;
        transaction.set(doc(db, "familyUsers", member.id), {
          activeFamilyId: "",
          closedFamilyIds: arrayUnion(familiaId),
        }, { merge: true });
      });
    });
  } catch (error) {
    await updateDoc(ref, { closing: false }).catch(() => {});
    throw error;
  }
}

export function observarCierreFamilia(familiaId: string, cerrado: () => void, error: () => void) {
  return onSnapshot(doc(db, "familySpaces", familiaId), snap => {
    if (!snap.exists() || snap.data().closed === true) cerrado();
  }, error);
}

export async function unirseAFamilia(uid: string, nombre: string, codigoCrudo: string): Promise<EspacioFamilia> {
  const codigo = codigoCrudo.trim().toUpperCase();
  const inviteRef = doc(db, "familyInvites", codigo);
  const invite = await getDoc(inviteRef);
  if (!invite.exists()) throw new Error("invalid-code");
  const data = invite.data();
  if (Number(data.expiresAt || 0) < Date.now()) throw new Error("expired-code");
  const familyId = String(data.familyId || "");
  const familyRef = doc(db, "familySpaces", familyId);
  const indexRef = doc(db, "familyUsers", uid);
  let resultado: EspacioFamilia | null = null;
  await runTransaction(db, async transaction => {
    const [family, index] = await Promise.all([transaction.get(familyRef), transaction.get(indexRef)]);
    if (!family.exists() || family.data().closed === true || family.data().closing === true) throw new Error("invalid-code");
    const activeFamilyId = index.exists() ? String(index.data().activeFamilyId || "") : "";
    if (activeFamilyId && activeFamilyId !== familyId) throw new Error("already-in-family");
    const familyData = family.data();
    resultado = { id: family.id, nombre: String(familyData.nombre || "Familia"), ownerUid: String(familyData.ownerUid), creadoEn: alNumero(familyData.creadoEn) };
    transaction.set(doc(db, "familySpaces", familyId, "members", uid), {
      uid,
      nombre: nombre.trim().slice(0, 60),
      rol: "member",
      inviteCode: codigo,
      unidoEn: serverTimestamp(),
    });
    transaction.set(indexRef, { activeFamilyId: familyId }, { merge: true });
  });
  if (!resultado) throw new Error("invalid-code");
  return resultado;
}

export async function listarMiembrosFamilia(familyId: string): Promise<MiembroFamilia[]> {
  const snap = await getDocs(collection(db, "familySpaces", familyId, "members"));
  return snap.docs.map((item) => ({ uid: item.id, nombre: String(item.data().nombre || "Miembro"), rol: item.data().rol === "owner" ? "owner" : "member" }));
}

export async function listarMovimientosFamilia(familyId: string): Promise<MovimientoFamilia[]> {
  const snap = await getDocs(query(collection(db, "familySpaces", familyId, "movements"), orderBy("creadoEn", "desc")));
  return snap.docs.map((item) => {
    const data = item.data();
    return { id: item.id, tipo: data.tipo === "ingreso" ? "ingreso" : "gasto", monto: Number(data.monto || 0), descripcion: String(data.descripcion || ""), method: typeof data.method === "string" ? data.method : undefined, fecha: String(data.fecha || ""), creadoEn: alNumero(data.creadoEn), creadoPor: String(data.creadoPor || ""), personalTransactionId: typeof data.personalTransactionId === "number" ? data.personalTransactionId : undefined, personalOwnerUid: typeof data.personalOwnerUid === "string" ? data.personalOwnerUid : undefined, personalReturnAmount: typeof data.personalReturnAmount === "number" ? data.personalReturnAmount : undefined };
  });
}

export async function guardarMovimientoFamilia(familyId: string, uid: string, movimiento: Omit<MovimientoFamilia, "id" | "creadoEn" | "creadoPor">): Promise<void> {
  if (!isSafeMoneyAmount(movimiento.monto) || movimiento.monto <= 0) throw new Error("invalid-amount");
  await addDoc(collection(db, "familySpaces", familyId, "movements"), { ...movimiento, creadoPor: uid, creadoEn: serverTimestamp() });
}

export async function borrarMovimientoFamilia(familyId: string, movementId: string): Promise<void> {
  await deleteDoc(doc(db, "familySpaces", familyId, "movements", movementId));
}

export async function salirDeFamilia(uid: string, familyId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    transaction.delete(doc(db, "familySpaces", familyId, "members", uid));
    transaction.set(doc(db, "familyUsers", uid), { activeFamilyId: "" }, { merge: true });
  });
}

export async function quitarMiembroFamilia(familyId: string, memberUid: string): Promise<void> {
  const indexRef = doc(db, "familyUsers", memberUid);
  await runTransaction(db, async transaction => {
    const index = await transaction.get(indexRef);
    transaction.delete(doc(db, "familySpaces", familyId, "members", memberUid));
    if (index.exists() && String(index.data().activeFamilyId || "") === familyId) {
      transaction.set(indexRef, { activeFamilyId: "" }, { merge: true });
    }
  });
}

export async function borrarVinculoFamiliaDeCuenta(uid: string): Promise<void> {
  const indexRef = doc(db, "familyUsers", uid);
  const index = await getDoc(indexRef);
  const data = index.exists() ? index.data() : {};
  const ids = new Set<string>([
    String(data.activeFamilyId || ""),
    ...(Array.isArray(data.closedFamilyIds) ? data.closedFamilyIds.map(String) : []),
  ].filter(Boolean));
  for (const familyId of ids) {
    const familyRef = doc(db, "familySpaces", familyId);
    const family = await getDoc(familyRef);
    if (!family.exists()) continue;
    if (family.data().ownerUid !== uid) {
      const propios = await getDocs(query(collection(db, "familySpaces", familyId, "movements"), where("creadoPor", "==", uid)));
      for (let inicio = 0; inicio < propios.docs.length; inicio += 400) {
        const lote = writeBatch(db);
        for (const item of propios.docs.slice(inicio, inicio + 400)) {
          lote.update(item.ref, {
            creadoPor: "deleted",
            ...(item.data().personalOwnerUid === uid ? { personalOwnerUid: "deleted" } : {}),
          });
        }
        await lote.commit();
      }
      await deleteDoc(doc(db, "familySpaces", familyId, "members", uid));
      continue;
    }
    await updateDoc(familyRef, { deleting: true });
    const [movimientos, miembros, invitaciones] = await Promise.all([
      getDocs(collection(db, "familySpaces", familyId, "movements")),
      getDocs(collection(db, "familySpaces", familyId, "members")),
      getDocs(query(collection(db, "familyInvites"), where("createdBy", "==", uid), where("familyId", "==", familyId))),
    ]);
    for (let inicio = 0; inicio < movimientos.docs.length; inicio += 400) {
      const lote = writeBatch(db);
      for (const item of movimientos.docs.slice(inicio, inicio + 400)) lote.delete(item.ref);
      await lote.commit();
    }
    for (let inicio = 0; inicio < miembros.docs.length; inicio += 200) {
      const grupo = miembros.docs.slice(inicio, inicio + 200);
      const indices = await Promise.all(grupo.map(member => getDoc(doc(db, "familyUsers", member.id))));
      const lote = writeBatch(db);
      grupo.forEach((member, index) => {
        if (member.id === uid) lote.delete(doc(db, "familyUsers", member.id));
        else if (indices[index].exists() && String(indices[index].data().activeFamilyId || "") === familyId) {
          lote.set(doc(db, "familyUsers", member.id), { activeFamilyId: "" }, { merge: true });
        }
        lote.delete(member.ref);
      });
      await lote.commit();
    }
    for (let inicio = 0; inicio < invitaciones.docs.length; inicio += 400) {
      const lote = writeBatch(db);
      for (const invite of invitaciones.docs.slice(inicio, inicio + 400)) lote.delete(invite.ref);
      await lote.commit();
    }
    await deleteDoc(familyRef);
  }
  await deleteDoc(indexRef);
}
