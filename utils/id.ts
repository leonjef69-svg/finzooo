// Genera un número único para identificar cada movimiento y cada meta.
//
// IMPORTANTE: antes esto empezaba en 1000 cada vez que se abría la app, así
// que el primer movimiento nuevo de una sesión reutilizaba un número que ya
// existía y TERMINABA REEMPLAZANDO un movimiento viejo en vez de agregarse
// (addOrUpdateTransaction entiende "mismo número" como "esto es una edición").
//
// La hora sola puede coincidir en dos celulares. Reservamos 12 bits aleatorios
// (4096 posibilidades) dentro de cada segundo. Una base de migración mantiene
// los IDs nuevos por encima del formato antiguo sin multiplicar para siempre
// Date.now(): aquel formato habría superado el entero seguro en 2039.
let lastId = 0;
const ID_EPOCH_MS = Date.UTC(2026, 0, 1);
const ID_BASE = 7_500_000_000_000_000;

export function idCandidate(now: number, randomBucket: number): number {
  const seconds = Math.max(0, Math.floor((now - ID_EPOCH_MS) / 1000));
  const bucket = Math.max(0, Math.min(4095, Math.floor(randomBucket)));
  return ID_BASE + seconds * 4096 + bucket;
}

export function nextId(): number {
  const candidato = idCandidate(Date.now(), Math.random() * 4096);
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
