// EL PRESUPUESTO NO SE COPIA A NINGUN OTRO MES (10/08/2026)
//
// El 09/08 el presupuesto pasó a repetirse solo cada mes. Un día después se pidió deshacerlo:
// ver "S/ 100" en NOVIEMBRE estando en agosto —un mes sin tocar, con un número sin escribir—
// desconcertaba mas de lo que ayudaba el ahorro de teclear.
//
// TODA ESTA PRUEBA FALLA CONTRA LA VERSION ANTERIOR, que devolvia el ultimo presupuesto puesto
// a mano cuando el mes no tenia el suyo.
import { presupuestoDelMes } from "@/utils/presupuestoMensual";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- CADA MES USA EL SUYO Y SOLO EL SUYO ---");
{
  const puestos = { "2026-06": 1500, "2026-07": 1800 };

  ok(presupuestoDelMes(puestos, "2026-07") === 1800, "el mes que tiene el suyo usa el suyo");
  ok(presupuestoDelMes(puestos, "2026-06") === 1500, "y cada uno el suyo, no el del vecino");

  // LO QUE CAMBIA HOY: agosto no tiene presupuesto, y por lo tanto vale cero.
  ok(presupuestoDelMes(puestos, "2026-08") === 0, `agosto empieza vacio (${presupuestoDelMes(puestos, "2026-08")})`);
  ok(presupuestoDelMes(puestos, "2026-08") !== 1800, "y NO copia el de julio, que es lo que hacia antes");

  // NOVIEMBRE, QUE ES EL CASO QUE LO DESTAPO. Mirando meses adelante no aparece nada.
  ok(presupuestoDelMes(puestos, "2026-11") === 0, `noviembre, tres meses adelante, sale en blanco (${presupuestoDelMes(puestos, "2026-11")})`);
  ok(presupuestoDelMes(puestos, "2027-03") === 0, "y el anio que viene tampoco");
}

console.log("\n--- NI HACIA ATRAS NI DESDE LA NADA ---");
{
  // El pasado no cambia porque hoy se escriba un numero.
  ok(presupuestoDelMes({ "2026-07": 700 }, "2026-05") === 0, "mayo no toma nada de julio");
  ok(presupuestoDelMes({}, "2026-08") === 0, "sin ningun presupuesto puesto, cero");
}

console.log("\n--- UN CERO ESCRITO A MANO SIGUE VALIENDO CERO ---");
{
  // "Este mes no me pongo presupuesto" es una decision. Se ve igual que no haber puesto nada,
  // y ahora ademas da lo mismo: ninguno de los dos hereda de ningun sitio.
  const conCero = { "2026-07": 1800, "2026-08": 0 };
  ok(presupuestoDelMes(conCero, "2026-08") === 0, "el cero de agosto se respeta");
  ok(presupuestoDelMes(conCero, "2026-09") === 0, "y septiembre tampoco saca nada de julio");
}

console.log("\n--- LAS CLAVES RARAS NO ROMPEN NADA ---");
{
  // El guardado ha ido cambiando con los meses y puede tener restos. Pedir un mes que no
  // existe tiene que dar cero, no reventar.
  const sucio = { "2026-07": 1800, ultimoMes: 999 } as Record<string, number>;
  ok(presupuestoDelMes(sucio, "2026-08") === 0, "una clave que no es un mes no se cuela");
  ok(presupuestoDelMes(sucio, "2026-07") === 1800, "y el mes de verdad sigue funcionando");
}

console.log(fallos === 0 ? "\nTodo bien: cada mes empieza vacio" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);
