// Punto de entrada de la app.
//
// Antes era directamente "expo-router/entry" en package.json. Hace falta uno
// propio para poder registrar el trabajo de fondo: el que registra un yapeo
// en el momento, con la app cerrada.
//
// El registro tiene que pasar aquí, al cargarse el paquete, y no dentro de
// una pantalla. Cuando Android despierta el trabajo no hay ninguna pantalla
// montada —no hay app— y si el trabajo no estuviera registrado ya, Android no
// encontraría nada que ejecutar.
import { AppRegistry } from "react-native";

import "expo-router/entry";

import { capturarEnFondo } from "./utils/capturaEnFondo";
import { exportarEnFondo } from "./utils/exportarEnFondo";

// El nombre tiene que ser EL MISMO que usa FinzoCaptureService en Android.
// Si no coinciden, Android despierta el trabajo, no encuentra nada con ese
// nombre y se cierra sin decir nada: no falla, simplemente no pasa.
AppRegistry.registerHeadlessTask("FinzoCapture", () => async () => {
  try {
    await capturarEnFondo();
  } catch {
    // Nunca dejar que esto reviente. Si algo sale mal, lo capturado sigue en
    // el buzón y la app lo recoge al abrirse, que es lo que pasaba antes de
    // que este trabajo existiera.
  }
});

// Y el reporte que se arma a la hora fijada con la app cerrada. El nombre tiene
// que ser EL MISMO que usa FinzoExportService en Android, por lo mismo de
// arriba: si no coinciden, Android despierta el trabajo, no encuentra nada con
// ese nombre y se cierra sin decir nada.
AppRegistry.registerHeadlessTask("FinzoExport", () => async () => {
  try {
    await exportarEnFondo();
  } catch {
    // Igual que el de arriba: si algo sale mal queda el aviso a la hora y el
    // reporte al abrir la app, que es el comportamiento de siempre.
  }
});
