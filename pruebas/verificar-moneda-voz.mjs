// EL CELULAR DECIA "ESE ENE UNO" (11/08/2026)
//
// Probando un yapeo de verdad: la voz leia el aviso bien, pero donde Yape escribe "S/ 1" el
// celular decia "S 1". Un simbolo no es una palabra, y el sistema de voz lo deletrea o se lo
// salta. Y no vale poner "soles" a secas: la app funciona en varios paises.
//
// LA LOGICA VIVE EN KOTLIN —la voz habla con Finzo cerrada, sin JavaScript— asi que aqui se
// hacen dos cosas distintas:
//
//   1. Se REESCRIBE la misma regla en JavaScript y se prueba con casos de verdad. No es
//      probar el codigo de Android, es probar la REGLA: que "S/ 1" sea "1 sol" y "S/ 50" sea
//      "50 soles". Si la regla esta mal aqui, esta mal alli.
//   2. Se comprueba que las dos listas de monedas —la de la app y la de Android— digan lo
//      mismo. Estan repetidas por obligacion, y una moneda añadida en un lado y no en el otro
//      volveria a deletrear el simbolo sin que nadie se enterara.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const KT = path.join(RAIZ, "modules/notification-reader/android/src/main/java/com/finzo/notificationreader");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

// La misma regla que MonedaEnVoz.kt, escrita aqui para poder correrla.
const MONEDAS = {
  PEN: { simbolos: ["S/.", "S/"], singular: "sol", plural: "soles" },
  USD: { simbolos: ["US$", "$"], singular: "dolar", plural: "dolares" },
  MXN: { simbolos: ["MX$", "$"], singular: "peso", plural: "pesos" },
  COP: { simbolos: ["COL$", "$"], singular: "peso", plural: "pesos" },
  ARS: { simbolos: ["AR$", "$"], singular: "peso", plural: "pesos" },
  CLP: { simbolos: ["CL$", "$"], singular: "peso", plural: "pesos" },
  BRL: { simbolos: ["R$"], singular: "real", plural: "reais" },
  EUR: { simbolos: ["€"], singular: "euro", plural: "euros" },
};

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function esUno(numero) {
  const partes = numero.split(/[.,]/);
  const entero = partes[0].replace(/^0+/, "") || "0";
  if (entero !== "1") return false;
  if (partes.length === 1) return true;
  return /^0+$/.test(partes[1]);
}

function conPalabras(texto, moneda) {
  const m = MONEDAS[moneda];
  if (!m) return texto;
  let salida = texto;
  for (const simbolo of [...m.simbolos].sort((a, b) => b.length - a.length)) {
    const patron = new RegExp(escapar(simbolo) + "\\s*(\\d+(?:[.,]\\d+)?)", "g");
    salida = salida.replace(patron, (_, numero) => `${numero} ${esUno(numero) ? m.singular : m.plural}`);
  }
  return salida;
}

console.log("\n--- EL AVISO DE YAPE, TAL COMO LLEGA ---");
{
  // El de verdad, copiado de su pantalla (sin el nombre).
  const aviso = "Confirmacion de Pago Yape! te envio un pago por S/ 1";
  const dicho = conPalabras(aviso, "PEN");
  ok(dicho.endsWith("1 sol"), `un sol, no "S 1" (${dicho.slice(-12)})`);
  ok(!dicho.includes("S/"), "y el simbolo desaparece del todo");
}

console.log("\n--- SINGULAR Y PLURAL ---");
{
  ok(conPalabras("S/ 1", "PEN") === "1 sol", "1 sol");
  ok(conPalabras("S/ 50", "PEN") === "50 soles", "50 soles");
  // "1.00" es uno igual. Se mira el numero escrito, no convertido: el separador decimal
  // cambia de pais y una conversion mal hecha diria "1 sol" donde hay 1,50.
  ok(conPalabras("S/ 1.00", "PEN") === "1.00 sol", `1.00 tambien es singular (${conPalabras("S/ 1.00", "PEN")})`);
  ok(conPalabras("S/ 1.50", "PEN") === "1.50 soles", `pero 1.50 no (${conPalabras("S/ 1.50", "PEN")})`);
  ok(conPalabras("S/ 0", "PEN") === "0 soles", "cero va en plural, como se dice");
}

console.log("\n--- LA PALABRA VA DETRAS DEL NUMERO ---");
{
  // En español el simbolo se escribe delante y se dice detras. Sustituir en el sitio daria
  // "soles 50", que suena a robot.
  const dicho = conPalabras("Te yapearon S/ 50 de Juan", "PEN");
  ok(dicho === "Te yapearon 50 soles de Juan", `queda natural (${dicho})`);
}

console.log("\n--- CADA PAIS LO SUYO ---");
{
  ok(conPalabras("MX$ 200", "MXN") === "200 pesos", "pesos en Mexico");
  ok(conPalabras("R$ 30", "BRL") === "30 reais", "reais en Brasil");
  ok(conPalabras("€ 5", "EUR") === "5 euros", "euros en España");
  ok(conPalabras("US$ 1", "USD") === "1 dolar", "un dolar, en singular");
  // Una moneda que no se conoce NO se toca. Antes que decir la palabra equivocada, callar.
  ok(conPalabras("S/ 1", "JPY") === "S/ 1", "una moneda desconocida se deja igual");
}

console.log("\n--- EL PUNTO DEL SIMBOLO NO SE QUEDA SUELTO ---");
{
  // Muchas boletas y avisos escriben "S/." Si se cambiara "S/" antes que "S/.", quedaria un
  // punto en medio de la frase y la voz haria una pausa rara.
  ok(conPalabras("S/. 20", "PEN") === "20 soles", `con punto tambien (${conPalabras("S/. 20", "PEN")})`);
}

console.log("\n--- Y SI NO HAY MONTO, NO SE INVENTA NADA ---");
{
  ok(conPalabras("Tu recarga fue exitosa", "PEN") === "Tu recarga fue exitosa", "un texto sin monto no cambia");
  // Una S/ suelta sin numero detras tampoco: sin cifra no hay nada que decir.
  ok(conPalabras("Paga con S/ en Yape", "PEN") === "Paga con S/ en Yape", "ni una S/ sin numero");
}

console.log("\n--- LAS DOS LISTAS DE MONEDAS DICEN LO MISMO ---");
{
  // Estan repetidas por obligacion: el servicio corre sin JavaScript. Una moneda añadida en
  // la app y no en Android volveria a deletrear el simbolo, y solo se notaria con un yapeo
  // real de ese pais — es decir, nunca desde aqui.
  const kotlin = fs.readFileSync(path.join(KT, "MonedaEnVoz.kt"), "utf8");
  const enKotlin = [...kotlin.matchAll(/"([A-Z]{3})" to Moneda/g)].map((m) => m[1]).sort();
  const app = fs.readFileSync(path.join(RAIZ, "constants/currencies.ts"), "utf8");
  const enApp = [...app.matchAll(/\{ id: "([A-Z]{3})"/g)].map((m) => m[1]).sort();

  ok(enApp.length > 0 && enKotlin.length > 0, `se leyeron las dos listas (app ${enApp.length}, Android ${enKotlin.length})`);
  const faltan = enApp.filter((c) => !enKotlin.includes(c));
  ok(faltan.length === 0, `ninguna moneda de la app le falta a la voz (${faltan.join(", ") || "ninguna"})`);
  const sobran = enKotlin.filter((c) => !enApp.includes(c));
  ok(sobran.length === 0, `y la voz no conoce monedas que la app no ofrece (${sobran.join(", ") || "ninguna"})`);
  // Y las de la prueba, que son la tercera copia.
  const enPrueba = Object.keys(MONEDAS).sort();
  ok(enPrueba.join() === enKotlin.join(), "y la lista de esta prueba va con las otras dos");
}

console.log("\n--- SE LE PASA AL SERVICIO, Y SE USA AL HABLAR ---");
{
  const listener = fs.readFileSync(path.join(KT, "FinzoNotificationListener.kt"), "utf8");
  ok(/MonedaEnVoz\.conPalabras\(texto, NotificationStore\.moneda\(/.test(listener), "el servicio lo aplica antes de hablar");
  // SOBRE EL TEXTO QUE SE DICE, NO SOBRE EL QUE SE GUARDA: en el registro de diagnostico
  // tiene que quedar el aviso tal como llego, o dejaria de servir para comparar.
  ok(!/anotarVoz\([^)]*conPalabras/.test(listener), "y no toca lo que se guarda en el registro");

  const contexto = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(/notificationReader\.setMoneda\(userCurrency\)/.test(contexto), "la app se la manda al servicio");
  ok(/\[userCurrency, ready\]/.test(contexto), "y se la vuelve a mandar si la cambia");
}

console.log(fallos === 0 ? "\nTodo bien: la voz dice la moneda, no la deletrea" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
