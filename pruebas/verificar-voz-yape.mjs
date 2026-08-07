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

const RAIZ = process.cwd();
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

/**
 * Saca la lista tal cual esta en el servicio, sin copiarla aqui.
 *
 * SI NO LA ENCUENTRA, PARA LA PRUEBA. No devuelve una lista vacia, y eso importa: con
 * una lista vacia las comprobaciones seguian corriendo y PASABAN POR EL MOTIVO
 * EQUIVOCADO. Se vio el 07/08/2026 al probar la regla nueva contra la version anterior:
 * los anuncios salian callados, pero no porque el servicio los callara — era que sin
 * lista no habia ninguna palabra que reconocer y todo caia del mismo lado.
 *
 * Es exactamente la mentira que este archivo existe para evitar, esta vez dentro de la
 * propia prueba.
 */
function listaDelKotlin(nombre) {
  const desde = kt.indexOf(`${nombre} = listOf(`);
  if (desde < 0) {
    console.log(`  FALLA el servicio no tiene la lista ${nombre}`);
    console.log("\n1 FALLAS");
    process.exit(1);
  }
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
const SALIDAS = listaDelKotlin("PALABRAS_DE_SALIDA");
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
  // TIENE QUE DECIR SI EL DINERO ENTRA O SALE. Nuevo el 07/08/2026, y es la regla que
  // calla la publicidad de Yape. Ver la seccion de los anuncios mas abajo.
  const entra = PALABRAS.some((p) => t.includes(p));
  const sale = SALIDAS.some((p) => t.includes(p));
  if (!entra && !sale) return false;
  if (!entra && !tambienSalidas) return false;
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

console.log("\n--- LA REGLA DE LA DIRECCION ESTA EN EL SERVICIO, NO SOLO AQUI ---");
{
  // ESTA SECCION EXISTE POR UN FALLO DE LA PRUEBA, NO DEL CODIGO, Y ES LA TERCERA VEZ QUE
  // PASA EN ESTE ARCHIVO.
  //
  // Todo lo que hay debajo lo decide hablaria(), que es una IMITACION en JavaScript de lo
  // que hace el servicio en Kotlin. Al añadir la regla de la direccion el 07/08/2026 se
  // añadio a la imitacion... y las comprobaciones de la publicidad pasaban tambien contra
  // la version ANTERIOR del servicio. Claro: la regla estaba en la imitacion, no en el
  // celular.
  //
  // Una imitacion solo vale si alguien comprueba que se parece al original. Eso es esto:
  // se mira el Kotlin de verdad.
  const anunciar = kt.slice(kt.indexOf("private fun anunciar"), kt.indexOf("private fun anotarVoz"));
  ok(anunciar.length > 200, "se encuentra el codigo que decide si hablar");

  ok(/val entra = pareceIngreso\(limpio\)/.test(anunciar), "el servicio mira si el dinero ENTRA");
  ok(/val sale = pareceSalida\(limpio\)/.test(anunciar), "y si SALE");
  // La regla nueva: sin direccion no se habla. Es la que calla la publicidad.
  ok(
    /if \(!entra && !sale\) \{[\s\S]{0,120}return/.test(anunciar),
    "y si no dice ninguna de las dos cosas, se calla"
  );
  // Y EL AJUSTE DE LAS SALIDAS NO PUEDE SALTARSE ESA REGLA. Aqui estaba el fallo: la
  // comprobacion vieja era "si NO leo salidas y NO parece ingreso, callar", asi que al
  // encender las salidas la unica comprobacion que quedaba era la del monto — y cualquier
  // aviso de Yape con una cifra se leia en voz alta.
  ok(
    /if \(!entra && !NotificationStore\.isSpeakOutgoing/.test(anunciar),
    "el ajuste de las salidas ensancha la regla, no la apaga"
  );
  ok(
    !/if \(!NotificationStore\.isSpeakOutgoing\(applicationContext\) && !pareceIngreso/.test(anunciar),
    "y no queda la comprobacion vieja, que con ese ajuste dejaba pasar cualquier cosa"
  );
  // La funcion tiene que existir de verdad, o el Kotlin no compilaria — pero compilar se
  // comprueba aparte y tarda tres minutos, y esto tarda nada.
  ok(/private fun pareceSalida/.test(kt), "existe la funcion que reconoce una salida");
  ok(SALIDAS.length > 10, `y su lista trae ${SALIDAS.length} palabras`);
}

console.log("\n--- LA PUBLICIDAD DE YAPE SE QUEDA CALLADA ---");
{
  // EL CASO REPORTADO EL 07/08/2026: *"me llego una notificacion de Yape pero no era
  // alguien que me habia yapeado, sino un mensaje normal, ejemplo: sin dinero solicita tu
  // prestamo por S/2000 preaprobados pagalo en 6 cuotas"*.
  //
  // Ya habia una lista negra de palabras de anuncio desde el 02/08 ("preaprobado",
  // "solicita tu", "promocion", "sorteo") Y NO BASTO. Es una carrera que no se gana: Yape
  // puede redactar un anuncio de mil maneras y siempre lleva un monto.
  //
  // Lo que si se gana es al reves: pedir la señal de un movimiento DE VERDAD. Un anuncio
  // no dice "te envio" ni "pagaste". Es la misma regla que ya usaba el interprete de la
  // app —"noDirection"— y que la voz no miraba: otra vez dos mitades bien y el fallo en la
  // costura.
  //
  // TODO ESTO SE PRUEBA CON LAS SALIDAS ENCENDIDAS a proposito, que es el peor caso: con
  // ese interruptor, antes la unica comprobacion que quedaba era la del monto y la voz
  // leia absolutamente cualquier aviso de Yape con una cifra.
  for (const texto of [
    // Redactados SIN ninguna palabra de la lista negra, para que lo que los calle sea la
    // regla nueva y no la lista. Si alguien quita la regla, estos vuelven a hablar.
    "Tienes S/ 2000 listos para ti, elige en cuantas cuotas",
    "S/ 500 disponibles en tu Yape ahora mismo",
    "Aprovecha hasta S/ 3000 para lo que necesites",
    "Tu linea de credito llego a S/ 1200",
    "Paga tus servicios y acumula hasta S/ 50",
    // Y los que ya callaba la lista negra, que tienen que seguir callados.
    "Tienes un préstamo preaprobado de S/ 5000",
    "Participa en el sorteo de S/ 1000",
  ]) {
    ok(!hablaria(texto, true), `calla con: "${texto.slice(0, 46)}"`);
  }

  // Y LO DE LA FOTO SIGUE HABLANDO. Es la mitad que importa: apretar la regla no sirve de
  // nada si de paso deja muda la notificacion que el usuario SI quiere oir. Copiado de su
  // captura del 07/08/2026.
  const suyo = "Confirmación de Pago Yape! JEFFERSON GIOVANNI LEON CARLOS te envió un pago por S/ 20";
  ok(hablaria(suyo), `habla con el aviso de la foto: "...te envió un pago por S/ 20"`);
  ok(hablaria(suyo, true), "y tambien con las salidas encendidas");
}

console.log("\n--- LA LISTA DE SALIDAS ES LA MISMA QUE LA DE JAVASCRIPT ---");
{
  // El mismo motivo que con la de entradas, y la misma leccion: la de entradas se escribio
  // a mano "segun como suenan" los avisos, le faltaba "te envio", y la voz se quedaba muda
  // con los yapes de verdad mientras la app SI los registraba.
  //
  // Y aqui una lista corta duele el doble: si le falta una palabra, "leer tambien las
  // salidas" no reconoce esa salida y se queda muda justo en lo que se pidio encender.
  const js = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");
  const trozo = js.slice(js.indexOf("const EXPENSE_HINTS"), js.indexOf("const NOT_A_NAME"));
  const enJs = [...trozo.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  ok(enJs.length > 10, `se encontraron las ${enJs.length} palabras de salida de JavaScript`);
  const faltan = enJs.filter((p) => !SALIDAS.includes(p));
  ok(
    faltan.length === 0,
    `ninguna palabra de salida se quedo fuera del servicio${faltan.length ? ": " + faltan.join(", ") : ""}`
  );
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
  for (const motivo of ["hablo", "apagado", "sin-monto", "es-salida", "sin-direccion", "no-es-movimiento", "sin-texto", "error"]) {
    ok(kt.includes(`anotarVoz("${motivo}")`), `anota el motivo "${motivo}"`);
  }

  const pantalla = fs.readFileSync(path.join(RAIZ, "screens/AutoCapture.tsx"), "utf8");
  ok(pantalla.includes("stats.lastSpeak"), "y la pantalla lo enseña");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
