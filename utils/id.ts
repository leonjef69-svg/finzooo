// Genera un número único para identificar cada movimiento y cada meta.
//
// IMPORTANTE: antes esto empezaba en 1000 cada vez que se abría la app, así
// que el primer movimiento nuevo de una sesión reutilizaba un número que ya
// existía y TERMINABA REEMPLAZANDO un movimiento viejo en vez de agregarse
// (addOrUpdateTransaction entiende "mismo número" como "esto es una edición").
//
// La hora sola puede coincidir en dos celulares. Por eso reservamos 12 bits
// aleatorios (4096 posibilidades) dentro de cada milisegundo. El resultado
// sigue siendo un número seguro de JavaScript y conserva el orden temporal,
// pero dos dispositivos ya no generan automáticamente el mismo identificador.
let lastId = 0;

export function nextId(): number {
  const now = Date.now();
  const candidato = now * 4096 + Math.floor(Math.random() * 4096);
  lastId = candidato > lastId ? candidato : lastId + 1;
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
