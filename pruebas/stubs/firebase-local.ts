/** Solo para bóveda/recibos locales Node: nunca conecta a Firebase real. */
export const auth: { currentUser: { uid: string; email?: string | null; emailVerified?: boolean } | null } = { currentUser: null };
export const db = {};
export const functions = {};
