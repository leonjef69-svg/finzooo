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

import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { isDecoyActive } from "@/utils/decoyMode";
import type { DatosDelNegocio } from "@/utils/negocio";

/**
 * EL CANDADO DEL MODO SEÑUELO, OTRA VEZ. NO QUITARLO.
 *
 * El de utils/cloudSync está puesto en "la única puerta que da a Firestore". Esta es una
 * puerta NUEVA, así que necesita el mismo candado o el señuelo dejaría de servir por aquí:
 *
 *   SUBIR  → con el señuelo puesto, subir pisaría el respaldo real del negocio.
 *   BAJAR  → traería las ventas y los precios REALES y los mostraría dentro del señuelo, o
 *            sea que el modo hecho para esconder los datos los enseñaría.
 *
 * Es exactamente el fallo que este proyecto repite: dos mitades que por separado están bien
 * y el fallo en la costura entre ellas. Hay una prueba que exige el candado en las dos.
 */
function elSeñueloBloquea(): boolean {
  return isDecoyActive();
}

/** Dónde vive el negocio de esta cuenta. */
function documento(uid: string) {
  return doc(db, "negocios", uid);
}

export async function bajarNegocio(uid: string): Promise<DatosDelNegocio | null> {
  if (elSeñueloBloquea()) return null;
  try {
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
  } catch {
    // Sin internet se sigue con lo que hay en el celular. Nunca se borra nada por no haber
    // podido leer.
    return null;
  }
}

export function subirNegocio(uid: string, datos: DatosDelNegocio): Promise<void> {
  if (elSeñueloBloquea()) return Promise.resolve();
  // Firestore RECHAZA cualquier campo con valor "undefined" y tira el guardado entero. La
  // venta tiene "movimientoId" opcional —vacío en toda la V1—, así que sin esta limpieza el
  // respaldo del negocio fallaría en silencio desde el primer día. Es el mismo paso que hace
  // saveCloudData, y por el mismo motivo.
  const limpio = JSON.parse(JSON.stringify(datos)) as DatosDelNegocio;
  return setDoc(documento(uid), limpio).catch(() => {});
}

/**
 * Borra el negocio de la nube. Se llama al eliminar la cuenta.
 *
 * Aquí SÍ importa si funcionó —por eso no se traga el error—: borrar la cuenta dejando sus
 * ventas y sus precios en la nube sería peor que no borrarla.
 */
export async function borrarNegocioDeLaNube(uid: string): Promise<void> {
  if (elSeñueloBloquea()) throw new Error("No disponible");
  await deleteDoc(documento(uid));
}
