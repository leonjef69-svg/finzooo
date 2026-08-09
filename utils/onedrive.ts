// SUBIR LOS REPORTES A ONEDRIVE, SIN TOCAR NADA (08/08/2026)
//
// Copiado de utils/dropbox.ts a propósito, porque el camino es el mismo: pedir permiso una vez
// en el navegador con PKCE, guardar el permiso largo en el almacén seguro, y canjearlo por uno
// corto cada vez que toca subir. Lo que cambia son las direcciones y cuatro detalles de
// Microsoft, y esos cuatro están comentados uno por uno abajo — son justo los que no se
// adivinan leyendo el de Dropbox.
//
// ---- FALTA UN DATO, Y NO LO PUEDE PONER EL CÓDIGO ----
//
// Microsoft exige que el dueño de la cuenta REGISTRE la app en el portal de Azure y saque de
// ahí un identificador. Es un trámite suyo, de una vez, y hasta que exista este archivo no
// puede funcionar. Por eso CLIENT_ID nace vacío y `onedriveDisponible()` devuelve false: la
// opción no se ofrece en la pantalla en vez de ofrecerse y fallar al tocarla.
//
// ---- SOBRE EL PERMISO QUE SE PIDE ----
//
// `Files.ReadWrite.AppFolder`: Finzo solo puede entrar a SU carpeta
// (OneDrive/Aplicaciones/Finzo). No puede leer, listar ni borrar nada más del OneDrive de
// nadie, aunque quisiera. Es el equivalente exacto de la "carpeta de aplicaciones" de Dropbox.
//
// ---- SOBRE EL SECRETO QUE **NO** SE USA ----
//
// Igual que en Dropbox: aquí no hay secreto. La app se registra como "cliente público" y se usa
// PKCE. Un secreto metido en una app de celular está regalado — cualquiera abre el APK y le
// saca los textos.

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { aBase64Url, codigoDeLaVuelta, comoFormulario, verificadorPkce } from "@/utils/pkce";

/**
 * El identificador público de la app en Azure. **VACÍO HASTA QUE EL DUEÑO LO REGISTRE.**
 *
 * Se saca en portal.azure.com → Microsoft Entra ID → Registros de aplicaciones → Nuevo
 * registro, eligiendo "cuentas personales de Microsoft" y añadiendo la dirección de vuelta de
 * abajo como plataforma **móvil**. Lo que hay que copiar es el "Id. de aplicación (cliente)".
 *
 * En cuanto esté, se pega aquí y la opción aparece sola: no hay nada más que cambiar.
 */
const CLIENT_ID = "";

/**
 * A dónde vuelve el navegador al terminar.
 *
 * Tiene que estar dada de alta en Azure EXACTAMENTE así. Si no coinciden letra por letra,
 * Microsoft se niega antes de enseñar la pantalla de permiso, y su mensaje no dice cuál de las
 * dos está mal — el mismo tropiezo que hubo con Dropbox.
 */
const REDIRECT = "finzo://onedrive";

// "common" acepta cuentas personales (outlook, hotmail, live) y también las de trabajo. Con
// "consumers" solo entrarían las personales, y con el identificador de una organización solo
// las de esa empresa: quien tenga su OneDrive en una cuenta de trabajo se quedaría fuera sin
// entender por qué.
const AUTORIZAR = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/**
 * Los permisos que se piden.
 *
 * `offline_access` NO ES OPCIONAL y es el primero de los cuatro detalles que no se adivinan
 * leyendo el de Dropbox: sin él, Microsoft devuelve un permiso que dura una hora y NO devuelve
 * el largo, así que el reporte de mañana fallaría y habría que volver a iniciar sesión cada
 * día. Es el equivalente del `token_access_type=offline` de Dropbox.
 */
const PERMISOS = "Files.ReadWrite.AppFolder offline_access";

// El permiso de larga duración. En el almacén seguro y no en los ajustes normales: con él se
// puede escribir en la carpeta de la persona.
const CLAVE_REFRESH = "finzo.onedrive.refresh";

/** No hay cuenta de OneDrive conectada todavía. */
export class OneDriveSinConectar extends Error {
  constructor() {
    super("sin-conectar");
    this.name = "OneDriveSinConectar";
  }
}

/** Se pidió el permiso y la persona dijo que no, o cerró el navegador. */
export class OneDriveRechazado extends Error {
  constructor() {
    super("rechazado");
    this.name = "OneDriveRechazado";
  }
}

/**
 * ¿Está OneDrive disponible en esta versión de la app?
 *
 * Mientras falte el identificador de Azure, NO. Y la pantalla no lo ofrece: una opción que se
 * puede tocar y siempre falla es peor que una que no está, porque manda a buscar un fallo en el
 * celular cuando lo que falta es un trámite.
 */
export function onedriveDisponible(): boolean {
  return CLIENT_ID !== "";
}

/** ¿Ya está conectada una cuenta? */
export async function onedriveConectado(): Promise<boolean> {
  if (!onedriveDisponible()) return false;
  return (await SecureStore.getItemAsync(CLAVE_REFRESH)) !== null;
}

// Se olvida la cuenta. Igual que en Dropbox: solo la llama permisoDeAhora, cuando Microsoft
// contesta que el permiso ya no vale.
async function desconectarOneDrive(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_REFRESH);
}

/** Conecta la cuenta. Abre el navegador una vez y guarda el permiso. */
export async function conectarOneDrive(): Promise<void> {
  if (!onedriveDisponible()) throw new OneDriveSinConectar();

  const azar = await Crypto.getRandomBytesAsync(64);
  const verificador = verificadorPkce(azar);
  const huella = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verificador,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  const desafio = aBase64Url(huella);

  const url =
    `${AUTORIZAR}?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&scope=${encodeURIComponent(PERMISOS)}` +
    `&code_challenge=${encodeURIComponent(desafio)}` +
    `&code_challenge_method=S256`;

  const r = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
  if (r.type !== "success") throw new OneDriveRechazado();

  const codigo = codigoDeLaVuelta(r.url);
  if (codigo === "") throw new OneDriveRechazado();

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: comoFormulario({
      code: codigo,
      grant_type: "authorization_code",
      code_verifier: verificador,
      client_id: CLIENT_ID,
      // Segundo detalle: Microsoft exige que la dirección de vuelta se repita aquí, al canjear
      // el código, y que sea la MISMA que en el paso anterior. Si falta, contesta
      // "invalid_grant" sin decir qué falta.
      redirect_uri: REDIRECT,
    }),
  });
  if (!respuesta.ok) throw new OneDriveRechazado();

  const datos = (await respuesta.json()) as { refresh_token?: string };
  if (!datos.refresh_token) throw new OneDriveRechazado();
  await SecureStore.setItemAsync(CLAVE_REFRESH, datos.refresh_token);
}

/**
 * Un permiso de corta duración para subir ahora.
 *
 * No se guarda, por lo mismo que en Dropbox: dura una hora, y guardarlo obligaría a controlar
 * cuándo caduca. Una copia caducada falla justo a la hora del reporte, que es cuando nadie está
 * mirando.
 */
async function permisoDeAhora(): Promise<string> {
  const refresh = await SecureStore.getItemAsync(CLAVE_REFRESH);
  if (!refresh) throw new OneDriveSinConectar();

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: comoFormulario({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: CLIENT_ID,
      // Tercer detalle: al renovar hay que volver a pedir los permisos. Dropbox no lo necesita.
      // Sin esto, Microsoft devuelve un permiso sin acceso a la carpeta y la subida falla con
      // un "prohibido" que no se entiende, porque conectar sí había funcionado.
      scope: PERMISOS,
    }),
  });

  // Si Microsoft dice que el permiso ya no vale —la persona lo revocó desde su cuenta— se
  // olvida. Dejarlo guardado haría que cada reporte fallara igual y sin explicación.
  if (respuesta.status === 400 || respuesta.status === 401) {
    await desconectarOneDrive();
    throw new OneDriveSinConectar();
  }
  if (!respuesta.ok) throw new Error("onedrive-token");

  const datos = (await respuesta.json()) as { access_token?: string };
  if (!datos.access_token) throw new Error("onedrive-token");
  return datos.access_token;
}

/**
 * Sube un archivo ya generado a la carpeta de Finzo en OneDrive.
 *
 * Devuelve el nombre con el que quedó, que puede NO ser el que se pidió: con `rename` Microsoft
 * añade un número si ya había uno igual, y así dos reportes del mismo día no se pisan. Es lo
 * mismo que hace `autorename` en Dropbox.
 */
export async function subirAOneDrive(fileUri: string, nombre: string): Promise<string> {
  const token = await permisoDeAhora();

  // Cuarto detalle, y el que más cuesta ver: el nombre del archivo va DENTRO de la dirección,
  // no en una cabecera como en Dropbox. `special/approot` es la carpeta propia de la app, y los
  // dos puntos de alrededor son los que le dicen a Microsoft que lo de en medio es una ruta.
  //
  // Y va escapado: un reporte se llama "Finzo agosto 2026.pdf" y ese espacio partiría la
  // dirección.
  const destino =
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(nombre)}:/content` +
    `?%40microsoft.graph.conflictBehavior=rename`;

  const r = await uploadAsync(destino, fileUri, {
    // PUT, no POST: Microsoft rechaza el POST aquí con un "método no permitido".
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
  });

  if (r.status < 200 || r.status >= 300) throw new Error("onedrive-subida");
  const datos = JSON.parse(r.body) as { name?: string };
  return datos.name ?? nombre;
}
