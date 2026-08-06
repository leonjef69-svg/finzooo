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
