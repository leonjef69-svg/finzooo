// LO ULTIMO QUE ANOTAS TIENE QUE SALIR ARRIBA.
//
// Fallo reportado: se anotaba un movimiento y no aparecia el primero. Inicio
// ordenaba con `a.date < b.date ? 1 : -1`, que para dos fechas IGUALES —dos
// movimientos del mismo dia, o sea casi siempre— devuelve -1 sin mirar nada
// mas. Como diria lo mismo comparandolos al reves, el orden que salia dependia
// de por donde empezara a comparar el celular.
import { compararMovimientos, minutosDeHora, ordenarMovimientos } from "@/utils/ordenarMovimientos";
import type { Transaction } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

function mov(id: number, date: string, time?: string, amount = 10): Transaction {
  return {
    id,
    date,
    time,
    amount,
    type: "expense",
    category: "otros",
    description: `mov ${id}`,
    notes: "",
    method: "cash",
  };
}

console.log("\n--- LA HORA ESCRITA, EN MINUTOS ---");
{
  // Escrita no se puede ordenar: "11:20 a.m." va antes que "3:40 a.m." si se
  // comparan como texto, porque el "1" es menor que el "3".
  ok(minutosDeHora("12:00 a.m.") === 0, "las 12 a.m. son la medianoche, no el mediodia");
  ok(minutosDeHora("12:30 p.m.") === 750, "las 12:30 p.m. son las 12 y media del dia");
  ok(minutosDeHora("3:40 a.m.") === 220, "3:40 a.m.");
  ok(minutosDeHora("3:40 p.m.") === 940, "3:40 p.m., doce horas mas");
  ok(minutosDeHora("11:20 a.m.") === 680, "11:20 a.m.");
  ok(minutosDeHora("11:20 a.m.") > minutosDeHora("3:40 a.m."), "y las 11:20 SI van despues de las 3:40");
  ok(minutosDeHora(undefined) === -1, "sin hora, -1");
  ok(minutosDeHora("cualquier cosa") === -1, "y con algo que no es una hora, tambien");
}

console.log("\n--- EL CASO REPORTADO: LO ULTIMO, ARRIBA ---");
{
  const antes = mov(1, "2026-08-02", "9:00 a.m.", 20);
  const recien = mov(2, "2026-08-02", "3:40 p.m.", 100);
  const orden = ordenarMovimientos([antes, recien]);
  ok(orden[0].id === 2, "el de las 3:40 p.m. sale primero");
  ok(orden[0].amount === 100, "que es el de S/ 100 recien anotado");
  // Y da igual en que orden estuvieran en la lista.
  ok(ordenarMovimientos([recien, antes])[0].id === 2, "y sale primero venga como venga la lista");
}

console.log("\n--- LA FECHA MANDA SOBRE LA HORA ---");
{
  const ayerTarde = mov(1, "2026-08-01", "11:50 p.m.");
  const hoyTemprano = mov(2, "2026-08-02", "12:10 a.m.");
  ok(ordenarMovimientos([ayerTarde, hoyTemprano])[0].id === 2, "un movimiento de hoy va antes que uno de ayer");
}

console.log("\n--- SIN HORA, AL FINAL DE SU DIA ---");
{
  // Los guardados antes de que se empezara a guardar la hora, y los
  // importados de un estado de cuenta, no la tienen. No hay forma de saber
  // cuando ocurrieron: al final del dia es lo menos malo.
  const conHora = mov(1, "2026-08-02", "8:00 a.m.");
  const sinHora = mov(2, "2026-08-02", undefined);
  const orden = ordenarMovimientos([sinHora, conHora]);
  ok(orden[0].id === 1, "el que tiene hora va primero");
  ok(orden[1].id === 2, "y el que no, despues");
}

console.log("\n--- EMPATE EXACTO: MANDA EL ULTIMO ANOTADO ---");
{
  // Misma fecha y misma hora: gana el identificador mas alto, que es el que
  // se anoto despues. Sin esto el orden seria el que quisiera el celular.
  const a = mov(7, "2026-08-02", "5:00 p.m.");
  const b = mov(9, "2026-08-02", "5:00 p.m.");
  ok(ordenarMovimientos([a, b])[0].id === 9, "el ultimo anotado sale arriba");
  ok(ordenarMovimientos([b, a])[0].id === 9, "y tambien al reves");
}

console.log("\n--- EL COMPARADOR ES COHERENTE ---");
{
  // Lo que fallaba antes: comparar a con b y b con a daba lo mismo, y eso
  // deja el orden en manos del celular.
  const a = mov(1, "2026-08-02", "9:00 a.m.");
  const b = mov(2, "2026-08-02", "9:00 a.m.");
  ok(compararMovimientos(a, b) > 0, "a despues de b");
  ok(compararMovimientos(b, a) < 0, "y b antes de a: lo contrario, como debe ser");
  ok(compararMovimientos(a, a) === 0, "y consigo mismo, empate");
}

console.log("\n--- NO SE TOCA LA LISTA ORIGINAL ---");
{
  const lista = [mov(1, "2026-08-01"), mov(2, "2026-08-02")];
  const copia = [...lista];
  ordenarMovimientos(lista);
  ok(lista[0].id === copia[0].id && lista[1].id === copia[1].id, "la lista que entra sale igual");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
