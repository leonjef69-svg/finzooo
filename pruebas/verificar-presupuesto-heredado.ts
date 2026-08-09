// EL PRESUPUESTO SE REPITE SOLO CADA MES (09/08/2026)
//
// Estaba apuntado como pendiente desde hacia semanas: "el presupuesto mensual no se repite solo
// cada mes: hay que volver a ponerlo". Cada 1 de mes la app amanecia con el presupuesto en cero
// — y con cero, Inicio no puede decir cuanto queda, que es el numero por el que se abre la app.
//
// LO QUE ESTA PRUEBA VIGILA DE VERDAD no es que se herede: es que heredar NO PISE una decision.
// "Este mes no me pongo presupuesto" es una decision, y en los datos guardados se parece
// muchisimo a "no he puesto nada todavia". Confundirlas seria la app corrigiendo a la persona.
import { esHeredado, presupuestoDelMes } from "@/utils/presupuestoHeredado";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- SE HEREDA DEL ULTIMO MES QUE SE PUSO ---");
{
  const puestos = { "2026-06": 1500, "2026-07": 1800 };

  ok(presupuestoDelMes(puestos, "2026-07") === 1800, "el mes que tiene el suyo usa el suyo");
  ok(presupuestoDelMes(puestos, "2026-08") === 1800, `agosto hereda el de julio (${presupuestoDelMes(puestos, "2026-08")})`);
  // Y EL ULTIMO, NO EL PRIMERO: se hereda lo mas reciente, no lo mas viejo.
  ok(presupuestoDelMes(puestos, "2026-12") === 1800, "y diciembre tambien, mientras no se ponga otro");

  // NO SE HEREDA DEL FUTURO. Quien mire mayo desde agosto tiene que ver lo que habia en mayo,
  // no algo que puso despues: el pasado no cambia porque hoy se escriba un numero.
  ok(presupuestoDelMes(puestos, "2026-05") === 0, `mayo, antes del primero, no hereda nada (${presupuestoDelMes(puestos, "2026-05")})`);

  // Sin ningun presupuesto puesto, cero: la app no se inventa uno.
  ok(presupuestoDelMes({}, "2026-08") === 0, "sin nada puesto, cero");
}

console.log("\n--- UN CERO PUESTO A MANO ES UNA DECISION, Y MANDA ---");
{
  // ES LA COMPROBACION IMPORTANTE DE ESTE ARCHIVO. En los datos guardados, "puse cero" y "no
  // puse nada" se ven casi igual: uno tiene la clave con valor 0 y el otro no tiene la clave.
  // Si se confunden, alguien que decidio no ponerse presupuesto este mes se encuentra el del
  // mes pasado puesto por la app.
  const conCero = { "2026-07": 1800, "2026-08": 0 };
  ok(presupuestoDelMes(conCero, "2026-08") === 0, "un cero escrito a mano no se sustituye");
  ok(!esHeredado(conCero, "2026-08"), "y no se anuncia como heredado, porque no lo es");

  // Y el mes SIGUIENTE a ese cero hereda el cero, no el 1800 de antes: la ultima decision es la
  // que vale.
  ok(presupuestoDelMes(conCero, "2026-09") === 0, `septiembre hereda el cero de agosto (${presupuestoDelMes(conCero, "2026-09")})`);
}

console.log("\n--- Y SE DICE DE DONDE SALIO EL NUMERO ---");
{
  // Un numero que aparece solo, sin que nadie lo haya escrito, es de las cosas que hacen
  // desconfiar de una app de dinero. Quien vea 1.800 en un mes que no ha tocado tiene que saber
  // de donde salio.
  const puestos = { "2026-07": 1800 };
  ok(esHeredado(puestos, "2026-08"), "agosto avisa de que ese numero viene de julio");
  ok(!esHeredado(puestos, "2026-07"), "julio no avisa: ahi lo puso la persona");
  ok(!esHeredado({}, "2026-08"), "y sin nada que heredar tampoco se avisa");
}

console.log("\n--- NO SE ESCRIBE NADA EN EL DISCO AL HEREDAR ---");
{
  // Se hereda al LEER. Copiar el numero al mes nuevo tendria dos efectos malos: llenaria el
  // guardado de meses que nadie toco y —peor— dejaria el valor congelado, asi que cambiar el
  // presupuesto de este mes no arreglaria el siguiente.
  const puestos = { "2026-07": 1800 };
  const antes = JSON.stringify(puestos);
  presupuestoDelMes(puestos, "2026-08");
  esHeredado(puestos, "2026-08");
  ok(JSON.stringify(puestos) === antes, "leer el presupuesto no cambia lo guardado");
}

console.log("\n--- CLAVES RARAS NO ROMPEN NADA ---");
{
  // El guardado puede traer cosas de versiones viejas o de una copia estropeada. Una clave que
  // no es un mes no puede colarse como si lo fuera.
  const sucio = { "2026-07": 1800, basura: 999, "": 5 } as Record<string, number>;
  ok(presupuestoDelMes(sucio, "2026-08") === 1800, `una clave que no es un mes se ignora (${presupuestoDelMes(sucio, "2026-08")})`);
}

console.log(fallos === 0 ? "\nTodo bien: el presupuesto se repite solo\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
