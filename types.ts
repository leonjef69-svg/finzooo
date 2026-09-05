// De dónde salió cada movimiento:
//   manual    🟡 lo escribiste tú a mano
//   imported  🔵 vino de un archivo del banco
//   verified  🟢 lo escribiste tú Y el banco lo confirmó después
//   merged    🟢 se juntaron el tuyo y el del banco en uno solo
//   auto      🟣 lo registró Fino sola, leyendo una notificación de Yape
export type TransactionOrigin = "manual" | "imported" | "verified" | "merged" | "auto";

export type Transaction = {
  /**
   * EL DIBUJO PROPIO DE ESTE MOVIMIENTO, si lo tiene. Opcional a propósito.
   *
   * Lo normal es que el dibujo salga de la CATEGORÍA, y así sigue siendo: los reportes, el
   * PDF y los límites agrupan por categoría, y un movimiento no puede quedarse fuera de eso.
   * Esto es solo lo que se PINTA.
   *
   * Nació el 19/08/2026 con el calendario de pagos: quien le pone el logo de Spotify a su
   * suscripción espera verlo también en Inicio, y lo pidió dos veces. La categoría se sigue
   * poniendo igual —"Netflix" cae en entretenimiento— así que las cuentas no cambian; lo
   * único que cambia es el dibujo de la fila.
   */
  icono?: string;
  /** Color propio del dibujo de este movimiento. */
  iconColor?: string;
  id: number;
  type: "expense" | "income";
  amount: number;
  category: string;
  date: string;
  method: string;
  description: string;
  notes: string;

  // ---- Campos nuevos (importación de estados de cuenta) ----
  // TODOS son opcionales a propósito: los movimientos que ya estaban
  // guardados antes de esta versión no los tienen, y deben seguir
  // funcionando igual sin necesidad de convertir nada.
  origin?: TransactionOrigin;
  // Nombre del comercio tal como lo reporta el banco ("KFC", "PRIMAX").
  merchant?: string;
  // Cuenta/banco de donde salió el dinero (ver constants/accounts.ts).
  account?: string;
  /**
   * Hora a la que ocurrio, "HH:MM". Opcional a proposito.
   *
   * Los movimientos guardados antes de esto no la tienen, y los importados de
   * un estado de cuenta tampoco: el banco solo da la fecha. Donde no hay, no
   * se enseña nada — mejor sin hora que con una inventada.
   */
  time?: string;
  // Código de operación del banco, sirve para no repetir un movimiento.
  reference?: string;
  tags?: string[];
};

// Los movimientos viejos no tienen "origin". Cuando falta, es porque la
// persona lo escribió a mano. Usar siempre esta función en vez de leer
// t.origin directamente, para no tener que revisar el caso vacío en cada
// pantalla.
export function originOf(t: Transaction): TransactionOrigin {
  return t.origin ?? "manual";
}

export type Month = { y: number; m: number };

export type Profile = {
  userName: string;
  userEmail: string;
  userPhoto: string | null;
  userCurrency: string;
  userLanguage: string;
  // Es local a este celular. Opcional para que perfiles creados antes de
  // 1.0.4 sigan abriendo sin migraciones ni cambios en Firestore.
  userCountry?: string;
  hasOnboarded: boolean;
};

export type Goal = {
  id: number;
  name: string;
  target: number;
  saved: number;
  createdDate: string;
  completed: boolean;
};
