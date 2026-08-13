// LAS HOJAS DE GOOGLE SALIAN EN GRIS (12/08/2026)
//
// Pedido suyo: *"necesito el google sheet funcionando correctamente para probarlo"*. Al importar
// movimientos, sus hojas de calculo de Google no se podian ni tocar.
//
// EL MOTIVO NO ERA UNA LISTA CORTA DE FORMATOS. Una Hoja de Google NO ES UN ARCHIVO: vive dentro
// de Drive en un formato propio y no hay bytes que leer. Anadirla a la lista del selector y nada
// mas habria sido peor que dejarla en gris — se podria elegir, y al elegirla la libreria intenta
// copiarla con openInputStream, falla, y se lleva por delante la eleccion entera.
//
// Por eso hay codigo nativo: hay que preguntarle a Drive en que formatos ofrece ese documento y
// pedirselo convertido. Son dos llamadas de Android que no existen en JavaScript.
//
// Lo que vigila esta prueba, por orden de gravedad:
//
//   1. Que la conversion siga ahi. Sin ella, todo lo demas sobra.
//   2. Que la libreria NO copie por su cuenta. Si alguien devuelve copyToCacheDirectory a true,
//      las hojas vuelven a romperse — y encima calladas, porque el resto seguiria funcionando.
//   3. Que los formatos de Google solo se ofrezcan si la app sabe convertirlos. Esto protege a
//      quien tenga la pantalla nueva sobre una app vieja: las actualizaciones por internet no
//      cambian la parte de Android.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
// Sin esto la prueba se lee a si misma: los comentarios de ahi arriba nombran justo las piezas
// que se estan buscando, y todo pasaria aunque el codigo estuviera vacio.
const sinComentarios = (f) =>
  leer(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const KOTLIN = "modules/incoming-file/android/src/main/java/com/finzo/incomingfile/IncomingFileModule.kt";
const PANTALLA = "screens/ImportSheet.tsx";

console.log("\n--- SE LE PIDE A DRIVE EL DOCUMENTO CONVERTIDO ---");
{
  const kotlin = sinComentarios(KOTLIN);
  ok(/getStreamTypes\(uri, "\*\/\*"\)/.test(kotlin), "se pregunta a Drive que formatos tiene");
  ok(/openTypedAssetFileDescriptor\(uri, elegido/.test(kotlin), "y se le pide el que sirve");
  ok(/AsyncFunction\("traerArchivo"\)/.test(kotlin), "y la pantalla puede llamarlo");

  // PRIMERO EL CAMINO NORMAL. Un CSV o un PDF no tienen nada que convertir: si se empezara por
  // preguntarle a Drive, cada importacion de las de siempre daria un rodeo para nada.
  const orden = kotlin.indexOf("copyToCache(uri") < kotlin.indexOf("getStreamTypes");
  ok(orden, "un archivo normal se copia y ya, sin pasar por Drive");

  // CSV ANTES QUE EXCEL. Los dos valen; el CSV es texto plano y pesa mucho menos.
  const formatos = kotlin.match(/FORMATOS_QUE_SIRVEN = listOf\(([\s\S]*?)\)/);
  ok(formatos != null, "la lista de formatos aceptados existe");
  if (formatos) {
    const lista = formatos[1];
    ok(
      lista.indexOf("text/csv") < lista.indexOf("spreadsheetml"),
      "se prefiere CSV antes que Excel"
    );
    // Drive tambien ofrece PDF de una hoja de calculo. Una tabla convertida en PDF se lee
    // muchisimo peor que la tabla, y aqui hay tabla: aceptarlo seria elegir el peor camino
    // teniendo el bueno delante.
    ok(!lista.includes("application/pdf"), "y no se acepta el PDF de una hoja de calculo");
  }

  // UN ARCHIVO VACIO NO ES UNA HOJA. Es una conversion que fallo sin avisar, y dejarla pasar
  // acabaria en "el archivo esta vacio" — un error que manda a mirar donde no es.
  ok(/length\(\) == 0L/.test(kotlin), "una conversion que sale vacia se trata como fallo");
}

console.log("\n--- Y LA LIBRERIA NO COPIA POR SU CUENTA ---");
{
  const pantalla = sinComentarios(PANTALLA);
  ok(
    /copyToCacheDirectory: !puedeTraerArchivos/.test(pantalla),
    "copyToCacheDirectory ya no va fijo en true"
  );
  ok(/traerArchivo\(asset\.uri\)/.test(pantalla), "la copia la hace Fino");
  ok(/showToastAndClose\(t\("importSheet\.unreadable"\)\)/.test(pantalla), "y si no se puede, avisa");
}

console.log("\n--- LOS FORMATOS DE GOOGLE SOLO SI SE PUEDEN ABRIR ---");
{
  // Una actualizacion por internet cambia la pantalla pero NO la parte de Android. Ofrecer una
  // Hoja de Google a quien no puede convertirla es prometer algo que la app no sabe cumplir.
  const pantalla = sinComentarios(PANTALLA);
  const condicional = /puedeTraerArchivos[\s\S]{0,120}vnd\.google-apps\.spreadsheet/.test(pantalla);
  ok(condicional, "las hojas de Google solo se ofrecen si la app sabe convertirlas");

  const puente = sinComentarios("modules/incoming-file/index.ts");
  ok(/traerArchivo\?:/.test(puente), "la funcion nativa se declara opcional");
  ok(
    /typeof Native\?\.traerArchivo === "function"/.test(puente),
    "y se comprueba de verdad que este, no que la app sea Android"
  );
}

console.log("\n--- EL NOMBRE CONVERTIDO LLEVA EXTENSION ---");
{
  // Una Hoja de Google se llama "Mis gastos", sin extension. Y de la extension depende que se
  // lea como texto o como hoja de calculo: sin ponersela, un CSV recien convertido se intentaria
  // abrir como Excel y no saldria ni un movimiento.
  const pantalla = sinComentarios(PANTALLA);
  ok(/EXTENSION_CONVERTIDA/.test(pantalla), "hay una tabla de extensiones");
  ok(/"text\/csv": "\.csv"/.test(pantalla), "un CSV convertido se llama .csv");
  ok(
    /spreadsheetml\.sheet": "\.xlsx"/.test(pantalla),
    "y un Excel convertido se llama .xlsx"
  );
}

console.log("\n--- EL AVISO ESTA EN LOS TRES IDIOMAS ---");
{
  const i18n = leer("constants/i18n.ts");
  const veces = (i18n.match(/"importSheet\.unreadable":/g) ?? []).length;
  ok(veces === 3, `importSheet.unreadable esta en los tres idiomas (${veces})`);
  // Y DICE QUE HACER. "No se pudo abrir" a secas deja tirado a quien acaba de elegir el archivo
  // a proposito; descargar la hoja como CSV desde Google es la salida y cuesta dos toques.
  ok(/Hoja de Google, ábrela y descárgala como CSV/.test(i18n), "y dice como salir del paso");
}

console.log(fallos === 0 ? "\nTodo bien: una Hoja de Google se puede importar" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
