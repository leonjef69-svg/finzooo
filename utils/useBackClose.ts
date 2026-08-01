import { useEffect } from "react";
import { BackHandler } from "react-native";

/**
 * Cierra una ventana de encima con el botón Atrás de Android.
 *
 * POR QUÉ HACE FALTA
 *
 * Las ventanas que se abren ENCIMA de una pantalla —la vista previa del
 * documento, el recorte de una imagen— no son pantallas de verdad: se dibujan
 * dentro de la que ya estaba. Android no sabe que existen, así que al tocar
 * Atrás cerraba la pantalla ENTERA y saltaba dos pasos de golpe.
 *
 * Se veía así: mirando la vista previa del reporte se tocaba Atrás y el
 * celular se plantaba en Ajustes, obligando a entrar otra vez en Exportar
 * movimientos y a volver a elegirlo todo. Parecía que la app se había salido
 * sola.
 *
 * Con esto, Atrás cierra solo lo de encima y deja debajo lo que estaba, que
 * es lo que espera cualquiera.
 *
 * OJO AL ORDEN: Android pregunta al ÚLTIMO que se apuntó. Como estas ventanas
 * se apuntan al abrirse y se dan de baja al cerrarse, siempre son las últimas
 * mientras están abiertas — y solo mandan ellas.
 */
export function useBackClose(onClose: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      // Devolver true es lo que le dice a Android "ya me encargué yo". Sin
      // esto cerraría la ventana Y la pantalla de debajo: el mismo salto de
      // dos pasos, solo que más difícil de ver.
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
}
