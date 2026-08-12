// COMO SE ESCRIBE EL DINERO EN UN AVISO, EN CUALQUIERA DE LOS PAISES (11/08/2026)
//
// EL HUECO, ENCONTRADO POR UNA PREGUNTA SUYA
//
// Se acababa de añadir Bolivia como país y moneda, y preguntó lo obvio: *"si me pongo la
// moneda en Bolivia, ¿el yape llegará igual pero en bolivianos?"*.
//
// La respuesta era NO, y no por poco:
//
//   · El servicio que HABLA exigía "S/" o "PEN" para dar el aviso por bueno. Con "Bs 50"
//     decía "sin-monto" y **no hablaba nunca**.
//   · El intérprete que REGISTRA el movimiento tenía la misma lista. Se salvaba de milagro
//     cuando el monto llevaba céntimos —hay una segunda regla que acepta "50.00" a secas— así
//     que "Bs 50.00" entraba y "Bs 50" se perdía sin dejar rastro.
//
// Es el fallo típico de este proyecto otra vez: **dos mitades que por separado están bien y el
// fallo en la costura.** La app ofrecía nueve monedas desde hacía meses; el lector de avisos
// solo entendía una.
//
// POR QUE UNA LISTA APARTE
//
// Los símbolos hacen falta en tres sitios que no se pueden llamar entre ellos: aquí, en el
// código de Android que habla con la app cerrada, y en la prueba. Escritos tres veces se
// separan — ya pasó con las palabras de la voz. Esta es la copia buena, y una prueba obliga a
// que las otras digan lo mismo.

/**
 * Los símbolos, ordenados de más largo a más corto.
 *
 * EL ORDEN IMPORTA. "US$" tiene que probarse antes que "$", o "US$ 20" se leería como un "$"
 * suelto con una "US" colgando delante. Lo mismo con "S/." y "S/".
 */
export const SIMBOLOS_DE_MONEDA = [
  "col$",
  "us$",
  "mx$",
  "ar$",
  "cl$",
  "pen",
  "s/.",
  "s/",
  "bs.",
  "bs",
  "r$",
  "€",
  "$",
] as const;

/**
 * La parte de la expresión que reconoce "hay dinero aquí".
 *
 * Se arma en vez de escribirse a mano para que añadir una moneda sea tocar UNA lista.
 *
 * LAS LETRAS LLEVAN LIMITE DE PALABRA. Sin él, "pen" haría creer que hay un monto en
 * "pendiente" o "pensión", y "bs" en cualquier palabra que empiece así. Los símbolos que no
 * son letras —"S/", "$", "€"— no lo necesitan y además lo estropearían: `\b` entre dos
 * caracteres no alfabéticos no casa.
 */
export function patronDeMoneda(): string {
  const partes: string[] = [];
  for (const simbolo of SIMBOLOS_DE_MONEDA) {
    // Los soles se añaden aparte, abajo, y con más manga ancha.
    if (simbolo === "s/." || simbolo === "s/") continue;
    const escapado = simbolo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    partes.push(/^[a-z]/.test(simbolo) ? `\\b${escapado}` : escapado);
  }

  // LOS SOLES, ACEPTANDO ESPACIOS EN MEDIO: "S / 20".
  //
  // El lector de notificaciones a veces mete espacios donde no los hay, y esa tolerancia ya
  // estaba antes de que existiera esta lista. Al pasar todos los símbolos por la misma regla
  // se perdió sin querer, y una prueba lo cazó: el servicio veía el monto y el intérprete no.
  // Los dos tienen que ver lo mismo, siempre — cuando no, la app registra el yapeo y el
  // celular se queda callado.
  partes.push("s\\s*/\\s*\\.?");

  return `(?:${partes.join("|")})`;
}
