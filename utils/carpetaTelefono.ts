// GUARDAR EL REPORTE EN UNA CARPETA DEL TELÉFONO, SIN PREGUNTAR NADA
//
// Es el destino automático que no necesita cuenta de nada: se elige la carpeta
// UNA vez y a partir de ahí los reportes aparecen ahí solos.
//
// ---- POR QUÉ HAY QUE PEDIR LA CARPETA Y NO ESCRIBIR DONDE SEA ----
//
// Desde Android 11 una app no puede escribir en cualquier sitio del
// almacenamiento aunque tenga "permiso de archivos". Solo puede escribir donde
// el dueño del celular le señala con el selector del sistema, y ese permiso
// queda guardado y sigue valiendo después de cerrar la app y de reiniciar. Eso
// es justo lo que hace falta aquí: un toque al configurar, cero toques después.
//
// Intentar escribir en "/Descargas" a mano —que es lo que uno esperaría— falla
// en silencio o lanza un error de permiso según la versión de Android, y el
// fallo aparecería a la hora del reporte, de madrugada, sin nadie mirando.
//
// ---- LO QUE ESTE PERMISO NO ES ----
//
// No es acceso a todo el almacenamiento. Es acceso a UNA carpeta, la que la
// persona eligió. Fino no puede leer ni tocar nada fuera de ahí.

import { StorageAccessFramework as SAF } from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { loadJSON, saveJSON } from "@/utils/storage";

const STORAGE_KEY = "finzo:carpetaExportacion";

/** No se ha elegido carpeta todavía. */
export class SinCarpeta extends Error {
  constructor() {
    super("sin-carpeta");
    this.name = "SinCarpeta";
  }
}

/**
 * La carpeta perdió el permiso.
 *
 * Pasa de verdad: si la persona la borra, la mueve, o quita el permiso desde
 * los ajustes de Android, el enlace guardado deja de servir. Tiene su propio
 * error para poder decirle "vuelve a elegirla" en vez de un "no se pudo
 * guardar" que no explica nada.
 */
export class CarpetaPerdida extends Error {
  constructor() {
    super("carpeta-perdida");
    this.name = "CarpetaPerdida";
  }
}

/** La carpeta elegida, o cadena vacía si no hay ninguna. */
export async function carpetaElegida(): Promise<string> {
  return await loadJSON<string>(STORAGE_KEY, "");
}

/**
 * Abre el selector del sistema para elegir la carpeta. Devuelve su dirección,
 * o cadena vacía si la persona canceló.
 *
 * Se guarda para no volver a preguntar nunca más.
 */
export async function elegirCarpeta(): Promise<string> {
  const permiso = await SAF.requestDirectoryPermissionsAsync();
  if (!permiso.granted) return "";
  saveJSON(STORAGE_KEY, permiso.directoryUri);
  return permiso.directoryUri;
}

// Se olvida la carpeta. Sin "export": el unico sitio que la olvida es
// guardarEnCarpeta, cuando descubre que ya no vale.
function olvidarCarpeta(): void {
  saveJSON(STORAGE_KEY, "");
}

/**
 * Copia un archivo ya generado a la carpeta elegida.
 *
 * El nombre llega CON extensión (así lo arma buildFileName) y el selector de
 * Android la pone él a partir del tipo de archivo, así que aquí se le quita:
 * si no, saldrían nombres como "Gastos_2026-08-05.pdf.pdf".
 */
export async function guardarEnCarpeta(
  origenUri: string,
  nombreConExtension: string,
  mimeType: string
): Promise<string> {
  const carpeta = await carpetaElegida();
  if (carpeta === "") throw new SinCarpeta();

  const nombre = nombreConExtension.replace(/\.[^.]+$/, "");
  try {
    const destino = await SAF.createFileAsync(carpeta, nombre, mimeType);
    // Se pasa por base64 porque es lo único que el escritor de archivos de
    // Android acepta para contenido que no es texto — un PDF o un Excel
    // guardados como texto plano llegan corruptos y no abren.
    const contenido = await new File(origenUri).base64();
    await SAF.writeAsStringAsync(destino, contenido, { encoding: "base64" });
    return destino;
  } catch {
    // Si la carpeta ya no vale, se olvida: dejarla guardada haría que cada
    // reporte fallara igual, en silencio, para siempre.
    olvidarCarpeta();
    throw new CarpetaPerdida();
  }
}
