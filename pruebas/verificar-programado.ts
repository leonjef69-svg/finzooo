// Comprueba la exportación automática: nombres de archivo, días personalizados,
// interruptor principal, calendario, destinos y la hora puesta a mano.
import fs from "fs";
import path from "path";
import { codigoDeLaVuelta, verificadorPkce } from "@/utils/pkce";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  activeWeekdays,
  buildFileName,
  claveDeEjecucion,
  esDestinoAutomatico,
  horaValida,
  isAutoRunDue,
  isPastTime,
  isScheduledDay,
  minutoValido,
  monthForSchedule,
  proximaEjecucion,
  sanitizeFileName,
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
    !isAutoRunDue({ ...drive, lastAutoRun: claveDeEjecucion(drive, new Date(2026, 6, 30)) }, new Date(2026, 6, 30, 22, 0)),
    "abrir la app diez veces el mismo día da UNA sola copia"
  );
}

console.log("\n--- CUÁNDO TOCA LA PRÓXIMA VEZ (el despertador de Android) ---");
{
  // El despertador nativo solo entiende "avísame en este instante". Si esta
  // cuenta devuelve un momento del PASADO, Android lo dispara de inmediato:
  // reporte al instante y luego nunca más. Es el fallo más probable de todos.
  const dia = (d: Date) => `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

  // Diario, con la hora todavía por llegar hoy.
  const antes = proximaEjecucion({ ...base, frequency: "daily", hour: 19, minute: 26 }, new Date(2026, 7, 5, 10, 0));
  ok(dia(antes) === "5/8 19:26", `si la hora no ha pasado, es hoy (${dia(antes)})`);

  // Diario, con la hora ya pasada.
  const despues = proximaEjecucion({ ...base, frequency: "daily", hour: 19, minute: 26 }, new Date(2026, 7, 5, 20, 0));
  ok(dia(despues) === "6/8 19:26", `si ya pasó, es mañana (${dia(despues)})`);

  // Y en el minuto exacto cuenta como pasada: si no, se volvería a programar
  // para el instante en que se está ejecutando y se repetiría en bucle.
  const justo = proximaEjecucion({ ...base, frequency: "daily", hour: 19, minute: 26 }, new Date(2026, 7, 5, 19, 26));
  ok(dia(justo) === "6/8 19:26", `en el minuto justo salta a mañana (${dia(justo)})`);

  // NUNCA en el pasado, con cualquier combinación.
  let todasFuturas = true;
  const ahora = new Date(2026, 7, 5, 19, 26, 30);
  for (const frequency of ["daily", "weekly", "monthly", "custom"] as const) {
    for (const hour of [0, 9, 19, 23]) {
      for (const minute of [0, 26, 59]) {
        for (const day of [1, 15, 28]) {
          const p = proximaEjecucion({ ...base, frequency, hour, minute, day, weekday: 2, customDays: [2, 6] }, ahora);
          if (p.getTime() <= ahora.getTime()) todasFuturas = false;
          if (p.getHours() !== hour || p.getMinutes() !== minute) todasFuturas = false;
        }
      }
    }
  }
  ok(todasFuturas, "con cualquier frecuencia, hora y día, el momento siempre es futuro y con la hora pedida");
}
{
  // Mensual: el día 1 del mes siguiente cuando el de este ya pasó, cruzando de
  // año sin equivocarse.
  const dic = proximaEjecucion({ ...base, frequency: "monthly", day: 1, hour: 9, minute: 0 }, new Date(2026, 11, 5, 10, 0));
  ok(dic.getFullYear() === 2027 && dic.getMonth() === 0 && dic.getDate() === 1, "en diciembre el mensual salta a enero del año siguiente");

  // El 31 no existe en febrero: se corta en 28 igual que los avisos.
  const feb = proximaEjecucion({ ...base, frequency: "monthly", day: 31, hour: 9, minute: 0 }, new Date(2026, 1, 1, 10, 0));
  ok(feb.getDate() === MAX_MONTH_DAY, `el día 31 se corta en ${MAX_MONTH_DAY} (salió ${feb.getDate()})`);
  ok(feb.getMonth() === 1, "y se queda en febrero, no se va a marzo");
}
{
  // Semanal: el 5/8/2026 es miércoles (getDay 3, o 4 en la numeración de los
  // avisos). Con el lunes elegido (2), toca el lunes siguiente.
  const miercoles = new Date(2026, 7, 5, 10, 0);
  ok(miercoles.getDay() === 3, "el 5/8/2026 es miércoles (comprobación de la propia prueba)");
  const lunes = proximaEjecucion({ ...base, frequency: "weekly", weekday: 2, hour: 9, minute: 0 }, miercoles);
  ok(lunes.getDay() === 1, "con el lunes elegido cae en lunes");
  ok(lunes.getDate() === 10, `y es el lunes siguiente, el 10 (salió el ${lunes.getDate()})`);
}
{
  // Días elegidos: lunes y viernes. Desde el miércoles, toca el viernes.
  const viernes = proximaEjecucion(
    { ...base, frequency: "custom", customDays: [2, 6], hour: 9, minute: 0 },
    new Date(2026, 7, 5, 10, 0)
  );
  ok(viernes.getDay() === 5, "con lunes y viernes elegidos, desde el miércoles toca el viernes");
  ok(viernes.getDate() === 7, `el día 7 (salió el ${viernes.getDate()})`);

  // Y si HOY es uno de los días elegidos y la hora no ha pasado, es hoy.
  const hoyMismo = proximaEjecucion(
    { ...base, frequency: "custom", customDays: [4], hour: 23, minute: 0 },
    new Date(2026, 7, 5, 10, 0)
  );
  ok(hoyMismo.getDate() === 5, "si hoy está elegido y la hora no ha pasado, es hoy mismo");
}

console.log("\n--- LA MARCA DE 'YA SE HIZO' NO PUEDE BLOQUEAR EL DÍA ENTERO ---");
{
  // EL FALLO DE VERDAD, el que costó tres intentos del usuario el 06/08/2026.
  //
  // La marca guardaba solo el DÍA, y la escriben dos mecanismos: el que exporta
  // al abrir la app (que la escribe ANTES de exportar, para no repetir en bucle)
  // y el despertador. Con solo el día, en cuanto uno tocaba el día el otro se
  // saltaba el reporte hasta la medianoche.
  //
  // Lo que vivió el usuario: tenía puesto 08:38 de una prueba anterior; al abrir
  // la app pasada esa hora se marcó el día y falló. Cambió a las 17:00, el
  // despertador sonó PUNTUAL, y se saltó el reporte. Desde fuera: "no funciona".
  const hoy = new Date(2026, 7, 6, 17, 0, 30);
  const alas1700: ScheduledExport = { ...base, frequency: "daily", destination: "drive", hour: 17, minute: 0 };

  ok(claveDeEjecucion(alas1700, hoy) === "2026-08-06 17:00", `la clave lleva día y hora (${claveDeEjecucion(alas1700, hoy)})`);

  // Una marca vieja (solo el día) NO puede bloquear: es lo que se autocura al
  // actualizar, y lo que desbloqueó al usuario.
  ok(
    isAutoRunDue({ ...alas1700, lastAutoRun: "2026-08-06" }, hoy),
    "una marca vieja de solo-el-día ya no bloquea"
  );

  // La marca de la MISMA ejecución sí bloquea: abrir la app diez veces con la
  // misma programación tiene que dar UNA sola copia. Eso no se puede perder.
  ok(
    !isAutoRunDue({ ...alas1700, lastAutoRun: "2026-08-06 17:00" }, hoy),
    "la misma ejecución no se repite"
  );

  // Y cambiar la hora el mismo día es otra ejecución: vuelve a intentarse.
  const alas1800 = { ...alas1700, hour: 18, lastAutoRun: "2026-08-06 17:00" };
  ok(isAutoRunDue(alas1800, new Date(2026, 7, 6, 18, 0, 30)), "cambiar la hora el mismo día vuelve a exportar");
  // Incluso cambiando solo los minutos.
  const alas1705 = { ...alas1700, minute: 5, lastAutoRun: "2026-08-06 17:00" };
  ok(isAutoRunDue(alas1705, new Date(2026, 7, 6, 17, 5, 30)), "y cambiar solo los minutos también");

  // Al día siguiente, la misma hora es otra ejecución.
  ok(
    isAutoRunDue({ ...alas1700, lastAutoRun: "2026-08-06 17:00" }, new Date(2026, 7, 7, 17, 0, 30)),
    "y mañana a la misma hora se vuelve a hacer"
  );

  // La pantalla borra la marca al cambiar cualquier cosa: reconfigurar es decir
  // "quiero que esto pase". Es la otra mitad del arreglo.
  const pant = fs.readFileSync(path.join(process.cwd(), "screens/ScheduledExportSettings.tsx"), "utf8");
  ok(
    /const next = \{ \.\.\.schedule, \.\.\.patch, lastAutoRun: undefined \}/.test(pant),
    "cambiar un ajuste borra la marca de 'ya se hizo'"
  );

  // Y el mensajito al guardar no puede decir "te avisaremos" cuando exporta solo.
  ok(pant.includes("schedExport.savedFondo"), "el mensaje al guardar dice que se exporta, no que se avisa");
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
  ok(esDestinoAutomatico("dropbox"), "Dropbox sí: se autoriza una vez y el permiso es duradero");
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
  ok(/id: "dropbox"/.test(codigo), "y Dropbox");
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

  // QUÉ PASA A ESA HORA, dicho en la pantalla. El usuario lo preguntó con todo
  // ya configurado —"¿debería exportar automáticamente a la hora que le puse?"—
  // y tenía razón: no se decía en ningún sitio.
  ok(codigo.includes("schedExport.timeWhatHappens"), "la pantalla explica qué pasa a la hora fijada");

  // Y ninguna nota puede volver a prometer "automático del todo". Lo decían las
  // tres, en la MISMA frase en que admitían que hay que abrir la app. Prometer
  // de más es peor que explicar el límite.
  const notas = [...i18n.matchAll(/"schedExport\.(?:driveNote|folderNote|dropboxNote)":\s*\n?\s*"([^"]*)"/g)].map(
    (m) => m[1]
  );
  ok(notas.length === 9, `hay 9 notas de destino (3 por idioma), y hay ${notas.length}`);
  ok(
    notas.every((x) => !/del todo|fully automatic|de verdade/i.test(x)),
    "ninguna promete 'automático del todo'"
  );

  // Y la repesca no puede volver por la puerta de atrás.
  ok(!/retryMinutes/.test(codigo), "no queda nada de la repesca en la pantalla");
  ok(!/"schedExport\.retry/.test(i18n), "ni sus textos en los idiomas");
}

console.log("\n--- EL DESPERTADOR DE ANDROID: LAS COSTURAS ---");
{
  const RAIZ = process.cwd();
  const MOD = "modules/export-scheduler";
  const leer = (f: string) => fs.readFileSync(path.join(RAIZ, f), "utf8");
  const modulo = leer(`${MOD}/android/src/main/java/com/finzo/exportscheduler/ExportSchedulerModule.kt`);
  const receptor = leer(`${MOD}/android/src/main/java/com/finzo/exportscheduler/FinzoExportReceiver.kt`);
  const servicio = leer(`${MOD}/android/src/main/java/com/finzo/exportscheduler/FinzoExportService.kt`);
  const manifiesto = leer(`${MOD}/android/src/main/AndroidManifest.xml`);
  const puente = leer(`${MOD}/index.ts`);
  const entrada = leer("index.js");

  // NOMBRES QUE TIENEN QUE COINCIDIR ENTRE KOTLIN Y JAVASCRIPT.
  //
  // Es el fallo que más veces ha mordido este proyecto: dos mitades que por
  // separado están bien y el error en la costura. Aquí duele especialmente,
  // porque si un nombre no coincide Android despierta el trabajo, no encuentra
  // nada con ese nombre y se cierra SIN DECIR NADA. No falla: no pasa.
  const tarea = /TAREA = "([^"]+)"/.exec(servicio)?.[1] ?? "";
  ok(tarea !== "", "el servicio declara el nombre de la tarea");
  ok(
    entrada.includes(`registerHeadlessTask("${tarea}"`),
    `index.js registra ese mismo nombre (${tarea})`
  );

  const nombreModulo = /Name\("([^"]+)"\)/.exec(modulo)?.[1] ?? "";
  ok(
    puente.includes(`requireOptionalNativeModule<NativeShape>("${nombreModulo}")`),
    `el puente pide el módulo por su nombre real (${nombreModulo})`
  );
  ok(
    manifiesto.includes("com.finzo.exportscheduler.FinzoExportService"),
    "el servicio está declarado en el manifiesto"
  );
  ok(
    manifiesto.includes("com.finzo.exportscheduler.FinzoExportReceiver"),
    "y el receptor también"
  );

  // Y cada función que JavaScript llama tiene que existir en Kotlin.
  for (const f of ["estaDisponible", "programar", "cancelar"]) {
    ok(modulo.includes(`Function("${f}")`), `Kotlin declara ${f}`);
  }

  // EL RECEPTOR TIENE QUE ESTAR ABIERTO, y estuvo cerrado: el mensaje de
  // "teléfono encendido" lo manda el sistema, que es OTRA app, así que con
  // exported="false" no llegaba nunca. Reiniciar el celular dejaba la función
  // muerta en silencio.
  const bloqueReceptor = /<receiver[\s\S]*?<\/receiver>/.exec(manifiesto)?.[0] ?? "";
  ok(/android:exported="true"/.test(bloqueReceptor), "el receptor está abierto, o el arranque no llega");
  ok(/BOOT_COMPLETED/.test(bloqueReceptor), "y escucha el arranque del teléfono");
  // Y el agujero que eso abre se cierra exigiendo una acción propia: sin esto,
  // otra app podría disparar una exportación mandando un mensaje vacío.
  ok(/ACCION_EXPORTAR/.test(modulo), "hay una acción propia para el despertador");
  ok(/ACCION_EXPORTAR ->/.test(receptor), "y el receptor solo exporta con esa acción");
  ok(/else -> Unit/.test(receptor), "cualquier otro mensaje se ignora");

  // EL TIPO DE DESPERTADOR. Se usó el inexacto y fue un error: Android agrupa
  // esos avisos y puede retrasarlos diez minutos, así que la función no se podía
  // ni probar. setAlarmClock es el único exacto que no pide permisos.
  ok(/setAlarmClock/.test(modulo), "el despertador es exacto (setAlarmClock)");
  ok(
    !/SCHEDULE_EXACT_ALARM/.test(manifiesto),
    "y no se pide SCHEDULE_EXACT_ALARM, que Google solo aprueba para alarmas"
  );

  // El tope de tiempo del servicio: aquí se sube un archivo por internet, y los
  // 30 s que usa el registro de yapes cortarían la subida a medias.
  const tope = Number(/^\s*(\d{4,}),$/m.exec(servicio)?.[1] ?? "0");
  ok(tope >= 60000, `el tope de tiempo es de al menos un minuto (${tope} ms)`);

  // Y corre también con la app en pantalla: con false se saltaría a quien esté
  // usando Finzo justo a esa hora.
  ok(/\btrue\b\s*\)/.test(servicio), "corre también con la app abierta");
}

console.log("\n--- EL PDF CON LA APP CERRADA ---");
{
  const RAIZ = process.cwd();
  const leer = (f: string) => fs.readFileSync(path.join(RAIZ, f), "utf8");
  const fondo = leer("utils/exportarEnFondo.ts");
  const pantalla = leer("screens/ExportPdfSheet.tsx");
  const armador = leer("utils/reportePdfDatos.ts");
  const puente = leer("modules/export-scheduler/index.ts");
  const conversor = leer("modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/HtmlAPdf.kt");
  const callbacks = leer("modules/export-scheduler/android/src/main/java/android/print/FinzoPrintCallbacks.kt");

  // UN SOLO ARMADOR DEL HTML, y esto es lo importante de todo el cambio.
  //
  // Copiar las cuentas para el trabajo de fondo habría dejado DOS armadores del
  // mismo documento: el PDF automático y el de a mano se irían separando con
  // cada cambio, y el que nadie mira es el que se rompe. Es el fallo que más
  // veces ha mordido este proyecto.
  ok(/export function htmlDelReporte/.test(armador), "hay un armador del HTML, fuera de la pantalla");
  ok(/htmlDelReporte\(\{/.test(pantalla), "la pantalla de exportar a mano lo usa");
  ok(/htmlDelReporte\(\{/.test(fondo), "y el trabajo de fondo usa el MISMO");
  // Y la pantalla ya no puede armarlo por su cuenta.
  ok(!/buildPdfHtml\(/.test(pantalla), "la pantalla ya no arma el HTML por su cuenta");

  // El PDF ya no se salta en el trabajo de fondo.
  ok(
    !/schedule\.format === "pdf"\) return await apuntar\("pdf-no-se-puede"\)/.test(fondo),
    "el PDF ya no se descarta de entrada"
  );
  ok(/htmlAPdfEnFondo\(/.test(fondo), "se convierte con el código de Android");

  // SE PREGUNTA POR LA FUNCIÓN, NO POR EL MÓDULO. Los APK 6ago-01 y 6ago-02 ya
  // traen el despertador pero NO el conversor de PDF, que llegó después.
  // Preguntando solo por el módulo, la app prometería el PDF automático a un
  // celular que no puede hacerlo.
  ok(/typeof nativo\?\.htmlAPdf === "function"/.test(puente), "se comprueba la función, no el módulo");
  ok(/PdfEnFondoNoDisponible/.test(puente), "y hay un error propio para el APK viejo");
  ok(
    /e instanceof PdfEnFondoNoDisponible/.test(fondo),
    "que se dice aparte: 'falló' mandaría a buscar un problema de internet"
  );
  ok(
    /puedePdfEnFondo/.test(leer("screens/ScheduledExportSettings.tsx")),
    "y la pantalla solo promete el PDF automático si el APK lo trae"
  );

  // LA CONVERSIÓN. Un WebView solo se puede crear desde el hilo principal, y
  // desde el hilo del trabajo de fondo Android lanza.
  ok(/Looper\.getMainLooper/.test(conversor), "el conversor trabaja en el hilo principal");
  // AQUÍ HABÍA UNA ESPERA de medio segundo tras cargar el HTML, "para que quedara
  // colocado antes de medir". Se quitó el 06/08/2026: expo-print escribe en el
  // mismo instante en que el HTML termina de cargar, y es lo que funciona en este
  // celular. La espera era una suposición nuestra que nunca se comprobó —el
  // conversor no había corrido ni una vez— y cada diferencia con expo-print es un
  // sitio donde uno puede funcionar y el otro no.
  ok(
    /override fun onPageFinished\([\s\S]{0,200}?escribir\(view, destino/.test(conversor),
    "se escribe en cuanto el HTML carga, igual que expo-print"
  );
  ok(!/postDelayed\(\{[\s\S]{0,80}?escribir\(/.test(conversor), "sin esperas inventadas de por medio");
  ok(/javaScriptEnabled = false/.test(conversor), "sin JavaScript: el reporte es tablas y estilos");
  ok(/NO_MARGINS/.test(conversor), "sin márgenes propios, que el HTML ya trae los suyos");
  ok(/if \(archivo\.exists\(\)\) archivo\.delete\(\)/.test(conversor), "borra el anterior antes de escribir");

  // La puerta lateral que hace posible todo esto, con su motivo escrito.
  ok(/^package android\.print$/m.test(callbacks), "los callbacks viven en android.print, o no se pueden heredar");
  ok(/constructores/i.test(callbacks), "y está escrito por qué hace falta");

  // DOS CONTRADICCIONES QUE SE CAZARON REVISANDO EN FRÍO, antes de entregar.
  //
  // Son de la misma familia que las de ayer: un texto que decide por su cuenta y
  // acaba diciendo lo contrario que el de al lado.
  const ajustes = leer("screens/ScheduledExportSettings.tsx");

  // 1. El aviso ámbar "el PDF no se puede con la app cerrada" salía TAMBIÉN con
  //    el APK que sí sabe hacerlo, junto al cuadro que dice "se guarda solo".
  ok(
    /schedule\.format === "pdf" && !pdfEnFondo/.test(ajustes),
    "el aviso de 'el PDF no se puede' solo sale si de verdad no se puede"
  );

  // 2. El aviso que llega al celular decía "Toca para exportar", y cuando llega
  //    el archivo YA está guardado: tocarlo invitaría a hacer una segunda copia.
  ok(/notifBodyFondo/.test(ajustes), "el aviso del celular no dice 'toca para exportar' si ya se guardó");
  const i18nTexto = leer("constants/i18n.ts");
  const cuantos = [...i18nTexto.matchAll(/"schedExport\.notifBodyFondo"/g)].length;
  ok(cuantos === 3, `y está en los tres idiomas (hay ${cuantos})`);
}

console.log("\n--- DROPBOX: LO QUE NO PUEDE ESTAR MAL ---");
{
  const RAIZ = process.cwd();
  const db =
    fs.readFileSync(path.join(RAIZ, "utils/dropbox.ts"), "utf8") +
    fs.readFileSync(path.join(RAIZ, "utils/pkce.ts"), "utf8");
  const codigo = db.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // EL SECRETO NO PUEDE ESTAR EN EL CÓDIGO. Cualquiera abre un APK y le saca los
  // textos, así que un secreto metido en una app de celular está regalado. Se usa
  // PKCE justamente para no necesitarlo. Esta es la aserción más importante del
  // archivo: si alguien "arregla" la conexión pegando el secreto, la app queda
  // suplantable y nada falla a la vista.
  ok(!/client_secret/.test(codigo), "el secreto de la app NO está en el código");
  ok(/code_challenge_method=S256/.test(codigo), "se usa PKCE con huella SHA-256");
  ok(/code_verifier/.test(codigo), "y se manda el número al azar al canjear");

  // La dirección de vuelta tiene que ser LA MISMA que está dada de alta en la
  // consola de Dropbox. Si se cambia aquí y no allá, Dropbox se niega antes de
  // enseñar la pantalla de permiso y el error no dice cuál de las dos está mal.
  ok(/const REDIRECT = "finzo:\/\/dropbox"/.test(codigo), "la dirección de vuelta es la registrada");

  // Sin esto, el permiso caduca en unas horas y habría que iniciar sesión cada
  // día: no sería automático de ninguna manera.
  ok(/token_access_type=offline/.test(codigo), "se pide un permiso de larga duración");

  // La clave es de 15 caracteres. Un carácter mal copiado da "app no encontrada",
  // y ese error no dice nada útil. Ya pasó al leerla de una captura: el penúltimo
  // signo era una L minúscula y se veía igual que un 1.
  const clave = /const CLIENT_ID = "([^"]+)"/.exec(codigo)?.[1] ?? "";
  ok(clave.length === 15, `la clave tiene 15 caracteres (tiene ${clave.length})`);
  ok(/^[a-z0-9]+$/.test(clave), "y son solo letras minúsculas y números");

  // El permiso de larga duración va al almacén seguro, no a los ajustes
  // normales: con él se puede escribir en la carpeta de la persona.
  ok(/SecureStore/.test(codigo), "el permiso guardado va al almacén seguro");
  ok(!/loadJSON|saveJSON/.test(codigo), "y no a los ajustes de siempre");

  // Si Dropbox dice que el permiso ya no vale, hay que olvidarlo. Dejarlo haría
  // que cada reporte fallara igual y sin explicación, para siempre.
  ok(/status === 400 \|\| respuesta\.status === 401/.test(codigo), "un permiso revocado se detecta");
  ok(/desconectarDropbox\(\)/.test(codigo), "y se olvida");

  // Y los avisos por cada subida van apagados: son reportes automáticos y
  // avisarlos convertiría la función en una molestia diaria.
  ok(/mute: true/.test(codigo), "las subidas no avisan en el celular");

  // NADA DE btoa, URL NI URLSearchParams. En el motor del celular btoa no existe
  // y URL.searchParams está a medias, así que con ellos todo esto pasa las
  // pruebas en la computadora y falla SOLO en el celular, con un error que
  // parece "permiso rechazado". Nada en la app los usaba: este archivo fue el
  // primero en tener la tentación.
  ok(!/\bbtoa\b/.test(codigo), "no se usa btoa, que en el celular no existe");
  ok(!/new URL\(/.test(codigo), "ni URL, que está a medias");
  ok(!/URLSearchParams/.test(codigo), "ni URLSearchParams");

  // Y las dos piezas que las reemplazan, comprobadas de verdad.
  const bytes = new Uint8Array([0, 1, 63, 64, 65, 127, 128, 200, 255]);
  const v = verificadorPkce(bytes);
  ok(v.length === bytes.length, "el número secreto tiene una letra por byte");
  ok(/^[A-Za-z0-9\-_]+$/.test(v), "y solo usa signos que PKCE permite");
  const largo = verificadorPkce(new Uint8Array(64));
  ok(largo.length >= 43 && largo.length <= 128, `con 64 bytes cabe en lo que pide PKCE (${largo.length})`);

  ok(codigoDeLaVuelta("finzo://dropbox?code=ABC123") === "ABC123", "se lee el código de la vuelta");
  ok(codigoDeLaVuelta("finzo://dropbox?state=x&code=ABC&y=1") === "ABC", "aunque venga entre otros datos");
  ok(codigoDeLaVuelta("finzo://dropbox?code=a%2Fb%2Bc") === "a/b+c", "y se descifra: sin esto Dropbox lo rechaza");
  ok(codigoDeLaVuelta("finzo://dropbox?error=access_denied") === "", "si no hay código, no se inventa uno");
  // El "code" tiene que ser el parámetro, no un trozo de otro nombre.
  ok(codigoDeLaVuelta("finzo://dropbox?mycode=NO&code=SI") === "SI", "y no se confunde con otro parámetro parecido");
}

console.log("\n--- DROPBOX TAMBIEN AL EXPORTAR A MANO ---");
{
  // ESTABA A MEDIAS Y AL REVES DE COMO SE USA: Dropbox se ofrecia en la exportacion
  // AUTOMATICA y no en la de a mano. Subir a mano es lo que se hace primero; lo automatico
  // viene despues de fiarse. El codigo de subida ya estaba escrito y probado desde el
  // 05/08/2026 — lo unico que faltaba era poder elegirlo.
  const RAIZ = process.cwd();
  const hoja = fs.readFileSync(path.join(RAIZ, "screens/ExportPdfSheet.tsx"), "utf8");

  ok(/id: "dropbox"/.test(hoja), "se puede elegir Dropbox al exportar a mano");
  ok(/subirADropbox\(file\.uri, file\.fileName\)/.test(hoja), "y sube de verdad");

  // Y SE PUEDE CONECTAR DESDE AQUI. Sin esto, elegir Dropbox y tocar Exportar armaba el
  // archivo entero para acabar en un aviso que mandaba a OTRA pantalla: el trabajo hecho y la
  // persona a mitad de camino. Es la leccion de la carpeta del telefono — lo que falta se dice
  // ANTES de empezar, y con el boton que lo resuelve al lado.
  ok(/conectarDropbox\(\)/.test(hoja), "se puede autorizar sin salir de la pantalla");
  ok(/destination === "dropbox" && !dropboxListo/.test(hoja), "y el aviso sale antes de exportar, no despues");

  // SE VUELVE A MIRAR AL ELEGIR DROPBOX, no una sola vez al abrir: se puede autorizar desde la
  // otra pantalla mientras esta sigue abierta detras, y con una sola lectura seguiria diciendo
  // que falta conectar.
  ok(/dropboxConectado\(\)\.then/.test(hoja), "se comprueba si ya esta conectado");
  const efecto = hoja.slice(hoja.indexOf("if (destination !== \"dropbox\") return;"));
  ok(/\}, \[destination\]\);/.test(efecto.slice(0, 400)), "y se vuelve a mirar cada vez que se elige");

  // UN PERMISO REVOCADO DESDE LA CUENTA DE DROPBOX solo se descubre al intentar subir. Sin
  // sacar otra vez el boton, quedaria un aviso sin salida.
  ok(/DropboxSinConectar\) \{[\s\S]{0,400}setDropboxListo\(false\)/.test(hoja), "y si el permiso se revoco, vuelve a salir el boton");

  // El texto viejo mandaba a la pantalla de exportacion automatica. Ahora se conecta aqui, asi
  // que mandar a otro sitio seria un paseo para nada.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  ok(!/"exportPdf\.dropboxMissing": "Conecta tu Dropbox en Exportación automática\."/.test(i18n), "y ya no manda a otra pantalla");
  const veces = (i18n.match(/"exportPdf\.dropboxConectaAqui":/g) ?? []).length;
  ok(veces === 3, `el aviso de conectar esta en los tres idiomas (${veces})`);
}

console.log("\n--- ONEDRIVE: LAS CUATRO TRAMPAS DE MICROSOFT ---");
{
  // Es una copia de dropbox.ts, y ahi esta el riesgo: lo que se copia se copia bien, y lo que
  // Microsoft hace DISTINTO se cuela sin que nada avise. Estas cuatro son esas diferencias.
  //
  // Ninguna se descubre leyendo: las cuatro fallan en el celular, con la app ya conectada, y
  // con un mensaje que manda a buscar al sitio equivocado.
  const RAIZ = process.cwd();
  const crudo = fs.readFileSync(path.join(RAIZ, "utils/onedrive.ts"), "utf8");
  const codigo = crudo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // 1. offline_access. Sin el, Microsoft devuelve un permiso de UNA HORA y NO devuelve el
  //    largo: conectar funcionaria, el primer reporte saldria, y el de mañana no. Es el
  //    equivalente del token_access_type=offline de Dropbox, y no se llama igual.
  ok(/offline_access/.test(codigo), "se pide offline_access, o el permiso dura una hora");

  // 2. El scope TAMBIEN al renovar. Dropbox no lo necesita; Microsoft si. Sin esto el permiso
  //    renovado sale sin acceso a la carpeta y la subida falla con un "prohibido" que no se
  //    entiende, porque conectar SI habia funcionado.
  const renovar = codigo.slice(codigo.indexOf("grant_type: \"refresh_token\""));
  ok(/scope: PERMISOS/.test(renovar.slice(0, 400)), "y los permisos se repiten al renovar");

  // 3. PUT, no POST. Microsoft contesta "metodo no permitido" al POST.
  ok(/httpMethod: "PUT"/.test(codigo), "se sube con PUT");
  ok(!/httpMethod: "POST"[\s\S]*uploadAsync/.test(codigo), "y no con POST, que Microsoft rechaza");

  // 4. El nombre va DENTRO de la direccion, no en una cabecera como en Dropbox. Y escapado: un
  //    reporte se llama "Finzo agosto 2026.pdf" y ese espacio partiria la direccion.
  ok(/special\/approot:\/\$\{encodeURIComponent\(nombre\)\}:\/content/.test(codigo), "el nombre va escapado dentro de la direccion");
  ok(/conflictBehavior=rename/.test(codigo), "y dos reportes del mismo dia no se pisan");

  // Y LO QUE COMPARTE CON DROPBOX, que tampoco puede estar mal.
  ok(!/client_secret/.test(codigo), "el secreto NO esta en el codigo");
  ok(/code_challenge_method=S256/.test(codigo), "se usa PKCE con huella SHA-256");
  ok(/code_verifier/.test(codigo), "y se manda el numero al azar al canjear");
  ok(/Files\.ReadWrite\.AppFolder/.test(codigo), "solo se pide la carpeta propia de la app");
  ok(!/Files\.ReadWrite\.All/.test(codigo), "y NUNCA el OneDrive entero");
  ok(/SecureStore/.test(codigo), "el permiso guardado va al almacen seguro");
  ok(!/loadJSON|saveJSON/.test(codigo), "y no a los ajustes de siempre");
  ok(/status === 400 \|\| respuesta\.status === 401/.test(codigo), "un permiso revocado se detecta");
  ok(/desconectarOneDrive\(\)/.test(codigo), "y se olvida");
  // Las tres tentaciones que en el celular no existen. Ver utils/pkce.
  ok(!/\bbtoa\b/.test(codigo), "no se usa btoa, que en el celular no existe");
  ok(!/new URL\(/.test(codigo), "ni URL, que esta a medias");
  ok(!/URLSearchParams/.test(codigo), "ni URLSearchParams");

  // "common" y no "consumers": quien tenga su OneDrive en una cuenta de trabajo se quedaria
  // fuera sin entender por que.
  ok(/login\.microsoftonline\.com\/common\//.test(codigo), "acepta cuentas personales y de trabajo");

  // LA OPCION NO SE OFRECE HASTA QUE EXISTA EL IDENTIFICADOR DE AZURE.
  //
  // Es lo que impide entregar un boton que siempre falla: sin el identificador, tocar
  // "conectar" abriria el navegador para que Microsoft conteste que la app no existe — y eso
  // manda a buscar un fallo en el celular cuando lo que falta es un tramite.
  ok(/export function onedriveDisponible/.test(codigo), "hay forma de saber si esta disponible");
  const pantalla = fs.readFileSync(path.join(RAIZ, "screens/ScheduledExportSettings.tsx"), "utf8");
  ok(/onedriveDisponible\(\)/.test(pantalla), "y la pantalla solo la ofrece si lo esta");

  // Y CUANDO EL IDENTIFICADOR ESTE PUESTO, que sea uno de verdad. Un identificador de Azure es
  // un UUID; pegar ahi otra cosa —el "id de objeto", o el de directorio— da un error que no
  // dice cual de los tres se copio mal.
  const id = /const CLIENT_ID = "([^"]*)"/.exec(codigo)?.[1] ?? "";
  ok(
    id === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    id === "" ? "sin identificador todavia, y por eso no se ofrece" : "el identificador tiene forma de UUID"
  );

  // El destino tiene que contar como automatico, o el reporte no saldria solo nunca.
  ok(esDestinoAutomatico("onedrive"), "OneDrive cuenta como destino automatico");
  // Y alguien tiene que subirlo de verdad: sin esta linea, elegir OneDrive guardaria en Drive.
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/exportarEnFondo.ts"), "utf8");
  ok(/destination === "onedrive"[\s\S]{0,120}subirAOneDrive/.test(fondo), "y el reporte se sube de verdad a OneDrive");

  // Los textos, en los tres idiomas.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["destOneDrive", "onedriveConnect", "onedriveMissing", "onedriveNote", "onedriveReady", "onedriveFailed"]) {
    const veces = (i18n.match(new RegExp(`"schedExport\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- CADA MOTIVO DE 'NO SE HIZO' TIENE SU TEXTO ---");
{
  // El trabajo de fondo devuelve un MOTIVO y la pantalla lo enseña. Si a un
  // motivo le falta su texto no revienta nada: en pantalla sale la clave cruda
  // ("schedExport.res.error"), y encima justo en el momento en que alguien está
  // intentando entender por qué no llegó su reporte.
  const RAIZ = process.cwd();
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/exportarEnFondo.ts"), "utf8");
  const union = /type ResultadoDeFondo =([\s\S]*?);/.exec(fondo)?.[1] ?? "";
  const motivos = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  ok(motivos.length >= 8, `se leyeron los motivos del código (${motivos.length})`);
  for (const motivo of motivos) {
    const veces = (i18n.match(new RegExp(`"schedExport\\.res\\.${motivo}":`, "g")) ?? []).length;
    ok(veces === 3, `${motivo} tiene texto en los tres idiomas (${veces})`);
  }
}

console.log("\n--- Y NINGÚN TEXTO SE QUEDA CONTANDO UN LÍMITE QUE YA NO EXISTE ---");
{
  // ESTO ES EL FALLO DEL 06/08/2026, y no era de código: el usuario puso PDF,
  // no salió solo, y la app le dijo "el PDF es el único que no se puede armar
  // con la app cerrada. Elige Excel o CSV".
  //
  // Ese texto era verdad hasta el 06/08 por la tarde, cuando el PDF SÍ pasó a
  // poder hacerse con la app cerrada. Lo que le faltaba era instalar el APK que
  // trae esa parte —el JavaScript le había llegado por internet, la parte de
  // Android no—. Leyendo el aviso, la conclusión correcta era imposible: decía
  // "no se puede" cuando la verdad era "te falta instalar".
  //
  // Un límite se cuenta SIEMPRE junto a lo que hay que hacer. Estos tres textos
  // salen justo cuando el PDF automático no está disponible, así que los tres
  // tienen que nombrar la instalación.
  const RAIZ = process.cwd();
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["schedExport.fondoNoPdf", "schedExport.whyNotFull", "schedExport.res.pdf-no-se-puede"]) {
    const valores = [
      ...i18n.matchAll(new RegExp(`"${clave.replace(/\./g, "\\.")}":\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g")),
    ].map((m) => m[1]);
    ok(valores.length === 3, `${clave} está en los tres idiomas (${valores.length})`);
    // "instal" cubre instalar / instalada / install / instale en los tres.
    const sinDecirQueHacer = valores.filter((v) => !/instal/i.test(v));
    ok(
      sinDecirQueHacer.length === 0,
      `${clave} dice que hay que instalar la versión nueva${sinDecirQueHacer.length ? ` (falta en ${sinDecirQueHacer.length})` : ""}`
    );
  }

  // Y de paso, el mismo tipo de resto: el correo dejó de ser un destino el
  // 05/08/2026, y "abrir el correo necesita la app abierta" siguió escrito en
  // whyNotFull hasta hoy. Un texto que nombra algo que ya no existe manda a
  // buscar una opción que no está.
  const seccion = [...i18n.matchAll(/"schedExport\.[^"]*":\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const conCorreo = seccion.filter((v) => /correo|e-mail|\bemail\b|WhatsApp/i.test(v));
  ok(
    conCorreo.length === 0,
    `ningún texto de la exportación nombra correo ni WhatsApp${conCorreo.length ? `: "${conCorreo[0].slice(0, 60)}…"` : ""}`
  );
}

console.log("\n--- 'PROBAR AHORA' PRUEBA EL CAMINO QUE VA A CORRER ---");
{
  // OTRO TROZO DEL FALLO DEL 06/08/2026, y de los que engañan bien: el botón
  // abría la pantalla de exportar y hacía el archivo con la app delante. Salía
  // bien, el archivo aparecía en Drive, y a la hora fijada no llegaba nada.
  //
  // Son dos caminos distintos y se estaba probando el que NO iba a usarse. Un
  // botón de probar que no prueba lo que va a pasar es peor que no tenerlo:
  // convierte "no sé si funciona" en "comprobé que funciona".
  const RAIZ = process.cwd();
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const pant = fs.readFileSync(path.join(RAIZ, "screens/ScheduledExportSettings.tsx"), "utf8");
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/exportarEnFondo.ts"), "utf8");

  ok(pant.includes("exportarEnFondo(true)"), "probar llama al MISMO trabajo del despertador");
  // Y solo cuando de verdad va a salir solo. Si no puede, lo que va a pasar a la
  // hora ES abrir la pantalla, así que probar eso es lo correcto.
  ok(/if \(!saleSolo\) \{[\s\S]{0,200}?pathname: "\/export-pdf"/.test(pant), "y si no sale solo, prueba lo que sí pasará");
  // Los ajustes se guardan agrupados con un retardo y el trabajo los lee DEL
  // DISCO: sin volcarlos, probar tras cambiar la hora probaría la hora anterior.
  ok(
    /flushPendingSaves\(\);\s*\r?\n\s*const resultado = await exportarEnFondo\(true\)/.test(pant),
    "volcando antes los ajustes al disco, para no probar los de antes"
  );
  ok(pant.includes("probando"), "y el botón se bloquea mientras corre, para no hacer tres copias");

  // Forzando se salta el calendario —probar un martes una programación de lunes
  // tiene que funcionar— pero NO se apunta como hecho: si se apuntara, probar a
  // las tres de la tarde se llevaría por delante el reporte de las siete.
  ok(/if \(!forzar && !isScheduledDay\(/.test(fondo), "forzando no mira si hoy tocaba");
  ok(/if \(!forzar && schedule\.lastAutoRun ===/.test(fondo), "ni si ya se había hecho");
  ok(
    /if \(!forzar\) \{[\s\S]{0,220}?markExported\(ahora\);/.test(fondo),
    "y NO lo apunta como hecho, para no cancelar el reporte de verdad"
  );

  for (const clave of ["schedExport.testHintFondo", "schedExport.testRunning", "schedExport.testOk", "schedExport.testFail"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(/\./g, "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} está en los tres idiomas (${veces})`);
  }
  // El resultado se dice con su motivo. "No salió" a secas es exactamente el
  // "no pasó nada" que costó este ida y vuelta.
  ok(/schedExport\.testFail[^\n]*\{motivo\}/.test(i18n), "y si falla, dice por qué");

  // EL TEXTO DEL ERROR SE GUARDA Y SE ENSEÑA.
  //
  // Faltaba, y fue lo que dejó el fallo sin diagnosticar: el motivo guardado era
  // "error", y "error" no distingue entre el permiso de Drive caducado, el
  // archivo que no se escribió y la conversión que no salió. El único caso que
  // necesita detalle era justo el que lo tiraba a la basura.
  ok(/detalle\?: string/.test(fondo), "el intento guarda el texto del error");
  ok(/e instanceof Error \? `\$\{e\.name\}: \$\{e\.message\}`/.test(fondo), "sacado de la excepción de verdad");
  ok(/ultimo\?\.detalle/.test(pant), "y la pantalla lo enseña");
  ok(/selectable/.test(pant), "para poder copiarlo y mandarlo");

  // UN PDF VACÍO NO SE SUBE.
  //
  // La conversión puede contestar "listo" y dejar un archivo de cero bytes: el
  // navegador que lo dibuja no está en ninguna pantalla. Sin comprobarlo, en
  // Drive quedaría un archivo que no abre y el reporte diría "listo" — peor que
  // no tener ninguno, porque así nadie lo revisa.
  ok(/\(hecho\.size \?\? 0\) === 0/.test(fondo), "un PDF de cero bytes no se sube");
  ok(/apuntar\("pdf-vacio"/.test(fondo), "y se dice con su propio motivo, no como 'falló'");

  // La ruta se arma con la MISMA pieza que el Excel. Pegando textos salía una
  // barra doble —Paths.cache ya acaba en barra— y una ruta con "//" en medio es
  // de las que funcionan en un sitio y no en el siguiente.
  ok(/new File\(Paths\.cache, fileName\)/.test(fondo), "la ruta del PDF se arma como la del Excel");
  ok(
    !/Paths\.cache\.uri\.replace\("file:\/\/", ""\)\}\//.test(fondo),
    "sin pegar textos, que dejaba una barra doble"
  );
}

console.log("\n--- LA CONVERSIÓN A PDF NO PUEDE QUEDARSE COLGADA ---");
{
  // ESTE ERA EL FALLO. El usuario tocó "Probar ahora" y el botón se quedó en
  // "Probando..." para siempre: ni PDF ni error. La conversión no contestaba.
  //
  // Dos causas, las dos aquí vigiladas:
  //
  //  1. El navegador que dibuja el PDF no estaba dentro de ninguna pantalla, así
  //     que medía 0 x 0. Con cero de alto no hay nada que colocar en la hoja y el
  //     adaptador de impresión espera un contenido que no llega.
  //  2. No había NINGÚN tope de tiempo. Un trabajo de fondo colgado no avisa de
  //     nada: no falla, no termina, y desde fuera se ve igual que "no pasó nada".
  const RAIZ = process.cwd();
  const kt = fs.readFileSync(
    path.join(RAIZ, "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/HtmlAPdf.kt"),
    "utf8"
  );
  const idx = fs.readFileSync(path.join(RAIZ, "modules/export-scheduler/index.ts"), "utf8");
  const svc = fs.readFileSync(
    path.join(RAIZ, "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/FinzoExportService.kt"),
    "utf8"
  );

  // 1. NO SE ESPERA LA MEDIDA. Es el arreglo entero.
  //
  // Lo natural es pedir la medida del documento, esperar la respuesta y escribir
  // despues. Con eso la conversion se colgaba para siempre: en un navegador que no
  // esta dentro de ninguna pantalla, esa respuesta NO LLEGA NUNCA. No falla: no
  // llega.
  //
  // Lo hace asi porque asi lo hace expo-print, que es lo que esta misma app usa
  // para el PDF de a mano y funciona en este celular. Costo dos entregas llegar
  // ahi, asi que se vigila que no vuelva a "arreglarse" al revés.
  const puente = fs.readFileSync(
    path.join(RAIZ, "modules/export-scheduler/android/src/main/java/android/print/FinzoPrintCallbacks.kt"),
    "utf8"
  );
  ok(/fun medirSinEsperar\(/.test(puente), "la medida se pide sin esperar respuesta");
  ok(/FinzoPrintPuente\.medirSinEsperar\(/.test(kt), "y es la que se usa al convertir");
  // Si alguien vuelve a poner una respuesta que escuche la medida, vuelve el
  // cuelgue. La unica que se escucha es la de ESCRIBIR.
  ok(!/onLayoutFinished/.test(puente), "nadie escucha el resultado de la medida");
  ok(/onWriteFinished/.test(puente), "y sí el de la escritura, que es el que llega");

  // 2. Los topes de tiempo, y que estén ESCALONADOS.
  const num = (s: string | undefined) => Number((s ?? "").replace(/_/g, ""));
  const topeKt = num(/TOPE_MS = ([\d_]+)L/.exec(kt)?.[1]);
  const topeJs = num(/TOPE_PDF_MS = ([\d_]+)/.exec(idx)?.[1]);
  const topeTarea = num(/HeadlessJsTaskConfig\([\s\S]*?(\d{5,7}),/.exec(svc)?.[1]);
  ok(topeKt > 0, `Android tiene su propio tope (${topeKt} ms)`);
  ok(topeJs > 0, `y la app el suyo de reserva (${topeJs} ms)`);
  ok(topeTarea > 0, `y el trabajo de fondo el suyo (${topeTarea} ms)`);

  // El de Android va PRIMERO: su mensaje dice si falló al medir o al escribir, y
  // eso vale mucho más que "no contestó".
  ok(topeKt < topeJs, "el de Android salta antes que el de la app, que dice menos");
  // Y el de la app antes de que Android mate el trabajo: si saltara después, el
  // motivo no se llegaría a guardar y volveríamos a "no pasó nada".
  ok(topeJs < topeTarea, "y el de la app antes de que se acabe el trabajo de fondo");
  // Con sitio de sobra para SUBIR el archivo después de convertirlo.
  ok(
    topeTarea - topeJs >= 20000,
    `y quedan ${(topeTarea - topeJs) / 1000} s para subirlo (hacen falta 20)`
  );

  // El de reserva vive en la app A PROPÓSITO: los APK anteriores no traen el de
  // Android y no se les puede añadir por internet.
  ok(/Promise\.race/.test(idx), "el tope de la app no espera al APK nuevo");
  ok(/clearTimeout\(reloj\)/.test(idx), "y se retira al terminar, para no dejar el proceso despierto");

  // Contestar dos veces —el tope y el resultado de verdad— hace reventar la
  // promesa de JavaScript, y encima se tocaría un navegador ya soltado.
  ok(/if \(contestado\) return/.test(kt), "se contesta una sola vez");
  ok(/v\.destroy\(\)/.test(kt), "y el navegador se suelta, para no dejar uno por reporte");

  // Colgarse se dice APARTE de "falló": lo que hay que hacer es distinto, hace
  // falta el APK nuevo. Sin distinguirlo, se buscaría un problema de internet.
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/exportarEnFondo.ts"), "utf8");
  ok(/PdfEnFondoSinRespuesta/.test(fondo), "y en la app se cuenta como su propio motivo");

  // Y el tope dice DÓNDE se atascó. "No contestó" a secas no distingue entre
  // cargar el HTML, medir y escribir, y esa diferencia es lo único que sirve.
  ok(/\(\$etapa\)/.test(kt), "el tope dice en qué etapa se quedó");
}

console.log("\n--- EL PDF AUTOMÁTICO ES EL MISMO PAPEL QUE EL DE A MANO ---");
{
  // La pantalla de exportar llama a expo-print SIN decirle tamaño, así que sale
  // en el papel que expo-print trae por defecto. El automático lo pone a mano, en
  // otro archivo y en otro lenguaje: si los dos números no coinciden, el mismo
  // reporte sale en hojas de distinto tamaño y con los saltos de página en otro
  // sitio. Dos documentos distintos con el mismo nombre, que es justo lo que este
  // módulo existe para evitar.
  //
  // Ya pasó: aquí había A4 a 300 puntos por pulgada y allí Carta a 72.
  //
  // Se leen de expo-print DE VERDAD, no copiados: el día que cambien su valor por
  // defecto, esta prueba lo dice en vez de que se descubra comparando dos PDF.
  const RAIZ = process.cwd();
  const suyo = fs.readFileSync(
    path.join(RAIZ, "node_modules/expo-print/android/src/main/java/expo/modules/print/PrintPDFRenderTask.kt"),
    "utf8"
  );
  const num = (re: RegExp) => Number(re.exec(suyo)?.[1]);
  const anchoPt = num(/DEFAULT_MEDIA_WIDTH = (\d+)/);
  const altoPt = num(/DEFAULT_MEDIA_HEIGHT = (\d+)/);
  const ppp = num(/PIXELS_PER_INCH = (\d+)/);
  ok(anchoPt > 0 && altoPt > 0 && ppp > 0, `se leyó el papel de expo-print (${anchoPt}x${altoPt} a ${ppp})`);

  // La misma cuenta que hace expo-print: puntos / (ppp / 1000) = milésimos.
  const enMils = (puntos: number) => Math.round(puntos / (ppp / 1000));

  const kt = fs.readFileSync(
    path.join(RAIZ, "modules/export-scheduler/android/src/main/java/com/finzo/exportscheduler/HtmlAPdf.kt"),
    "utf8"
  );
  const nuestro = (re: RegExp) => Number(re.exec(kt)?.[1]);
  ok(nuestro(/ANCHO_MILS = (\d+)/) === enMils(anchoPt), `el ancho coincide (${enMils(anchoPt)})`);
  ok(nuestro(/ALTO_MILS = (\d+)/) === enMils(altoPt), `y el alto (${enMils(altoPt)})`);
  ok(nuestro(/PUNTOS_POR_PULGADA = (\d+)/) === ppp, `y los puntos por pulgada (${ppp})`);

  // La pantalla no puede empezar a pedirle a expo-print un tamaño propio sin que
  // esto se enteré: ahí se rompería la igualdad por el otro lado.
  const pantExp = fs.readFileSync(path.join(RAIZ, "screens/ExportPdfSheet.tsx"), "utf8");
  ok(
    /printToFileAsync\(\{ html \}\)/.test(pantExp),
    "y la pantalla sigue sin pedir un tamaño propio"
  );
}

console.log("\n--- Y SE PUEDE VER DESDE FUERA QUÉ TRAE EL CELULAR ---");
{
  // La marca del código (CODE_MARKER) dice qué JavaScript corre, y por internet
  // llega siempre el último: en el celular decía "6ago-06" mientras la parte de
  // Android era de dos APK antes. Preguntando por chat "¿qué versión tienes?"
  // la respuesta era correcta y no servía.
  //
  // Estas dos marcas en "Acerca de" contestan lo que sí importaba. Son dos y no
  // una porque el despertador llegó en un APK y el conversor de PDF en otro
  // posterior: hay celulares con el primero y sin el segundo, que es justo el
  // caso de este fallo.
  const RAIZ = process.cwd();
  const info = fs.readFileSync(path.join(RAIZ, "screens/AppInfo.tsx"), "utf8");
  ok(info.includes("puedeExportarEnFondo()"), "Acerca de enseña si trae el despertador");
  ok(info.includes("puedePdfEnFondo()"), "y si trae el conversor de PDF, que es lo que faltaba");
}

console.log("\n--- LOS GRÁFICOS DEL PDF AUTOMÁTICO SE PUEDEN PEDIR ---");
{
  // Pedido el 07/08/2026: *"la exportación programada va sin gráficos (falta su
  // interruptor)"*. Iban en `false` fijo, y era coherente con la pantalla de exportar a mano
  // —donde también vienen apagados— pero dejaba la exportación programada SIN FORMA de
  // tenerlos: encenderlos al exportar a mano no llegaba hasta aquí.
  const RAIZ = process.cwd();
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/exportarEnFondo.ts"), "utf8");
  const ajustes = fs.readFileSync(path.join(RAIZ, "utils/scheduledExport.ts"), "utf8");
  const pantalla = fs.readFileSync(path.join(RAIZ, "screens/ScheduledExportSettings.tsx"), "utf8");

  // Las tres mitades tienen que estar unidas: el ajuste existe, la pantalla lo cambia, y el
  // trabajo de fondo lo LEE. Que falte la tercera es el fallo clásico de este proyecto —dos
  // mitades bien y el fallo en la costura—: el interruptor se movería y el PDF saldría igual.
  ok(/charts\?: boolean/.test(ajustes), "el ajuste guarda si se quieren los graficos");
  ok(/update\(\{ charts: v \}\)/.test(pantalla), "la pantalla lo cambia");
  ok(/charts: schedule\.charts \?\? false/.test(fondo), "y el trabajo de fondo lo LEE de ahi");

  // VIENE APAGADO. Ocupan media hoja y empujan la lista a la siguiente, asi que encenderlos
  // por su cuenta cambiaria el documento a quien ya lo tenia puesto.
  ok(/charts: false/.test(ajustes), "y de fabrica viene apagado, como se comportaba antes");

  // Y EL "?? false" NO ES ADORNO: los ajustes guardados antes de esta version no traen este
  // dato, y sin el valor de respaldo el PDF de esos celulares saldria con graficos de golpe.
  ok(
    /schedule\.charts \?\? false/.test(fondo),
    "los ajustes guardados de antes valen apagado, no cambian solos"
  );

  // Solo con PDF: Excel y CSV no llevan graficos, y un interruptor que no hace nada es peor
  // que no tenerlo.
  ok(
    /schedule\.format === "pdf" && \(/.test(pantalla),
    "el interruptor solo sale con PDF elegido"
  );

  // Y sus dos textos en los tres idiomas. Uno que falte no da error: sale el nombre de la
  // clave en pantalla.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["graficos", "graficosHint"]) {
    const veces = (i18n.match(new RegExp(`"schedExport\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
