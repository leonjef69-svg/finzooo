// Comprueba que toda pantalla que abre una APLICACION DE ANDROID esté en la
// lista KEEP_ON_RETURN de app/_layout.tsx.
//
// Por que existe este auditor:
//
// Al volver de otra app, _layout.tsx cierra la pantalla actual y manda a
// Inicio — salvo las de esa lista. La camara, la galeria, el selector de
// archivos y el servicio de voz son aplicaciones aparte, asi que cualquier
// pantalla que las use se cierra sola al volver y pierde su trabajo.
//
// Ya paso dos veces: primero con el microfono, y despues con el escaner de
// boletas, donde la persona tomaba la foto, volvia, y se encontraba en
// Inicio sin saber si habia escaneado. Es un fallo silencioso —no hay
// error, no hay aviso, simplemente no pasa nada— y por eso conviene que lo
// vigile una comprobacion y no la memoria.

import fs from "fs";
import path from "path";

const ROOT = process.argv[2] ?? ".";

// Llamadas que le pasan el control a otra aplicacion de Android.
const ABREN_OTRA_APP = [
  { patron: /ImagePicker\.launchCameraAsync/, que: "la cámara" },
  { patron: /ImagePicker\.launchImageLibraryAsync/, que: "la galería" },
  { patron: /DocumentPicker\.getDocumentAsync/, que: "el selector de archivos" },
  { patron: /Sharing\.shareAsync/, que: "el menú de compartir" },
  { patron: /Linking\.openURL|startActivity/, que: "otra aplicación" },
  { patron: /ExpoSpeechRecognitionModule\.start|useSpeechRecognitionEvent/, que: "el servicio de voz" },
  // Los cuadros de permiso los dibuja Android ENCIMA de la app, y la app lo
  // vive igual que si se hubiera ido a otra aplicación. Entró por aquí el
  // cuarto caso: la pantalla de exportación programada pide el permiso de
  // avisos en el primer toque, así que conceder el permiso mandaba a Inicio
  // antes de poder terminar de configurar nada.
  //
  // applySchedule está en la lista aunque sea una función nuestra: pide el
  // permiso por dentro, y una pantalla que la llama queda igual de expuesta
  // que si lo pidiera ella misma. Si mañana aparece otro ayudante que pida
  // permisos, hay que añadirlo aquí.
  { patron: /requestPermissionsAsync|applySchedule/, que: "el cuadro de permisos de Android" },
];

// Pantallas que abren otra app pero NO necesitan seguir abiertas al volver,
// porque su trabajo ya termino antes de salir.
const EXCEPCIONES = {
  // ExportPdfSheet estuvo aquí y era un error. El razonamiento era "comparte
  // el PDF cuando ya está generado, así que al volver no le queda nada por
  // hacer". Falso: lo que queda por hacer es SEGUIR AHÍ. Quien cierra el
  // menú de compartir sin elegir nada quiere volver a la pantalla de
  // exportar —con su mes, su formato y su selección puestos—, no aparecer
  // en Inicio y tener que empezar de cero.
  //
  // La lección: lo que importa no es si el trabajo termino, sino si la
  // persona esperaba seguir en esa pantalla. Antes de excusar una pantalla
  // aquí, hay que responder a eso y no a lo otro.
  // Comprobado: Ajustes abre la galería para la foto de perfil, y el guardado
  // ocurre DESPUES de volver. No se pierde porque Ajustes es una pestaña y
  // sigue montada aunque la app salte a Inicio, asi que compressPhoto y
  // onSaveProfile terminan igual. El unico efecto visible es acabar en
  // Inicio en vez de en Ajustes — molesto, no destructivo, y anadir la
  // pestana entera a la lista cambiaria como se comporta la app al volver
  // desde cualquier punto de Ajustes, que es mas de lo que arregla.
  "Settings.tsx":
    "la foto de perfil se guarda igual (la pestaña sigue montada); solo se acaba en Inicio",
};

function leer(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// --- 1. La lista tal como está hoy ---
const layout = leer(path.join(ROOT, "app/_layout.tsx"));
const match = layout.match(/const KEEP_ON_RETURN = \[([^\]]*)\]/);
if (!match) {
  console.log("FALLA  no se encontró KEEP_ON_RETURN en app/_layout.tsx");
  process.exit(1);
}
// Se quitan los comentarios ANTES de partir por comas: una lista con un
// comentario dentro producia entradas basura y una ruta de verdad se
// quedaba sin comprobar, con el auditor diciendo que si la habia mirado.
const sinComentarios = match[1].replace(new RegExp("//[^\\n]*", "g"), "");
const enLaLista = new Set(
  sinComentarios.split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean)
);

// --- 2. Qué ruta usa cada pantalla ---
// Se recorren los archivos de app/ y se mira qué pantalla importa cada uno.
const rutaDePantalla = new Map();
function recorrerRutas(dir, prefijo = "") {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Los grupos entre paréntesis, como (tabs), no forman parte de la ruta.
      const trozo = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`;
      recorrerRutas(rel, prefijo + trozo);
      continue;
    }
    if (!entry.name.endsWith(".tsx") || entry.name === "_layout.tsx") continue;
    const nombre = entry.name.replace(/\.tsx$/, "");
    const ruta = nombre === "index" ? prefijo || "/" : `${prefijo}/${nombre}`;
    const codigo = leer(path.join(ROOT, rel));
    for (const m of codigo.matchAll(/from "@\/screens\/([A-Za-z0-9_]+)"/g)) {
      rutaDePantalla.set(`${m[1]}.tsx`, ruta);
    }
  }
}
recorrerRutas("app");

// --- 3. Qué pantallas abren otra app ---
let fallos = 0;
const dirPantallas = path.join(ROOT, "screens");
for (const archivo of fs.readdirSync(dirPantallas).sort()) {
  if (!archivo.endsWith(".tsx")) continue;
  const codigo = leer(path.join(dirPantallas, archivo));

  const abre = ABREN_OTRA_APP.filter((r) => r.patron.test(codigo)).map((r) => r.que);
  if (abre.length === 0) continue;

  if (EXCEPCIONES[archivo]) {
    console.log(`  --    ${archivo.padEnd(24)} abre ${abre.join(" y ")} · excepción: ${EXCEPCIONES[archivo]}`);
    continue;
  }

  const ruta = rutaDePantalla.get(archivo);
  if (!ruta) {
    console.log(`  --    ${archivo.padEnd(24)} abre ${abre.join(" y ")} · no es una pantalla con ruta propia`);
    continue;
  }

  if (enLaLista.has(ruta)) {
    console.log(`  OK    ${archivo.padEnd(24)} abre ${abre.join(" y ")} · ${ruta} está en la lista`);
  } else {
    fallos++;
    console.log(
      `  FALLA ${archivo.padEnd(24)} abre ${abre.join(" y ")} pero ${ruta} NO está en KEEP_ON_RETURN:\n` +
      `        al volver, la pantalla se cerrará sola y se perderá lo que estuviera haciendo.`
    );
  }
}

// --- 4. Y al revés: rutas en la lista que ya no existen ---
const rutasReales = new Set(rutaDePantalla.values());
for (const ruta of enLaLista) {
  if (!rutasReales.has(ruta)) {
    console.log(`  --    ${ruta} está en la lista pero no se pudo comprobar (ruta sin pantalla propia)`);
  }
}

console.log(fallos === 0 ? "\nSin problemas" : `\n${fallos} pantallas se cerrarán solas`);
if (fallos) process.exitCode = 1;
