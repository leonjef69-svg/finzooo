// DICTAR VARIAS COSAS SEGUIDAS
//
// Pedido el 07/08/2026: *"el microfono no esta registrando correctamente los ingresos y
// gastos cuando hablo rapido y tampoco entender correctamente al momento de hablarle,
// le digo varias cosas por ejemplo gaste 10 salchiapap, 10 mandarina, 10 tenedor, 10
// papel, 10 cuchara y mas"*.
//
// Eran DOS fallos distintos con el mismo sintoma, y hay que proteger los dos:
//
//   1. La frase no le llegaba completa al interprete. Android cierra lo dicho POR
//      TROZOS, y la pantalla reemplazaba cada trozo con el siguiente y se cerraba en el
//      primero. De cinco compras quedaba una. Eso se vigila leyendo la pantalla.
//   2. El interprete, con la frase completa, tenia sus propios errores: contaba las
//      CANTIDADES como si fueran dinero ("10 en 2 mandarinas" inventaba un gasto de
//      S/ 2) y las HORAS tambien ("a las 5" inventaba uno de S/ 5). Eso se vigila
//      haciendolo hablar de verdad.
//
// La parte del interprete son frases, no lectura de codigo, porque lo que importa es el
// resultado. La parte de la pantalla no se puede hacer hablar desde Node, asi que se
// leen las propiedades del codigo que hacen que funcione — igual que en la prueba de
// los yapes seguidos.
import fs from "fs";
import path from "path";
import { parseVoice } from "@/utils/voiceParser";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

// Un dia fijo: si la fecha saliera del reloj, las pruebas de "ayer" fallarian solas
// al cambiar el dia.
const AHORA = new Date(2026, 7, 7);

/** Lo entendido, en corto: "-10 mandarinas" por movimiento. */
function dictar(frase: string): string[] {
  const r = parseVoice(frase, AHORA);
  if (!r.ok) return ["NO:" + r.reason];
  return r.rows.map((x) => `${x.type === "income" ? "+" : "-"}${x.amount} ${x.description}`);
}

console.log("\n--- LA FRASE DEL USUARIO, TAL CUAL ---");
{
  // Las cinco, con su monto y su nombre. Ni una menos: perder la ultima de una lista
  // sin avisar es el fallo que este archivo existe para que no vuelva.
  const esperado = ["-10 salchipapa", "-10 mandarina", "-10 tenedor", "-10 papel", "-10 cuchara"];

  const conComas = dictar("gasté 10 salchipapa, 10 mandarina, 10 tenedor, 10 papel, 10 cuchara");
  ok(conComas.join(" | ") === esperado.join(" | "), `con comas: ${conComas.join(" | ")}`);

  // Y sin comas, que es como lo escribe Android cuando no pone puntuacion.
  const sinComas = dictar("gasté 10 salchipapa 10 mandarina 10 tenedor 10 papel 10 cuchara");
  ok(sinComas.join(" | ") === esperado.join(" | "), `sin comas: ${sinComas.join(" | ")}`);

  // Con "en", que es como habla la mayoria.
  const conEn = dictar("gasté 10 en salchipapa, 10 en mandarina, 10 en tenedor, 10 en papel y 10 en cuchara");
  ok(conEn.join(" | ") === esperado.join(" | "), `con "en": ${conEn.join(" | ")}`);

  // Repitiendo el verbo, que es lo natural si uno va cerrando frases.
  const conVerbo = dictar("gasté 10 en salchipapa gasté 10 en mandarina gasté 10 en papel");
  ok(conVerbo.length === 3, `repitiendo el verbo salen 3: ${conVerbo.join(" | ")}`);

  // Una lista larga de verdad, la del mercado. El tope son 30, asi que siete entran.
  const mercado = dictar("gasté 5 en tomate 3 en cebolla 8 en pollo 12 en arroz 4 en huevos 6 en aceite 2 en ajo");
  ok(mercado.length === 7, `la lista del mercado entra entera (${mercado.length} de 7)`);
}

console.log("\n--- UNA CANTIDAD NO ES DINERO ---");
{
  // "gasté 10 en 2 mandarinas" registraba DOS movimientos: uno de S/ 10 sin nombre y
  // otro de S/ 2 llamado "mandarinas". El de S/ 2 no existio nunca.
  const dos = dictar("gasté 10 en 2 mandarinas");
  ok(dos.length === 1, `"10 en 2 mandarinas" es UN movimiento, no dos (${dos.join(" | ")})`);
  ok(dos[0] === "-10 mandarinas", `y es el de 10, con su nombre (${dos[0]})`);

  // Dicha con letras tiene que valer igual.
  const letras = dictar("gasté 10 en dos mandarinas");
  ok(letras.join("") === "-10 mandarinas", `con letras igual (${letras.join(" | ")})`);

  // Y la cantidad se salta ENTERA. Saltando solo la primera palabra, el "cinco" de
  // "treinta y cinco" quedaba suelto y se colaba como un gasto de S/ 5.
  const larga = dictar("gasté 20 en treinta y cinco mandarinas");
  ok(larga.length === 1 && larga[0] === "-20 mandarinas", `"treinta y cinco" no deja nada suelto (${larga.join(" | ")})`);

  // Lo que NO debe cambiar: "de 45 soles" es dinero, porque detras va "soles" y no el
  // nombre de una cosa. Si esta se rompe, la regla se paso de lista.
  const cuenta = dictar("pagué la cuenta de 45 soles");
  ok(cuenta.length === 1 && cuenta[0].startsWith("-45"), `"la cuenta de 45 soles" sigue siendo dinero (${cuenta.join(" | ")})`);

  // Y dos montos seguidos con "y" en medio siguen siendo dos.
  const dosMontos = dictar("gasté 10 en pan y 20 en leche");
  ok(dosMontos.length === 2, `dos gastos siguen siendo dos (${dosMontos.join(" | ")})`);
}

console.log("\n--- UNA HORA NO ES DINERO ---");
{
  // "gasté 30 en pan a las 5" registraba el pan Y un gasto de S/ 5 inexistente.
  const hora = dictar("gasté 30 en pan a las 5");
  ok(hora.length === 1 && hora[0] === "-30 pan", `"a las 5" no es un gasto de S/ 5 (${hora.join(" | ")})`);

  const unaHora = dictar("gasté 20 en pan a la 1");
  ok(unaHora.length === 1, `"a la 1" tampoco (${unaHora.join(" | ")})`);
}

console.log("\n--- LOS NOMBRES DE DOS Y TRES PALABRAS ---");
{
  // "pollo a la brasa" se quedaba en "pollo", y en Peru eso es media carta.
  const brasa = dictar("gasté 15 en pollo a la brasa y 5 en chicha");
  ok(brasa[0] === "-15 pollo a la brasa", `sale el plato entero (${brasa[0]})`);
  ok(brasa[1] === "-5 chicha", `y lo de despues no se lo lleva (${brasa[1]})`);

  ok(dictar("gasté 18 en lomo a lo pobre")[0] === "-18 lomo a lo pobre", "«a lo pobre» tambien");

  // Lo que ya funcionaba y no se puede perder.
  ok(dictar("gasté 40 en la bodega de Don Pepe")[0] === "-40 bodega de Don Pepe", "«de» en medio sigue valiendo");
  ok(dictar("gasté 12 en pan de la bodega")[0] === "-12 pan de la bodega", "«de la» en medio sigue valiendo");
}

console.log("\n--- EL NOMBRE DICHO ANTES DEL MONTO ---");
{
  // Sin nombre no se puede adivinar la categoria, asi que el movimiento caia en
  // "Otros" aunque el nombre estuviera dicho — solo que delante del monto.
  ok(dictar("el pan me costó 5 soles")[0] === "-5 pan", "«el pan me costó 5» encuentra el pan");
  ok(dictar("compré una hamburguesa de 15")[0] === "-15 hamburguesa", "«una hamburguesa de 15» tambien");
  ok(dictar("la gaseosa 3")[0] === "-3 gaseosa", "y «la gaseosa 3»");

  // PERO SOLO PARA EL PRIMERO, y esto es lo que evita un error peor que el que arregla:
  // mirar hacia atras desde el 20 encontraria "sueldo" y llamaria "sueldo" a un gasto.
  const mezcla = dictar("recibí 500 de sueldo y gasté 20");
  ok(mezcla[0] === "+500 sueldo", `el sueldo entra como ingreso (${mezcla[0]})`);
  ok(mezcla[1] === "-20 ", `y el gasto de 20 NO se llama "sueldo" (${mezcla[1]})`);
}

console.log("\n--- LO QUE YA ANDABA SIGUE ANDANDO ---");
{
  ok(dictar("gasté 30 soles en KFC")[0] === "-30 KFC", "una compra normal");
  ok(dictar("gasté 10.50 en pan")[0] === "-10.5 pan", "con centimos");
  ok(dictar("gasté 10 con 50 en pan")[0] === "-10.5 pan", "«10 con 50»");
  ok(dictar("gasté S/10 en pan")[0] === "-10 pan", "con «S/»");
  ok(dictar("gasté diez en pan y veinte en gaseosa").length === 2, "numeros en letras");
  ok(dictar("recibí 500 de sueldo y gasté 20 en pan").join(" | ") === "+500 sueldo | -20 pan", "gasto e ingreso mezclados");
  // "un" no vale 1 a proposito: si no, esta frase seria un gasto de S/ 1.
  ok(dictar("gasté un montón en el mercado")[0] === "NO:noAmount", "«un montón» no es un monto");
  // La fecha se tacha antes de buscar montos, o el 28 seria un gasto de S/ 28.
  const conFecha = parseVoice("gasté 20 el 28 de julio", AHORA);
  ok(conFecha.ok && conFecha.rows.length === 1 && conFecha.rows[0].date === "2026-07-28", "la fecha no se cuenta como monto");
}

console.log("\n--- LA PANTALLA NO SE CIERRA EN EL PRIMER TROZO ---");
{
  // Aqui estaba el fallo gordo, y es de los que no se ven mirando el resultado: el
  // interprete entendia la frase perfectamente, pero nunca la recibia completa.
  const pantalla = fs.readFileSync(path.join(RAIZ, "screens/VoiceEntry.tsx"), "utf8");

  // 1. La escucha seguida. Sin esto, la documentacion de la libreria es explicita:
  //    en Android la escucha termina al primer resultado final.
  ok(/continuous:\s*true/.test(pantalla), "se pide la escucha seguida");
  ok(!/continuous:\s*false/.test(pantalla), "y no queda ninguna escucha que se cierre al primer trozo");

  // 2. Los trozos se SUMAN. Es la diferencia entre cinco compras y una.
  ok(/trozos\.current\.push\(/.test(pantalla), "cada trozo cerrado se suma a los anteriores");
  ok(
    /\[\.\.\.trozos\.current,\s*enCurso\.current\]/.test(pantalla),
    "y lo que se interpreta es la suma de todos mas lo que va en curso"
  );

  // 3. NO se puede volver a mandar nuestras esperas de silencio.
  //    Es el detalle invisible: las opciones que le pasamos se aplican DESPUES de las
  //    de la libreria, y en Android 12 o menos su forma de conseguir la escucha seguida
  //    es justamente poner esas esperas larguisimas. Volver a mandarlas dejaria el
  //    arreglo funcionando en un celular nuevo y roto en uno viejo — el peor caso,
  //    porque no se notaria aqui.
  ok(
    !/EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS/.test(pantalla),
    "no se pisan las esperas de silencio de la libreria"
  );
  ok(
    !/EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS/.test(pantalla),
    "ni el minimo de la libreria"
  );

  // 4. Alguien tiene que cerrar el microfono, porque ya no se cierra solo. Son dos
  //    caminos a proposito: el reloj del silencio y el boton. Si el reloj fallara en
  //    algun celular, el boton salva el dictado.
  ok(/ExpoSpeechRecognitionModule\.stop\(\)/.test(pantalla), "el dictado se cierra pidiendo a Android que se detenga");
  ok(/function terminarDeEscuchar/.test(pantalla), "hay un solo sitio que cierra el dictado");
  ok(/onPress={terminarDeEscuchar}/.test(pantalla), "y el boton de «Listo» usa ese mismo sitio");
  ok(/voice\.listo/.test(pantalla), "el boton tiene su texto traducido");

  // 5. La red de seguridad. Si el celular no puede con la escucha seguida, se vuelve a
  //    la de antes en vez de quedarse sin microfono.
  ok(/escuchaSeguida\.current = false/.test(pantalla), "si falla la escucha seguida se prueba a la antigua");
}

console.log("\n--- «LISTO» ESTA EN LOS TRES IDIOMAS ---");
{
  // Una clave que falte no da error: sale el nombre de la clave en el boton.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const veces = (i18n.match(/"voice\.listo":/g) || []).length;
  ok(veces === 3, `«Listo» esta en los tres idiomas (${veces})`);
}

console.log(
  fallos === 0 ? "\nTodo bien: el dictado largo se entiende entero" : `\n${fallos} FALLAS`
);
process.exit(fallos === 0 ? 0 : 1);
