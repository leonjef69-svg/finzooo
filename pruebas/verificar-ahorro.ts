// EL AHORRO COMO SOBRES.
//
// Lo que se comprueba aqui es que no se pueda apartar dinero que no existe, y
// que el numero "Libre" —lo que se puede gastar sin tocar las metas— salga
// bien en los casos raros, que son los que de verdad pasan.
import {
  totalApartado,
  saldoLibre,
  maximoAApartar,
  hayDescuadre,
  faltaParaRespaldar,
} from "@/utils/ahorro";
import type { Goal } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

function meta(id: number, saved: number, target = 1000, completed = false): Goal {
  return { id, name: `meta ${id}`, target, saved, createdDate: "2026-08-01", completed };
}

console.log("\n--- CUANTO HAY APARTADO ---");
ok(totalApartado([]) === 0, "sin metas, nada apartado");
ok(totalApartado([meta(1, 200), meta(2, 100)]) === 300, "dos metas suman 300");
// Una meta cumplida ya cumplio su funcion: su dinero se gasto en lo que era.
ok(totalApartado([meta(1, 200), meta(2, 500, 500, true)]) === 200, "una meta cumplida ya no aparta nada");

console.log("\n--- EL NUMERO QUE FALTABA: LIBRE ---");
ok(saldoLibre(500, 200) === 300, "con 500 y 200 apartados, quedan 300 libres");
ok(saldoLibre(500, 0) === 500, "sin metas, todo es libre");
ok(saldoLibre(500, 500) === 0, "apartando todo no queda nada libre");

console.log("\n--- NO SE PUEDE APARTAR LO QUE NO SE TIENE ---");
{
  // EL FALLO QUE SE ARREGLA: con 500 se apartaban 500 en tres metas
  // distintas. 1.500 que no existen, y nada lo impedia.
  ok(maximoAApartar(500, 0) === 500, "con 500 y nada apartado, se pueden apartar 500");
  ok(maximoAApartar(500, 500) === 0, "ya apartados los 500, no se puede apartar nada mas");
  ok(maximoAApartar(500, 300) === 200, "con 300 apartados, quedan 200 por apartar");
  // Y nunca un tope negativo, que dejaria escribir cualquier cosa.
  ok(maximoAApartar(100, 300) === 0, "si ya hay mas apartado que dinero, el tope es cero, no negativo");
}

console.log("\n--- CUANDO SE GASTA LO QUE ESTABA APARTADO ---");
{
  // Tenia 500, aparto 200 para la moto, y gasto 400. Se comio 100 de la meta.
  const disponible = 100;
  const apartado = 200;
  ok(hayDescuadre(disponible, apartado), "se avisa de que hay mas apartado que dinero");
  ok(faltaParaRespaldar(disponible, apartado) === 100, "faltan 100 para respaldar la meta");
  ok(saldoLibre(disponible, apartado) === -100, "el libre sale negativo, que es la verdad");
}
{
  // El otro camino legitimo: poner el Saldo anterior en cero baja el
  // disponible de golpe, y de pronto hay mas apartado que dinero.
  ok(hayDescuadre(250, 300), "poner el saldo anterior en cero tambien puede descuadrar");
  ok(faltaParaRespaldar(250, 300) === 50, "y dice cuanto falta");
}

console.log("\n--- CUANDO TODO CUADRA, NO SE MOLESTA ---");
ok(!hayDescuadre(500, 200), "con dinero de sobra no se avisa de nada");
ok(!hayDescuadre(200, 200), "justo al limite tampoco: 200 respaldan 200");
ok(faltaParaRespaldar(500, 200) === 0, "y no falta nada por respaldar");

console.log("\n--- LA META CUMPLIDA: EL FINAL FELIZ ---");
{
  // Se aparto 200 para la moto, se compro la moto (el gasto lo anoto el
  // registro automatico) y se marco la meta como cumplida.
  const antesDisponible = 500;
  const antesApartado = totalApartado([meta(1, 200)]);
  const librePrevio = saldoLibre(antesDisponible, antesApartado);

  const despuesDisponible = 300; // bajo por el gasto real de la moto
  const despuesApartado = totalApartado([meta(1, 200, 200, true)]); // ya cumplida
  const libreDespues = saldoLibre(despuesDisponible, despuesApartado);

  ok(librePrevio === 300, "antes de comprar habia 300 libres");
  ok(libreDespues === 300, "y despues siguen siendo 300");
  // Es lo que tiene que sentirse al cumplir una meta: no duele, porque ese
  // dinero ya tenia dueno.
  ok(librePrevio === libreDespues, "cumplir una meta NO cambia lo que se puede gastar");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
