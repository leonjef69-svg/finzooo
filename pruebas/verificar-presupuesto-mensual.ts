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

console.log("\n--- LA TARJETA DE LIMITES NO PUEDE CONTRADECIRSE ---");
{
  // EL FALLO, reportado con captura el 07/08/2026: la tarjeta "Presupuestos por
  // categoria" decia "Aun no le pusiste limite a ninguna categoria" y justo debajo
  // "13 categorias sin gastos este mes · € 650.00 sin usar". Las dos a la vez, y
  // las dos no pueden ser verdad.
  //
  // El motivo: ese primer texto se decidia con las categorias que TIENEN GASTO, no
  // con las que tienen limite. Con trece limites puestos y ningun gasto en ellos,
  // "no pusiste ninguno" era falso.
  //
  // Es el mismo fallo que ya paso en la pantalla de exportacion automatica: dos
  // textos decidiendo por su cuenta. La regla es la misma: una sola pregunta.
  const fs = await import("fs");
  const path = await import("path");
  const RAIZ = process.cwd();
  const pant = fs.readFileSync(path.join(RAIZ, "screens/Reports.tsx"), "utf8");
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");

  ok(/hayLimites: todos\.length > 0/.test(pant), "'hay limites' se cuenta de los limites, no de los gastos");
  ok(
    /t\(hayLimites \? "categoryBudgets\.noneSpentYet" : "categoryBudgets\.noneSet"\)/.test(pant),
    "y es esa misma respuesta la que elige el texto"
  );
  // Los dos textos tienen que existir en los tres idiomas: si falta uno, en
  // pantalla sale la clave cruda justo cuando alguien mira sus presupuestos.
  for (const clave of ["categoryBudgets.noneSet", "categoryBudgets.noneSpentYet"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }

  // Y el resumen de las categorias sin gasto no vuelve: se quito a pedido del
  // usuario ("no se por que me sale eso, quitalo, no me gusta") porque esa tarjeta
  // contesta "¿como voy con mis limites?" y una lista de las que ni toco no
  // contesta eso — ademas de que "€ 650.00 sin usar" se leia como dinero
  // disponible.
  ok(!i18n.includes("categoryBudgets.untouched"), "el resumen de las intactas no vuelve");
  ok(!pant.includes("sinGastoTotal"), "ni su cuenta");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
