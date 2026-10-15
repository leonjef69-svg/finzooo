// LO QUE COSTARÍA PREMIUM
//
// Son precios propuestos que la pantalla comparte entre selector, importe y ahorro.
// No son precios de tienda: Play Billing todavía no está activado y nada se cobra.
//
// EL PAGO TODAVÍA NO EXISTE, Y ESO ESTÁ DICHO EN LA PANTALLA
//
// No hay cobro integrado: no hay Play Billing ni pasarela. Así que estos números son
// lo que costaría, no lo que se cobra. La pantalla lo dice con letra pequeña
// (premium.sinCobro) en vez de callarlo, porque un botón "ADQUIRIR" que no cobra y
// no lo advierte es exactamente lo que hace que alguien se sienta engañado.
//
// Y es uno de los puntos que hay que resolver antes de publicar en Play Store — está
// en la lista de ESTADO.md.

/** Los precios, en la moneda de la tienda (soles). */
export const PRECIOS = {
  /** Propuesta de precio mensual para Fino Pro. */
  mensualNormal: 9.99,
  /** Lo que se paga en la promoción de los tres primeros meses. */
  mensualPromo: 5,
  /** Cuántos meses dura la promoción mensual. */
  mesesPromo: 3,
  /** El plan de un año, de una sola vez. */
  anual: 84,
  /** Propuesta mensual de Fino Plus; todavía no se cobra en la app. */
  plusMensual: 3.6,
} as const;

/** Ahorro anual frente a pagar Pro mes a mes durante doce meses. */
export const AHORRO_PRO_ANUAL = Number((PRECIOS.mensualNormal * 12 - PRECIOS.anual).toFixed(2));
