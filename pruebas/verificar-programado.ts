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
  esDestinoAutomatico,
  horaValida,
  isAutoRunDue,
  isPastTime,
  isScheduledDay,
  minutoValido,
  monthForSchedule,
  proximaEjecucion,
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

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
