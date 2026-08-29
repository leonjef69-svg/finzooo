// LO QUE COSTARÍA PREMIUM
//
// Vive aquí y no escrito dentro de la pantalla por un motivo concreto: los mismos
// números aparecen en cuatro sitios de esa pantalla (el selector de arriba, el
// precio grande, el precio tachado y el cálculo por mes del plan anual). Escritos a
// mano en cada uno, basta cambiar el precio una vez para que dos de los cuatro digan
// otra cosa — y un precio que se contradice a sí mismo es de las cosas que hacen
// desconfiar de una app de dinero.
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
  /** Lo que costaría normalmente cada mes. Es el precio tachado. */
  mensualNormal: 9.9,
  /** Lo que se paga en la promoción de los tres primeros meses. */
  mensualPromo: 5,
  /** Cuántos meses dura la promoción mensual. */
  mesesPromo: 3,
  /** El plan de un año, de una sola vez. */
  anual: 50,
} as const;
