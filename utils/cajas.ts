export type Caja = {
  id: string;
  nombre: string;
  creadaEn: number;
};

export type MovimientoCaja = {
  id: string;
  cajaId: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  descripcion: string;
  method?: string;
  fecha: string;
  creadoEn: number;
  /** Débito de Personal que financió este ingreso, si corresponde. */
  personalTransactionId?: number;
  /** Parte de este gasto que volvió a Personal. */
  personalReturnAmount?: number;
};

export type DatosCajas = {
  cajas: Caja[];
  movimientos: MovimientoCaja[];
  cajasBorradas: string[];
  movimientosBorrados: string[];
};

export const CAJAS_VACIAS: DatosCajas = {
  cajas: [],
  movimientos: [],
  cajasBorradas: [],
  movimientosBorrados: [],
};

export function nuevoIdCaja(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizarCajas(value: Partial<DatosCajas> | null | undefined): DatosCajas {
  return {
    cajas: Array.isArray(value?.cajas) ? value.cajas : [],
    movimientos: Array.isArray(value?.movimientos) ? value.movimientos : [],
    cajasBorradas: Array.isArray(value?.cajasBorradas) ? value.cajasBorradas : [],
    movimientosBorrados: Array.isArray(value?.movimientosBorrados) ? value.movimientosBorrados : [],
  };
}

function unirPorId<T extends { id: string }>(a: T[], b: T[]): T[] {
  const resultado = new Map<string, T>();
  for (const item of [...b, ...a]) resultado.set(item.id, item);
  return [...resultado.values()];
}

export function fusionarCajas(local: DatosCajas, remoto: DatosCajas): DatosCajas {
  const cajasBorradas = [...new Set([...local.cajasBorradas, ...remoto.cajasBorradas])];
  const movimientosBorrados = [...new Set([...local.movimientosBorrados, ...remoto.movimientosBorrados])];
  const cajasFuera = new Set(cajasBorradas);
  const movimientosFuera = new Set(movimientosBorrados);
  const cajas = unirPorId(local.cajas, remoto.cajas).filter((item) => !cajasFuera.has(item.id));
  const idsCajas = new Set(cajas.map((item) => item.id));
  const movimientos = unirPorId(local.movimientos, remoto.movimientos)
    .filter((item) => !movimientosFuera.has(item.id) && idsCajas.has(item.cajaId));
  return { cajas, movimientos, cajasBorradas, movimientosBorrados };
}

export function saldoCaja(cajaId: string, movimientos: MovimientoCaja[]): number {
  return movimientos.reduce((total, item) => {
    if (item.cajaId !== cajaId) return total;
    return total + (item.tipo === "ingreso" ? item.monto : -item.monto);
  }, 0);
}
