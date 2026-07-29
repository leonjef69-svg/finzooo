// SUBIR ARCHIVOS A GOOGLE DRIVE
//
// Se usa para guardar los reportes exportados sin pasar por el menú de
// compartir: se dice "exporta mayo a Drive" y el PDF aparece en la nube.
//
// ---- SOBRE EL PERMISO QUE SE PIDE ----
// Se pide "drive.file", que es el más pequeño que existe: deja a Finzo ver
// y tocar ÚNICAMENTE los archivos que ella misma creó. No puede leer, ni
// listar, ni borrar nada más de tu Drive — ni tus fotos, ni tus
// documentos, ni las carpetas de nadie.
//
// Se podría haber pedido acceso completo y habría sido más fácil de
// programar (por ejemplo, para buscar una carpeta hecha a mano). No hay
// ninguna razón para que una app de presupuesto vea tu Drive entero.

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { File } from "expo-file-system";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const FOLDER_NAME = "Finzo";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** No hay sesión de Google (se entró con correo y contraseña, o sin cuenta). */
export class DriveNotSignedIn extends Error {
  constructor() {
    super("not-signed-in");
    this.name = "DriveNotSignedIn";
  }
}

/** Se pidió el permiso de Drive y la persona dijo que no. */
export class DriveDenied extends Error {
  constructor() {
    super("denied");
    this.name = "DriveDenied";
  }
}

/** ¿Hay una cuenta de Google conectada en este celular? */
export function hasGoogleSession(): boolean {
  try {
    return GoogleSignin.getCurrentUser() != null;
  } catch {
    return false;
  }
}

async function currentToken(): Promise<string> {
  const { accessToken } = await GoogleSignin.getTokens();
  if (!accessToken) throw new DriveNotSignedIn();
  return accessToken;
}

/**
 * Pide el permiso de Drive si aún no lo tenemos.
 *
 * Se llama solo cuando Google ya nos dijo que no (401/403) en vez de
 * preguntar por adelantado: así, quien ya lo concedió una vez no vuelve a
 * ver ninguna ventana nunca más.
 */
async function requestDriveScope(): Promise<void> {
  const result = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
  if (!result) throw new DriveDenied();
}

type DriveFile = { id: string; name: string; webViewLink?: string };

/**
 * Busca la carpeta "Finzo" en Drive y, si no existe, la crea.
 *
 * Con el permiso "drive.file" esta búsqueda solo ve los archivos que creó
 * la propia app, así que encuentra la carpeta que hicimos nosotros y jamás
 * una carpeta personal que se llame igual.
 */
async function findOrCreateFolder(token: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`
    );
    const found = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (found.ok) {
      const data = await found.json();
      if (data.files?.[0]?.id) return data.files[0].id as string;
    }

    const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    });
    if (!created.ok) return null;
    const data = await created.json();
    return (data.id as string) ?? null;
  } catch {
    // Si algo falla con la carpeta, el archivo igual se sube — a la raíz
    // del Drive. Perder el orden es mucho mejor que perder el reporte.
    return null;
  }
}

async function putFile(
  token: string,
  base64: string,
  name: string,
  mimeType: string,
  folderId: string | null
): Promise<Response> {
  // Subida "multipart" de Drive: en un solo envío van los datos del archivo
  // (nombre, carpeta) y su contenido. El contenido va en base64 porque es
  // texto plano, y así el cuerpo entero es una cadena — sin eso habría que
  // armar datos binarios a mano, que en React Native es frágil.
  const boundary = `finzo${Date.now()}`;
  const metadata: Record<string, unknown> = { name, mimeType };
  if (folderId) metadata.parents = [folderId];

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64}\r\n` +
    `--${boundary}--`;

  return fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
}

/**
 * Sube un archivo del celular a la carpeta "Finzo" de Google Drive.
 * Devuelve los datos del archivo creado, o lanza si no se pudo.
 */
export async function uploadToDrive(
  fileUri: string,
  name: string,
  mimeType: string
): Promise<DriveFile> {
  if (!hasGoogleSession()) throw new DriveNotSignedIn();

  const base64 = await new File(fileUri).base64();
  let token = await currentToken();
  let folderId = await findOrCreateFolder(token);
  let response = await putFile(token, base64, name, mimeType, folderId);

  // 401/403 = "no tienes permiso para escribir en Drive". Es lo que pasa la
  // PRIMERA vez: la sesión de Google sirve para entrar a la app, pero no
  // incluye Drive. Se pide, y se reintenta una sola vez.
  if (response.status === 401 || response.status === 403) {
    await requestDriveScope();
    token = await currentToken();
    folderId = await findOrCreateFolder(token);
    response = await putFile(token, base64, name, mimeType, folderId);
  }

  if (!response.ok) {
    throw new Error(`drive-upload-${response.status}`);
  }
  return (await response.json()) as DriveFile;
}
