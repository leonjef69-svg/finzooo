import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query,
  runTransaction, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "@/utils/firebase";
import { crearCodigoFamilia } from "@/utils/familia";

export type CajaCompartida = {
  id: string;
  nombre: string;
  ownerUid: string;
  creadaEn: number;
};

export type MovimientoCajaCompartida = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  descripcion: string;
  fecha: string;
  creadoPor: string;
  creadoEn: number;
};

const alNumero = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) return (value as { toMillis(): number }).toMillis();
  return Date.now();
};

function desdeDocumento(id: string, data: Record<string, unknown>): CajaCompartida {
  return { id, nombre: String(data.nombre || "Caja"), ownerUid: String(data.ownerUid || ""), creadaEn: alNumero(data.creadaEn) };
}

export async function listarCajasCompartidas(uid: string): Promise<CajaCompartida[]> {
  const enlaces = await getDocs(collection(db, "boxUsers", uid, "spaces"));
  const cajas = await Promise.all(enlaces.docs.map(async enlace => {
    const caja = await getDoc(doc(db, "boxSpaces", enlace.id));
    return caja.exists() ? desdeDocumento(caja.id, caja.data()) : null;
  }));
  return cajas.filter((caja): caja is CajaCompartida => caja !== null).sort((a, b) => b.creadaEn - a.creadaEn);
}

export async function crearCajaCompartida(uid: string, nombrePersona: string, nombre: string): Promise<CajaCompartida> {
  const ref = doc(collection(db, "boxSpaces"));
  const limpia = nombre.trim().slice(0, 30);
  await runTransaction(db, async transaction => {
    transaction.set(ref, { nombre: limpia, ownerUid: uid, creadaEn: serverTimestamp() });
    transaction.set(doc(db, "boxSpaces", ref.id, "members", uid), { uid, nombre: nombrePersona, rol: "owner", unidoEn: serverTimestamp() });
    transaction.set(doc(db, "boxUsers", uid, "spaces", ref.id), { boxId: ref.id, unidoEn: serverTimestamp() });
  });
  return { id: ref.id, nombre: limpia, ownerUid: uid, creadaEn: Date.now() };
}

export async function crearInvitacionCaja(uid: string, boxId: string): Promise<string> {
  const codigo = crearCodigoFamilia();
  await setDoc(doc(db, "boxInvites", codigo), { boxId, createdBy: uid, expiresAt: Date.now() + 7 * 86400000, creadoEn: serverTimestamp() });
  return codigo;
}

export async function unirseACaja(uid: string, nombre: string, codigoCrudo: string): Promise<CajaCompartida> {
  const codigo = codigoCrudo.trim().toUpperCase();
  const invitacion = await getDoc(doc(db, "boxInvites", codigo));
  if (!invitacion.exists() || Number(invitacion.data().expiresAt || 0) < Date.now()) throw new Error("invalid-code");
  const boxId = String(invitacion.data().boxId || "");
  const caja = await getDoc(doc(db, "boxSpaces", boxId));
  if (!caja.exists()) throw new Error("invalid-code");
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, "boxSpaces", boxId, "members", uid), { uid, nombre, rol: "member", inviteCode: codigo, unidoEn: serverTimestamp() });
    transaction.set(doc(db, "boxUsers", uid, "spaces", boxId), { boxId, unidoEn: serverTimestamp() });
  });
  return desdeDocumento(caja.id, caja.data());
}

export async function listarMovimientosCajaCompartida(boxId: string): Promise<MovimientoCajaCompartida[]> {
  const snap = await getDocs(query(collection(db, "boxSpaces", boxId, "movements"), orderBy("creadoEn", "desc")));
  return snap.docs.map(item => ({ id: item.id, tipo: item.data().tipo === "ingreso" ? "ingreso" : "gasto", monto: Number(item.data().monto || 0), descripcion: String(item.data().descripcion || ""), fecha: String(item.data().fecha || ""), creadoPor: String(item.data().creadoPor || ""), creadoEn: alNumero(item.data().creadoEn) }));
}

export async function guardarMovimientoCajaCompartida(boxId: string, uid: string, movimiento: Omit<MovimientoCajaCompartida, "id" | "creadoPor" | "creadoEn">): Promise<void> {
  await addDoc(collection(db, "boxSpaces", boxId, "movements"), { ...movimiento, creadoPor: uid, creadoEn: serverTimestamp() });
}
