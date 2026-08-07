// Sombra suave reutilizable para tarjetas, filas y hojas — se pasa por
// "style" (no por className) porque las utilidades de sombra de Tailwind
// no se ven igual de bien en Android e iOS.
export const CARD_SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

/**
 * LA TARJETA VERDE DEL SALDO DISPONIBLE.
 *
 * Hay dos: la de Inicio y la del Panorama del mes en Reportes. Enseñan el MISMO
 * número con el MISMO título, así que tienen que verse igual — son la misma
 * tarjeta en dos sitios, no dos tarjetas parecidas.
 *
 * ESTABAN DISTINTAS, Y SE VEÍA (07/08/2026)
 *
 * El usuario mandó las dos juntas: *"redondea las esquinas y los bordes
 * emparéjalos al igual que los demás, y ponle un color que vaya de acorde, no ese
 * aparente blanco que se ve feo"*. Tres diferencias, y una era un fallo de verdad:
 *
 *   · Verde distinto. La de Reportes iba más apagada (#065f46 → #047857) que la
 *     de Inicio.
 *   · Esquinas menos redondas: 24 puntos contra 32.
 *   · **Le faltaba `overflow-hidden`, y eso es lo del "blanco".** Sin recortar, en
 *     Android el degradado se pinta con las esquinas CUADRADAS y el borde blanco
 *     se dibuja redondeado encima: en cada esquina asoma el arco claro del borde
 *     con el verde saliéndose por fuera. No era un color mal elegido, era el
 *     relleno sin recortar.
 *
 * Por eso el aspecto vive aquí y no copiado en dos pantallas: ya se arregló una y
 * la otra se quedó atrás —el comentario de Inicio incluso llama a la de Reportes
 * "la hermana de esta"— y es el fallo que este proyecto repite.
 *
 * El borde va en blanco al 45%: al 20% se perdía sobre el verde y la tarjeta
 * parecía la única sin contorno rodeada de tarjetas que sí lo llevan. Un borde
 * gris como el de las demás chirriaría sobre el verde.
 */
export const SALDO_VERDE = ["#059669", "#0f766e"] as const;
export const SALDO_TARJETA = "rounded-[32px] overflow-hidden border-[1.5px] border-white/45";
