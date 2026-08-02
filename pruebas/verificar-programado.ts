// Comprueba lo nuevo del recordatorio de exportación: nombres de archivo,
// días personalizados, interruptor principal y calendario.
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  RETRY_OPTIONS,
  activeWeekdays,
  buildFileName,
  isAutoRunDue,
  isPastTime,
  isScheduledDay,
  monthForSchedule,
  sanitizeFileName,
  toDateKey,
  type ScheduledExport,
} from "@/utils/scheduledExport";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

const base: ScheduledExport = { ...DEFAULT_SCHEDULE, enabled: true };

console.log("\n--- EL INTERRUPTOR PRINCIPAL ---");
ok(DEFAULT_SCHEDULE.enabled === false, "de fábrica viene apagado: nadie recibe avisos sin pedirlos");
ok(!isScheduledDay({ ...base, enabled: false, frequency: "daily" }, new Date()), "apagado, ningún día toca");
ok(isScheduledDay({ ...base, frequency: "daily" }, new Date()), "encendido y diario, todos los días tocan");
ok(
  !isAutoRunDue({ ...base, enabled: false, destination: "drive", frequency: "daily" }, new Date(2026, 6, 30, 23, 0)),
  "apagado, tampoco sube sola a Drive"
);

console.log("\n--- NOMBRE DEL ARCHIVO ---");
{
  const auto = buildFileName({
    mode: "auto",
    custom: "",
    typeLabel: "Gastos",
    dateKey: "2026-07-31",
    extension: "pdf",
  });
  ok(auto === "Gastos_2026-07-31.pdf", `automático: ${auto}`);
  // La fecha va en año-mes-día y al final para que al ordenar por nombre en
  // Drive queden en orden cronológico solos.
  const enero = buildFileName({ mode: "auto", custom: "", typeLabel: "Gastos", dateKey: "2026-01-05", extension: "pdf" });
  ok(["Gastos_2026-01-05.pdf", auto].sort()[0] === enero, "ordenados por nombre quedan en orden de fecha");
}
{
  const mio = buildFileName({
    mode: "custom",
    custom: "Gastos Julio",
    typeLabel: "Gastos",
    dateKey: "2026-07-31",
    extension: "pdf",
  });
  ok(mio === "Gastos_Julio.pdf", `escrito a mano, los espacios pasan a guion bajo: ${mio}`);
}
{
  // Los caracteres prohibidos por el sistema de archivos. "Gastos 07/2026"
  // habría intentado crear una carpeta.
  ok(sanitizeFileName("Gastos 07/2026") === "Gastos_072026", "la barra se quita, no parte el nombre");
  ok(sanitizeFileName('a:b*c?d"e<f>g|h') === "abcdefgh", "se quitan todos los prohibidos de Windows");
  ok(sanitizeFileName("  Julio  ") === "Julio", "se recortan los espacios de los extremos");
  ok(sanitizeFileName("Julio...") === "Julio", "un punto al final lo borraría Windows en silencio");
  ok(sanitizeFileName("x".repeat(200)).length === 60, "se corta a 60, no se manda un nombre kilométrico");
}
{
  // Alguien escribe solo símbolos: no puede salir un archivo llamado ".pdf".
  const vacio = buildFileName({
    mode: "custom",
    custom: '???///',
    typeLabel: "Gastos",
    dateKey: "2026-07-31",
    extension: "pdf",
  });
  ok(vacio === "Gastos_2026-07-31.pdf", "si lo escrito se queda en nada, se cae al automático");
  const sinTipo = buildFileName({ mode: "auto", custom: "", typeLabel: "///", dateKey: "2026-07-31", extension: "csv" });
  ok(sinTipo === "Finzo_2026-07-31.csv", "y si hasta la etiqueta se queda en nada, el archivo se llama Finzo");
}
ok(
  buildFileName({ mode: "auto", custom: "", typeLabel: "Todos", dateKey: "2026-07-31", extension: "csv" }).endsWith(".csv"),
  "la extensión sigue al formato elegido"
);

console.log("\n--- PERSONALIZADO: VARIOS DÍAS ---");
{
  const custom: ScheduledExport = { ...base, frequency: "custom", customDays: [2, 6] };
  ok(activeWeekdays(custom).join() === "2,6", "los días elegidos son los que disparan");
  // 30 de julio de 2026 es jueves: getDay() 4, que en la numeración de los
  // avisos (1 = domingo) es el 5.
  const jueves = new Date(2026, 6, 30, 10, 0);
  ok(jueves.getDay() === 4, "el 30/7/2026 es jueves (comprobación de la propia prueba)");
  ok(!isScheduledDay(custom, jueves), "el jueves no está elegido, así que no toca");
  const lunes = new Date(2026, 6, 27, 10, 0);
  ok(lunes.getDay() === 1, "el 27/7/2026 es lunes (comprobación de la propia prueba)");
  ok(isScheduledDay(custom, lunes), "el lunes sí está elegido");
  const viernes = new Date(2026, 6, 31, 10, 0);
  ok(isScheduledDay(custom, viernes), "el viernes también");
}
{
  // Días repetidos o desordenados no pueden generar avisos duplicados.
  const sucio: ScheduledExport = { ...base, frequency: "custom", customDays: [6, 2, 2, 6] };
  ok(activeWeekdays(sucio).join() === "2,6", "los repetidos se colapsan: no salen dos avisos el mismo día");
}
ok(activeWeekdays({ ...base, frequency: "daily" }).length === 0, "el diario no usa días de la semana");
ok(activeWeekdays({ ...base, frequency: "monthly" }).length === 0, "el mensual tampoco");
ok(activeWeekdays({ ...base, frequency: "weekly", weekday: 4 }).join() === "4", "el semanal es un solo día");

console.log("\n--- LA HORA ---");
{
  const s = { ...base, hour: 9, minute: 0 };
  ok(!isPastTime(s, new Date(2026, 6, 30, 8, 59)), "un minuto antes todavía no");
  ok(isPastTime(s, new Date(2026, 6, 30, 9, 0)), "a la hora en punto sí");
  ok(isPastTime(s, new Date(2026, 6, 30, 23, 59)), "y por la noche también");
}

console.log("\n--- LA COPIA SOLA A DRIVE ---");
{
  const drive: ScheduledExport = { ...base, frequency: "daily", destination: "drive", hour: 9 };
  ok(isAutoRunDue(drive, new Date(2026, 6, 30, 9, 1)), "pasada la hora, toca");
  ok(!isAutoRunDue({ ...drive, destination: "gmail" }, new Date(2026, 6, 30, 9, 1)), "Gmail no se manda solo");
  ok(!isAutoRunDue({ ...drive, destination: "mail" }, new Date(2026, 6, 30, 9, 1)), "el correo tampoco");
  ok(!isAutoRunDue({ ...drive, destination: "share" }, new Date(2026, 6, 30, 9, 1)), "compartir tampoco");
  ok(
    !isAutoRunDue({ ...drive, lastAutoRun: toDateKey(new Date(2026, 6, 30)) }, new Date(2026, 6, 30, 22, 0)),
    "abrir la app diez veces el mismo día da UNA sola copia"
  );
}

console.log("\n--- QUÉ MES LLEVA EL REPORTE ---");
{
  const uno = new Date(2026, 6, 1, 9, 0);
  ok(monthForSchedule({ ...base, frequency: "monthly" }, uno) === "2026-06", "el mensual del día 1 trae JUNIO, no julio vacío");
  ok(monthForSchedule({ ...base, frequency: "daily" }, uno) === "2026-07", "el diario trae el mes en curso");
  ok(monthForSchedule({ ...base, frequency: "custom" }, uno) === "2026-07", "el personalizado también");
  ok(
    monthForSchedule({ ...base, frequency: "monthly" }, new Date(2026, 0, 1, 9, 0)) === "2025-12",
    "en enero el mensual retrocede de año correctamente"
  );
}

console.log("\n--- COSAS QUE NO PUEDEN CAMBIAR SIN DARSE CUENTA ---");
ok(MAX_MONTH_DAY === 28, "el día mensual no pasa del 28, porque febrero tiene 28");
ok(RETRY_OPTIONS[0] === 0, "la primera opción de repesca es 'no insistir'");
ok(RETRY_OPTIONS.every((m) => m === 0 || m >= 5), "ninguna repesca es de menos de 5 minutos");
ok(DEFAULT_SCHEDULE.customDays.length > 0, "personalizado nunca arranca sin ningún día");

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
