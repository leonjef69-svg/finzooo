// Genera un número único para identificar cada movimiento y cada meta.
//
// IMPORTANTE: antes esto empezaba en 1000 cada vez que se abría la app, así
// que el primer movimiento nuevo de una sesión reutilizaba un número que ya
// existía y TERMINABA REEMPLAZANDO un movimiento viejo en vez de agregarse
// (addOrUpdateTransaction entiende "mismo número" como "esto es una edición").
//
// La hora sola puede coincidir en dos celulares. El piso del reloj conserva
// el formato numérico anterior; cada alta salta 24 bits de azar nativo desde
// el mayor piso conocido. Nunca se reduce todo a `máximo + 1`. La identidad
// UUID independiente detecta una coincidencia numérica de altas nuevas.
// No renumera registros/enlaces antiguos; al agotarse el entero seguro falla
// cerrado. Un salto medio deja ~180 millones de altas desde la base actual,
// no un espacio infinito ni una promesa de unicidad matemática del número.
import { getRandomValues, randomUUID } from "expo-crypto";

let lastId = 0;
const issuedOrigins = new Map<number, string>();
const MAX_INCREMENT = 16_777_216;
const ID_EPOCH_MS = Date.UTC(2026, 0, 1);
const ID_BASE = 7_500_000_000_000_000;

export function idCandidate(now: number, randomBucket: number): number {
  const seconds = Math.max(0, Math.floor((now - ID_EPOCH_MS) / 1000));
  const bucket = Math.max(0, Math.min(4095, Math.floor(randomBucket)));
  return ID_BASE + seconds * 4096 + bucket;
}

export function nextId(): number {
  // Un máximo restaurado común no debe convertir el azar de dos teléfonos
  // en el mismo `máximo + 1`. El salto usa 24 bits nativos incluso si el
  // reloj retrocede. El UUID independiente permite reconocer una eventual
  // coincidencia numérica sin tratarla como edición del mismo registro.
  const base = Math.max(lastId, idCandidate(Date.now(), 0));
  if (!Number.isSafeInteger(base) || base > Number.MAX_SAFE_INTEGER - MAX_INCREMENT) {
    throw new Error("record-id-space-exhausted");
  }
  const bytes = getRandomValues(new Uint8Array(3));
  const increment = 1 + bytes[0] * 65_536 + bytes[1] * 256 + bytes[2];
  const id = base + increment;
  const origin = randomUUID();
  lastId = id;
  issuedOrigins.set(id, origin);
  // Los formularios consumen la identidad al construir el registro. El
  // límite solo retira identidades aún no consumidas, nunca datos guardados.
  if (issuedOrigins.size > 100_000) issuedOrigins.delete(issuedOrigins.keys().next().value!);
  return lastId;
}

/** Solo identidades emitidas al crear: jamás etiqueta/renumera datos antiguos. */
export function issuedCreationId(id: number): string | undefined {
  return issuedOrigins.get(id);
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
