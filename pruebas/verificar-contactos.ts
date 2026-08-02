// A quien se le manda el reporte. Lo critico aqui es el numero de telefono:
// si sale mal, WhatsApp abre un chat vacio en vez de decir que no encontro a
// nadie, y eso parece que la app no hizo nada.
import {
  checkPhone,
  contactsFor,
  findContactByName,
  isValidEmail,
  nextContactId,
  resolveRecipient,
  normalizePhone,
  validateContact,
  type SendContact,
} from "@/utils/sendContacts";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

console.log("\n--- EL NUMERO COMO LO QUIERE WHATSAPP ---");
ok(normalizePhone("+51 999 888 777") === "51999888777", "se quitan el mas, los espacios y queda solo digitos");
ok(normalizePhone("999 888 777") === "51999888777", "un numero peruano suelto recibe su codigo de pais");
ok(normalizePhone("999888777") === "51999888777", "y sin espacios tambien");
ok(normalizePhone("+52 55 1234 5678") === "525512345678", "un mexicano conserva SU codigo, no se le pone el peruano");
ok(normalizePhone("(01) 555-1234") === "015551234", "un fijo se deja tal cual: no es celular y no se le inventa un codigo de pais");
ok(normalizePhone("01-555-1234") === "015551234", "parentesis y guiones fuera");
ok(normalizePhone("") === "", "vacio sigue vacio");
ok(normalizePhone("abc") === "", "sin digitos no se inventa un numero");

console.log("\n--- CONTAR LOS DIGITOS ANTES DE GUARDAR ---");
// Un digito de menos no da NINGUN error: WhatsApp abre un chat vacio en vez
// de decir que ese numero no existe. A simple vista los dos son iguales.
ok(checkPhone("51942582430").warning === null, "51942582430 esta bien: 51 + 9 digitos");
ok(checkPhone("5194258430").warning === "peruLength", "5194258430 tiene un digito de menos y se avisa");
ok(checkPhone("519425824300").warning === "peruLength", "y uno de mas tambien");
ok(checkPhone("51942582430").normalized === "51942582430", "se guarda tal cual");
ok(checkPhone("+51 942 582 430").normalized === "51942582430", "escrito con mas y espacios, queda igual");
ok(checkPhone("942582430").normalized === "51942582430", "sin el 51, se lo pone y no avisa de nada");
ok(checkPhone("942582430").warning === null, "...porque ya son 11");
ok(checkPhone("525512345678").warning === null, "un mexicano no se mide con la regla peruana");
ok(checkPhone("519").warning === null, "mientras se escribe no se avisa de nada");
ok(checkPhone("").normalized === "", "vacio no dice nada");

console.log("\n--- CORREOS ---");
ok(isValidEmail("lion@gmail.com"), "un correo normal");
ok(isValidEmail("a.b+c@sub.dominio.pe"), "uno con punto, mas y subdominio");
ok(!isValidEmail("lion@gmail"), "sin punto final no vale");
ok(!isValidEmail("lion gmail.com"), "sin arroba tampoco");
ok(!isValidEmail(""), "vacio no vale");

console.log("\n--- GUARDAR UN CONTACTO ---");
{
  const r = validateContact("  Contador  ", "email", "  conta@estudio.pe ");
  ok(r.ok, "se guarda un contacto de correo");
  if (r.ok) {
    ok(r.contact.name === "Contador", "el nombre sale sin espacios de sobra");
    ok(r.contact.value === "conta@estudio.pe", "y el correo tambien");
  }
}
{
  const r = validateContact("Mama", "whatsapp", "+51 999 888 777");
  ok(r.ok, "se guarda uno de WhatsApp");
  if (r.ok) ok(r.contact.value === "51999888777", "con el numero ya limpio, listo para WhatsApp");
}
{
  const sinNombre = validateContact("   ", "email", "a@b.com");
  ok(!sinNombre.ok && sinNombre.reason === "name", "sin nombre no se guarda, y dice que es el nombre");
  const malCorreo = validateContact("Juan", "email", "juan@");
  ok(!malCorreo.ok && malCorreo.reason === "value", "con el correo mal, dice que es el correo");
  const malNumero = validateContact("Juan", "whatsapp", "123");
  ok(!malNumero.ok && malNumero.reason === "value", "un numero de tres digitos no pasa");
}

console.log("\n--- CADA DESTINO VE LOS SUYOS ---");
{
  const lista: SendContact[] = [
    { id: "c1", name: "Yo", kind: "email", value: "yo@gmail.com" },
    { id: "c2", name: "Mama", kind: "whatsapp", value: "51999888777" },
  ];
  ok(contactsFor(lista, "whatsapp").length === 1, "WhatsApp solo ve los de WhatsApp");
  ok(contactsFor(lista, "whatsapp")[0].name === "Mama", "y es el correcto");
  ok(contactsFor(lista, "mail").length === 1, "Correo solo ve los de correo");
  ok(contactsFor(lista, "gmail")[0].name === "Yo", "Gmail comparte los de correo");
  // Drive es tuyo y Compartir abre el menu de Android: ahi no hay a quien
  // elegir, y ofrecer contactos seria ofrecer algo que no se usa.
  ok(contactsFor(lista, "drive").length === 0, "Drive no pide destinatario");
  ok(contactsFor(lista, "share").length === 0, "Compartir tampoco");
}

console.log("\n--- LOS IDENTIFICADORES NO CHOCAN ---");
{
  const lista: SendContact[] = [
    { id: "c1", name: "a", kind: "email", value: "a@b.com" },
    { id: "c2", name: "b", kind: "email", value: "b@b.com" },
  ];
  ok(nextContactId(lista) === "c3", "el siguiente es c3");
  const conHueco: SendContact[] = [{ id: "c2", name: "b", kind: "email", value: "b@b.com" }];
  ok(nextContactId(conHueco) === "c1", "y si se borro el c1, se reutiliza sin pisar al c2");
  ok(nextContactId([]) === "c1", "en una lista vacia, c1");
}


console.log("\n--- BUSCAR A QUIEN POR EL NOMBRE DICHO ---");
{
  const lista: SendContact[] = [
    { id: "c1", name: "Mamá", kind: "whatsapp", value: "51999888777" },
    { id: "c2", name: "Contador", kind: "whatsapp", value: "51988777666" },
    { id: "c3", name: "Yo", kind: "email", value: "yo@gmail.com" },
  ];
  ok(findContactByName(lista, "mama", "whatsapp")?.id === "c1", "el microfono dice 'mama' sin tilde y encuentra a Mamá");
  ok(findContactByName(lista, "MAMA", "whatsapp")?.id === "c1", "en mayusculas tambien");
  ok(findContactByName(lista, "contador", "whatsapp")?.id === "c2", "al contador");
  ok(findContactByName(lista, "yo", "mail")?.id === "c3", "y los de correo por su lado");
  ok(findContactByName(lista, "mama", "mail") === null, "un contacto de WhatsApp no vale para correo");
  ok(findContactByName(lista, "juan", "whatsapp") === null, "un nombre que no existe no devuelve a nadie");
  ok(findContactByName(lista, "a", "whatsapp") === null, "una sola letra no basta para elegir");
}
{
  // Dos parecidos: NO se elige ninguno. Mandar el estado de cuenta a la
  // persona equivocada por adivinar es peor que abrir la app y elegir.
  const lista: SendContact[] = [
    { id: "c1", name: "Mamá", kind: "whatsapp", value: "51999888777" },
    { id: "c2", name: "Mamá Rosa", kind: "whatsapp", value: "51988777666" },
  ];
  ok(findContactByName(lista, "mama", "whatsapp") === null, "con dos que encajan no se adivina: se elige a mano");
}

console.log("\n--- A QUIEN VA, EN EL MOMENTO DE MANDARLO ---");
{
  // El fallo real: por voz, el contacto se busca y se marca en la MISMA
  // vuelta en la que se exporta, asi que al exportar aun no estaba marcado.
  // WhatsApp abria su lista de contactos aunque el numero estuviera guardado.
  const lista: SendContact[] = [
    { id: "c1", name: "Mi numero", kind: "whatsapp", value: "51938600765" },
    { id: "c2", name: "Contador", kind: "email", value: "conta@estudio.pe" },
  ];
  const sinMarcar = resolveRecipient(null, lista, "mi numero", "whatsapp");
  ok(sinMarcar?.value === "51938600765", "sin nada marcado todavia, se saca del nombre dicho");

  const marcado = lista[0];
  ok(
    resolveRecipient(marcado, lista, "otro que no existe", "whatsapp")?.id === "c1",
    "lo que se toco a mano manda sobre lo que se dijo"
  );
  ok(resolveRecipient(null, lista, undefined, "whatsapp") === null, "sin nombre dicho y sin marcar, no va a nadie");
  ok(resolveRecipient(null, lista, "contador", "gmail")?.value === "conta@estudio.pe", "por gmail sale el correo");
  ok(resolveRecipient(null, lista, "mi numero", "drive") === null, "Drive es tuyo: no lleva destinatario");
  ok(resolveRecipient(null, lista, "mi numero", "share") === null, "Compartir abre el menu de Android: tampoco");
  ok(resolveRecipient(null, lista, "mi numero", "gmail") === null, "un numero de WhatsApp no sirve como correo");
  ok(resolveRecipient(null, [], "mi numero", "whatsapp") === null, "sin contactos guardados no se inventa ninguno");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
