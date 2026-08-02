// QUE EL PRESUPUESTO SIGA VIGENTE EL MES SIGUIENTE.
//
// Y sobre todo: que al hacerlo no aparezcan presupuestos de meses que la
// persona nunca vivio. El Saldo anterior suma los presupuestos de todos los
// meses previos, asi que inventar uno inventa dinero.
import { presupuestoAHeredar } from "@/utils/presupuestoMensual";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

console.log("\n--- EL CASO DE SIEMPRE: CAMBIA EL MES ---");
ok(presupuestoAHeredar({ "2026-07": 500 }, "2026-08") === 500, "agosto hereda los 500 de julio");
ok(presupuestoAHeredar({ "2026-12": 800 }, "2027-01") === 800, "y enero hereda de diciembre, aunque cambie el anio");

console.log("\n--- LO QUE YA TIENE NO SE TOCA ---");
ok(presupuestoAHeredar({ "2026-07": 500, "2026-08": 300 }, "2026-08") === null, "agosto ya tiene 300: se queda");
// Cero puesto a mano es una decision, no un hueco.
ok(presupuestoAHeredar({ "2026-07": 500, "2026-08": 0 }, "2026-08") === null, "un cero puesto a proposito se respeta");

console.log("\n--- DE DONDE SE HEREDA ---");
{
  const varios = { "2026-05": 100, "2026-07": 700, "2026-06": 200 };
  ok(presupuestoAHeredar(varios, "2026-08") === 700, "del mes con presupuesto MAS RECIENTE, no del primero");
  // Mirando un mes pasado no se hereda de uno posterior.
  ok(presupuestoAHeredar(varios, "2026-06") === null, "junio ya tiene el suyo");
  ok(presupuestoAHeredar({ "2026-07": 700 }, "2026-06") === null, "y nunca se hereda de un mes POSTERIOR");
}

console.log("\n--- CUANDO NO HAY NADA QUE HEREDAR ---");
ok(presupuestoAHeredar({}, "2026-08") === null, "sin ningun presupuesto, nada");
ok(presupuestoAHeredar({ "2026-07": 0 }, "2026-08") === null, "un cero no se arrastra: escribirlo o no se ve igual");

console.log("\n--- Y LO IMPORTANTE: NO SE INVENTAN MESES ---");
{
  // Puso 500 en enero y no abrio la app en seis meses. Solo agosto —el mes
  // en curso— recibe presupuesto. Si en vez de copiar se heredara al vuelo,
  // febrero a julio tendrian 500 cada uno y el Saldo anterior subiria 3.000
  // soles que nunca existieron.
  const soloEnero = { "2026-01": 500 };
  ok(presupuestoAHeredar(soloEnero, "2026-08") === 500, "agosto si recibe");
  // Los del medio siguen sin entrada: esta funcion solo se llama con el mes
  // en curso, y ninguno de ellos la recibe nunca.
  ok(Object.keys(soloEnero).length === 1, "y la funcion no escribe nada por su cuenta");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
