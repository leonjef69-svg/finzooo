import { loadJSON, saveJSON } from "@/utils/storage";

/**
 * A quién sueles mandarle tus reportes.
 *
 * POR QUÉ UNA LISTA Y NO UN DESTINATARIO FIJO
 *
 * La idea de "guardar a quién mandar siempre" es cómoda y peligrosa: se
 * guarda una vez, pasan tres meses, se olvida quién está guardado, y un día
 * se toca Exportar en automático y el estado de cuenta se va a quien no toca.
 * Con un documento de dinero eso no es un despiste menor.
 *
 * Con una lista se elige EN EL MOMENTO. No hay nada que se dispare solo, pero
 * tampoco hay que buscar entre trescientos contactos: se toca el nombre y
 * listo.
 *
 * Lo que sigue sin poder quitarse es el "Enviar" final dentro de WhatsApp o
 * del correo. Android no permite que una app mande mensajes en nombre de
 * nadie sin que la persona lo confirme, y con esto es mejor que sea así.
 *
 * OJO CON LOS DATOS: aquí se guardan correos y números de teléfono, que son
 * datos personales. Van por el mismo camino cifrado que los movimientos (ver
 * utils/storage) y viajan en la copia de la nube. Si esto llega a Play Store,
 * la política de privacidad tiene que decirlo.
 */

export type SendContactKind = "email" | "whatsapp";

export type SendContact = {
  id: string;
  name: string;
  kind: SendContactKind;
  /** El correo, o el número con código de país y solo dígitos. */
  value: string;
};

const STORAGE_KEY = "finzo:sendContacts";

export async function loadContacts(): Promise<SendContact[]> {
  const saved = await loadJSON<SendContact[]>(STORAGE_KEY, []);
  return Array.isArray(saved) ? saved.filter(esValido) : [];
}

export function saveContacts(list: SendContact[]): void {
  saveJSON(STORAGE_KEY, list);
}

function esValido(c: unknown): c is SendContact {
  const x = c as SendContact;
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    (x.kind === "email" || x.kind === "whatsapp") &&
    typeof x.value === "string"
  );
}

/**
 * Deja un número de teléfono como lo quiere WhatsApp: solo dígitos, con
 * código de país y sin el "+".
 *
 * Se quitan espacios, guiones y paréntesis porque la gente los escribe —
 * "+51 999 888 777" es como viene en una tarjeta— y con cualquiera de ellos
 * dentro, WhatsApp no encuentra el contacto y abre un chat vacío.
 */
export function normalizePhone(raw: string, defaultCountry = "51"): string {
  const soloDigitos = raw.replace(/\D/g, "");
  if (soloDigitos.length === 0) return "";
  // Un celular peruano son 9 dígitos y EMPIEZA POR 9. Si viene así, se le
  // pone el código de país delante: sin él WhatsApp lo da por no válido.
  //
  // Lo del 9 importa. Sin esa condición, un fijo de Lima —"(01) 555-1234",
  // que también son 9 dígitos— salía como "51015551234", un número que no
  // existe. Y WhatsApp con un número que no existe no avisa: abre el
  // selector de contactos como si no se hubiera pedido nada, y desde fuera
  // parece que la app no hizo nada.
  //
  // Un fijo no sirve para WhatsApp de todas formas, así que se deja tal cual
  // y quien lo escriba verá que no funciona, en vez de que se lo cambiemos
  // por otro número.
  const esCelularPeruano = soloDigitos.length === 9 && soloDigitos.startsWith("9");
  if (esCelularPeruano && !raw.trim().startsWith("+")) {
    return defaultCountry + soloDigitos;
  }
  return soloDigitos;
}

/**
 * ¿Sirve este correo?
 *
 * Se comprueba lo mínimo —algo, arroba, algo, punto, algo— y no más. Las
 * comprobaciones estrictas de correo rechazan direcciones que existen, y
 * quien se queda fuera por eso no puede hacer nada al respecto. El correo lo
 * valida de verdad el servidor al enviarlo.
 */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** ¿Se puede guardar este contacto tal como está escrito? */
export function validateContact(
  name: string,
  kind: SendContactKind,
  value: string
): { ok: true; contact: Omit<SendContact, "id"> } | { ok: false; reason: "name" | "value" } {
  const nombre = name.trim();
  if (nombre.length < 1) return { ok: false, reason: "name" };

  if (kind === "email") {
    const correo = value.trim();
    if (!isValidEmail(correo)) return { ok: false, reason: "value" };
    return { ok: true, contact: { name: nombre, kind, value: correo } };
  }

  const numero = normalizePhone(value);
  // Menos de ocho dígitos no es un teléfono de ningún país.
  if (numero.length < 8) return { ok: false, reason: "value" };
  return { ok: true, contact: { name: nombre, kind, value: numero } };
}

/** Los contactos que valen para un destino concreto. */
export function contactsFor(list: SendContact[], destination: string): SendContact[] {
  if (destination === "whatsapp") return list.filter((c) => c.kind === "whatsapp");
  if (destination === "mail" || destination === "gmail") {
    return list.filter((c) => c.kind === "email");
  }
  return [];
}

/** Un identificador que no choque con los que ya hay. */
export function nextContactId(list: SendContact[]): string {
  let n = 1;
  const usados = new Set(list.map((c) => c.id));
  while (usados.has(`c${n}`)) n++;
  return `c${n}`;
}
