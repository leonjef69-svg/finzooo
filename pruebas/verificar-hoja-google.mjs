// LAS HOJAS DE GOOGLE SALIAN EN GRIS (12/08/2026)
//
// Pedido suyo: *"necesito el google sheet funcionando correctamente para probarlo"*.
//
// EL PRIMER INTENTO NO SIRVIO, Y LA LECCION ESTA EN POR QUE. Se escribio la conversion —una
// Hoja de Google no es un archivo, hay que pedirle a Drive que la convierta— y se anadieron sus
// formatos a la lista del selector. Todo correcto, y seguia en gris. El motivo era UNA linea
// dentro de la libreria expo-document-picker:
//
//     addCategory(Intent.CATEGORY_OPENABLE)
//
// Significa "enseñame solo lo que se pueda abrir como archivo", y una Hoja de Google no se
// puede. Con esa linea puesta, Drive la enseña en gris por mucho que se le pidan sus formatos:
// la lista de tipos no pinta nada. La conversion estaba bien y no llegaba a ejecutarse NUNCA.
//
// Por eso Fino abre ahora esa pantalla el mismo, sin esa categoria. Y de paso se quito un
// bloqueo de la libreria que le costo la noche a el: guarda "hay una eleccion en curso" y si
// Android no le devuelve el resultado —puede matar la pantalla mientras el selector esta
// abierto— se queda trabada para siempre, y el boton deja de responder sin decir nada.
//
// Lo que vigila esta prueba, por orden de gravedad:
//
//   1. Que el selector se abra SIN esa categoria. Es lo unico que hace que la hoja se pueda
//      tocar; sin ello todo lo demas es decorado.
//   2. Que ningun fallo sea mudo. Un boton que no reacciona no se puede diagnosticar ni
//      contando lo que se ve.
//   3. Que la conversion siga ahi y prefiera CSV.
//   4. Que en apps viejas no se ofrezcan hojas que no se van a poder abrir.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
// Sin esto la prueba se lee a si misma: los comentarios del codigo nombran justo las piezas que
// se estan buscando, y todo pasaria aunque no hubiera nada escrito.
//
// SOLO SE QUITAN LOS BLOQUES QUE EMPIEZAN UNA LINEA, y no es un detalle. Buscando "/*" en
// cualquier posicion, el texto "*/*" —que aparece en el codigo, es como se le pide a Android
// "cualquier formato"— se toma por el final de un comentario y se borra el codigo que hay en
// medio. Paso el 12/08/2026: la comprobacion mas importante de esta prueba, la de
// CATEGORY_OPENABLE, pasaba porque el trozo donde habria estado ya no existia. Una prueba en
// verde por haber perdido lo que iba a mirar es peor que no tenerla.
const sinComentarios = (f) =>
  leer(f).replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*(\/\/|rem ).*$/gim, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const KOTLIN = "modules/incoming-file/android/src/main/java/com/finzo/incomingfile/IncomingFileModule.kt";
const PANTALLA = "screens/ImportSheet.tsx";
const PUENTE = "modules/incoming-file/index.ts";

console.log("\n--- EL SELECTOR LO ABRE FINO, SIN CATEGORY_OPENABLE ---");
{
  const kotlin = sinComentarios(KOTLIN);
  ok(/Intent\(Intent\.ACTION_OPEN_DOCUMENT\)/.test(kotlin), "Fino abre la pantalla de elegir archivo");

  // ESTA ES LA COMPROBACION QUE IMPORTA. Si alguien anade esta linea "para hacerlo como la
  // libreria", las Hojas de Google vuelven a salir en gris y no hay ningun otro sintoma.
  ok(!/CATEGORY_OPENABLE/.test(kotlin), "y NO le pone CATEGORY_OPENABLE (eso las dejaba en gris)");

  ok(/EXTRA_MIME_TYPES, TIPOS_QUE_SE_OFRECEN/.test(kotlin), "se le pasan los formatos aceptados");
  ok(/vnd\.google-apps\.spreadsheet/.test(kotlin), "y entre ellos las Hojas de Google");

  // NO PUEDE QUEDARSE TRABADO. Si llega una peticion nueva con otra a medias, la vieja se da
  // por cancelada. Un boton que deja de responder no se arregla desde la app: hay que
  // reinstalar, y nadie sabe que ese es el remedio.
  ok(/eligiendo\?\.resolve\(cancelado\(\)\)/.test(kotlin),
    "una eleccion a medias no bloquea la siguiente");
}

console.log("\n--- EL PERMISO SOBRE EL ARCHIVO DURA (13/08/2026) ---");
{
  // Le salio "SecurityException" con un archivo que acababa de elegir. El permiso que da la
  // pantalla de elegir vive lo que viva la pantalla que la abrio, y Android recicla pantallas
  // cuando le falta memoria —su celular lo hace rapido, y con el selector abierto encima—. Al
  // volver, el archivo que acababa de elegir a proposito ya no se podia ni abrir.
  const kotlin = sinComentarios(KOTLIN);
  ok(/FLAG_GRANT_PERSISTABLE_URI_PERMISSION/.test(kotlin), "se pide un permiso que dure");
  ok(/takePersistableUriPermission/.test(kotlin), "y se toma al recibir el archivo");

  // ANTES DE COPIAR NADA. Es el momento en que Android lo esta ofreciendo; unos milisegundos
  // despues, ya dentro del hilo que copia, puede ser tarde.
  ok(
    kotlin.indexOf("takePersistableUriPermission") < kotlin.indexOf("Thread {"),
    "y se toma antes de ponerse a copiar"
  );

  // Y SE DICE EN QUE FORMATO QUEDO DE VERDAD, sea el preferido o el de respaldo. Con el
  // respaldo se dejaba en blanco, asi que un PDF traido de Drive acababa en el lector de texto
  // y no salia nada: el fallo aparecia mas tarde y en otro sitio.
  ok(/\.put\("convertido", pedido\)/.test(kotlin), "y se dice en que formato quedo de verdad");
}

console.log("\n--- NINGUN FALLO ES MUDO ---");
{
  const kotlin = sinComentarios(KOTLIN);
  const pantalla = sinComentarios(PANTALLA);
  const puente = sinComentarios(PUENTE);

  ok(/put\("error", motivo\)/.test(kotlin), "el motivo del fallo viaja hasta la pantalla");
  ok(/estado === "error"/.test(pantalla), "la pantalla lo distingue de cancelar");
  ok(/\$\{elegido\.motivo\}/.test(pantalla), "y lo enseña");
  ok(/catch \(e\) \{[\s\S]{0,120}showToastAndClose/.test(pantalla),
    "y si revienta algo inesperado, tambien avisa");
  ok(/estado: "cancelado"/.test(puente), "cancelar no cuenta como fallo");
}

console.log("\n--- LA CONVERSION SIGUE AHI ---");
{
  const kotlin = sinComentarios(KOTLIN);
  ok(/getStreamTypes\(uri, "\*\/\*"\)/.test(kotlin), "se pregunta a Drive que formatos tiene");
  ok(/openTypedAssetFileDescriptor\(uri, pedido/.test(kotlin), "y se le pide el que sirve");

  // SI NINGUNO ES DE LOS BUENOS, SE INTENTA CON EL PRIMERO QUE HAYA. Un formato raro que quiza
  // no se lea es mejor que rendirse: si sale mal se ve, y rendirse deja sin nada y sin motivo.
  ok(/val pedido = elegido \?: disponibles\.first\(\)/.test(kotlin),
    "y si ninguno sirve, se intenta igual con el que ofrezca");

  // CADA FALLO DICE CUAL FUE. "No se pudo leer" a secas costo una entrega entera: no distingue
  // entre que Drive no ofrezca nada, que ofrezca formatos inutiles o que la conversion salga
  // vacia, y son tres arreglos distintos.
  for (const motivo of ["drive-no-ofrece-nada", "conversion-vacia", "drive-no-lo-abre"]) {
    ok(kotlin.includes(motivo), `el fallo "${motivo}" se distingue de los demas`);
  }

  // PRIMERO EL CAMINO NORMAL. Un CSV o un PDF no tienen nada que convertir.
  ok(kotlin.indexOf("copyToCache(uri") < kotlin.indexOf("getStreamTypes"),
    "un archivo normal se copia y ya, sin pasar por Drive");

  const formatos = kotlin.match(/FORMATOS_QUE_SIRVEN = listOf\(([\s\S]*?)\)/);
  ok(formatos != null, "la lista de formatos aceptados existe");
  if (formatos) {
    const lista = formatos[1];
    // CSV ANTES QUE EXCEL. Los dos valen; el CSV es texto plano y pesa mucho menos.
    ok(lista.indexOf("text/csv") < lista.indexOf("spreadsheetml"), "se prefiere CSV antes que Excel");
    // El PDF no esta entre los PREFERIDOS: una tabla convertida en PDF se lee muchisimo peor
    // que la tabla. Pero si es lo unico que Drive ofrece se pide igual —le paso a el—, porque
    // leerlo peor es mejor que no leerlo.
    ok(!lista.includes("application/pdf"), "el PDF no es de los preferidos");
  }

  // UN ARCHIVO VACIO NO ES UNA HOJA. Es una conversion que fallo sin avisar, y dejarla pasar
  // acabaria en "el archivo esta vacio" — un error que manda a mirar donde no es.
  ok(/length\(\) == 0L/.test(kotlin), "una conversion que sale vacia se trata como fallo");

  // Y LA COPIA NO VA EN EL HILO DE LA PANTALLA. Una hoja grande se descarga entera de Drive:
  // hacerlo delante dejaria la app congelada, que es justo el sintoma que se estaba arreglando.
  ok(/Thread \{/.test(kotlin), "la descarga no congela la pantalla");
}

console.log("\n--- EN APPS VIEJAS NO SE OFRECE LO QUE NO SE PUEDE ABRIR ---");
{
  // Las actualizaciones por internet cambian la pantalla pero NO la parte de Android. Ahi manda
  // la libreria, con su CATEGORY_OPENABLE: ofrecer una Hoja de Google seria prometer algo que
  // esa version no puede cumplir.
  const pantalla = sinComentarios(PANTALLA);
  const lista = pantalla.match(/const FORMATOS = \[([\s\S]*?)\]/);
  ok(lista != null && !lista[1].includes("google-apps"),
    "la lista de la libreria no incluye documentos de Google");
  ok(/if \(!puedeElegirArchivo\)/.test(pantalla), "y se usa solo cuando no hay nada mejor");

  const puente = sinComentarios(PUENTE);
  ok(/elegirArchivo\?:/.test(puente), "la funcion nativa se declara opcional");
  ok(/typeof Native\?\.elegirArchivo === "function"/.test(puente),
    "y se comprueba de verdad que este, no que la app sea Android");

  // Y SE VE EN INFORMACION. Sin esto no hay forma de saber si un APK trae esta parte, y se
  // acaba buscando el fallo donde no esta — pasó el 12/08/2026, dos veces.
  ok(/puedeElegirArchivo \? "✓" : "✗"\} hojas de Google/.test(leer("screens/AppInfo.tsx")),
    "y se ve en la pantalla de Informacion");
}

console.log("\n--- EL NOMBRE CONVERTIDO LLEVA EXTENSION ---");
{
  // Una Hoja de Google se llama "Mis gastos", sin extension. Y de la extension depende que se
  // lea como texto o como hoja de calculo: sin ponersela, un CSV recien convertido se intentaria
  // abrir como Excel y no saldria ni un movimiento.
  const pantalla = sinComentarios(PANTALLA);
  ok(/EXTENSION_CONVERTIDA/.test(pantalla), "hay una tabla de extensiones");
  ok(/"text\/csv": "\.csv"/.test(pantalla), "un CSV convertido se llama .csv");
  ok(/spreadsheetml\.sheet": "\.xlsx"/.test(pantalla), "y un Excel convertido se llama .xlsx");

  // Y AL ELEGIR NO SE SUPONE PDF. El respaldo de compartir es "estado-de-cuenta.pdf" —alli un
  // archivo sin nombre casi seguro es el extracto de un banco— pero aqui puede ser cualquier
  // cosa, y llamar PDF a una hoja la manda al lector equivocado.
  ok(/displayName\(uri, "archivo"\)/.test(sinComentarios(KOTLIN)),
    "al elegir, un archivo sin nombre no se toma por un PDF");
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
