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
 * Cómo va a quedar guardado el número, y si tiene mala pinta.
 *
 * Existe porque un número mal escrito NO da ningún error visible: WhatsApp no
 * dice "ese número no existe", abre un chat vacío. Se descubre cuando el
 * reporte no llegó, y para entonces ya no se sabe si falló el número, la app
 * o el envío.
 *
 * No bloquea nada: solo enseña el número tal como se va a usar, para poder
 * contarlo antes de guardarlo.
 */
export type PhoneCheck = { normalized: string; warning: "peruLength" | null };

export function checkPhone(raw: string): PhoneCheck {
  const normalized = normalizePhone(raw);
  // Mientras se escribe no se avisa de nada: quien va por el tercer dígito ya
  // sabe que le faltan, y un aviso ahí solo estorba.
  if (normalized.length < 8) return { normalized, warning: null };

  // Un celular peruano son 9 dígitos, más el 51 del país: 11 en total.
  // Es el error fácil de cometer y el imposible de ver: a simple vista,
  // 5194258430 y 51942582430 son el mismo número.
  if (normalized.startsWith("51") && normalized.length !== 11) {
    return { normalized, warning: "peruLength" };
  }
  return { normalized, warning: null };
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

/**
 * Busca un contacto por el nombre que se dijo en voz alta.
 *
 * El reconocedor de Android entrega el texto sin tildes fiables y en
 * minúsculas o no, según el celular, así que se compara sin tildes y sin
 * mayúsculas. Y se acepta que el nombre dicho esté CONTENIDO en el guardado
 * o al revés: quien guardó "Mamá Rosa" dirá "mamá", y quien guardó "Conta"
 * puede decir "el contador".
 *
 * Si hay dos que encajan, NO se elige ninguno. Mandar el estado de cuenta a
 * la persona equivocada por haber adivinado entre dos parecidos es peor que
 * abrir la app y que se elija a mano.
 */
export function findContactByName(
  list: SendContact[],
  spoken: string,
  destination: string
): SendContact | null {
  const dicho = normalizeForMatch(spoken);
  if (dicho.length < 2) return null;

  const candidatos = contactsFor(list, destination).filter((c) => {
    const guardado = normalizeForMatch(c.name);
    return guardado === dicho || guardado.includes(dicho) || dicho.includes(guardado);
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Sin tildes, sin mayúsculas y sin espacios de sobra. */
function normalizeForMatch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A quién se le manda, de verdad, en el momento de mandarlo.
 *
 * POR QUÉ NO BASTA CON MIRAR EL CONTACTO MARCADO EN PANTALLA
 *
 * Cuando la orden viene por voz, la pantalla de exportar hace dos cosas en la
 * misma vuelta: buscar el nombre dicho entre los contactos y marcarlo, y
 * exportar. Pero marcar no cambia nada al instante — queda apuntado para la
 * vuelta siguiente—, así que al exportar el contacto marcado todavía era
 * NINGUNO aunque estuviera guardado y el nombre se hubiera entendido bien.
 *
 * Se llamaba entonces a WhatsApp sin número, y WhatsApp abría su lista de
 * contactos. Desde fuera parecía que no había entendido a quién, cuando lo
 * sabía y lo perdía en el último paso.
 *
 * Aquí se decide sin depender de ninguna vuelta: si hay algo marcado manda
 * eso, y si no, se busca el nombre dicho.
 *
 * Drive y Compartir no llevan destinatario: uno es tuyo y el otro abre el
 * menú de Android.
 */
export function resolveRecipient(
  chosen: SendContact | null,
  list: SendContact[],
  spokenName: string | undefined,
  destination: string
): SendContact | null {
  if (chosen) return chosen;
  if (!spokenName) return null;
  if (destination === "drive" || destination === "share") return null;
  return findContactByName(list, spokenName, destination);
}

/** Un identificador que no choque con los que ya hay. */
export function nextContactId(list: SendContact[]): string {
  let n = 1;
  const usados = new Set(list.map((c) => c.id));
  while (usados.has(`c${n}`)) n++;
  return `c${n}`;
}
