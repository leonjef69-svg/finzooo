// EL RESPALDO DEL MODO NEGOCIO EN LA NUBE (V1, 07/08/2026)
//
// POR QUÉ UN DOCUMENTO APARTE Y NO EL DE SIEMPRE
//
// No es orden: es un límite que rompe cosas. Todo el respaldo de una cuenta vive hoy en **un
// solo documento** de Firestore (`users/{uid}`), y Firestore limita cada documento a **1 MB**.
// Ahí ya están todos los movimientos.
//
// Las ventas de un negocio crecen rápido —una pollería hace decenas al día— y meterlas en ese
// documento acabaría reventando el límite. Y cuando eso pasa no se pierde solo el negocio:
// **deja de sincronizar la cuenta entera**, también lo personal, y en silencio.
//
// Con un documento propio, el negocio puede crecer sin acercarse al límite de lo personal.
//
// Y NO ES UNA SUBCOLECCIÓN DEL DOCUMENTO DE LA CUENTA, tampoco por gusto: **borrar un
// documento en Firestore NO borra sus subcolecciones**. Puesto ahí dentro, borrar la cuenta
// habría dejado las ventas y los precios del negocio huérfanos en la nube, para siempre y sin
// que nadie lo viera. Al ser un documento suelto, se borra con una línea — y esa línea está
// en deleteCloudAccount, junto a la otra.

import { deleteDoc, doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/utils/firebase";
import type { DatosDelNegocio } from "@/utils/negocio";
import { utf8ByteLength } from "@/utils/utf8";
import { hasUnreadableLocalData } from "@/utils/storage";

/** Dónde vive el negocio de esta cuenta. */
function documento(uid: string) {
  return doc(db, "negocios", uid);
}

export async function bajarNegocio(uid: string): Promise<DatosDelNegocio | null> {
  const snap = await getDoc(documento(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<DatosDelNegocio>;
  // Cada lista con su valor de respaldo: un documento guardado por una versión anterior
  // puede no traerlas todas, y leer una lista que no está reventaría la pantalla.
  return {
    negocios: Array.isArray(data.negocios) ? data.negocios : [],
    productos: Array.isArray(data.productos) ? data.productos : [],
    ventas: Array.isArray(data.ventas) ? data.ventas : [],
    movimientos: Array.isArray(data.movimientos) ? data.movimientos : [],
  };
}

export function subirNegocio(uid: string, datos: DatosDelNegocio): Promise<void> {
  if (hasUnreadableLocalData()) return Promise.reject(new Error("datos-locales-ilegibles"));
  // Firestore RECHAZA cualquier campo con valor "undefined" y tira el guardado entero. La
  // venta tiene "movimientoId" opcional —vacío en toda la V1—, así que sin esta limpieza el
  // respaldo del negocio fallaría en silencio desde el primer día. Es el mismo paso que hace
  // saveCloudData, y por el mismo motivo.
  const limpio = JSON.parse(JSON.stringify(datos)) as DatosDelNegocio;
  return runTransaction(db, async transaction => {
    if (hasUnreadableLocalData()) throw new Error("datos-locales-ilegibles");
    const ref = documento(uid);
    const snap = await transaction.get(ref);
    const remoto = snap.exists() ? snap.data() as Partial<DatosDelNegocio> : {};
    const fusionar = <T extends { id: string }>(local: T[], nube: unknown): T[] => {
      const resultado = [...local];
      const ids = new Set(local.map(item => item.id));
      for (const item of Array.isArray(nube) ? nube as T[] : []) {
        if (!item || typeof item.id !== "string" || ids.has(item.id)) continue;
        ids.add(item.id);
        resultado.push(item);
      }
      return resultado;
    };
    const siguiente: DatosDelNegocio = {
      negocios: fusionar(limpio.negocios, remoto.negocios),
      productos: fusionar(limpio.productos, remoto.productos),
      ventas: fusionar(limpio.ventas, remoto.ventas),
      movimientos: fusionar(limpio.movimientos, remoto.movimientos),
    };
    if (utf8ByteLength(JSON.stringify(siguiente)) > 800_000) {
      throw new Error("negocio-demasiado-grande");
    }
    if (hasUnreadableLocalData()) throw new Error("datos-locales-ilegibles");
    transaction.set(ref, siguiente);
  });
}

/**
 * Borra el negocio de la nube. Se llama al eliminar la cuenta.
 *
 * Aquí SÍ importa si funcionó —por eso no se traga el error—: borrar la cuenta dejando sus
 * ventas y sus precios en la nube sería peor que no borrarla.
 */
export async function borrarNegocioDeLaNube(uid: string): Promise<void> {
  await deleteDoc(documento(uid));
}
