// CUADRAR LA CAJA: DECIRLE A LA APP CUÁNTO TIENES DE VERDAD (10/08/2026)
//
// EL PROBLEMA, QUE NO TENÍA ARREGLO
//
// Finzo no ve tu dinero. El "Saldo disponible" sale de lo que escribiste: presupuesto, más
// ingresos, menos gastos, más lo que venía del mes pasado. Todo lo teclea la persona.
//
// Así que cada compra sin anotar deja una diferencia entre la app y el bolsillo. Y esa
// diferencia NO SE CORRIGE SOLA NUNCA: al mes siguiente pasa entera al saldo anterior, y al
// otro, y crece. A los doce meses la app puede decir S/ 2.400 con S/ 600 en la mano.
//
// Hasta ahora no había ninguna forma de arreglarlo desde dentro de la app.
//
// CÓMO SE ARREGLA, Y POR QUÉ ASÍ
//
// Cuentas tu plata, se la dices, y la app anota la diferencia como UN MOVIMIENTO NORMAL. No un
// número escondido, no una corrección invisible: una línea más en tu lista, con su fecha y su
// nombre, que se ve y se borra como cualquier otra.
//
// Lo evidente sería guardar aparte un "saldo real" y pintar ese número. Se descartó por dos
// motivos, y los dos importan:
//
//   · Un saldo que no sale de los movimientos es un número que nadie puede comprobar. En una
//     app de dinero, "confía en mí" no vale.
//   · No se podría deshacer. Al ser un movimiento, borrarlo devuelve todo a como estaba, sin
//     necesidad de guardar el valor anterior en ningún sitio.
//
// Y por ser un movimiento normal, todo lo demás sigue funcionando sin tocarlo: entra en el
// saldo anterior del mes siguiente, en los reportes y en lo exportado, sin una sola línea de
// código nueva en ninguno de los tres.

/** Lo que hay que anotar para cuadrar. `null` cuando ya cuadra y no hay nada que hacer. */
export type AjusteAAnotar = {
  /** Menos plata de la que decía la app → un gasto. Más → un ingreso. */
  type: "expense" | "income";
  /** Siempre positivo: el tipo ya dice hacia dónde va. */
  amount: number;
};

/**
 * Qué movimiento hace falta para que la app diga lo mismo que tu bolsillo.
 *
 * Se redondea a céntimos porque los dos números vienen de sumas y restas de decimales, y sin
 * redondear un ajuste "exacto" puede dejar 0.000000001 de resto: un movimiento de cero soles en
 * la lista, que no se puede explicar.
 */
export function ajusteNecesario(disponible: number, plataReal: number): AjusteAAnotar | null {
  if (!Number.isFinite(disponible) || !Number.isFinite(plataReal)) return null;

  const diferencia = Math.round((plataReal - disponible) * 100) / 100;
  if (diferencia === 0) return null;

  return diferencia < 0
    ? { type: "expense", amount: Math.abs(diferencia) }
    : { type: "income", amount: diferencia };
}
