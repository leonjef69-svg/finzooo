import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

export type EntryOperationGuard = () => boolean;

/** Cancelar la continuación de una pantalla, no la llamada al SDK ya enviada. */
export function createEntryOperationScope() {
  let focused = false;
  let revision = 0;
  return {
    focus() { focused = true; revision++; },
    blur() { focused = false; revision++; },
    begin(): EntryOperationGuard {
      const operation = ++revision;
      return () => focused && revision === operation;
    },
  };
}

/** El selector nativo puede poner Android inactive sin abandonar esta ruta. */
export function useEntryOperation(onFocus: () => void): () => EntryOperationGuard {
  const reset = useRef(onFocus);
  reset.current = onFocus;
  const scope = useRef<ReturnType<typeof createEntryOperationScope> | null>(null);
  scope.current ??= createEntryOperationScope();
  useFocusEffect(useCallback(() => {
    scope.current!.focus();
    reset.current();
    return () => scope.current!.blur();
  }, []));
  return useCallback(() => scope.current!.begin(), []);
}
