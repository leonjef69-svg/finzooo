import type { Caja, MovimientoCaja } from "../../utils/cajas";
export function privateBoxSourceString(box: Caja, rows: MovimientoCaja[], currency: string): string;
export function sharedBoxMovement(row: MovimientoCaja, uid: string): Record<string, unknown>;
export function copiedBoxMovementMatches(actual: Record<string, unknown>, row: MovimientoCaja, uid: string): boolean;
