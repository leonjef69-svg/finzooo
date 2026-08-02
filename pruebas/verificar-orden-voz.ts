// QUE NO IMPORTE EL ORDEN EN EL QUE SE DIGA.
//
// Hablando no se sigue ningun orden: sale "exportar pdf whatsapp ingresos
// leon julio" o "exportar los ingresos de julio a leon por whatsapp en pdf",
// segun el dia. Si el orden importa, la orden falla la mitad de las veces y
// desde fuera parece que la app entiende a ratos.
//
// Aqui no se comprueban unas cuantas frases elegidas a mano: se prueban TODAS
// las formas de decir la misma, las 720. Una sola que falle se ve.
import { parseVoiceCommand } from "@/utils/voiceCommand";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

const AHORA = new Date(2026, 7, 1);

function permutaciones<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  const salida: T[][] = [];
  for (let i = 0; i < xs.length; i++) {
    const resto = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutaciones(resto)) salida.push([xs[i], ...p]);
  }
  return salida;
}

console.log("\n--- LAS 720 FORMAS DE DECIR LA MISMA ORDEN ---");
{
  const piezas = ["exportar", "pdf", "whatsapp", "ingresos", "leon", "julio"];
  const todas = permutaciones(piezas);
  ok(todas.length === 720, `son ${todas.length} combinaciones`);

  const malas: string[] = [];
  for (const orden of todas) {
    const frase = orden.join(" ");
    const r = parseVoiceCommand(frase, AHORA);
    if (
      r.kind !== "export" ||
      r.monthKey !== "2026-07" ||
      r.format !== "pdf" ||
      r.destination !== "whatsapp" ||
      r.type !== "income" ||
      r.recipient !== "leon"
    ) {
      malas.push(frase);
    }
  }
  ok(malas.length === 0, `las 720 dan lo mismo${malas.length ? ` — falla: "${malas[0]}"` : ""}`);
  if (malas.length > 0) {
    console.log("\n  Primeras que fallan:");
    for (const f of malas.slice(0, 8)) {
      const r = parseVoiceCommand(f, AHORA);
      console.log("   ", f, "->", JSON.stringify(r));
    }
  }
}

console.log("\n--- LO MISMO, DICHO COMO SE HABLA ---");
{
  // Con preposiciones y articulos por medio, que es como sale de verdad.
  const frases = [
    "exportar los ingresos de julio a leon por whatsapp en pdf",
    "exportame por whatsapp a leon el pdf de mis ingresos de julio",
    "manda a leon los ingresos de julio en pdf por whatsapp",
    "whatsapp a leon el pdf de los ingresos de julio",
    "pdf de ingresos de julio para leon por whatsapp",
  ];
  for (const f of frases) {
    const r = parseVoiceCommand(f, AHORA);
    const bien =
      r.kind === "export" &&
      r.monthKey === "2026-07" &&
      r.format === "pdf" &&
      r.destination === "whatsapp" &&
      r.type === "income" &&
      r.recipient === "leon";
    ok(bien, `"${f}"${bien ? "" : ` -> ${JSON.stringify(r)}`}`);
  }
}

console.log("\n--- LO MISMO CON GASTOS, LAS 720 ---");
{
  // "gastos" tiene una trampa que "ingresos" no: comparte raiz con las
  // palabras de PREGUNTAR ("cuanto gaste", "dame los gastos"). Si una
  // combinacion se colara por ahi, en vez de exportar saldria un resumen en
  // pantalla y no se mandaria nada.
  const piezas = ["exportar", "pdf", "whatsapp", "gastos", "leon", "julio"];
  const malas: string[] = [];
  for (const orden of permutaciones(piezas)) {
    const frase = orden.join(" ");
    const r = parseVoiceCommand(frase, AHORA);
    if (
      r.kind !== "export" ||
      r.monthKey !== "2026-07" ||
      r.format !== "pdf" ||
      r.destination !== "whatsapp" ||
      r.type !== "expense" ||
      r.recipient !== "leon"
    ) {
      malas.push(frase);
    }
  }
  ok(malas.length === 0, `las 720 de gastos dan lo mismo${malas.length ? ` — falla: "${malas[0]}"` : ""}`);
  if (malas.length > 0) {
    console.log("\n  Primeras que fallan:");
    for (const f of malas.slice(0, 8)) {
      console.log("   ", f, "->", JSON.stringify(parseVoiceCommand(f, AHORA)));
    }
  }
}

console.log("\n--- GASTOS, DICHO COMO SE HABLA ---");
{
  const frases = [
    "exportar los gastos de julio a leon por whatsapp en pdf",
    "exportame por whatsapp a leon el pdf de mis gastos de julio",
    "manda a leon los gastos de julio en pdf por whatsapp",
    "whatsapp a leon el pdf de los gastos de julio",
    "pdf de gastos de julio para leon por whatsapp",
    "exportar el gasto de julio a leon por whatsapp en pdf",
  ];
  for (const f of frases) {
    const r = parseVoiceCommand(f, AHORA);
    const bien =
      r.kind === "export" &&
      r.monthKey === "2026-07" &&
      r.format === "pdf" &&
      r.destination === "whatsapp" &&
      r.type === "expense" &&
      r.recipient === "leon";
    ok(bien, `"${f}"${bien ? "" : ` -> ${JSON.stringify(r)}`}`);
  }
}

console.log("\n--- PREGUNTAR POR LOS GASTOS SIGUE SIENDO PREGUNTAR ---");
{
  // El limite del otro lado: sin ninguna palabra de exportar, hablar de
  // gastos tiene que seguir dando un resumen en pantalla.
  const preguntas = [
    "cuanto gaste en julio",
    "dame los gastos de julio",
    "en que gaste este mes",
    "muestrame mis gastos de julio",
  ];
  for (const f of preguntas) {
    const r = parseVoiceCommand(f, AHORA);
    ok(r.kind === "summary", `"${f}" sigue siendo una pregunta, no una exportacion`);
  }
}

console.log("\n--- Y SIN NOMBRE, SIGUE SIN INVENTARSE A NADIE ---");
{
  const piezas = ["exportar", "pdf", "whatsapp", "gastos", "julio"];
  const malas: string[] = [];
  for (const orden of permutaciones(piezas)) {
    const frase = orden.join(" ");
    const r = parseVoiceCommand(frase, AHORA);
    if (r.kind !== "export" || r.recipient !== undefined || r.type !== "expense") malas.push(frase);
  }
  ok(malas.length === 0, `las 120 sin nombre no sacan destinatario${malas.length ? ` — falla: "${malas[0]}"` : ""}`);
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
