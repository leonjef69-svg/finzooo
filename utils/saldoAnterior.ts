// EL SALDO QUE ENTRA A UN MES, Y LA DECISIÓN DE DEJARLO PASAR O NO (10/08/2026)
//
// CÓMO ERA ANTES, Y POR QUÉ ESTABA MAL
//
// El "Saldo anterior" era una suma plana: todos los presupuestos y todos los movimientos de
// todos los meses anteriores, de una vez. Y la marca de "poner en cero" cortaba con un
// `alguno <= mes`, así que una marca en agosto dejaba en cero agosto, septiembre, octubre y
// todo lo que viniera después, hasta que se restaurara agosto.
//
// Eso convertía una decisión pequeña —"lo de julio no lo quiero en agosto"— en una decisión
// permanente sobre el futuro. Y septiembre acababa arrancando de cero aunque agosto hubiera
// terminado con 150 soles de verdad, que existían y que estaban en la cuenta.
//
// CÓMO ES AHORA
//
// Cada paso de un mes al siguiente es UNA PUERTA, y cada puerta se abre o se cierra sola:
//
//     JULIO ──🚪──> AGOSTO ──🚪──> SEPTIEMBRE ──🚪──> OCTUBRE
//               ❌            ✅                 ❌
//
// La marca de un mes cierra ÚNICAMENTE la puerta que entra a ese mes. El resultado real del
// mes no cambia nunca —los movimientos son los que son— y ese resultado real sigue su camino
// al mes siguiente.
//
// Por eso ya no vale sumarlo todo de golpe: hay que RECORRER los meses en orden, porque un
// cero en medio tiene que borrar lo de antes sin borrar lo de después.
//
// LOS PRESUPUESTOS SE LEEN EN CRUDO, SIN HERENCIA
//
// `presupuestoDelMes` hereda el último presupuesto puesto a mano para ENSEÑARLO. Aquí no se
// usa, y es a propósito: quien puso 500 en enero y no abrió la app en seis meses tendría de
// golpe seis presupuestos de 500 que nunca existieron, y 3.000 soles de saldo salidos de la
// nada. En la cadena solo cuentan los meses que la persona vivió de verdad.

/** Lo justo de un movimiento para esta cuenta. Nada más hace falta. */
export type MovimientoDelSaldo = {
  date: string;
  type: "income" | "expense";
  amount: number;
};

/** ¿Este mes tiene cerrada la puerta de entrada? */
export function tieneCorte(cortes: string[], mes: string): boolean {
  return cortes.includes(mes);
}

/**
 * Lo que cada mes SUMA por sí mismo: su presupuesto más sus ingresos menos sus gastos.
 *
 * No incluye lo que venga de atrás. Es el trozo del mes que es suyo y que no cambia nunca,
 * pase lo que pase con las puertas.
 */
function netoPorMes(
  budgets: Record<string, number>,
  transactions: MovimientoDelSaldo[],
  hasta: string
): Record<string, number> {
  const neto: Record<string, number> = {};
  for (const [mes, monto] of Object.entries(budgets)) {
    if (!/^\d{4}-\d{2}$/.test(mes) || mes >= hasta) continue;
    neto[mes] = (neto[mes] ?? 0) + (monto || 0);
  }
  for (const tx of transactions) {
    const mes = tx.date.slice(0, 7);
    if (mes >= hasta) continue;
    neto[mes] = (neto[mes] ?? 0) + (tx.type === "income" ? tx.amount : -tx.amount);
  }
  return neto;
}

/**
 * El saldo con el que arranca un mes.
 *
 * Si ese mes tiene la puerta cerrada, cero y punto. Si no, es el disponible real con el que
 * terminó el mes anterior — que a su vez arrastra lo suyo, y así hacia atrás.
 *
 * Se recorre desde el mes más antiguo con datos hasta el que se pide. Los meses vacíos de en
 * medio no estorban: no suman nada y dejan pasar lo que llevaban.
 *
 * OJO CON LOS MESES VACÍOS QUE SÍ TIENEN CORTE. Un mes sin un solo movimiento pero con la
 * puerta cerrada tiene que dejar el saldo en cero igual: si solo se recorrieran los meses con
 * datos, esa marca se saltaría en silencio y el mes siguiente recibiría lo de dos meses atrás.
 */
export function saldoAnteriorDe(
  mes: string,
  budgets: Record<string, number>,
  transactions: MovimientoDelSaldo[],
  cortes: string[]
): number {
  // La puerta de este mes manda sobre todo lo demás: no hace falta ni mirar hacia atrás.
  if (tieneCorte(cortes, mes)) return 0;

  const neto = netoPorMes(budgets, transactions, mes);

  // Los meses a recorrer: los que tienen datos MÁS los que tienen la puerta cerrada. En texto
  // "AAAA-MM" el orden alfabético y el cronológico son el mismo, así que basta con ordenar.
  const aRecorrer = Array.from(
    new Set([...Object.keys(neto), ...cortes.filter((c) => c < mes)])
  ).sort();

  let saldo = 0;
  for (const m of aRecorrer) {
    // La puerta cerrada tira lo acumulado, pero NO lo que ese mes gane o gaste por su cuenta.
    if (tieneCorte(cortes, m)) saldo = 0;
    saldo += neto[m] ?? 0;
  }
  return saldo;
}
