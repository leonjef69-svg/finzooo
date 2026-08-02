// ¿EL CELULAR VA A HABLAR CON ESTE AVISO?
//
// Esta prueba existe porque fallo en la vida real y no lo caza nada mas.
//
// El aviso de Yape dice: "Yape! JEFFERSON GIOVANNI LEON CARLOS te envio un
// pago por S/ 1". El movimiento se registro bien —esa parte usa la lista de
// JavaScript, que si tiene "te envio"— pero la voz callo, porque la lista de
// Kotlin la escribi a mano y le faltaba justo esa frase.
//
// Un fallo que solo se veia haciendo un yapeo de verdad. Aqui se ve sin
// levantar el celular: se lee la lista DEL PROPIO KOTLIN y se prueba contra
// los textos tal como los manda cada app.
import fs from "fs";
import path from "path";

const RAIZ = "C:/Users/User/Videos/Fino control de gastos diarios/PresupuestoApp";
const KT = path.join(
  RAIZ,
  "modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt"
);

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const kt = fs.readFileSync(KT, "utf8");

// La lista tal cual esta en el servicio. Se lee del archivo y no se copia
// aqui: una copia se separa del original, que es exactamente lo que fallo.
const desde = kt.indexOf("PALABRAS_DE_INGRESO = listOf(");
const bloque = kt.slice(desde, desde + kt.slice(desde).indexOf(")"));
const PALABRAS = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// La misma normalizacion que hace el Kotlin: minusculas y sin tildes.
function normalizar(texto) {
  return texto
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u");
}

const bloqueIgnorar = kt.slice(kt.indexOf("PALABRAS_A_IGNORAR = listOf("));
const IGNORAR = [...bloqueIgnorar.slice(0, bloqueIgnorar.indexOf(")")).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** Lo que decide el servicio antes de hablar, en el mismo orden. */
function hablaria(texto, tambienSalidas = false) {
  const t = normalizar(texto);
  // 1. No es un movimiento: claves, promociones, encuestas.
  if (IGNORAR.some((p) => t.includes(p))) return false;
  // 2. Sin monto no hay movimiento.
  if (!/s\/\s?\d/.test(t)) return false;
  // 3. Solo lo que entra, salvo que se pidan tambien las salidas.
  if (!tambienSalidas && !PALABRAS.some((p) => t.includes(p))) return false;
  return true;
}

function pareceIngreso(texto) {
  return hablaria(texto);
}

console.log(`\n  (${PALABRAS.length} palabras leidas del servicio)`);

console.log("\n--- EL AVISO QUE FALLO DE VERDAD ---");
{
  // Copiado de la captura del celular, palabra por palabra.
  const real = "Yape! JEFFERSON GIOVANNI LEON CARLOS te envió un pago por S/ 1";
  ok(pareceIngreso(real), `habla con: "${real}"`);

  // El servicio lee el CUERPO del aviso, no el titulo ("Confirmación de
  // Pago"). Es lo correcto: el titulo no dice ni quien ni cuanto, y ademas es
  // el mismo cuando pagas tu. Lo que se dice en voz alta es la linea de
  // abajo, que es la que trae el nombre y el monto.
  ok(!pareceIngreso("Confirmación de Pago"), "el titulo solo no basta, y no debe bastar");
}

console.log("\n--- DINERO QUE ENTRA: TIENE QUE HABLAR ---");
for (const texto of [
  "Te yapearon S/ 50.00 de Juan Pérez",
  "Yapeo recibido de ROSA MARIA por S/ 40.00",
  "Te plinearon S/ 30",
  "Recibiste una transferencia de S/ 120.00",
  "Has recibido un abono de S/ 900",
  "Se depositaron S/ 1,500.00 en tu cuenta",
  "MARIA te envió un pago por S/ 20",
  "PEDRO te transfirió S/ 45",
  "Pago recibido por S/ 15",
]) {
  ok(pareceIngreso(texto), `"${texto.slice(0, 48)}"`);
}

console.log("\n--- DINERO QUE SALE: TIENE QUE CALLARSE ---");
{
  // Con "Tambien cuando pagas" apagado, que es como viene. Si hablara aqui,
  // el celular anunciaria lo que uno acaba de pagar delante de la cola.
  for (const texto of [
    "Yapeaste S/ 20.00 a Juan Pérez",
    "Pagaste S/ 35.00 en METRO",
    "Compra aprobada por S/ 89.90",
    "Consumo de S/ 12.00 con tu tarjeta",
    "Retiro de S/ 100.00 en cajero",
  ]) {
    ok(!pareceIngreso(texto), `calla con: "${texto.slice(0, 44)}"`);
  }
}

console.log("\n--- LA LISTA ES LA MISMA QUE LA DE JAVASCRIPT ---");
{
  // Son dos listas porque el servicio de Android no puede leer JavaScript.
  // Que digan lo mismo es lo unico que evita que la voz y el registro se
  // contradigan: uno anota el yapeo y el otro se queda callado.
  const js = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");
  const trozo = js.slice(js.indexOf("const INCOME_HINTS"), js.indexOf("// Salió dinero"));
  const enJs = [...trozo.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const faltan = enJs.filter((p) => !PALABRAS.includes(p));
  ok(faltan.length === 0, `ninguna palabra se quedo fuera del servicio${faltan.length ? ": " + faltan.join(", ") : ""}`);
}

console.log("\n--- LO QUE NO ES UN MOVIMIENTO: NO SE DICE ---");
{
  // El caso reportado: al confirmar el yapeo en la banca movil, el celular
  // leyo en voz alta "se ha autogenerado la clave". Yape manda ese aviso
  // pegado a CADA yapeo, y la app ya lo descartaba — la voz no lo miraba.
  //
  // Se comprueba con las salidas ENCENDIDAS, que es como lo tenia: sin ese
  // filtro, con ese interruptor la voz lee absolutamente todo.
  for (const texto of [
    "Operación en curso. Hemos generado y autocompletado la clave",
    "Tu código de verificación es 4821",
    "No compartas tu clave con nadie",
    "Participa en el sorteo de S/ 1000",
    "Tienes un préstamo preaprobado de S/ 5000",
  ]) {
    ok(!hablaria(texto, true), "calla con: " + texto.slice(0, 44));
  }
}

console.log("\n--- Y SIN MONTO TAMPOCO HABLA ---");
{
  ok(!hablaria("Tu estado de cuenta ya esta listo", true), "un aviso sin monto no es un movimiento");
  ok(!hablaria("Te yapearon", true), "ni uno que suene a ingreso pero no diga cuanto");
  ok(hablaria("Te yapearon S/ 50.00 de Juan", true), "con monto si");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
