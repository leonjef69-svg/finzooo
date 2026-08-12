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

// ---------------------------------------------------------------------------------------
// Y AHORA LO QUE TODAVIA NO HABIA FALLADO, PERO PODIA (11/08/2026)
//
// Pedido asi: *"la voz siempre debe hablar cuando llegue la notificacion de yape, no quiero
// problemas a futuro... preveen los problemas que puedan suceder"*.
//
// El motor de voz de Android no es parte de Fino: es un servicio aparte que el sistema
// enciende, apaga y mata cuando le hace falta memoria. Todo lo de aqui abajo son formas de
// quedarse mudo QUE NO DAN NINGUN ERROR — que son las peores, porque nadie las busca.
// ---------------------------------------------------------------------------------------

console.log("\n--- SI EL MOTOR NO LLEGA A ARRANCAR, SE ENCIENDE OTRO ---");
{
  // Android promete llamar de vuelta cuando el motor esta listo, y a veces no llama. El motor
  // quedaba creado pero nunca listo, y prepararVoz se corta en seco cuando ya hay uno: no se
  // volvia a intentar JAMAS. Muda para siempre, sin un solo error.
  ok(/vigilarArranque/.test(servicio), "hay un vigilante del arranque");
  ok(/postDelayed\(vigilarArranque/.test(servicio), "que salta si tarda demasiado");
  ok(/removeCallbacks\(vigilarArranque\)/.test(servicio), "y se cancela cuando si arranca");
}

console.log("\n--- SI EL MOTOR SE MUERE A MITAD, SE REEMPLAZA SIN PERDER EL AVISO ---");
{
  const rec = servicio.slice(servicio.indexOf("private fun reencender"));
  ok(/private fun reencender/.test(servicio), "se puede encender un motor de repuesto");
  ok(/val pendientes = ArrayList\(porDecir\)/.test(rec), "guardando lo que estaba por decir");
  ok(/porDecir\.addAll\(pendientes\)/.test(rec), "y devolviendolo a la cola del motor nuevo");
  // El yapeo que fallo se vuelve a poner el PRIMERO, no se tira.
  ok(/porDecir\.addFirst\(frase\)/.test(servicio), "el aviso que fallo se reintenta, no se pierde");
  // Con tope, para no dar vueltas eternas si de verdad no hay voz instalada...
  ok(/MAX_REENCENDIDOS/.test(servicio), "con un tope de intentos");
  // ...pero el tope se reinicia al hablar bien: tres fallos repartidos en meses no pueden
  // dejar la voz apagada para siempre.
  ok(/reencendidos = 0/.test(servicio), "que se reinicia en cuanto suena bien una vez");
}

console.log("\n--- 'HABLO' SOLO CUANDO EL MOTOR EMPIEZA A HABLAR ---");
{
  // Que speak diga SUCCESS significa "acepto el encargo", no "se oyo". Entre una cosa y otra
  // el motor puede morirse. El diagnostico tiene que decir la verdad o manda a buscar el
  // fallo donde no esta — que es lo que paso anoche.
  ok(/UtteranceProgressListener/.test(servicio), "se escucha al motor mientras habla");
  const escucha = servicio.slice(servicio.indexOf("private fun escucharAlMotor"));
  ok(/override fun onStart[\s\S]{0,200}anotarVoz\("hablo"\)/.test(escucha), '"hablo" lo pone onStart');
  ok(/override fun onError[\s\S]{0,200}anotarVoz\("no-sono"\)/.test(escucha), 'y onError pone "no-sono"');
  // Las DOS onError: Android llama a la vieja en unas versiones y a la nueva en otras. Con
  // una sola, en la mitad de los celulares el fallo pasaria en silencio.
  const cuantasOnError = (escucha.match(/override fun onError/g) ?? []).length;
  ok(cuantasOnError >= 2, `las dos formas de onError, vieja y nueva (${cuantasOnError})`);
  // Y al encolar ya no se miente diciendo "hablo".
  ok(/anotarVoz\("en-cola"\)/.test(servicio), 'al encolar se apunta "en-cola", no "hablo"');
}

console.log("\n--- LA COLA NO CRECE SIN FIN ---");
{
  // Un motor que no arrancara nunca iria dejando una frase por yapeo dentro de un servicio del
  // sistema que puede pasar dias encendido.
  ok(/MAX_EN_COLA/.test(servicio), "la cola tiene tope");
  ok(/while \(porDecir\.size >= MAX_EN_COLA\) porDecir\.removeFirst\(\)/.test(servicio), "y tira los avisos mas viejos, no los nuevos");
}

console.log("\n--- EL VOLUMEN DE AVISOS EN CERO SE APUNTA ---");
{
  // El canal de avisos va aparte del de la musica: el celular puede sonar bien con la musica y
  // tener los avisos en cero. La voz habla de verdad y no se oye, y desde fuera se ve igual
  // que un motor roto. No se corta por esto —puede haber un auricular— pero se deja dicho.
  ok(/volumenDeAvisos\(applicationContext\) == 0/.test(servicio), "se mira el volumen antes de hablar");
  ok(/anotarVoz\("sin-volumen"\)/.test(servicio), "y se apunta para que la pantalla lo señale");
}

console.log(fallos === 0 ? "\nTodo bien: la voz no se queda muda en silencio" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
