import { useRef } from "react";

/**
 * EL VALOR DE UN CONTEXTO QUE SOLO CAMBIA CUANDO ALGO CAMBIÓ DE VERDAD.
 *
 * **EL PROBLEMA (20/08/2026).** `AppDataContext` entregaba su valor como un objeto escrito a
 * mano dentro del JSX: `value={{ ready, month, transactions, logout, ... }}`. Un objeto
 * literal es uno NUEVO en cada dibujado, y React compara los contextos por identidad, no por
 * contenido. O sea: cada vez que cambiaba cualquiera de los 34 estados del proveedor —un
 * aviso, el mes, un movimiento, el mensajito de "guardado"— **se redibujaban de golpe todas
 * las pantallas montadas**, aunque ninguna usara lo que cambió.
 *
 * Él lo dijo así de claro: *"quiero que la aplicación vaya rápido, limpio"*.
 *
 * **POR QUÉ NO SE ARREGLA CON UN `useMemo` NORMAL.** Habría que escribir la lista de las 110
 * cosas de las que depende, y olvidar UNA deja la pantalla enseñando un dato viejo — un fallo
 * silencioso y de los caros. Y aun escribiéndolas todas no serviría de nada: unas sesenta de
 * esas cosas son funciones declaradas dentro del componente, o sea funciones nuevas en cada
 * dibujado, así que el `useMemo` nunca acertaría.
 *
 * **LO QUE HACE ESTO, Y POR QUÉ ES SEGURO.** No hay ninguna lista que mantener:
 *
 *  · Las **funciones** se envuelven UNA sola vez y esa envoltura no cambia jamás. Por dentro
 *    llama siempre a la última versión —se guarda en una caja que se refresca en cada
 *    dibujado—, así que no puede quedarse con datos viejos. Es la diferencia con `useCallback`
 *    y su lista de dependencias, que es justo donde se cuelan los fallos.
 *  · De lo **demás** se compara el valor con el del dibujado anterior. Si no cambió nada, se
 *    devuelve el MISMO objeto y React no despierta a nadie.
 *
 * **LO ÚNICO QUE HAY QUE SABER PARA USARLO:** las claves del objeto tienen que ser siempre las
 * mismas. Con un objeto escrito a mano lo son.
 *
 * **Y EL DETALLE QUE HAY QUE VIGILAR:** si alguna pantalla pusiera una de estas funciones en
 * la lista de dependencias de un efecto **esperando que cambie**, ese efecto dejaría de
 * dispararse. Se comprobó antes de hacer esto que ninguna lo hace, y hay una prueba que lo
 * vigila (ver `verificar-valor-estable`).
 */
export function useValorEstable<T extends object>(crudo: T): T {
  // La caja con lo último. Se refresca ANTES de cualquier envoltura, para que una función
  // llamada durante este mismo dibujado ya vea los datos de ahora.
  const vivo = useRef(crudo);
  vivo.current = crudo;

  const guardado = useRef<{ crudo: T; estable: T } | null>(null);

  if (guardado.current === null) {
    const estable = {} as Record<string, unknown>;
    for (const clave of Object.keys(crudo)) {
      const valor = (crudo as Record<string, unknown>)[clave];
      estable[clave] =
        typeof valor === "function"
          ? (...args: unknown[]) =>
              ((vivo.current as Record<string, unknown>)[clave] as (...a: unknown[]) => unknown)(
                ...args
              )
          : valor;
    }
    guardado.current = { crudo, estable: estable as T };
    return estable as T;
  }

  const anterior = guardado.current.crudo as Record<string, unknown>;
  const ahora = crudo as Record<string, unknown>;

  let cambio = false;
  for (const clave of Object.keys(ahora)) {
    // Las funciones se saltan: su envoltura ya es la misma y por dentro apunta a la de ahora.
    if (typeof ahora[clave] === "function") continue;
    if (!Object.is(ahora[clave], anterior[clave])) {
      cambio = true;
      break;
    }
  }

  if (!cambio) {
    // Se guarda el crudo de ahora igualmente: las funciones de dentro son las nuevas, y la
    // próxima comparación tiene que hacerse contra este dibujado y no contra uno más viejo.
    guardado.current = { crudo, estable: guardado.current.estable };
    return guardado.current.estable;
  }

  const estable = { ...(guardado.current.estable as Record<string, unknown>) };
  for (const clave of Object.keys(ahora)) {
    if (typeof ahora[clave] !== "function") estable[clave] = ahora[clave];
  }
  guardado.current = { crudo, estable: estable as T };
  return estable as T;
}
