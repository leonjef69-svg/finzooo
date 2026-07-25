// Genera un número único para identificar cada movimiento y cada meta.
//
// IMPORTANTE: antes esto empezaba en 1000 cada vez que se abría la app, así
// que el primer movimiento nuevo de una sesión reutilizaba un número que ya
// existía y TERMINABA REEMPLAZANDO un movimiento viejo en vez de agregarse
// (addOrUpdateTransaction entiende "mismo número" como "esto es una edición").
//
// Ahora usamos la hora exacta del celular (milisegundos desde 1970), que no
// se repite entre sesiones. Si se piden varios números dentro del mismo
// milisegundo (por ejemplo al importar un archivo con muchas filas), se suma
// 1 para que igual salgan todos distintos y en orden.
let lastId = 0;

export function nextId(): number {
  const now = Date.now();
  lastId = now > lastId ? now : lastId + 1;
  return lastId;
}

// Red de seguridad: al cargar los datos guardados (del celular o de la nube)
// avisamos cuál es el número más alto que ya existe. Así, aunque el reloj del
// celular se haya atrasado, los números nuevos siempre serán mayores y nunca
// pisarán algo que ya estaba guardado.
export function reserveIdsAbove(maxExistingId: number): void {
  if (Number.isFinite(maxExistingId) && maxExistingId > lastId) {
    lastId = maxExistingId;
  }
}
