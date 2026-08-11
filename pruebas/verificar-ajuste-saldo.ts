// CUADRAR LA CAJA: DECIRLE A LA APP CUANTO TIENES DE VERDAD (10/08/2026)
//
// Finzo no ve el dinero de nadie. El "Saldo disponible" sale de lo que la persona escribio, asi
// que cada compra sin anotar deja una diferencia entre la app y el bolsillo — y esa diferencia
// NO SE CORRIGE SOLA: al mes siguiente pasa entera al saldo anterior, y crece. A los doce meses
// la app puede decir S/ 2.400 con S/ 600 en la mano.
//
// LO QUE ESTA PRUEBA VIGILA no es la resta, que es trivial. Son las tres cosas que convierten
// una resta en un movimiento de dinero mal anotado:
//
//   1. Que el sentido no se invierta. Anotar un ingreso donde tocaba un gasto ALEJA la app de
//      la realidad en vez de acercarla, y por el doble de la diferencia.
//   2. Que cuadrar cuando ya cuadra no anote nada. Un movimiento de cero soles en la lista no
//      se puede explicar mirandolo.
//   3. Que no salgan colas de decimales. Los dos numeros vienen de sumas de decimales, y sin
//      redondear un ajuste "exacto" deja 0.000000001 de resto.
import { ajusteNecesario } from "@/utils/ajusteSaldo";
import { AJUSTE_CAT } from "@/constants/categories";
import { catInfo } from "@/constants/categories";
import fs from "fs";
import path from "path";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- TIENES MENOS DE LO QUE DICE LA APP: UN GASTO ---");
{
  // El caso normal: se te olvido anotar compras. La app dice 400, tienes 340.
  const a = ajusteNecesario(400, 340);
  ok(a !== null && a.type === "expense", `es un gasto (${a?.type})`);
  ok(a?.amount === 60, `de 60, no de 340 ni de -60 (${a?.amount})`);
  // EL SENTIDO AL REVES SERIA EL PEOR FALLO POSIBLE: anotar 60 de ingreso dejaria la app en
  // 460 teniendo 340. El doble de lejos que antes de tocar nada.
  ok(a?.type !== "income", "y NO un ingreso, que alejaria el doble");
}

console.log("\n--- TIENES MAS DE LO QUE DICE LA APP: UN INGRESO ---");
{
  // El caso que el propio usuario planteo: "escribo 300 pero en el bolsillo tengo 400".
  const a = ajusteNecesario(300, 400);
  ok(a !== null && a.type === "income", `es un ingreso (${a?.type})`);
  ok(a?.amount === 100, `de 100 (${a?.amount})`);
}

console.log("\n--- SI YA CUADRA, NO SE ANOTA NADA ---");
{
  ok(ajusteNecesario(400, 400) === null, "mismo numero, nada que hacer");
  // Y con decimales que ya cuadran tampoco: aqui es donde salia el movimiento fantasma.
  ok(ajusteNecesario(0.1 + 0.2, 0.3) === null, "0.1+0.2 contra 0.3 tambien cuadra");
  ok(ajusteNecesario(0, 0) === null, "cero contra cero");
}

console.log("\n--- LOS CENTIMOS, SIN COLAS ---");
{
  const a = ajusteNecesario(400.1, 340.2);
  ok(a?.amount === 59.9, `59.9 exacto, sin cola de decimales (${a?.amount})`);
  const b = ajusteNecesario(0.3, 0.1);
  ok(b?.amount === 0.2, `0.2 exacto (${b?.amount})`);
  // Un ajuste de un solo centimo sigue siendo un ajuste: no se traga por redondeo.
  const c = ajusteNecesario(400, 399.99);
  ok(c !== null && c.amount === 0.01, `un centimo tambien cuenta (${c?.amount})`);
}

console.log("\n--- EL SALDO EN ROJO TAMBIEN SE PUEDE CUADRAR ---");
{
  // Pasarse del presupuesto es normal y el disponible sale negativo. Cuadrar desde ahi tiene
  // que funcionar igual: si la app dice -50 y tienes 20, te sobran 70 sin anotar.
  const a = ajusteNecesario(-50, 20);
  ok(a?.type === "income" && a.amount === 70, `de -50 a 20 son 70 de ingreso (${a?.type} ${a?.amount})`);
  const b = ajusteNecesario(20, -50);
  ok(b?.type === "expense" && b.amount === 70, `y al reves, 70 de gasto (${b?.type} ${b?.amount})`);
}

console.log("\n--- UN NUMERO QUE NO ES UN NUMERO NO ANOTA NADA ---");
{
  // El campo es texto: si se deja vacio o con basura, parseAmountInput puede devolver NaN.
  // Anotar un movimiento de NaN soles corrompe el saldo de forma irreparable — deja de ser un
  // numero y todas las sumas de ahi en adelante dan NaN.
  ok(ajusteNecesario(400, NaN) === null, "sin monto no se anota");
  ok(ajusteNecesario(NaN, 400) === null, "ni con un disponible roto");
  ok(ajusteNecesario(400, Infinity) === null, "ni con infinito");
}

console.log("\n--- LA CATEGORIA DEL AJUSTE SE RECONOCE ---");
{
  // Va fuera de las dos listas —no se elige a mano— pero TIENE que resolverse por su id. Si no,
  // catInfo devuelve "Otros" y el movimiento sale en la lista con el nombre equivocado: justo
  // lo que no puede pasar con algo que la app se inventa y que hay que poder borrar.
  ok(catInfo(AJUSTE_CAT.id).id === "ajuste", `catInfo lo encuentra (${catInfo(AJUSTE_CAT.id).id})`);
  ok(catInfo(AJUSTE_CAT.id).label === "category.ajuste", "y con su nombre, no el de Otros");
}

console.log("\n--- SE AVISA ANTES DE ANOTAR, Y EN LOS TRES IDIOMAS ---");
{
  const i18n = fs.readFileSync(path.join(process.cwd(), "constants/i18n.ts"), "utf8");
  // Una clave que falta no revienta: el traductor devuelve la clave y en pantalla sale
  // "home.adjustExplain". Solo se descubre mirando la app en ese idioma.
  for (const clave of ["home.adjustBalance", "home.adjustTitle", "home.adjustExplain", "category.ajuste"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }

  // Y QUE EL AVISO SIGA DICIENDO LO QUE PASA. Anotar un movimiento sin decirlo antes es
  // cambiarle a alguien su dinero a sus espaldas, aunque el numero final sea el correcto.
  const home = fs.readFileSync(path.join(process.cwd(), "screens/Home.tsx"), "utf8");
  ok(/adjustExplain/.test(home), "la hoja explica lo que va a hacer antes de hacerlo");
}

console.log(fallos === 0 ? "\nTodo bien: cuadrar la caja no inventa dinero" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);
