/**
 * LOS DOS AVISOS DE GOOGLE PLAY, Y QUE NO VUELVAN (21/08/2026)
 *
 * El panel de Play decía dos cosas bajo "Para tu siguiente versión":
 *
 *  1. *"Tu aplicación usa APIs o parámetros obsoletos para la vista de extremo a extremo."*
 *  2. *"Quita las restricciones de redimensionamiento y orientación de tu aplicación para que
 *     sea compatible con dispositivos de pantalla grande."*
 *
 * Ninguno bloqueaba publicar, pero el segundo deja de ser opcional solo: **a partir de
 * Android 16 el sistema IGNORA la restricción de orientación en pantallas grandes**. O la app
 * está preparada para girar, o gira igual y se ve mal.
 *
 * Esta prueba mira el proyecto de Android, no el código de las pantallas. Es la única parte de
 * la app que no se puede comprobar mirando lo que se dibuja, y por eso es donde una regresión
 * pasaría inadvertida hasta que Google la señalara otra vez — semanas después.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let fallos = 0;
function ok(condicion, texto) {
  if (condicion) console.log(`  ok    ${texto}`);
  else {
    console.log(`  FALLA ${texto}`);
    fallos++;
  }
}

const app = JSON.parse(fs.readFileSync(path.join(RAIZ, "app.json"), "utf8")).expo;
const manifest = fs.readFileSync(
  path.join(RAIZ, "android/app/src/main/AndroidManifest.xml"),
  "utf8"
);
const estilos = fs.readFileSync(
  path.join(RAIZ, "android/app/src/main/res/values/styles.xml"),
  "utf8"
);

console.log("\n--- LA VISTA DE EXTREMO A EXTREMO, SIN APIS OBSOLETAS ---");
{
  ok(app.android?.edgeToEdgeEnabled === true, "la app dibuja de borde a borde");

  /* Estas dos son las que Google señalaba. Se buscan como ETIQUETA y no como texto suelto: el
     comentario del propio archivo las nombra para explicar por qué no están, y buscar el
     nombre a secas daría un falso positivo — que es como se acaba desactivando una prueba. */
  ok(
    !/<item name="android:statusBarColor"/.test(estilos),
    "nadie pinta la barra de estado: en borde a borde es transparente y debajo va la pantalla"
  );
  ok(
    !/<item name="android:navigationBarColor"/.test(estilos),
    "ni la barra de navegacion"
  );
  ok(
    !/<item name="android:enforceNavigationBarContrast"/.test(estilos),
    "ni se fuerza el contraste de la barra, que Android 15 ignora"
  );
}

console.log("\n--- LA APP GIRA Y SE ADAPTA A PANTALLAS GRANDES ---");
{
  ok(app.orientation === "default", 'app.json no ata la app a "portrait"');
  ok(
    !/android:screenOrientation="(portrait|landscape|sensorPortrait|userPortrait)"/.test(manifest),
    "y el manifiesto tampoco la ata"
  );
  ok(
    /android:resizeableActivity="true"/.test(manifest),
    "la ventana se puede redimensionar: es lo que piden las pantallas grandes y las ventanas partidas"
  );

  /* AL GIRAR NO SE PUEDE PERDER LO ESCRITO.
     Sin estos configChanges, Android DESTRUYE Y RECREA la pantalla en cada giro: quien
     estuviera escribiendo un movimiento a medias lo perdería. Ya estaban puestos, y por eso
     soltar la orientación es seguro; si alguien los quita, girar pasa a costar datos. */
  const cc = /android:configChanges="([^"]*)"/.exec(manifest)?.[1] ?? "";
  for (const cambio of ["orientation", "screenSize", "screenLayout"]) {
    ok(cc.includes(cambio), `girar no recrea la pantalla (configChanges incluye ${cambio})`);
  }
}

console.log("\n--- Y EL ANCHO SE VUELVE A MEDIR AL GIRAR ---");
{
  /* `Dimensions.get("window")` devuelve el ancho DE ESE INSTANTE. Guardado en una constante o
     leído fuera de un componente, al girar sigue diciendo el ancho de antes: los graficos se
     dibujarian con el ancho del retrato en horizontal, saliendose o dejando media pantalla
     vacia. `useWindowDimensions` se actualiza solo.

     Esto no daba problemas mientras la app estaba atada al retrato. Al soltarla, empieza a
     importar. */
  const archivos = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) recorrer(rel);
      else if (/\.tsx?$/.test(e.name)) archivos.push(rel);
    }
  };
  ["screens", "components", "app", "constants"].forEach(recorrer);

  const malos = [];
  for (const rel of archivos) {
    const txt = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    if (/Dimensions\.get\(/.test(txt)) malos.push(rel);
  }
  ok(
    malos.length === 0,
    `nadie mide la pantalla una sola vez${malos.length ? " — lo hacen: " + malos.join(", ") : ""}`
  );

  // Y que quien necesita el ancho lo pida bien.
  const reportes = fs.readFileSync(path.join(RAIZ, "screens/Reports.tsx"), "utf8");
  ok(
    /useWindowDimensions\(\)/.test(reportes),
    "los graficos piden el ancho con useWindowDimensions, que cambia al girar"
  );
}

console.log(
  fallos ? `\n${fallos} con problemas` : "\nTodo bien: sin APIs obsoletas y lista para girar"
);
process.exit(fallos ? 1 : 0);
