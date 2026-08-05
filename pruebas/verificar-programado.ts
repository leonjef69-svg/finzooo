// Comprueba la exportación automática: nombres de archivo, días personalizados,
// interruptor principal, calendario, destinos y la hora puesta a mano.
import fs from "fs";
import path from "path";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  activeWeekdays,
  buildFileName,
  esDestinoAutomatico,
  horaValida,
  isAutoRunDue,
  isPastTime,
  isScheduledDay,
  minutoValido,
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
ok(DEFAULT_SCHEDULE.customDays.length > 0, "personalizado nunca arranca sin ningún día");

// La repesca ("volver a avisar a los N minutos") se quitó el 05/08/2026 a
// pedido del usuario. Aquí se comprobaban sus opciones; se deja anotado en vez
// de borrarlo a secas, para que nadie la reponga creyendo que se perdió.
ok(!("retryMinutes" in DEFAULT_SCHEDULE), "ya no hay repesca en los ajustes");

console.log("\n--- SOLO SE OFRECEN DESTINOS QUE SE HACEN SOLOS ---");
{
  // El criterio: que NADIE tenga que elegir a quién mandar el archivo ni tocar
  // enviar. Compartir, correo, Gmail y WhatsApp abren otra aplicación y esperan
  // a una persona, así que dejaron de ofrecerse en la exportación automática.
  ok(esDestinoAutomatico("drive"), "Drive sí: la cuenta ya está conectada");
  ok(esDestinoAutomatico("folder"), "la carpeta del teléfono sí: el permiso queda puesto");
  for (const d of ["share", "mail", "gmail", "whatsapp"] as const) {
    ok(!esDestinoAutomatico(d), `${d} no, porque abre otra app y espera a alguien`);
  }
  ok(esDestinoAutomatico(DEFAULT_SCHEDULE.destination), "y el destino de fábrica es automático");

  // Quien tuviera guardado uno de los que se quitaron no puede quedarse con un
  // ajuste que apunta a una opción inexistente: la pantalla se vería sin destino
  // y la exportación no haría nada. isAutoRunDue lo demuestra.
  const conDestinoViejo = { ...DEFAULT_SCHEDULE, enabled: true, frequency: "daily" as const, hour: 0, minute: 0, destination: "whatsapp" as const };
  ok(!isAutoRunDue(conDestinoViejo, new Date()), "un destino no automático nunca dispara la copia sola");
  const conCarpeta = { ...conDestinoViejo, destination: "folder" as const };
  ok(isAutoRunDue(conCarpeta, new Date()), "y la carpeta del teléfono sí la dispara");
}

console.log("\n--- LA HORA A MANO NO PUEDE QUEDAR INVÁLIDA ---");
{
  // Pedido: "en hora agrégale un personalizado, o sea para yo poder poner la
  // hora cualquiera, ejemplo 03:15". Una hora fuera de rango deja el aviso sin
  // programar, sin error y sin señal, así que se topa antes de guardarla.
  ok(horaValida(3) === 3, "una hora normal se respeta");
  ok(minutoValido(15) === 15, "y un minuto normal también");
  ok(horaValida(0) === 0 && minutoValido(0) === 0, "la medianoche es válida");
  ok(horaValida(23) === 23 && minutoValido(59) === 59, "y las 23:59");
  ok(horaValida(24) === 9, "las 24 no existen: cae en la de reserva");
  ok(horaValida(-1) === 9, "ni una hora negativa");
  ok(minutoValido(60) === 0, "ni el minuto 60");
  ok(horaValida("abc") === 9, "un texto que no es número tampoco");
  ok(horaValida(undefined) === 9, "ni un ajuste que llega vacío");
  ok(horaValida(NaN) === 9, "ni una cuenta imposible");
  ok(horaValida(3.7) === 3, "y un decimal se queda con la hora entera");
}

console.log("\n--- LA PANTALLA DICE Y OFRECE LO QUE DEBE ---");
{
  const RAIZ = process.cwd();
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const pant = fs.readFileSync(path.join(RAIZ, "screens/ScheduledExportSettings.tsx"), "utf8");
  const codigo = pant.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // El nombre: lo pidió el usuario el 05/08/2026. Se comprueba que no quede la
  // palabra "recordatorio" en el título ni en la fila de ajustes, en los tres
  // idiomas, porque cambiarlo en uno solo deja la app diciendo dos cosas.
  const titulos = [...i18n.matchAll(/"schedExport\.(?:title|settingsRow)":\s*"([^"]*)"/g)].map(
    (m) => m[1]
  );
  ok(titulos.length === 6, `hay 6 títulos (2 por idioma), y hay ${titulos.length}`);
  ok(
    titulos.every((x) => !/recordatorio|reminder|lembrete/i.test(x)),
    "ninguno dice ya 'recordatorio'"
  );
  ok(
    titulos.every((x) => /autom/i.test(x)),
    "y todos dicen 'automática'"
  );

  // Destinos: solo los que se hacen solos, y ninguno de los cuatro que se
  // quitaron. Se mira el código sin comentarios porque los comentarios explican
  // justamente cuáles se fueron.
  ok(/id: "folder"/.test(codigo), "se ofrece la carpeta del teléfono");
  ok(/id: "drive"/.test(codigo), "y Drive");
  for (const fuera of ["share", "mail", "gmail", "whatsapp"]) {
    ok(!new RegExp(`id: "${fuera}"`).test(codigo), `y ya no se ofrece ${fuera}`);
  }

  // La carpeta hay que elegirla antes, y si falta hay que decirlo AQUÍ: el
  // fallo llegaría de madrugada, a la hora del reporte, sin nadie mirando.
  ok(/elegirCarpeta/.test(codigo), "se puede elegir la carpeta");
  ok(codigo.includes("schedExport.folderMissing"), "y se avisa si todavía falta");

  // La hora a mano.
  ok(/horaPersonal/.test(codigo), "hay una opción de hora a mano");
  ok(codigo.includes("schedExport.timeCustom"), "con su etiqueta");
  ok(/keyboardType="number-pad"/.test(codigo), "y teclado de números");
  // Y va ANTES de las horas en punto. La fila se desliza, y detrás de las diez
  // horas quedaba fuera de la pantalla: el usuario pidió una opción que ya
  // existía porque no se veía. Se compara la posición en el código, que es el
  // orden en que se dibujan.
  ok(
    codigo.indexOf("schedExport.timeCustom") < codigo.indexOf("HORAS.map"),
    "y sale antes de las horas en punto, no escondida al final de la fila"
  );

  // Y la repesca no puede volver por la puerta de atrás.
  ok(!/retryMinutes/.test(codigo), "no queda nada de la repesca en la pantalla");
  ok(!/"schedExport\.retry/.test(i18n), "ni sus textos en los idiomas");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
