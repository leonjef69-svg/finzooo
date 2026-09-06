import {
  addDoc,
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
} from "firebase/firestore";
import { db } from "@/utils/firebase";
import { crearCodigoFamilia } from "@/utils/familia";

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
  fecha: string;
  creadoEn: number;
  creadoPor: string;
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
  return { id: espacio.id, nombre: String(data.nombre || "Familia"), ownerUid: String(data.ownerUid), creadoEn: alNumero(data.creadoEn) };
}

export async function crearFamilia(uid: string, nombrePersona: string, nombreFamilia: string): Promise<EspacioFamilia> {
  const ref = doc(collection(db, "familySpaces"));
  const familia = { nombre: nombreFamilia, ownerUid: uid, creadoEn: serverTimestamp() };
  await setDoc(ref, familia);
  await setDoc(doc(db, "familySpaces", ref.id, "members", uid), { uid, nombre: nombrePersona, rol: "owner", unidoEn: serverTimestamp() });
  await setDoc(doc(db, "familyUsers", uid), { activeFamilyId: ref.id }, { merge: true });
  return { id: ref.id, nombre: nombreFamilia, ownerUid: uid, creadoEn: Date.now() };
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

export async function unirseAFamilia(uid: string, nombre: string, codigoCrudo: string): Promise<EspacioFamilia> {
  const codigo = codigoCrudo.trim().toUpperCase();
  const inviteRef = doc(db, "familyInvites", codigo);
  const invite = await getDoc(inviteRef);
  if (!invite.exists()) throw new Error("invalid-code");
  const data = invite.data();
  if (Number(data.expiresAt || 0) < Date.now()) throw new Error("expired-code");
  const familyId = String(data.familyId || "");
  await setDoc(doc(db, "familySpaces", familyId, "members", uid), {
    uid,
    nombre,
    rol: "member",
    inviteCode: codigo,
    unidoEn: serverTimestamp(),
  });
  await setDoc(doc(db, "familyUsers", uid), { activeFamilyId: familyId }, { merge: true });
  const familyRef = doc(db, "familySpaces", familyId);
  const family = await getDoc(familyRef);
  if (!family.exists()) throw new Error("invalid-code");
  const familyData = family.data();
  return { id: family.id, nombre: String(familyData.nombre || "Familia"), ownerUid: String(familyData.ownerUid), creadoEn: alNumero(familyData.creadoEn) };
}

export async function listarMiembrosFamilia(familyId: string): Promise<MiembroFamilia[]> {
  const snap = await getDocs(collection(db, "familySpaces", familyId, "members"));
  return snap.docs.map((item) => ({ uid: item.id, nombre: String(item.data().nombre || "Miembro"), rol: item.data().rol === "owner" ? "owner" : "member" }));
}

export async function listarMovimientosFamilia(familyId: string): Promise<MovimientoFamilia[]> {
  const snap = await getDocs(query(collection(db, "familySpaces", familyId, "movements"), orderBy("creadoEn", "desc")));
  return snap.docs.map((item) => {
    const data = item.data();
    return { id: item.id, tipo: data.tipo === "ingreso" ? "ingreso" : "gasto", monto: Number(data.monto || 0), descripcion: String(data.descripcion || ""), fecha: String(data.fecha || ""), creadoEn: alNumero(data.creadoEn), creadoPor: String(data.creadoPor || "") };
  });
}

export async function guardarMovimientoFamilia(familyId: string, uid: string, movimiento: Omit<MovimientoFamilia, "id" | "creadoEn" | "creadoPor">): Promise<void> {
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

export async function borrarVinculoFamiliaDeCuenta(uid: string): Promise<void> {
  const indexRef = doc(db, "familyUsers", uid);
  const index = await getDoc(indexRef);
  const familyId = index.exists() ? String(index.data().activeFamilyId || "") : "";
  if (familyId) await deleteDoc(doc(db, "familySpaces", familyId, "members", uid));
  await deleteDoc(indexRef);
}
