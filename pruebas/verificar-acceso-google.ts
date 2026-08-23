/**
 * EL ACCESO CON GOOGLE DICE QUÉ FALLÓ (22/08/2026)
 *
 * Un tester eligió su cuenta de Google y Fino puso "Ocurrió un error" justo
 * debajo de Contraseña. La contraseña no participa en ese botón: el mensaje
 * estaba en el lugar equivocado y además escondía el código que hacía falta
 * para encontrar la causa.
 */
import fs from "node:fs";
import path from "node:path";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";

let fallos = 0;
function ok(condicion: boolean, texto: string) {
  if (condicion) console.log(`  ok    ${texto}`);
  else {
    console.log(`  FALLA ${texto}`);
    fallos++;
  }
}

console.log("\n--- LOS FALLOS DE GOOGLE YA NO SON TODOS IGUALES ---");
ok(googleSignInErrorMessage({ code: "10" }).includes("G10"), "identifica la instalación");
ok(
  googleSignInErrorMessage({ code: "auth/network-request-failed" }).includes("G7"),
  "distingue un problema de Internet"
);
ok(
  googleSignInErrorMessage({ code: "PLAY_SERVICES_NOT_AVAILABLE" }).includes("GPS"),
  "avisa si falta actualizar Google Play"
);
ok(
  googleSignInErrorMessage({ code: "fallo-nuevo" }).includes("fallo-nuevo"),
  "conserva un código desconocido para poder investigarlo"
);
ok(
  !googleSignInErrorMessage({ code: "<correo secreto>" }).includes("<"),
  "no muestra texto interno sin limpiar"
);

console.log("\n--- EL AVISO ESTÁ CON EL BOTÓN DE GOOGLE, NO CON LA CONTRASEÑA ---");
for (const archivo of ["Register.tsx", "Login.tsx"]) {
  const pantalla = fs.readFileSync(path.join(process.cwd(), "screens", archivo), "utf8");
  const boton = pantalla.lastIndexOf("<GoogleButton");
  const aviso = pantalla.lastIndexOf("{googleError ?");
  ok(boton >= 0 && aviso > boton, `${archivo}: el aviso aparece debajo del botón de Google`);
  ok(
    pantalla.includes("setGoogleError(googleSignInErrorMessage(err))"),
    `${archivo}: el fallo de Google no se guarda como error de contraseña`
  );
}

console.log("\n--- EL AAB USA LA CONFIGURACIÓN RECIÉN DESCARGADA ---");
const generador = fs.readFileSync(path.join(process.cwd(), "generar-aab.bat"), "utf8");
ok(
  /Downloads\\google-services\*\.json/i.test(generador) &&
    /copy \/Y "%FIREBASE_CONFIG%" "android\\app\\google-services\.json"/i.test(generador),
  "el generador toma de Descargas la configuración privada más reciente"
);

// La firma de la aplicación que entrega Google Play debe existir tanto en la
// configuración de respaldo como en la que Gradle usa al crear el AAB. Si
// falta, Google Play Services responde G10 aunque el botón y Firebase estén
// bien escritos.
const PLAY_SIGNING_SHA1 = "251613db754cae260052f7e00b8f8192fe02355a";
for (const archivo of ["google-services.json", "android/app/google-services.json"]) {
  const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), archivo), "utf8"));
  const app = config.client.find(
    (client: { client_info?: { android_client_info?: { package_name?: string } } }) =>
      client.client_info?.android_client_info?.package_name === "com.finoapp.gastos"
  );
  const firmas = (app?.oauth_client ?? []).map(
    (client: { android_info?: { certificate_hash?: string } }) => client.android_info?.certificate_hash
  );
  ok(firmas.includes(PLAY_SIGNING_SHA1), `${archivo}: incluye la firma que usa Google Play`);
}

console.log(
  fallos ? `\n${fallos} con problemas` : "\nTodo bien: el acceso con Google explica el fallo real"
);
process.exit(fallos ? 1 : 0);
