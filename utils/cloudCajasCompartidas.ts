import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query,
  runTransaction, serverTimestamp, setDoc, onSnapshot, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "@/utils/firebase";
import { crearCodigoFamilia } from "@/utils/familia";
import { isSafeMoneyAmount } from "@/utils/amount";
import type { Caja, MovimientoCaja } from "@/utils/cajas";

export type CajaCompartida = {
  id: string;
  nombre: string;
  ownerUid: string;
  creadaEn: number;
  currency: string;
};

export type MovimientoCajaCompartida = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  descripcion: string;
  method?: string;
  fecha: string;
  creadoPor: string;
  creadoEn: number;
  personalTransactionId?: number;
  personalOwnerUid?: string;
};

const alNumero = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) return (value as { toMillis(): number }).toMillis();
  return Date.now();
};

function desdeDocumento(id: string, data: Record<string, unknown>): CajaCompartida {
  return { id, nombre: String(data.nombre || "Caja"), ownerUid: String(data.ownerUid || ""), creadaEn: alNumero(data.creadaEn), currency: String(data.currency || "PEN") };
}

export async function listarCajasCompartidas(uid: string): Promise<CajaCompartida[]> {
  const enlaces = await getDocs(collection(db, "boxUsers", uid, "spaces"));
  const cajas = await Promise.all(enlaces.docs.map(async enlace => {
    const caja = await getDoc(doc(db, "boxSpaces", enlace.id));
    return caja.exists() && caja.data().migrationComplete !== false ? desdeDocumento(caja.id, caja.data()) : null;
  }));
  return cajas.filter((caja): caja is CajaCompartida => caja !== null).sort((a, b) => b.creadaEn - a.creadaEn);
}

export async function crearCajaCompartida(uid: string, nombrePersona: string, nombre: string, montoInicial = 0, currency = "PEN"): Promise<CajaCompartida> {
  const ref = doc(collection(db, "boxSpaces"));
  const limpia = nombre.trim().slice(0, 30);
  if (!limpia || !isSafeMoneyAmount(montoInicial) || montoInicial < 0) throw new Error("invalid-input");
  await runTransaction(db, async transaction => {
    transaction.set(ref, { nombre: limpia, ownerUid: uid, currency, creadaEn: serverTimestamp() });
    transaction.set(doc(db, "boxSpaces", ref.id, "members", uid), { uid, nombre: nombrePersona, rol: "owner", unidoEn: serverTimestamp() });
    transaction.set(doc(db, "boxUsers", uid, "spaces", ref.id), { boxId: ref.id, unidoEn: serverTimestamp() });
    if (montoInicial > 0) transaction.set(doc(db, "boxSpaces", ref.id, "movements", "initial"), {
      tipo: "ingreso", monto: montoInicial, descripcion: "", fecha: new Date().toLocaleDateString("sv-SE"),
      creadoPor: uid, creadoEn: serverTimestamp(),
    });
  });
  return { id: ref.id, nombre: limpia, ownerUid: uid, creadaEn: Date.now(), currency };
}

/**
 * Convierte una caja privada en compartida sin crear una segunda caja visible.
 * La copia se marca como incompleta hasta que todos sus movimientos llegaron;
 * si se corta Internet, la caja privada permanece y se puede reintentar.
 */
export async function compartirCajaExistente(
  uid: string,
  nombrePersona: string,
  caja: Caja,
  movimientos: MovimientoCaja[],
  currency = "PEN",
): Promise<CajaCompartida> {
  const ref = doc(db, "boxSpaces", `${uid}_${caja.id}`);
  await runTransaction(db, async transaction => {
    const actual = await transaction.get(ref);
    if (actual.exists() && actual.data().ownerUid !== uid) throw new Error("not-owner");
    if (!actual.exists()) {
      transaction.set(ref, { nombre: caja.nombre, ownerUid: uid, currency, creadaEn: serverTimestamp(), migrationComplete: false });
      transaction.set(doc(db, "boxSpaces", ref.id, "members", uid), { uid, nombre: nombrePersona, rol: "owner", unidoEn: serverTimestamp() });
      transaction.set(doc(db, "boxUsers", uid, "spaces", ref.id), { boxId: ref.id, unidoEn: serverTimestamp() });
    }
  });
  for (let inicio = 0; inicio < movimientos.length; inicio += 400) {
    const lote = writeBatch(db);
    for (const item of movimientos.slice(inicio, inicio + 400)) {
      lote.set(doc(db, "boxSpaces", ref.id, "movements", item.id), {
        tipo: item.tipo, monto: item.monto, descripcion: item.descripcion, fecha: item.fecha,
        ...(item.method ? { method: item.method } : {}), creadoPor: uid, creadoEn: item.creadoEn,
        ...(item.personalTransactionId != null ? { personalTransactionId: item.personalTransactionId, personalOwnerUid: uid } : {}),
      });
    }
    await lote.commit();
  }
  await updateDoc(ref, { migrationComplete: true });
  return { id: ref.id, nombre: caja.nombre, ownerUid: uid, creadaEn: caja.creadaEn, currency };
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
  await runTransaction(db, async transaction => {
    const memberRef = doc(db, "boxSpaces", boxId, "members", uid);
    const member = await transaction.get(memberRef);
    if (!member.exists()) transaction.set(memberRef, { uid, nombre, rol: "member", inviteCode: codigo, unidoEn: serverTimestamp() });
    transaction.set(doc(db, "boxUsers", uid, "spaces", boxId), { boxId, unidoEn: serverTimestamp() });
  });
  const caja = await getDoc(doc(db, "boxSpaces", boxId));
  if (!caja.exists()) throw new Error("invalid-code");
  return desdeDocumento(caja.id, caja.data());
}

export async function listarMovimientosCajaCompartida(boxId: string): Promise<MovimientoCajaCompartida[]> {
  const snap = await getDocs(query(collection(db, "boxSpaces", boxId, "movements"), orderBy("creadoEn", "desc")));
  return snap.docs.map(item => ({ id: item.id, tipo: item.data().tipo === "ingreso" ? "ingreso" : "gasto", monto: Number(item.data().monto || 0), descripcion: String(item.data().descripcion || ""), method: typeof item.data().method === "string" ? item.data().method : undefined, fecha: String(item.data().fecha || ""), creadoPor: String(item.data().creadoPor || ""), creadoEn: alNumero(item.data().creadoEn), personalTransactionId: typeof item.data().personalTransactionId === "number" ? item.data().personalTransactionId : undefined, personalOwnerUid: typeof item.data().personalOwnerUid === "string" ? item.data().personalOwnerUid : undefined }));
}

export async function guardarMovimientoCajaCompartida(boxId: string, uid: string, movimiento: Omit<MovimientoCajaCompartida, "id" | "creadoPor" | "creadoEn">): Promise<void> {
  if (!isSafeMoneyAmount(movimiento.monto) || movimiento.monto <= 0) throw new Error("invalid-amount");
  await addDoc(collection(db, "boxSpaces", boxId, "movements"), { ...movimiento, creadoPor: uid, creadoEn: serverTimestamp() });
}

export function escucharMovimientosCaja(boxId: string, recibir: (items: MovimientoCajaCompartida[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, "boxSpaces", boxId, "movements"), orderBy("creadoEn", "desc")), snap => {
    recibir(snap.docs.map(item => ({ id: item.id, tipo: item.data().tipo === "ingreso" ? "ingreso" : "gasto", monto: Number(item.data().monto || 0), descripcion: String(item.data().descripcion || ""), method: typeof item.data().method === "string" ? item.data().method : undefined, fecha: String(item.data().fecha || ""), creadoPor: String(item.data().creadoPor || ""), creadoEn: alNumero(item.data().creadoEn), personalTransactionId: typeof item.data().personalTransactionId === "number" ? item.data().personalTransactionId : undefined, personalOwnerUid: typeof item.data().personalOwnerUid === "string" ? item.data().personalOwnerUid : undefined })));
  }, error);
}
