// ¿EL CELULAR VA A HABLAR CON ESTE AVISO?
//
// Esta prueba existe porque fallo en la vida real DOS veces, y no lo caza
// nada mas.
//
// LA SEGUNDA VEZ FALLO LA PRUEBA MISMA, Y ESO ES LO IMPORTANTE
//
// El aviso real de Yape —"Yape! JEFFERSON GIOVANNI LEON CARLOS te envio un
// pago por S/ 1"— se registro bien pero la voz callo. Y esta prueba decia
// que todo estaba OK.
//
// El motivo: el servicio esta escrito en Kotlin y la prueba lo imita en
// JavaScript. En JavaScript "\s" incluye el espacio DURO (el que impide que
// "S/" y el numero se partan en dos lineas); en Kotlin NO lo incluye. Asi
// que la prueba aceptaba un texto que el celular rechazaba: probaba una
// version mas permisiva que la de verdad.
//
// Por eso ahora la prueba:
//   1. Lee las reglas DEL PROPIO KOTLIN, sin copiarlas.
//   2. Y las traduce a las reglas de JAVA, no a las de JavaScript.
//
// Una prueba escrita en otro idioma que el codigo que prueba tiene que
// traducir tambien las diferencias del idioma. Si no, miente.
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

/** Saca la lista tal cual esta en el servicio, sin copiarla aqui. */
function listaDelKotlin(nombre) {
  const desde = kt.indexOf(`${nombre} = listOf(`);
  const bloque = kt.slice(desde, desde + kt.slice(desde).indexOf(")"));
  return [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Saca una expresion del Kotlin y la convierte a una que se comporte como
 * JAVA, no como JavaScript.
 *
 * En Java "\s" son SOLO estos seis caracteres. En JavaScript son esos y
 * ademas el espacio duro y una docena de espacios raros mas. Esa unica
 * diferencia es la que dejo la voz muda.
 */
function regexDelKotlin(nombre) {
  const linea = kt.slice(kt.indexOf(`${nombre} =`));
  const cruda = linea.slice(linea.indexOf('Regex("') + 7);
  const fuente = cruda.slice(0, cruda.indexOf('")'));
  const enJava = fuente.replace(/\\\\/g, "\\").replace(/\\s/g, "[ \\t\\n\\x0B\\f\\r]");
  return new RegExp(enJava);
}

const PALABRAS = listaDelKotlin("PALABRAS_DE_INGRESO");
const IGNORAR = listaDelKotlin("PALABRAS_A_IGNORAR");
const TIENE_MONTO = regexDelKotlin("TIENE_MONTO");
// Si el servicio no trae la regla de los espacios, se prueba tal cual: sin
// ella el texto llega con el espacio duro puesto, que es justo lo que dejaba
// muda la voz. Se busca a proposito que ESO salte como fallo, y no que la
// prueba reviente sin decir nada util.
const ESPACIOS = (() => {
  const trozo = kt.slice(kt.indexOf("ESPACIOS ="));
  const hallado = kt.includes("ESPACIOS =") && trozo.match(/Regex\("([^"]+)"\)/);
  if (!hallado) return null;
  return new RegExp(hallado[1].replace(/\\\\/g, "\\"), "g");
})();

/** La misma normalizacion que hace el Kotlin. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(ESPACIOS ?? /(?:)/g, ESPACIOS ? " " : "")
    .trim();
}

/** Lo que decide el servicio antes de hablar, en el mismo orden. */
function hablaria(texto, tambienSalidas = false) {
  const t = normalizar(texto);
  if (IGNORAR.some((p) => t.includes(p))) return false;
  if (!TIENE_MONTO.test(t)) return false;
  if (!tambienSalidas && !PALABRAS.some((p) => t.includes(p))) return false;
  return true;
}

const pareceIngreso = (texto) => hablaria(texto);

console.log(`\n  (${PALABRAS.length} palabras y la regla del monto, leidas del servicio)`);

console.log("\n--- LOS ESPACIOS QUE NO SON ESPACIOS ---");
{
  // ESTO es lo que fallo el 2 de agosto. Los tres textos se ven identicos en
  // pantalla; solo cambia que espacio hay entre "S/" y el numero.
  const DURO = "\u00a0"; // el que usa Yape para no partir el monto en dos lineas
  const FINO = "\u202f"; // otro que usan varias apps de banco

  ok(
    pareceIngreso(`MARIA te envió un pago por S/${DURO}20`),
    "espacio duro: se ve igual y antes dejaba muda la voz"
  );
  ok(pareceIngreso(`MARIA te envió un pago por S/${FINO}20`), "espacio fino, lo mismo");
  ok(pareceIngreso("MARIA te envió un pago por S/  20"), "dos espacios seguidos");
  ok(pareceIngreso("Te yapearon S/. 50.00 de Juan Pérez"), "con punto: S/. 50.00");
  ok(pareceIngreso("Te yapearon S / 50 de Juan"), "con el símbolo separado: S / 50");
}

console.log("\n--- EL AVISO QUE FALLO DE VERDAD ---");
{
  // Copiado de la captura del celular, palabra por palabra.
  const real = "Yape! JEFFERSON GIOVANNI LEON CARLOS te envió un pago por S/ 1";
  ok(pareceIngreso(real), `habla con: "${real}"`);

  // El servicio lee el CUERPO del aviso, no el titulo ("Confirmación de
  // Pago"). Es lo correcto: el titulo no dice ni quien ni cuanto, y ademas es
  // el mismo cuando pagas tu.
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
  "Te yapearon PEN 25.00 de Ana",
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

console.log("\n--- Y LA REGLA DEL MONTO TAMBIEN ---");
{
  // La voz y el registro tienen que estar de acuerdo en QUE es un monto. La
  // vez que no lo estuvieron, la app anoto el yapeo y el celular no dijo ni
  // pio — y eso, desde fuera, parece que la voz esta rota.
  const js = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");
  const delRegistro = new RegExp(js.match(/const withSymbol = text\.match\(\/(.+?)\/i\);/)[1], "i");

  const DURO = "\u00a0";
  for (const texto of [
    "te envió un pago por S/ 1",
    `te envió un pago por S/${DURO}1`,
    "te yapearon S/. 50.00",
    "te yapearon S/20",
    "te yapearon S / 20",
  ]) {
    const registra = delRegistro.test(texto.toLowerCase());
    const habla = TIENE_MONTO.test(normalizar(texto));
    ok(registra === habla, `los dos ven lo mismo en: "${texto.replace(DURO, "·")}"`);
  }
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
    "Hemos generado y autocompletado la clave",
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

console.log("\n--- EL SERVICIO DEJA DICHO POR QUE CALLO ---");
{
  // Sin esto, "no dijo nada" se ve igual con la voz apagada, con un monto no
  // reconocido o con un aviso tomado por un pago tuyo. Distinguirlos costo
  // un dia y un yapeo de verdad.
  for (const motivo of ["hablo", "apagado", "sin-monto", "es-salida", "no-es-movimiento", "sin-texto", "error"]) {
    ok(kt.includes(`anotarVoz("${motivo}")`), `anota el motivo "${motivo}"`);
  }

  const pantalla = fs.readFileSync(path.join(RAIZ, "screens/AutoCapture.tsx"), "utf8");
  ok(pantalla.includes("stats.lastSpeak"), "y la pantalla lo enseña");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
