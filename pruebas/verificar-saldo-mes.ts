// CADA MES DECIDE SOLO SI RECIBE EL SALDO DEL ANTERIOR (10/08/2026)
//
// LO QUE HABIA ANTES, Y POR QUE SE CAMBIO
//
// Poner un mes en cero cortaba la cadena de ahi EN ADELANTE: una marca en agosto dejaba en
// cero agosto, septiembre, octubre y todo lo que viniera despues. Una decision pequeña
// —"lo de julio no lo quiero en agosto"— se convertia en una decision permanente sobre meses
// que todavia no habian pasado. Y septiembre arrancaba de cero aunque agosto hubiera
// terminado con 150 soles de verdad, que existian y estaban en la cuenta.
//
// AHORA CADA PASO ES UNA PUERTA INDEPENDIENTE:
//
//     JULIO ──🚪──> AGOSTO ──🚪──> SEPTIEMBRE ──🚪──> OCTUBRE
//               ❌            ✅                 ❌
//
// TODA ESTA PRUEBA FALLA CONTRA LA VERSION ANTERIOR salvo donde se diga lo contrario: el
// codigo viejo devolvia 0 en cuanto habia una marca en ese mes o en cualquiera anterior.
import { saldoAnteriorDe, tieneCorte } from "@/utils/saldoAnterior";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

type Mov = { date: string; type: "income" | "expense"; amount: number };
const ingreso = (fecha: string, monto: number): Mov => ({ date: fecha, type: "income", amount: monto });
const gasto = (fecha: string, monto: number): Mov => ({ date: fecha, type: "expense", amount: monto });

console.log("\n--- SIN NINGUNA PUERTA CERRADA, TODO COMO SIEMPRE ---");
{
  // Esta parte PASABA YA ANTES, y esta escrita justamente por eso: el cambio no puede
  // moverle el saldo a nadie que nunca haya tocado el boton, que son casi todos.
  const movs = [ingreso("2026-07-05", 200), gasto("2026-07-20", 50)];
  const presupuestos = { "2026-07": 300 };

  ok(saldoAnteriorDe("2026-08", presupuestos, movs, []) === 450, `agosto recibe 300+200-50 (${saldoAnteriorDe("2026-08", presupuestos, movs, [])})`);
  // Y sin nada anterior, cero: no se inventa un saldo de la nada.
  ok(saldoAnteriorDe("2026-07", presupuestos, movs, []) === 0, "el primer mes no recibe nada");
  // El deficit se arrastra igual que el sobrante. Deber dinero tambien es un dato.
  ok(saldoAnteriorDe("2026-08", {}, [gasto("2026-07-10", 50)], []) === -50, "un mes en rojo pasa el rojo");
}

console.log("\n--- CASO 1: JULIO 200, AGOSTO NO RECIBE, SEPTIEMBRE SI ---");
{
  // El ejemplo exacto: julio termina con 200 y agosto cierra su puerta. Agosto gana 500 y
  // gasta 350, asi que termina con 150 REALES. Septiembre tiene que recibir esos 150.
  const movs = [
    ingreso("2026-07-05", 200),
    ingreso("2026-08-10", 500),
    gasto("2026-08-20", 350),
  ];
  const cortes = ["2026-08"];

  ok(saldoAnteriorDe("2026-08", {}, movs, cortes) === 0, "agosto arranca en cero");
  const sept = saldoAnteriorDe("2026-09", {}, movs, cortes);
  ok(sept === 150, `septiembre recibe los 150 reales de agosto (${sept})`);
  // LO QUE HACIA ANTES, dicho a las claras: septiembre se quedaba en cero por una marca que
  // ni siquiera era suya.
  ok(sept !== 0, "y NO cero, que es lo que devolvia el corte global");
  // Julio no se entera de nada: la puerta de agosto no mira hacia atras.
  ok(saldoAnteriorDe("2026-08", {}, movs, []) === 200, "sin la marca, agosto si recibe los 200");
}

console.log("\n--- CASO 2: RESTAURAR DEVUELVE EL SALDO EXACTO ---");
{
  const movs = [ingreso("2026-07-05", 200), ingreso("2026-08-10", 500), gasto("2026-08-20", 350)];

  // Quitar la marca es quitarla de la lista: no hay nada que reconstruir a mano.
  const conMarca = saldoAnteriorDe("2026-08", {}, movs, ["2026-08"]);
  const sinMarca = saldoAnteriorDe("2026-08", {}, movs, []);
  ok(conMarca === 0 && sinMarca === 200, `0 con la puerta cerrada, 200 al abrirla (${conMarca} / ${sinMarca})`);
  // Y septiembre se recoloca solo: 200 que entran + 500 - 350 = 350.
  ok(saldoAnteriorDe("2026-09", {}, movs, []) === 350, `septiembre se recalcula solo (${saldoAnteriorDe("2026-09", {}, movs, [])})`);
}

console.log("\n--- CASO 3: PUERTAS ALTERNAS, CUATRO MESES SEGUIDOS ---");
{
  // julio→agosto ❌ · agosto→septiembre ✅ · septiembre→octubre ❌ · octubre→noviembre ✅
  const movs = [
    ingreso("2026-07-05", 200),
    ingreso("2026-08-10", 500), gasto("2026-08-20", 300),   // agosto gana 200
    ingreso("2026-09-10", 100), gasto("2026-09-20", 50),    // septiembre gana 50
    ingreso("2026-10-10", 80),                              // octubre gana 80
  ];
  const cortes = ["2026-08", "2026-10"];

  ok(saldoAnteriorDe("2026-08", {}, movs, cortes) === 0, "agosto: puerta cerrada, cero");
  ok(saldoAnteriorDe("2026-09", {}, movs, cortes) === 200, `septiembre recibe los 200 de agosto (${saldoAnteriorDe("2026-09", {}, movs, cortes)})`);
  ok(saldoAnteriorDe("2026-10", {}, movs, cortes) === 0, "octubre: puerta cerrada, cero");
  ok(saldoAnteriorDe("2026-11", {}, movs, cortes) === 80, `noviembre recibe los 80 de octubre (${saldoAnteriorDe("2026-11", {}, movs, cortes)})`);
  // Y septiembre NO se entera de la marca de octubre: el futuro no decide el presente.
  ok(saldoAnteriorDe("2026-09", {}, movs, ["2026-10"]) === 400, `una marca posterior no toca a septiembre: 200 de julio + 200 de agosto (${saldoAnteriorDe("2026-09", {}, movs, ["2026-10"])})`);
}

console.log("\n--- CASO 4: SIN SALDO QUE CORTAR, NO HAY BOTON ---");
{
  // La pantalla enseña la goma solo si el saldo NO es cero. Aqui se comprueba la cuenta que
  // decide eso, que es la unica parte que se puede probar sin Android.
  ok(saldoAnteriorDe("2026-07", {}, [], []) === 0, "sin historial no hay nada que cortar");
  // Un mes que recibe exactamente cero porque lo anterior se compenso: tampoco hay boton, y
  // es correcto — cerrar la puerta no cambiaria nada.
  const compensado = [ingreso("2026-07-05", 200), gasto("2026-07-06", 200)];
  ok(saldoAnteriorDe("2026-08", {}, compensado, []) === 0, "un mes que cuadro en cero deja cero");
}

console.log("\n--- CASO 5: EL BOTON PERTENECE AL MES QUE SE ESTA VIENDO ---");
{
  const cortes = ["2026-08"];
  ok(tieneCorte(cortes, "2026-08") === true, "viendo agosto, la puerta esta cerrada");
  ok(tieneCorte(cortes, "2026-09") === false, "viendo septiembre, esta abierta");
  ok(tieneCorte(cortes, "2026-07") === false, "viendo julio, esta abierta");
}

console.log("\n--- CASO 7: TOCAR UN MOVIMIENTO RECALCULA TODO ---");
{
  // No se guarda ningun saldo: se recalcula desde los movimientos cada vez. Asi que añadir,
  // cambiar o borrar uno se nota solo, sin tener que avisar a nadie.
  const cortes = ["2026-08"];
  const antes = [ingreso("2026-07-05", 200), ingreso("2026-08-10", 500), gasto("2026-08-20", 350)];
  ok(saldoAnteriorDe("2026-09", {}, antes, cortes) === 150, "septiembre: 150");

  const conUnGastoMas = [...antes, gasto("2026-08-25", 50)];
  ok(saldoAnteriorDe("2026-09", {}, conUnGastoMas, cortes) === 100, `un gasto mas en agosto y septiembre baja a 100 (${saldoAnteriorDe("2026-09", {}, conUnGastoMas, cortes)})`);

  const sinElGastoGrande = antes.filter((m) => m.amount !== 350);
  ok(saldoAnteriorDe("2026-09", {}, sinElGastoGrande, cortes) === 500, `borrando el gasto de 350, septiembre sube a 500 (${saldoAnteriorDe("2026-09", {}, sinElGastoGrande, cortes)})`);

  // Y un movimiento en JULIO no mueve septiembre, porque la puerta de agosto sigue cerrada.
  const conMasEnJulio = [...antes, ingreso("2026-07-28", 1000)];
  ok(saldoAnteriorDe("2026-09", {}, conMasEnJulio, cortes) === 150, "lo de julio no se cuela por la puerta cerrada");
}

console.log("\n--- LOS HUECOS Y LOS MESES VACIOS ---");
{
  // UN MES VACIO CON LA PUERTA CERRADA TIENE QUE CONTAR IGUAL. Si solo se recorrieran los
  // meses con movimientos, esa marca se saltaria en silencio y septiembre recibiria lo de
  // julio como si agosto no existiera. Es el fallo mas facil de dejarse en esta cuenta.
  const movs = [ingreso("2026-07-05", 200)];
  ok(saldoAnteriorDe("2026-09", {}, movs, ["2026-08"]) === 0, `agosto vacio pero cortado deja septiembre en cero (${saldoAnteriorDe("2026-09", {}, movs, ["2026-08"])})`);
  // Sin la marca, el mes vacio solo deja pasar lo que llevaba.
  ok(saldoAnteriorDe("2026-09", {}, movs, []) === 200, "un mes vacio sin marca no estorba");
  // Un hueco largo tampoco: diciembre sigue recibiendo lo de julio.
  ok(saldoAnteriorDe("2026-12", {}, movs, []) === 200, "cinco meses sin abrir la app y el saldo sigue ahi");
}

console.log("\n--- LOS PRESUPUESTOS ENTRAN EN CRUDO, SIN HEREDAR ---");
{
  // presupuestoDelMes hereda el ultimo puesto a mano para ENSEÑARLO. Aqui no se usa a
  // proposito: quien puso 500 en enero y no abrio la app en seis meses tendria seis
  // presupuestos de 500 que nunca existieron, y 3.000 soles salidos de la nada.
  const presupuestos = { "2026-01": 500 };
  ok(saldoAnteriorDe("2026-07", presupuestos, [], []) === 500, `solo cuenta el presupuesto que se puso de verdad (${saldoAnteriorDe("2026-07", presupuestos, [], [])})`);
  // Y una clave que no sea un mes no rompe la cuenta ni suma nada.
  ok(saldoAnteriorDe("2026-07", { ...presupuestos, basura: 999 } as Record<string, number>, [], []) === 500, "una clave rara no suma");
}

console.log(fallos === 0 ? "\nTodo bien: cada mes decide solo" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);
