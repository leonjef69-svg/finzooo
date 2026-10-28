import { useEffect, useState } from "react";
import { router, useNavigationContainerRef } from "expo-router";
import { StackActions, type NavigationProp, type NavigationState, type ParamListBase, type PartialState } from "@react-navigation/native";

// `isReady()` puede conservar un `true` viejo durante Fast Refresh, cuando el
// contenedor anterior ya se desmontó y el nuevo todavía no tiene árbol. La
// clave del estado raíz confirma que el Stack actual sí está montado.
export function isNavigationMounted(
  navigationRef: ReturnType<typeof useNavigationContainerRef>
): boolean {
  return navigationRef.isReady() && Boolean(navigationRef.getRootState()?.key);
}

// Espera activamente a que el sistema de navegación esté LISTO de verdad
// (no solo "existe", sino "puede recibir órdenes de navegar" — son dos
// cosas distintas y esa diferencia fue la causa del error anterior).
function whenNavigationReady(
  navigationRef: ReturnType<typeof useNavigationContainerRef>,
  action: () => void
) {
  let cancelled = false;
  let readyChecks = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function attempt() {
    if (cancelled) return;
    if (!isNavigationMounted(navigationRef)) {
      readyChecks = 0;
      timer = setTimeout(attempt, 50);
      return;
    }
    // Dos comprobaciones consecutivas evitan navegar en el instante intermedio
    // en que Expo Router está reemplazando el contenedor durante una recarga.
    readyChecks++;
    if (readyChecks < 2) {
      timer = setTimeout(attempt, 50);
      return;
    }
    action();
  }
  attempt();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

// Como "router.back()", pero si no hay ninguna pantalla a la cual volver
// (por ejemplo, si se entró directo a esta pantalla sin pasar por Inicio),
// en vez de fallar, te lleva a Inicio.
export function safeBack() {
  ultimosViajes.clear();
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
 * Un segundo y medio es la ventana. Medio segundo resultó insuficiente en
 * celulares donde montar la pantalla y terminar la animación tarda más: el
 * botón de atrás seguía recibiendo un segundo toque y apilaba otra copia.
 *
 * **La hora del último viaje vive en una variable de módulo y NO en un estado.** Con un
 * estado, cada toque redibujaría la pantalla entera — que es justo el trabajo que sobra
 * cuando lo que se está tratando de arreglar es un dedo rápido. Es la misma decisión que se
 * tomó con la pausa del reparto de iconos el 07/08.
 */
const ultimosViajes = new Map<string, number>();
let ultimoReemplazo: { clave: string; cuando: number } | null = null;
let ultimoCambioEspacio: { ruta: string; cuando: number } | null = null;
let ultimoRetroceso = 0;
const BLOQUEO_NAVEGACION_MS = 1500;

function claveDeRuta(ruta: Parameters<typeof router.push>[0]): string {
  if (typeof ruta === "string") return ruta;
  const params = ruta.params ? JSON.stringify(ruta.params) : "";
  return `${ruta.pathname}?${params}`;
}

function seNavegoHacePoco(accion: "push" | "replace", ruta: Parameters<typeof router.push>[0]): boolean {
  const ahora = Date.now();
  const clave = `${accion}:${claveDeRuta(ruta)}`;
  const anterior = ultimosViajes.get(clave) ?? 0;
  if (ahora - anterior < BLOQUEO_NAVEGACION_MS) return true;
  ultimosViajes.set(clave, ahora);
  return false;
}

export function irUnaVez(ruta: Parameters<typeof router.push>[0]): boolean {
  if (seNavegoHacePoco("push", ruta)) return false;
  router.push(ruta);
  return true;
}

/**
 * La misma protección para selectores que CAMBIAN de espacio en vez de apilar
 * una pantalla. Sin esto, dos toques rápidos podían ordenar dos reemplazos y el
 * segundo terminaba ganando cuando el primero todavía estaba montándose.
 */
export function reemplazarUnaVez(ruta: Parameters<typeof router.replace>[0]): void {
  const ahora = Date.now();
  const clave = claveDeRuta(ruta);
  const transcurrido = ultimoReemplazo ? ahora - ultimoReemplazo.cuando : Infinity;
  // Solo se descarta repetir el ÚLTIMO destino. Familia → Cajas → Familia
  // es un regreso válido, aunque todavía no hayan pasado 1,5 segundos.
  if (ultimoReemplazo?.clave === clave && transcurrido >= 0 && transcurrido < BLOQUEO_NAVEGACION_MS) return;
  router.replace(ruta);
  // Si el navegador rechaza la orden, el siguiente toque debe poder reintentar.
  ultimoReemplazo = { clave, cuando: ahora };
}

type SpaceRoute = "/(tabs)" | "/family" | "/boxes";
type SpaceStack = NavigationState | PartialState<NavigationState>;

function spaceStack(state: SpaceStack | undefined): SpaceStack | undefined {
  let current: SpaceStack | undefined = state;
  while (current) {
    if (["(tabs)", "family", "boxes"].every(name => current?.routeNames?.includes(name))) return current;
    current = current.routes[current.index ?? current.routes.length - 1]?.state;
  }
  return undefined;
}

/** Conserva UN Inicio al cambiar de espacio. Familia/Cajas se sustituyen
 * entre sí; volver retira la pantalla de delante en vez de recrear también
 * el navegador de pestañas. No precarga tres pantallas ni acumula visitas.
 * popTo también reemplaza con Inicio si se entró por un enlace directo.
 */
export function cambiarEspacioUnaVez(navigation: Pick<NavigationProp<ParamListBase>, "dispatch"> & { getState: () => NavigationState | undefined }, destino: SpaceRoute): void {
  const available = spaceStack(navigation.getState());
  const active = available?.routes[available.index ?? available.routes.length - 1]?.name;
  if (!available || !active || !["(tabs)", "family", "boxes"].includes(active)) return;
  const ahora = Date.now();
  const elapsed = ultimoCambioEspacio ? ahora - ultimoCambioEspacio.cuando : Infinity;
  if (ultimoCambioEspacio?.ruta === destino && elapsed >= 0 && elapsed < BLOQUEO_NAVEGACION_MS) return;
  const name = destino === "/(tabs)" ? "(tabs)" : destino.slice(1);
  // Resolver contra el árbol vigente AL ejecutar la orden: otro toque puede
  // proceder todavía del Inicio saliente. No fiarse de su etiqueta antigua.
  navigation.dispatch(state => {
    const stack = spaceStack(state);
    const current = stack?.routes[stack.index ?? stack.routes.length - 1]?.name;
    if (!stack?.key || !current || !["(tabs)", "family", "boxes"].includes(current)) {
      return { ...StackActions.popTo(state.routes[state.index].name), target: state.key };
    }
    const action = name === "(tabs)" || current === name ? StackActions.popTo(name)
      : current === "(tabs)" ? StackActions.push(name) : StackActions.replace(name);
    return { ...action, target: stack.key };
  });
  // Una orden rechazada permite reintentar inmediatamente.
  ultimoCambioEspacio = { ruta: destino, cuando: ahora };
}

export function volverUnaVez(): void {
  const ahora = Date.now();
  if (ahora - ultimoRetroceso < BLOQUEO_NAVEGACION_MS) return;
  ultimoRetroceso = ahora;
  safeBack();
}
