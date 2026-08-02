// QUE NO SE PIERDA UN MOVIMIENTO ESCRITO POR FUERA.
//
// La app guarda la lista entera cada vez que cambia algo. En cuanto algo mas
// escriba —el servicio que registra un yapeo con la app cerrada— la lista de
// memoria se queda vieja y el siguiente guardado la pisa: el movimiento
// desaparece sin dejar rastro. Esto comprueba que eso no pase.
import { mergeTransactions, hayNovedades } from "@/utils/mergeTransactions";
import type { Transaction } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

function tx(id: number, date: string, amount: number, description = ""): Transaction {
  return {
    id,
    date,
    amount,
    type: "expense",
    category: "otros",
    description,
    notes: "",
    method: "cash",
  };
}

console.log("\n--- EL YAPEO REGISTRADO CON LA APP CERRADA NO SE PIERDE ---");
{
  // Lo que la app tenia cargado antes de irse a segundo plano.
  const memoria = [tx(1, "2026-08-01", 20), tx(2, "2026-07-30", 50)];
  // Y lo que hay en el disco: lo mismo mas el yapeo que registro el servicio.
  const disco = [...memoria, tx(80, "2026-08-02", 80, "Te yapearon de Rosa")];

  const juntas = mergeTransactions(memoria, disco);
  ok(juntas.length === 3, `salen los tres (${juntas.length})`);
  ok(juntas.some((t) => t.id === 80), "el yapeo del servicio sigue ahi");
  ok(juntas.some((t) => t.id === 1) && juntas.some((t) => t.id === 2), "y los de antes tambien");
}

console.log("\n--- LO QUE SE ACABA DE TOCAR EN PANTALLA MANDA ---");
{
  // Mismo identificador, dos versiones: la de pantalla es la buena. Es lo que
  // acaba de escribir la persona, y el disco puede traer la de antes.
  const memoria = [tx(1, "2026-08-01", 99, "corregido a mano")];
  const disco = [tx(1, "2026-08-01", 20, "el viejo")];
  const juntas = mergeTransactions(memoria, disco);
  ok(juntas.length === 1, "no se duplica");
  ok(juntas[0].amount === 99, "gana el monto corregido en pantalla");
  ok(juntas[0].description === "corregido a mano", "y su descripcion");
}

console.log("\n--- CASOS DE BORDE ---");
{
  ok(mergeTransactions([], []).length === 0, "las dos vacias, nada");
  ok(mergeTransactions([tx(1, "2026-08-01", 10)], []).length === 1, "con el disco vacio se queda lo de memoria");
  ok(mergeTransactions([], [tx(1, "2026-08-01", 10)]).length === 1, "y al reves tambien");
}

console.log("\n--- EL ORDEN NO BAILA ---");
{
  const juntas = mergeTransactions(
    [tx(2, "2026-07-30", 1)],
    [tx(3, "2026-08-05", 2), tx(1, "2026-08-05", 3)]
  );
  ok(juntas[0].date === "2026-08-05", "las mas nuevas arriba");
  ok(juntas[juntas.length - 1].id === 2, "y la mas vieja al final");
  // Con la misma fecha, un orden fijo: si bailara, la lista parecería
  // cambiar sola entre dos aperturas.
  const otra = mergeTransactions(
    [tx(2, "2026-07-30", 1)],
    [tx(1, "2026-08-05", 3), tx(3, "2026-08-05", 2)]
  );
  ok(
    juntas.map((t) => t.id).join() === otra.map((t) => t.id).join(),
    "el mismo conjunto sale siempre en el mismo orden"
  );
}

console.log("\n--- SABER SI HAY QUE MIRAR EL DISCO ---");
{
  const memoria = [tx(1, "2026-08-01", 10)];
  ok(!hayNovedades(memoria, memoria), "sin nada nuevo, no hay novedades");
  ok(hayNovedades(memoria, [...memoria, tx(9, "2026-08-02", 5)]), "con un yapeo nuevo, si");
  ok(!hayNovedades(memoria, []), "un disco vacio no cuenta como novedad");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
