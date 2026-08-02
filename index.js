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
