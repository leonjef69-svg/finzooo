// UN PDF PUEDE DEVOLVER MUCHÍSIMO TEXTO Y NINGUNA LETRA
//
// El 07/08/2026 el usuario subió su estado de cuenta DE VERDAD —una tarjeta de crédito de
// diciembre, bajado de su banca móvil— y le salió *"No se pudo leer el texto de este PDF"*.
// Preguntó lo correcto: *"no sé si fue lo correcto o tal vez importar movimientos no sirve
// para eso"*.
//
// Se probó ese archivo contra el extractor de la app y salieron **7.024 caracteres**. Texto
// había. Lo que no había era sentido: ese PDF escribe con tipografías propias (Identity-H),
// donde cada letra viaja como un número que hay que traducir con una tabla que el PDF
// debería traer. Sin traducir salen símbolos.
//
// SE MIDIÓ EL ARCHIVO REAL, y de ahí salen los números de este archivo:
//
//   · 7.024 caracteres extraídos
//   · **12%** de ellos letras o números ASCII
//   · **CERO** palabras reconocibles ("fecha", "saldo", "monto"...)
//
// Un PDF de texto normal pasa del 80% de ASCII y trae esas palabras por todas partes. Entre
// uno bueno y este no hay zona de duda: hay un abismo.
//
// Y APARECIERON DOS FALLOS, LOS DOS DE MENSAJES QUE MENTÍAN:
//
//   1. El diagnóstico decía **"escaneado"** —fotos de las páginas— porque el PDF traía una
//      imagen JPEG. Pero **todos** los estados de cuenta traen el logo del banco en JPEG,
//      así que cualquiera daba "escaneado". El suyo tenía cinco imágenes Y 7.024 caracteres
//      de texto.
//   2. Y la pantalla solo diagnosticaba cuando NO salía texto. Con texto ilegible lo daba
//      por bueno, el importador no encontraba columnas, y acababa saliendo el mensaje más
//      genérico de todos. La app tenía la respuesta y no la usaba.
//
// AQUÍ NO SE GUARDA SU ARCHIVO, Y ES A PROPÓSITO: es su estado de cuenta real, con su
// nombre, su número de tarjeta y sus compras, y este repositorio se sube a internet. Se
// reproduce la CONDICIÓN —texto con muy pocas letras reconocibles y ninguna palabra— sin
// ninguno de sus datos.
import { diagnosePdf, seEntiende } from "@/utils/pdfExtract";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

/** Texto como el que salía de su PDF: símbolos, con unas pocas letras sueltas. */
function comoElSuyo(): string {
  let s = "";
  // 88% de símbolos altos y 12% de letras, que es la proporción medida del archivo real.
  for (let i = 0; i < 900; i++) {
    s += i % 8 === 0 ? "abc"[i % 3] : String.fromCharCode(0xab + (i % 40));
    if (i % 12 === 0) s += " ";
  }
  return s;
}

/** Un PDF de mentira: solo lo que el diagnóstico mira, sin datos de nadie. */
function pdfDeMentira(partes: string[]): Uint8Array {
  const texto = "%PDF-1.4\n" + partes.join("\n") + "\n" + "x".repeat(300) + "\ntrailer\n%%EOF";
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff;
  return bytes;
}

const SIN_IMAGENES = pdfDeMentira(["/Type /Page"]);
const CON_LOGO = pdfDeMentira(["/Type /Page", "/Subtype /Image /Filter /DCTDecode"]);
const PROTEGIDO = pdfDeMentira(["/Type /Page", "/Encrypt 12 0 R"]);

console.log("\n--- SE ENTIENDE, O SON SÍMBOLOS SUELTOS ---");
{
  const suyo = comoElSuyo();
  const legibles = (suyo.replace(/\s/g, "").match(/[a-zA-Z0-9]/g) ?? []).length;
  const total = suyo.replace(/\s/g, "").length;
  console.log(`  (el texto de prueba tiene ${Math.round((legibles / total) * 100)}% de letras, como el real)`);

  ok(!seEntiende(suyo), "un texto de símbolos NO se entiende");

  // Y LO QUE SÍ TIENE QUE PASAR POR BUENO. Si esto se rompe, la app rechazaría estados de
  // cuenta que lee perfectamente, que es mucho peor que el fallo que se está arreglando.
  ok(
    seEntiende("Fecha Descripcion Monto\n01/12/2025 SUPERMERCADO 45.90\n02/12/2025 GRIFO 30.00"),
    "un estado de cuenta normal SÍ se entiende"
  );
  ok(seEntiende("Date Description Amount\n01/12/2025 STORE 45.90"), "y uno en ingles tambien");
  ok(seEntiende("Data Valor\n01/12/2025 LOJA 45,90"), "y uno en portugues");

  // Sin ninguna de las palabras conocidas, pero en letras normales: pasa por el porcentaje.
  // Es la mitad que cubre a un banco que escriba distinto —"F. Proceso" en vez de "Fecha"—:
  // sin esto le diriamos que su PDF no se entiende cuando si se entendia.
  ok(
    seEntiende("F. Proceso Detalle Cargo\n01/12 COMERCIO XYZ 45.90\n02/12 COMERCIO ABC 30.00"),
    "y uno que escribe distinto, por sus letras normales"
  );

  // Un texto cortísimo no se juzga: no hay con qué.
  ok(seEntiende("«¬­®"), "un texto de cuatro simbolos no se juzga");
}

console.log("\n--- EL DIAGNÓSTICO DICE LA VERDAD ---");
{
  const suyo = comoElSuyo();

  // EL FALLO PRINCIPAL: con logo Y texto, esto decia "escaneado".
  ok(
    diagnosePdf(CON_LOGO, suyo) === "sinLetras",
    "con logo y texto ilegible dice que las letras no se entienden, NO que sea escaneado"
  );
  ok(
    diagnosePdf(SIN_IMAGENES, suyo) === "sinLetras",
    "y sin imagenes, lo mismo"
  );

  // ESCANEADO DE VERDAD: imagen y NADA de texto. Es el unico caso en que ese mensaje
  // —"son fotos de las paginas"— es cierto.
  ok(diagnosePdf(CON_LOGO, "") === "scanned", "una imagen sin texto si es escaneado");

  // Y el logo NO puede convertir en escaneado a un PDF que se lee bien. Esta es la que
  // fallaba con su archivo.
  const buenTexto = "Fecha Descripcion Monto\n01/12/2025 SUPERMERCADO 45.90\n".repeat(8);
  ok(
    diagnosePdf(CON_LOGO, buenTexto) !== "scanned",
    "un PDF que se lee bien NO es escaneado por traer el logo del banco"
  );

  // La contraseña manda sobre todo lo demas: sin abrirlo no se puede saber nada mas.
  ok(diagnosePdf(PROTEGIDO, "") === "encrypted", "un PDF con contraseña se dice primero");
  ok(diagnosePdf(PROTEGIDO, suyo) === "encrypted", "y tambien si sale texto raro");
}

console.log("\n--- Y EL MENSAJE NUEVO, EN LOS TRES IDIOMAS ---");
{
  // Una clave que falte no da error: en pantalla sale el nombre de la clave.
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const i18n = fs.readFileSync(path.join(process.cwd(), "constants/i18n.ts"), "utf8");
  const veces = (i18n.match(/"importSheet\.pdfSinLetras":/g) ?? []).length;
  ok(veces === 3, `el mensaje esta en los tres idiomas (${veces})`);

  // Y la pantalla tiene que usarlo, o el mensaje nuevo no lo veria nadie.
  const pantalla = fs.readFileSync(path.join(process.cwd(), "screens/ImportSheet.tsx"), "utf8");
  ok(/importSheet\.pdfSinLetras/.test(pantalla), "y la pantalla lo usa");
  // LA MITAD QUE FALTABA: mirar tambien si SE ENTIENDE, no solo si salio algo.
  ok(
    /if \(!text\.trim\(\) \|\| !seEntiende\(text\)\)/.test(pantalla),
    "y comprueba si se entiende, no solo si salio texto"
  );
  ok(/diagnosePdf\(bytes, text\)/.test(pantalla), "y le pasa el texto al diagnostico");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
