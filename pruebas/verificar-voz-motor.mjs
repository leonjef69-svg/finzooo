// LA VOZ CALLABA CON UN YAPEO REAL (11/08/2026)
//
// Reportado con la pantalla en la mano: se yapeo S/ 1, el aviso entro y quedo "Registrado",
// pero NO SONO NADA. Y al tocar "Probar la voz ahora", la primera vez salio "tu celular no
// tiene voz instalada" y la segunda funciono.
//
// Esa segunda vez es la pista entera: no le faltaba nada instalado. El sistema de voz de
// Android estaba FRIO, y frio contesta mal.
//
// LAS DOS MITADES DEL FALLO
//
//   1. El idioma se pedia UNA sola vez, al encender el motor — el instante en que peor
//      contesta. Un "no hay espanol" ahi se quedaba puesto PARA SIEMPRE, porque el motor del
//      servicio no se suelta nunca. La voz seguia hablandole a un motor sin idioma util.
//
//   2. Y no se miraba si el motor aceptaba la frase. El registro apuntaba "hablo" en cuanto
//      se mandaba el texto, sonara o no. La pantalla de diagnostico —la que existe justo para
//      esto— afirmaba que habia hablado con el celular mudo.
//
// SE MIRA EL CODIGO porque esto es Kotlin: no hay forma de correrlo aqui. Lo que se vigila no
// es una cuenta, es que las cuatro defensas sigan puestas.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const KT = "modules/notification-reader/android/src/main/java/com/finzo/notificationreader";
const leer = (f) =>
  fs
    .readFileSync(path.join(RAIZ, KT, f), "utf8")
    // Fuera los comentarios: las explicaciones de arriba nombran justo lo que se busca.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const probador = leer("ProbadorDeVoz.kt");
const servicio = leer("FinzoNotificationListener.kt");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- AL MOTOR SE LE PREGUNTA VARIAS VECES, NO UNA ---");
ok(/repeat\(INTENTOS_DE_IDIOMA\)/.test(probador), "ponerEspanol reintenta");
ok(/INTENTOS_DE_IDIOMA\s*=\s*([2-9]|\d\d)/.test(probador), "y mas de un intento");
ok(/Thread\.sleep\(\d+\)/.test(probador), "esperando entre intentos, que es de lo que se trata");

console.log("\n--- Y SE LE VUELVE A PREGUNTAR ANTES DE HABLAR ---");
{
  // Es la mitad que arregla el yapeo mudo: aunque al arrancar dijera que no hay espanol, al
  // llegar el aviso el motor lleva rato despierto y contesta bien.
  const cola = servicio.slice(servicio.indexOf("private fun vaciarCola"));
  ok(/idiomaListo/.test(cola), "vaciarCola mira si el idioma quedo puesto");
  ok(/ponerEspanol/.test(cola), "y lo vuelve a pedir si no");
  // Y el estado del idioma va APARTE del estado del motor. Juntos era el fallo: motor listo
  // sin idioma se daba por bueno.
  ok(/private var idiomaListo/.test(servicio), "el idioma tiene su propio estado, aparte del motor");
  ok(/idiomaListo = false/.test(servicio), "y se reinicia al soltar el motor");
}

console.log("\n--- SI EL MOTOR NO ACEPTA LA FRASE, SE DICE ---");
{
  const cola = servicio.slice(servicio.indexOf("private fun vaciarCola"));
  ok(/val resultado[\s\S]{0,200}speak\(/.test(cola), "se guarda lo que devuelve speak");
  ok(/resultado != TextToSpeech\.SUCCESS/.test(cola), "y se comprueba");
  ok(/anotarVoz\("no-sono"\)/.test(cola), 'se anota "no-sono" en vez de mentir con "hablo"');
  ok(/soltarVoz\(\)/.test(cola), "y se tira el motor, para que el siguiente aviso use uno nuevo");
}

console.log("\n--- AL PROBAR A MANO SE ESPERA LO QUE TARDA UN MOTOR FRIO ---");
{
  // Seis segundos se quedaban cortos con el celular recien encendido, y entonces la pantalla
  // acusaba de faltar algo que si estaba. Mandar a alguien a instalar lo que ya tiene es peor
  // que hacerle esperar.
  const espera = probador.match(/arranco\.await\((\d+), TimeUnit\.SECONDS\)/);
  ok(espera !== null, "la espera del arranque sigue teniendo un tope");
  ok(espera !== null && Number(espera[1]) >= 12, `y es de 12 segundos o mas (${espera?.[1]})`);
}

console.log(fallos === 0 ? "\nTodo bien: la voz no se queda muda en silencio" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
