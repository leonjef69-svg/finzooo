import { useEffect, useState } from "react";
import { router, useNavigationContainerRef } from "expo-router";

// Espera activamente a que el sistema de navegación esté LISTO de verdad
// (no solo "existe", sino "puede recibir órdenes de navegar" — son dos
// cosas distintas y esa diferencia fue la causa del error anterior).
function whenNavigationReady(
  navigationRef: ReturnType<typeof useNavigationContainerRef>,
  action: () => void
) {
  let cancelled = false;
  function attempt() {
    if (cancelled) return;
    if (!navigationRef.isReady()) {
      setTimeout(attempt, 50);
      return;
    }
    action();
  }
  attempt();
  return () => {
    cancelled = true;
  };
}

// Como "router.back()", pero si no hay ninguna pantalla a la cual volver
// (por ejemplo, si se entró directo a esta pantalla sin pasar por Inicio),
// en vez de fallar, te lleva a Inicio.
export function safeBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}

// Esta pantalla NUNCA debería ser la primera que se ve al abrir la app
// (por ejemplo "Agregar movimiento"). Si en algún momento eso pasa —sin
// haber pasado antes por Inicio—, se corrige solo y manda a Inicio.
//
// Devuelve `true` mientras se está verificando (o mientras se está
// redirigiendo) — en ese caso, la pantalla que llama a este hook debe
// mostrar "nada" en vez de su contenido normal, para que la persona
// nunca alcance a VER esa pantalla ni un instante antes de la corrección.
//
// `allowed` sirve para los casos en que SÍ es correcto llegar aquí de
// primeras: cuando Android abre Fino con un archivo compartido, la app
// arranca directo en Importar y no hay nada detrás. Ahí, "no hay pantalla
// anterior" no es un error, es lo esperado.
export function useRedirectIfOrphaned(allowed = false) {
  const navigationRef = useNavigationContainerRef();
  const [blocked, setBlocked] = useState(!allowed);

  useEffect(() => {
    if (allowed) return;
    return whenNavigationReady(navigationRef, () => {
      if (!router.canGoBack()) {
        router.replace("/(tabs)");
        // Se queda "blocked" — esta pantalla está por desaparecer.
      } else {
        setBlocked(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  return blocked;
}

// Igual que arriba, pero para navegar a una ruta específica una vez que
// el sistema de navegación ya esté listo para recibir la orden.
export function useNavigateWhenReady(
  action: (() => void) | null,
  deps: unknown[]
) {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (!action) return;
    return whenNavigationReady(navigationRef, action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * ABRIR UNA PANTALLA SIN QUE UN DOBLE TOQUE ABRA DOS (19/08/2026)
 *
 * Reportado por él: *"en la pantalla de calendario le di rápidamente varias veces click en
 * agregar un pago y se abrieron 3 pantallas de nuevo pago"*.
 *
 * Es el fallo clásico de `router.push`: cada toque apila una pantalla, y mientras la primera
 * está entrando —la animación dura unos 300 ms— el botón sigue debajo del dedo. Nadie quiere
 * abrir la misma pantalla tres veces; los toques de más son de impaciencia, no una orden.
 *
 * Medio segundo es la ventana: cubre de sobra la animación y no llega a estorbar a quien
 * abre, vuelve y quiere entrar otra vez.
 *
 * **La hora del último viaje vive en una variable de módulo y NO en un estado.** Con un
 * estado, cada toque redibujaría la pantalla entera — que es justo el trabajo que sobra
 * cuando lo que se está tratando de arreglar es un dedo rápido. Es la misma decisión que se
 * tomó con la pausa del reparto de iconos el 07/08.
 */
let ultimoViaje = 0;

export function irUnaVez(ruta: Parameters<typeof router.push>[0]): void {
  const ahora = Date.now();
  if (ahora - ultimoViaje < 500) return;
  ultimoViaje = ahora;
  router.push(ruta);
}
