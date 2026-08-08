// EL YAPEO QUE ENTRA AL NEGOCIO (Modo Negocio V1, paso 5, 08/08/2026)
//
// Es la última pieza de la V1 y la única que toca un camino que YA FUNCIONA: el registro
// automático de yapeos. Los cuatro pasos anteriores no tocaron ni una línea de lo personal.
//
// POR QUÉ TODA LA DECISIÓN ESTÁ EN ESTE ARCHIVO Y NO REPARTIDA
//
// Porque así se puede probar entera sin celular y sin Yape: se le pasan los movimientos que
// habrían entrado y el negocio que recibe, y devuelve qué va a cada bolsillo. Y porque el
// camino personal no se toca: utils/autoCapture sigue haciendo exactamente lo de siempre
// —entender el aviso, descartar repetidos, dejar el registro— y esto ocurre DESPUÉS, con lo
// que ya decidió.
//
// LA REGLA QUE PROTEGE TODO LO DEMÁS: sin un negocio que reciba, esta función devuelve la
// lista tal cual entró. Ni una vuelta, ni una copia distinta. Con el interruptor apagado —que
// es como está por defecto— la app se comporta igual que antes de existir este archivo.
//
// SOLO LO QUE ENTRA, Y ES DELIBERADO
//
// Un yapeo que TÚ pagas sigue siendo tuyo: lo pagaste con tu celular y con tu plata. Lo que
// se pidió fue lo contrario —*"una pollería que recibe un Yape de un cliente"*— y mandar
// también tus pagos a la caja del negocio metería la compra del almuerzo entre los gastos del
// local.
//
// Y NO SE ADIVINA QUÉ SE VENDIÓ. Un yapeo de S/ 15 significa "entraron S/ 15" y nada más:
// *"En V1 NO quiero que el sistema diga: recibiste S/15, entonces vendiste un Broster"*.
// Juntarlo con su venta es V2, y para eso está el hueco de `ventaId`.

import {
  ahoraDelNegocio,
  crearMovimientoNegocio,
  type MetodoDeVenta,
  type MovimientoNegocio,
  type Negocio,
} from "@/utils/negocio";
import type { Transaction } from "@/types";

/**
 * El negocio que se queda con los yapeos, si hay alguno.
 *
 * SOLO PUEDE HABER UNO. Con dos, el mismo yapeo tendría dos destinos posibles y la respuesta
 * dependería del orden de la lista — o sea, del azar. En una app de dinero, "depende" no es
 * una respuesta.
 *
 * Y tiene que estar activo: un negocio cerrado no recibe nada.
 */
export function negocioQueRecibeYapes(negocios: Negocio[]): Negocio | undefined {
  return negocios.find((n) => n.activo && n.destinoYapes === "negocio");
}

/**
 * Enciende o apaga el envío de yapeos a un negocio, APAGÁNDOLO EN LOS DEMÁS.
 *
 * La regla de "solo uno" se aplica aquí, al cambiarlo, y no al leerlo: si se dejara para la
 * lectura, en el disco quedarían dos negocios diciendo que reciben, y la próxima pantalla que
 * lo lea sin pasar por aquí volvería a tener dos respuestas.
 */
export function mandarYapesA(negocios: Negocio[], id: string, activar: boolean): Negocio[] {
  return negocios.map((n) => {
    if (n.id === id) return { ...n, destinoYapes: activar ? "negocio" : "personal" };
    // Los demás se apagan SIEMPRE que se encienda uno, y se quedan como estaban si se está
    // apagando: apagar el de la pollería no tiene por qué tocar nada más.
    return activar ? { ...n, destinoYapes: "personal" } : n;
  });
}

/**
 * Junta la caja que la app tiene en memoria con la que hay en el disco.
 *
 * POR QUÉ HACE FALTA, Y ES EXACTAMENTE EL MISMO PROBLEMA QUE YA TUVIERON LOS MOVIMIENTOS
 *
 * La app guarda la lista entera cada vez que cambia algo. Mientras solo escriba ella, bien.
 * Pero desde el paso 5 hay otro que escribe: el trabajo de fondo que registra el yapeo con la
 * app cerrada. Sin juntar, la app volvería con su lista vieja en memoria y el siguiente
 * guardado pisaría ese yapeo — y nadie se enteraría hasta que la caja no cuadre.
 *
 * NUNCA BORRA, igual que mergeTransactions y por lo mismo: un movimiento borrado de verdad
 * desaparece de los dos lados a la vez. Y entre perder uno o quedarse con uno de más, el de
 * más se ve y se borra a mano; el que falta no se ve nunca.
 *
 * DEVUELVE LA MISMA LISTA si no hay nada nuevo, y con la misma referencia: esto se llama cada
 * ocho segundos, y devolver una lista nueva cada vez repintaría el panel y volvería a guardar
 * y a subir a la nube el negocio entero sin que hubiera cambiado nada.
 */
export function fusionarMovimientosNegocio(
  enMemoria: MovimientoNegocio[],
  guardados: MovimientoNegocio[]
): MovimientoNegocio[] {
  if (guardados.length === 0) return enMemoria;
  const conocidos = new Set(enMemoria.map((m) => m.id));
  const nuevos = guardados.filter((m) => !conocidos.has(m.id));
  if (nuevos.length === 0) return enMemoria;
  return [...enMemoria, ...nuevos];
}

/** La marca del aviso de Android, para no registrar dos veces el mismo yapeo. */
function idDeAviso(postedAt: number): string {
  return `aviso_${postedAt}`;
}

/** Con qué se cobró, en las palabras del negocio. Hoy solo se miran los avisos de Yape. */
function metodoDeLaCuenta(cuenta: string | undefined): MetodoDeVenta {
  if (cuenta === "yape") return "yape";
  if (cuenta === "plin") return "plin";
  return "otro";
}

/**
 * Reparte lo que la captura automática iba a registrar: qué se queda en lo personal y qué
 * entra en la caja del negocio.
 *
 * `avisoDe` dice de qué aviso vino cada movimiento (su hora exacta en milisegundos). Sin eso
 * no se puede marcar el movimiento del negocio con su aviso, y sin la marca no hay forma de
 * saber que un yapeo ya se registró.
 */
export function separarLoDelNegocio(
  aRegistrar: Transaction[],
  avisoDe: Record<number, number>,
  negocio: Negocio | undefined,
  yaEnLaCaja: MovimientoNegocio[]
): { personales: Transaction[]; delNegocio: MovimientoNegocio[] } {
  // SIN NEGOCIO QUE RECIBA, TODO SIGUE COMO SIEMPRE. Es la línea que hace que encender el
  // Modo Negocio no cambie nada mientras no se diga lo contrario.
  if (!negocio || !negocio.activo || negocio.destinoYapes !== "negocio") {
    return { personales: aRegistrar, delNegocio: [] };
  }

  const yaVistos = new Set(yaEnLaCaja.map((m) => m.avisoId).filter(Boolean));
  const personales: Transaction[] = [];
  const delNegocio: MovimientoNegocio[] = [];

  for (const mov of aRegistrar) {
    // Lo que sale de tu bolsillo sigue siendo tuyo. Ver arriba.
    if (mov.type !== "income") {
      personales.push(mov);
      continue;
    }
    const cuando = avisoDe[mov.id];
    // SIN LA MARCA DEL AVISO SE QUEDA EN PERSONAL, que es el sitio donde estaría hoy. Meterlo
    // en la caja sin poder marcarlo lo dejaría expuesto a registrarse otra vez, y un ingreso
    // duplicado en una caja es peor que uno bien puesto en el bolsillo equivocado: el segundo
    // se ve y se mueve, el primero solo infla el saldo.
    if (cuando === undefined) {
      personales.push(mov);
      continue;
    }
    const avisoId = idDeAviso(cuando);
    // Ya estaba en la caja: no se registra otra vez, y tampoco cae en lo personal.
    if (yaVistos.has(avisoId)) continue;
    yaVistos.add(avisoId);

    // LA FECHA Y LA HORA SON LAS DEL AVISO, no las de ahora. Si el celular estuvo sin abrir la
    // app dos días, el yapeo es del día que llegó. Es la misma regla que ya seguía el camino
    // personal.
    const { fecha, hora } = ahoraDelNegocio(cuando);
    delNegocio.push(
      crearMovimientoNegocio({
        negocioId: negocio.id,
        tipo: "ingreso",
        monto: mov.amount,
        metodo: metodoDeLaCuenta(mov.account),
        descripcion: mov.description,
        fecha,
        hora,
        origen: "automatico",
        avisoId,
      })
    );
  }

  return { personales, delNegocio };
}
