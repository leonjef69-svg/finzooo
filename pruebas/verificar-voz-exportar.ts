// "Exportar julio PDF WhatsApp a mama": que la orden por voz entienda el
// formato, el destino Y a quien.
import { parseVoiceCommand } from "@/utils/voiceCommand";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }
const AHORA = new Date(2026, 7, 1); // 1 de agosto de 2026

function exp(frase: string) {
  const r = parseVoiceCommand(frase, AHORA);
  return r.kind === "export" ? r : null;
}

console.log("\n--- LA FRASE DE LA PETICION ---");
{
  const r = exp("exportar julio pdf whatsapp");
  ok(!!r, "se reconoce como exportar");
  ok(r?.monthKey === "2026-07", `y el mes es julio (${r?.monthKey})`);
  ok(r?.format === "pdf", "en PDF");
  ok(r?.destination === "whatsapp", "y a WhatsApp");
}

console.log("\n--- LOS DESTINOS ---");
ok(exp("exporta julio por whatsapp")?.destination === "whatsapp", "whatsapp");
ok(exp("exporta julio por wasap")?.destination === "whatsapp", "wasap, como suele oirlo el microfono");
ok(exp("exporta julio por gmail")?.destination === "gmail", "gmail");
ok(exp("exporta julio por correo")?.destination === "mail", "correo");
ok(exp("exporta julio a drive")?.destination === "drive", "drive");
ok(exp("exporta julio")?.destination === "share", "sin decir nada, el menu de compartir");
{
  // Gmail se mira ANTES que correo: las dos palabras salen en frases
  // parecidas y al reves se abriria el correo del fabricante.
  ok(exp("exporta el pdf por gmail al correo de mama")?.destination === "gmail", "gmail gana sobre correo");
  // "correo" es el destino y "mama" la persona. Antes se quedaba sin nadie
  // por no saber saltarse el destino; lo que nunca debe pasar es devolver
  // "correo" como si fuera el nombre de alguien.
  ok(exp("exporta el pdf por gmail al correo de mama")?.recipient === "mama", "'al correo de mama' saca a mama, no 'correo'");
}

console.log("\n--- LOS FORMATOS ---");
ok(exp("exporta julio")?.format === "pdf", "sin decir nada, PDF");
ok(exp("exporta julio en excel")?.format === "xlsx", "excel es .xlsx de verdad, ya no un CSV");
ok(exp("exporta julio en csv")?.format === "csv", "csv sigue siendo csv");

console.log("\n--- A QUIEN ---");
ok(exp("exportar julio pdf whatsapp a mama")?.recipient === "mama", "a mama");
ok(exp("exporta julio por whatsapp al contador")?.recipient === "contador", "al contador");
ok(exp("exporta julio por correo a mi hermana")?.recipient === "hermana", "a mi hermana");
{
  // El reconocedor entrega la frase de corrido. Sin cortar en las palabras
  // que ya significan otra cosa, el nombre se llevaria media orden pegada.
  const r = exp("exporta a mama julio pdf");
  ok(r?.recipient === undefined || !r.recipient.includes("julio"), "el nombre no se lleva el mes pegado");
}
ok(exp("exporta julio pdf whatsapp")?.recipient === undefined, "sin decir a quien, no se inventa nadie");
ok(exp("exporta julio a drive")?.recipient === undefined, "'a drive' es un destino, no una persona");
ok(exp("exporta julio a pdf")?.recipient === undefined, "'a pdf' tampoco");

console.log("\n--- SIN DECIR 'A': COMO SALE HABLANDO ---");
// Hablando NO se dice la preposicion. Exigirla dejaba a WhatsApp abriendose
// con el archivo puesto pero preguntando a quien mandarlo.
ok(exp("exportar julio pdf whatsapp mi numero")?.recipient === "numero", "exportar julio pdf whatsapp MI NUMERO (el 'mi' sobra: la busqueda acepta que uno contenga al otro)");
ok(exp("exportar julio pdf whatsapp mama")?.recipient === "mama", "...whatsapp mama");
ok(exp("exporta agosto excel gmail contador")?.recipient === "contador", "...gmail contador");
{
  const r = exp("exportar julio pdf whatsapp mi numero");
  ok(r?.monthKey === "2026-07", "y el mes sigue siendo julio");
  ok(r?.format === "pdf", "el formato sigue siendo pdf");
  ok(r?.destination === "whatsapp", "y el destino WhatsApp");
}
console.log("\n--- EL CORREO, DONDE EL CONTACTO SE LLAMA COMO EL DESTINO ---");
// "por correo" es a donde va; "mi correo" es de quien es. La misma palabra.
{
  const r = exp("exportar julio pdf gmail mi correo");
  ok(r?.destination === "gmail", "el destino sigue siendo gmail");
  ok(r?.recipient === "mi correo", "y el nombre es 'mi correo'");
  ok(r?.monthKey === "2026-07", "con julio intacto");
}
ok(exp("exportar julio pdf correo mi correo")?.recipient === "mi correo", "lo mismo con la app de correo");
ok(exp("exportar julio pdf correo mi correo")?.destination === "mail", "y ahi el destino es correo, no gmail");
ok(exp("exportar agosto excel gmail mi gmail")?.recipient === "mi gmail", "'mi gmail' tambien vale como nombre");
ok(exp("exportar julio pdf gmail mi trabajo")?.recipient === "trabajo", "y un nombre normal detras del destino (el 'mi' sobra)");
// Sin ese "mi" delante, la palabra vuelve a ser solo el destino.
ok(exp("exporta julio por correo")?.recipient === undefined, "'por correo' es a donde va, no quien");
ok(exp("exporta julio por gmail")?.recipient === undefined, "'por gmail' tampoco");
ok(exp("exporta mis gastos de julio")?.recipient === undefined, "'mis gastos de julio' no nombra a nadie");

// Un anio suelto al final no es una persona.
ok(exp("exporta julio de 2026 en pdf")?.recipient === undefined, "'2026' no es nadie");
ok(exp("exportar movimientos")?.recipient === undefined, "sin formato ni destino ni mes, el final es la orden, no un nombre");
ok(exp("exporta julio en excel")?.recipient === undefined, "una orden que acaba en formato no deja nombre");
ok(exp("exporta julio por correo")?.recipient === undefined, "ni una que acaba en destino");

console.log("\n--- SOLO GASTOS O SOLO INGRESOS ---");
{
  // La frase de la peticion. El nombre va EN MEDIO, entre dos palabras de la
  // orden: cualquier regla de "lo que va detras de la ultima" se lo perdia.
  const r = exp("exportar pdf whatsapp ingresos leon julio");
  ok(r?.type === "income", "pide solo los ingresos");
  ok(r?.recipient === "leon", "y a leon, aunque su nombre quede en medio de la orden");
  ok(r?.monthKey === "2026-07", "julio");
  ok(r?.destination === "whatsapp", "por whatsapp");
  ok(r?.format === "pdf", "en pdf");
}
ok(exp("exportar julio pdf gastos")?.type === "expense", "solo los gastos");
ok(exp("exportar julio pdf")?.type === "all", "sin decir nada, todo");
ok(exp("exportar julio pdf gastos e ingresos")?.type === "all", "nombrar los dos es pedirlo todo");
ok(exp("exportar mis ingresos de julio")?.type === "income", "dicho de otra forma");
ok(exp("exportar julio pdf gastos")?.recipient === undefined, "y 'gastos' no es el nombre de nadie");
ok(exp("exportar julio pdf ingresos")?.recipient === undefined, "ni 'ingresos'");
ok(exp("exportar movimientos de julio en pdf")?.recipient === undefined, "ni 'movimientos'");

console.log("\n--- LOS GRAFICOS, SOLO SI SE PIDEN ---");
// Ocupan media hoja y empujan la lista de movimientos a la siguiente. Quien
// solo queria sus movimientos no tiene por que pagar esa hoja.
ok(exp("exportar pdf whatsapp julio leon")?.charts === false, "la frase de siempre llega sin graficos");
ok(exp("exportar pdf whatsapp julio leon graficos")?.charts === true, "diciendo 'graficos' aparecen");
ok(exp("exportar julio pdf con graficos")?.charts === true, "'con graficos' tambien");
ok(exp("exportar julio pdf con grafica")?.charts === true, "en singular igual");
ok(exp("exportar julio pdf con las graficas")?.charts === true, "y en femenino plural");
// Nombrar la palabra no basta: "sin graficos" pide justo lo contrario.
ok(exp("exportar julio pdf sin graficos")?.charts === false, "'sin graficos' no los enciende");
ok(exp("exportar julio pdf sin los graficos")?.charts === false, "ni con el articulo por medio");
// Y la palabra no es el nombre de nadie.
ok(exp("exportar julio pdf whatsapp graficos")?.recipient === undefined, "'graficos' no se toma por una persona");
{
  const r = exp("exportar pdf whatsapp julio leon graficos");
  ok(r?.recipient === "leon", "con graficos pedidos, leon sigue siendo el destinatario");
  ok(r?.monthKey === "2026-07", "y julio sigue siendo julio");
}

console.log("\n--- NO SE ROMPE LO QUE YA FUNCIONABA ---");
{
  const r = parseVoiceCommand("gaste 20 soles en kfc", AHORA);
  ok(r.kind === "movements", "anotar un gasto sigue siendo anotar");
  const s = parseVoiceCommand("cuanto gaste en julio", AHORA);
  ok(s.kind === "summary", "preguntar sigue siendo preguntar");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
