// SUBIR ARCHIVOS A GOOGLE DRIVE
//
// Se usa para guardar los reportes exportados sin pasar por el menú de
// compartir: se dice "exporta mayo a Drive" y el PDF aparece en la nube.
//
// ---- SOBRE EL PERMISO QUE SE PIDE ----
// Se pide "drive.file", que es el más pequeño que existe: deja a Fino ver
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

const FOLDER_NAME = "Fino";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** No hay sesión de Google (se entró con correo y contraseña, o sin cuenta). */
export class DriveNotSignedIn extends Error {
  /**
   * El motivo viaja en el mensaje A PROPÓSITO. La pantalla de exportación automática lo
   * escribe tal cual, y hasta hoy solo decía "not-signed-in": eso no distingue entre "nunca
   * entró con Google", "la cuenta ya no está en el celular" y "Play Services falló". Con el
   * motivo dentro, el celular dice qué pasó en vez de tener que suponerlo.
   */
  constructor(motivo = "not-signed-in") {
    super(motivo);
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

/** ¿Hay una cuenta de Google conectada EN ESTA EJECUCIÓN de la app? Ver `asegurarSesion`. */
export function hasGoogleSession(): boolean {
  try {
    return GoogleSignin.getCurrentUser() != null;
  } catch {
    return false;
  }
}

/**
 * RECUPERA LA SESIÓN DE GOOGLE AL VOLVER A ABRIR LA APP. **Esto era el fallo (20/08/2026).**
 *
 * `getCurrentUser()` no mira la cuenta del celular: devuelve lo que la librería tiene
 * guardado EN MEMORIA, y eso solo se llena cuando alguien entra con `signIn()`. Al cerrar y
 * volver a abrir Fino, la memoria arranca vacía — así que devolvía `null` aunque la persona
 * hubiera entrado con Google y siguiera perfectamente conectada.
 *
 * Consecuencia: guardar en Drive solo funcionaba en la MISMA sesión en la que se pulsó
 * "Entrar con Google". Después siempre fallaba, y con un mensaje que además desorientaba
 * —*"Para guardar en Drive, entra a Fino con tu cuenta de Google"*, estando ya dentro con
 * ella—. La exportación automática, que corre justo al abrir la app, no acertaba nunca:
 * *"está fallando, creo, no exporta de manera automática"*.
 *
 * `signInSilently()` es lo que devuelve esa sesión a la memoria, sin enseñar ninguna ventana
 * ni pedir nada. Si de verdad no hay cuenta —se entró con correo y contraseña, o se cerró
 * sesión— no encuentra nada y entonces sí, el error es el correcto.
 */
async function asegurarSesion(): Promise<void> {
  if (hasGoogleSession()) return;
  try {
    const r = (await GoogleSignin.signInSilently()) as { type?: string } | undefined;
    if (r?.type === "success") return;
    ultimoTropiezo = r?.type ?? "sin-respuesta";
  } catch (e) {
    ultimoTropiezo = String((e as Error)?.message ?? e);
  }
  /* AQUÍ NO SE DECIDE NADA, Y ES ADREDE.
     Aunque recuperar no haya salido, se sigue: quien de verdad sabe si hay una sesión
     utilizable es `getTokens()`, porque habla con Google Play en vez de mirar una memoria de
     la app. Cortar aquí es lo que hacía el código viejo, y por eso decía "no has entrado" a
     quien sí había entrado. */
}

/**
 * El último error de la recuperación, para poder ENSEÑARLO.
 *
 * La pantalla de exportación automática escribe el error tal cual, y ahí se vio
 * `DriveNotSignedIn: not-signed-in` — un mensaje que solo decía "no hay sesión" sin decir por
 * qué, así que hubo que adivinar dos veces. Guardando el motivo real, la próxima vez el
 * propio celular dice qué pasó.
 */
let ultimoTropiezo: string | null = null;

async function currentToken(): Promise<string> {
  try {
    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) throw new DriveNotSignedIn("sin-token" + motivo());
    return accessToken;
  } catch (e) {
    if (e instanceof DriveNotSignedIn) throw e;
    // ESTE es el sitio que de verdad sabe si hay sesión utilizable: pedir el token habla con
    // Google Play, no con una memoria de la app. Su error dice lo que pasa —cuenta quitada
    // del celular, Play Services sin actualizar, red caída— y se enseña tal cual.
    throw new DriveNotSignedIn(String((e as Error)?.message ?? e) + motivo());
  }
}

function motivo(): string {
  return ultimoTropiezo ? ` (recuperar: ${ultimoTropiezo})` : "";
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
 * Busca la carpeta "Fino" en Drive y, si no existe, la crea.
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
 * Sube un archivo del celular a la carpeta "Fino" de Google Drive.
 * Devuelve los datos del archivo creado, o lanza si no se pudo.
 */
export async function uploadToDrive(
  fileUri: string,
  name: string,
  mimeType: string
): Promise<DriveFile> {
  await asegurarSesion();

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
