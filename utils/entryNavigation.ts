import { Keyboard } from "react-native";
import { reemplazarUnaVez } from "@/utils/nav";

export function switchEntryRoute(route: "/login" | "/register"): void {
  // Ocultar el teclado antes de reemplazar evita transportar su altura a la otra pantalla.
  Keyboard.dismiss();
  reemplazarUnaVez(route);
}
