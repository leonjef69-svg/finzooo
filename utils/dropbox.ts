// SUBIR LOS REPORTES A DROPBOX, SIN TOCAR NADA
//
// ---- POR QUÉ NO SE USA LA LIBRERÍA DE DROPBOX ----
//
// No hace falta: son tres llamadas de red y ya está. Meter la librería oficial
// obligaría a compilar un APK nuevo, y todo esto se entrega por actualización.
//
// ---- SOBRE EL PERMISO QUE SE PIDE ----
//
// La app está registrada como "carpeta de aplicaciones", así que Fino solo
// puede entrar a SU carpeta (Dropbox/Aplicaciones/<nombre de la app>). No puede
// leer, listar ni borrar nada más del Dropbox de nadie, aunque quisiera.
//
// Y el único permiso marcado es "files.content.write": escribir archivos. Ni
// compartir, ni contactos, ni leer.
//
// ---- SOBRE EL SECRETO QUE **NO** SE USA ----
//
// Dropbox da una "clave" y un "secreto". Aquí solo se usa la clave, que es un
// identificador público. El secreto NO está en el código y no debe estarlo:
// cualquiera puede abrir un APK y sacarle los textos, así que un secreto metido
// en una app de celular está regalado. En su lugar se usa PKCE, que es el
// método hecho para este caso: la app se inventa un número al azar, manda su
// huella al pedir permiso y el número entero al canjear el código. Sin ese
// número, un código robado a medio camino no sirve para nada.

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { aBase64Url, codigoDeLaVuelta, comoFormulario, verificadorPkce } from "@/utils/pkce";

/**
 * La clave pública de la app en Dropbox.
 *
 * La creó el dueño de la cuenta en dropbox.com/developers/apps el 05/08/2026.
 * Si algún día deja de funcionar (app borrada, clave rotada), el error que
 * llega es "app no encontrada" y se arregla poniendo la nueva aquí.
 */
const CLIENT_ID = "4gvyeptik8qjlgn";

/**
 * A dónde vuelve el navegador al terminar.
 *
 * Tiene que ser EXACTAMENTE la misma que está dada de alta en la consola de
 * Dropbox. Si no coinciden letra por letra, Dropbox se niega antes de enseñar
 * la pantalla de permiso y el mensaje no dice cuál de las dos está mal.
 */
const REDIRECT = "finzo://dropbox";

const AUTORIZAR = "https://www.dropbox.com/oauth2/authorize";
const TOKEN = "https://api.dropboxapi.com/oauth2/token";
const SUBIR = "https://content.dropboxapi.com/2/files/upload";

// El permiso de larga duración. Va en el almacén seguro del celular y no en los
// ajustes normales: con él se puede escribir en la carpeta de la persona.
const CLAVE_REFRESH = "finzo.dropbox.refresh";

/** No hay cuenta de Dropbox conectada todavía. */
export class DropboxSinConectar extends Error {
  constructor() {
    super("sin-conectar");
    this.name = "DropboxSinConectar";
  }
}

/** Se pidió el permiso y la persona dijo que no, o cerró el navegador. */
export class DropboxRechazado extends Error {
  constructor() {
    super("rechazado");
    this.name = "DropboxRechazado";
  }
}

/** ¿Ya está conectada una cuenta? */
export async function dropboxConectado(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CLAVE_REFRESH)) !== null;
}

// Se olvida la cuenta. Sin "export" porque nadie la desconecta a mano todavía:
// el único que la llama es permisoDeAhora, cuando Dropbox contesta que el
// permiso ya no vale. El día que haya un botón de desconectar, se exporta.
async function desconectarDropbox(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_REFRESH);
}

/**
 * Conecta la cuenta. Abre el navegador una vez y guarda el permiso.
 *
 * Se pide `token_access_type=offline` a propósito: sin eso Dropbox da un permiso
 * que caduca en unas horas y habría que volver a iniciar sesión cada día, lo
 * cual no es automático de ninguna manera.
 */
export async function conectarDropbox(): Promise<void> {
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
    `&code_challenge=${encodeURIComponent(desafio)}` +
    `&code_challenge_method=S256` +
    `&token_access_type=offline`;

  const r = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
  if (r.type !== "success") throw new DropboxRechazado();

  const codigo = codigoDeLaVuelta(r.url);
  if (codigo === "") throw new DropboxRechazado();

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: comoFormulario({
      code: codigo,
      grant_type: "authorization_code",
      code_verifier: verificador,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
    }),
  });
  if (!respuesta.ok) throw new DropboxRechazado();

  const datos = (await respuesta.json()) as { refresh_token?: string };
  if (!datos.refresh_token) throw new DropboxRechazado();
  await SecureStore.setItemAsync(CLAVE_REFRESH, datos.refresh_token);
}

/**
 * Un permiso de corta duración para subir ahora.
 *
 * No se guarda: dura unas horas y pedirlo cuesta una llamada. Guardarlo sería
 * tener que controlar cuándo caduca, y una copia caducada falla justo a la hora
 * del reporte, que es cuando nadie está mirando.
 */
async function permisoDeAhora(): Promise<string> {
  const refresh = await SecureStore.getItemAsync(CLAVE_REFRESH);
  if (!refresh) throw new DropboxSinConectar();

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: comoFormulario({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: CLIENT_ID,
    }),
  });

  // Si Dropbox dice que el permiso ya no vale —la persona lo revocó desde su
  // cuenta— se olvida. Dejarlo guardado haría que cada reporte fallara igual y
  // sin explicación, y no habría forma de volver a conectar.
  if (respuesta.status === 400 || respuesta.status === 401) {
    await desconectarDropbox();
    throw new DropboxSinConectar();
  }
  if (!respuesta.ok) throw new Error("dropbox-token");

  const datos = (await respuesta.json()) as { access_token?: string };
  if (!datos.access_token) throw new Error("dropbox-token");
  return datos.access_token;
}

/**
 * Sube un archivo ya generado a la carpeta de Fino en Dropbox.
 *
 * Devuelve el nombre con el que quedó, que puede NO ser el que se pidió: con
 * `autorename` Dropbox añade "(1)" si ya había uno igual, y así dos reportes
 * del mismo día no se pisan.
 */
export async function subirADropbox(fileUri: string, nombre: string): Promise<string> {
  const token = await permisoDeAhora();

  // Los datos de la subida van en una CABECERA, no en el cuerpo: el cuerpo es
  // el archivo entero. Por eso el nombre tiene que ir en JSON aquí.
  const argumentos = JSON.stringify({
    path: `/${nombre}`,
    mode: "add",
    autorename: true,
    // Sin aviso en el celular por cada subida: son reportes automáticos y
    // avisarlos convertiría la función en una molestia diaria.
    mute: true,
  });

  const r = await uploadAsync(SUBIR, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": argumentos,
    },
  });

  if (r.status < 200 || r.status >= 300) throw new Error("dropbox-subida");
  const datos = JSON.parse(r.body) as { name?: string };
  return datos.name ?? nombre;
}
