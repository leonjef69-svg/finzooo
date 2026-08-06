// Sustituto de @/modules/export-scheduler.
//
// El de verdad habla con el despertador de Android a traves de
// requireOptionalNativeModule, que no existe en Node. Sin este sustituto, las
// pruebas que cargan utils/scheduledExport se caen al arrancar — y ese archivo
// lo cargan varias que no tienen nada que ver con el despertador.
//
// Aqui no hacen nada, y eso es exactamente lo que hacen en un celular cuyo APK
// es anterior al modulo nativo: la app tiene que funcionar igual en los dos
// casos, y esa es justo la propiedad que conviene que las pruebas ejerciten.

export function puedeExportarEnFondo(): boolean {
  return false;
}

export function programarExportacion(_cuando: Date): void {}

export function cancelarExportacion(): void {}
