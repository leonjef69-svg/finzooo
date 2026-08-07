import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/**
 * El puente con el despertador de Android.
 *
 * SE PIDE "OPCIONAL" A PROPOSITO
 *
 * Las actualizaciones por internet NO traen codigo de Android. Quien tenga un
 * APK anterior a esto recibe el JavaScript nuevo y un modulo nativo que no
 * existe. Con requireNativeModule reventaria al arrancar la app entera; asi
 * simplemente no esta, y las funciones de abajo se portan como si la funcion no
 * existiera — que es la verdad.
 */
type NativeShape = {
  estaDisponible: () => boolean;
  programar: (cuandoMillis: number) => void;
  cancelar: () => void;
  htmlAPdf: (html: string, destino: string) => Promise<string>;
};

const nativo = requireOptionalNativeModule<NativeShape>("ExportScheduler");

/**
 * ¿Este APK sabe exportar con la app cerrada?
 *
 * La pantalla lo pregunta antes de prometer nada: decir "a las 19:26 sale solo"
 * en un celular cuyo APK no lo trae es exactamente la clase de promesa que hace
 * que alguien deje de confiar en el resto.
 */
export function puedeExportarEnFondo(): boolean {
  return Platform.OS === "android" && nativo?.estaDisponible() === true;
}

/** Pone el despertador para ese momento. Si el APK no lo trae, no hace nada. */
export function programarExportacion(cuando: Date): void {
  nativo?.programar(cuando.getTime());
}

/** Quita el despertador. */
export function cancelarExportacion(): void {
  nativo?.cancelar();
}

/** Se lanza cuando el APK instalado no sabe hacer el PDF sin pantalla. */
export class PdfEnFondoNoDisponible extends Error {
  constructor() {
    super("pdf-en-fondo-no-disponible");
    this.name = "PdfEnFondoNoDisponible";
  }
}

/**
 * ¿ESTE APK sabe hacer el PDF sin pantalla?
 *
 * Se pregunta por la FUNCIÓN y no por el módulo, y esa diferencia importa: los
 * APK 6ago-01 y 6ago-02 ya traen el módulo (el despertador) pero NO traen esta
 * función, que llegó después. Preguntando solo por el módulo, la app prometería
 * el PDF automático a un celular que no puede hacerlo.
 */
export function puedePdfEnFondo(): boolean {
  return Platform.OS === "android" && typeof nativo?.htmlAPdf === "function";
}

/** Se lanza cuando la conversión no contesta ni bien ni mal. Ver el tope de abajo. */
export class PdfEnFondoSinRespuesta extends Error {
  constructor(segundos: number) {
    super(`pdf-en-fondo-sin-respuesta-${segundos}s`);
    this.name = "PdfEnFondoSinRespuesta";
  }
}

/**
 * Cuánto se espera a la conversión antes de darla por perdida, EN ESTE LADO.
 *
 * El código de Android tiene su propio tope, y este es el de reserva: los APK
 * anteriores al 06/08/2026 por la noche NO lo traen, y las actualizaciones por
 * internet no pueden añadirlo. Sin este, en esos APK el botón "Probar ahora" se
 * queda girando para siempre y el trabajo de fondo muere en silencio al agotar
 * su tiempo — que es exactamente lo que pasó.
 *
 * Va más alto que el de Android (30 s) a propósito: si el de allá funciona, es él
 * quien contesta, y su mensaje dice mucho más que "no contestó".
 */
const TOPE_PDF_MS = 40_000;

/**
 * Convierte el HTML del reporte en un PDF, sin necesitar la app en pantalla.
 *
 * Es lo que permite que el PDF automático sea EL MISMO documento que el de a
 * mano: se le pasa el HTML que arma utils/reportePdfDatos, el de siempre.
 *
 * NUNCA SE QUEDA ESPERANDO PARA SIEMPRE. Un trabajo de fondo colgado no avisa de
 * nada: no falla, no termina, y desde fuera se ve igual que "no pasó nada".
 */
export async function htmlAPdfEnFondo(html: string, destino: string): Promise<string> {
  if (!puedePdfEnFondo()) throw new PdfEnFondoNoDisponible();
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      nativo!.htmlAPdf(html, destino),
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(
          () => rechazar(new PdfEnFondoSinRespuesta(TOPE_PDF_MS / 1000)),
          TOPE_PDF_MS
        );
      }),
    ]);
  } finally {
    // Sin esto el temporizador sigue vivo hasta el final aunque la conversión ya
    // haya salido bien, y en un trabajo de fondo eso es tener el proceso
    // despierto sin motivo.
    if (reloj) clearTimeout(reloj);
  }
}
