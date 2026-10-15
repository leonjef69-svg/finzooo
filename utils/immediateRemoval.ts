/** Solo presentación: no toca libros, saldos, disco, marcas ni copias en nube.
 * Ante rechazo o fallo, el registro confirmado vuelve a ser visible.
 * Una operación terminada fuera de su pantalla/sesión no publica nada allí. */
export async function withImmediateRemoval<T>(
  ids: readonly string[],
  update: (next: (previous: Set<string>) => Set<string>) => void,
  current: () => boolean,
  operation: () => Promise<T>,
): Promise<T> {
  if (!current()) throw new Error("account-task-obsolete");
  update(previous => new Set([...previous, ...ids]));
  try { return await operation(); }
  finally {
    if (current()) update(previous => new Set([...previous].filter(id => !ids.includes(id))));
  }
}
