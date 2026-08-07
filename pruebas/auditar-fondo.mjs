// AUDITORIA A FONDO: lo que los otros auditores NO miran.
//
// Los que ya habia comprueban que los textos existan en los tres idiomas y
// que no falten claves. Este busca lo otro: claves repetidas, erratas de
// puntuacion, ceros escritos como letra, restos de depuracion y trampas de
// React que no dan error pero se comportan mal.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const CARPETAS = ["app", "screens", "components", "utils", "constants", "contexts", "modules"];

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "build" || e.name === "android") continue;
      archivos(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const TODOS = CARPETAS.flatMap((c) => archivos(path.join(RAIZ, c)));
const problemas = [];
function fallo(donde, que) {
  problemas.push(`${donde}: ${que}`);
}

// ---------------------------------------------------------------------------
console.log("\n--- CLAVES DE TEXTO REPETIDAS DENTRO DEL MISMO IDIOMA ---");
{
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8").split("\n");
  // Cada idioma arranca donde empieza su objeto. Se detectan por la linea que
  // abre el bloque, no por el archivo entero: una clave puede existir en
  // espanol y faltar en ingles, y mirando todo junto no se veria.
  const inicios = [];
  for (let i = 0; i < i18n.length; i++) {
    if (/^\s{2}(es|en|pt):\s*\{/.test(i18n[i])) inicios.push({ i, idioma: i18n[i].trim().slice(0, 2) });
  }
  console.log(`  ${inicios.length} bloques de idioma`);
  for (let k = 0; k < inicios.length; k++) {
    const desde = inicios[k].i;
    const hasta = k + 1 < inicios.length ? inicios[k + 1].i : i18n.length;
    const vistas = new Map();
    for (let i = desde; i < hasta; i++) {
      const m = i18n[i].match(/^\s*"([^"]+)":/);
      if (!m) continue;
      if (vistas.has(m[1])) {
        fallo("i18n", `clave repetida en ${inicios[k].idioma}: "${m[1]}" (lineas ${vistas.get(m[1]) + 1} y ${i + 1})`);
      } else {
        vistas.set(m[1], i);
      }
    }
    console.log(`  ${inicios[k].idioma}: ${vistas.size} claves`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n--- ERRATAS DE PUNTUACION EN LOS TEXTOS ---");
{
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8").split("\n");
  let revisados = 0;
  for (let i = 0; i < i18n.length; i++) {
    const m = i18n[i].match(/^\s*"[^"]+":\s*"(.*)",?\s*$/);
    if (!m) continue;
    const texto = m[1];
    revisados++;
    const linea = `linea ${i + 1}`;
    if (/\s{2,}/.test(texto)) fallo(linea, `dos espacios seguidos: "${texto.slice(0, 60)}"`);
    if (/\s[,;:]/.test(texto)) fallo(linea, `espacio antes de coma: "${texto.slice(0, 60)}"`);
    // Los puntos suspensivos son TRES y son correctos. Antes esta regla los
    // daba por error: al llegar al segundo punto veia ".." sin nada detras.
    // Ahora se exige que no haya punto ni antes ni despues.
    if (/,,|(?<!\.)\.\.(?!\.)/.test(texto)) fallo(linea, `puntuacion doble: "${texto.slice(0, 60)}"`);
    if (/^\s|\s$/.test(texto)) fallo(linea, `sobra un espacio al principio o al final: "${texto}"`);
    // Interrogaciones y exclamaciones sin pareja.
    const abre = (texto.match(/¿/g) || []).length;
    const cierra = (texto.match(/\?/g) || []).length;
    if (abre > cierra) fallo(linea, `¿ sin ? : "${texto.slice(0, 60)}"`);
    const abreEx = (texto.match(/¡/g) || []).length;
    const cierraEx = (texto.match(/!/g) || []).length;
    if (abreEx > cierraEx) fallo(linea, `¡ sin ! : "${texto.slice(0, 60)}"`);
    // Un cero escrito como letra O, o al reves, dentro de un numero.
    if (/\d[Oo]\d|\b[Oo]\d|\d[Oo]\b/.test(texto)) fallo(linea, `puede haber una O donde va un 0: "${texto.slice(0, 60)}"`);
    if (/\bl\d|\d l\b/.test(texto)) fallo(linea, `puede haber una l donde va un 1: "${texto.slice(0, 60)}"`);
    // Un {marcador} sin cerrar.
    const llaveAbre = (texto.match(/\{/g) || []).length;
    const llaveCierra = (texto.match(/\}/g) || []).length;
    if (llaveAbre !== llaveCierra) fallo(linea, `marcador sin cerrar: "${texto.slice(0, 60)}"`);
  }
  console.log(`  ${revisados} textos revisados`);
}

// ---------------------------------------------------------------------------
console.log("\n--- RESTOS DE DEPURACION ---");
{
  let encontrados = 0;
  for (const f of TODOS) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
    const lineas = fs.readFileSync(f, "utf8").split("\n");
    lineas.forEach((l, i) => {
      if (/^\s*console\.(log|debug|warn|error)\(/.test(l)) {
        fallo(`${rel}:${i + 1}`, `console dejado en el codigo: ${l.trim().slice(0, 60)}`);
        encontrados++;
      }
      if (/\b(TODO|FIXME|XXX|HACK)\b/.test(l) && !/\/\/ *(TODO|FIXME) *:/.test(l) === false) {
        // Solo se marcan los que son de verdad una nota pendiente.
      }
      if (/\bdebugger\b/.test(l)) {
        fallo(`${rel}:${i + 1}`, "debugger olvidado");
        encontrados++;
      }
    });
  }
  console.log(`  ${encontrados} restos`);
}

// ---------------------------------------------------------------------------
console.log("\n--- NOTAS PENDIENTES (TODO / FIXME) ---");
{
  let n = 0;
  for (const f of TODOS) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (/\b(TODO|FIXME|XXX|HACK)\b/.test(l)) {
          console.log(`  ${rel}:${i + 1}  ${l.trim().slice(0, 80)}`);
          n++;
        }
      });
  }
  console.log(`  ${n} notas`);
}

// ---------------------------------------------------------------------------
console.log("\n--- LA MISMA FUNCION EXPORTADA EN DOS ARCHIVOS ---");
{
  const donde = new Map();
  for (const f of TODOS) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
    const txt = fs.readFileSync(f, "utf8");
    for (const m of txt.matchAll(/^export (?:async )?function (\w+)/gm)) {
      const lista = donde.get(m[1]) ?? [];
      lista.push(rel);
      donde.set(m[1], lista);
    }
  }
  let n = 0;
  for (const [nombre, archivos2] of donde) {
    if (archivos2.length > 1) {
      fallo("duplicado", `${nombre}() existe en ${archivos2.join(" y ")}`);
      n++;
    }
  }
  console.log(`  ${donde.size} funciones exportadas, ${n} repetidas`);
}

// ---------------------------------------------------------------------------
console.log("\n--- PROPIEDADES 'initial' GUARDADAS EN useState ---");
{
  // Trampa de React: useState(prop) solo mira la propiedad la PRIMERA vez.
  // Si el componente se queda montado y la propiedad cambia, el estado no se
  // entera. Aqui se listan para revisarlos a mano, no como falla automatica:
  // en una pantalla que se monta de cero cada vez es correcto.
  let n = 0;
  for (const f of TODOS) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (/useState\(\s*initial\w*/.test(l)) {
          console.log(`  ${rel}:${i + 1}  ${l.trim().slice(0, 70)}`);
          n++;
        }
      });
  }
  console.log(`  ${n} para revisar a mano`);
}

// ---------------------------------------------------------------------------
console.log("\n--- COMPARACIONES SOSPECHOSAS ---");
{
  let n = 0;
  for (const f of TODOS) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        // == en vez de === (fuera de === y !==)
        // "== null" es a proposito: coge null Y undefined de una vez, que es
        // justo lo que se quiere al leer algo guardado. Lo demas si se marca.
        if (
          /[^=!<>]==[^=]/.test(l) &&
          !/===|!==/.test(l) &&
          !/==\s*null/.test(l) &&
          !/base64|data:image/.test(l)
        ) {
          fallo(`${rel}:${i + 1}`, `comparacion con == : ${l.trim().slice(0, 60)}`);
          n++;
        }
      });
  }
  console.log(`  ${n} comparaciones flojas`);
}

// ---------------------------------------------------------------------------
console.log("\n--- LA LISTA DE 'ENTRO DINERO', EN LOS DOS SITIOS ---");
{
  // La misma lista existe dos veces: en JavaScript, que decide si un aviso es
  // un ingreso, y en Kotlin, que decide si el celular lo dice en voz alta. No
  // se pueden unir: el servicio de Android no puede leer JavaScript.
  //
  // Se separaron. La de Kotlin la escribi a mano en vez de copiarla, y le
  // faltaba "te envio" — que es JUSTO como escribe Yape sus avisos: "te envio
  // un pago por S/ 1". Resultado: el yapeo se registraba bien (esa parte usa
  // la lista buena) y la voz callaba. Un fallo que solo se ve probando con un
  // yapeo de verdad.
  const js = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");
  const bloqueJs = js.slice(js.indexOf("const INCOME_HINTS"), js.indexOf("// Salió dinero"));
  const enJs = [...bloqueJs.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const kt = fs.readFileSync(
    path.join(
      RAIZ,
      "modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt"
    ),
    "utf8"
  );
  const desde = kt.indexOf("PALABRAS_DE_INGRESO = listOf(");
  const bloqueKt = kt.slice(desde, desde + kt.slice(desde).indexOf(")"));
  const enKt = [...bloqueKt.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const faltan = enJs.filter((p) => !enKt.includes(p));
  const sobran = enKt.filter((p) => !enJs.includes(p));

  for (const p of faltan) fallo("voz", `"${p}" esta en JavaScript pero no en Kotlin: la voz callara`);
  for (const p of sobran) fallo("voz", `"${p}" esta en Kotlin pero no en JavaScript`);

  console.log(`  ${enJs.length} palabras, iguales en los dos sitios: ${faltan.length + sobran.length === 0 ? "si" : "NO"}`);
}

// ---------------------------------------------------------------------------
console.log("\n--- COLORES DE CATEGORIA QUE SE PISAN ---");
{
  // En la rosquilla, el color es lo UNICO que distingue una categoria de
  // otra: los trozos no llevan etiqueta. Dos categorias del mismo color —o de
  // dos que se parecen— y no se sabe cual es cual.
  //
  // Llego a haber dos con el MISMO naranja exacto (Combustible y Hogar), y
  // no se vio hasta que se noto a ojo en la pantalla.
  // Se lee EL BLOQUE DEL TONO 600, no "todo lo que hay antes de GOAL_COLOR_HEX".
  //
  // Asi estaba, y se rompio el 07/08/2026 al anadir los tonos 100 y 500 al mismo
  // archivo: los tres mapas usan las mismas claves, asi que al leerlos todos
  // seguidos el ultimo pisaba al primero y este auditor acabo comparando unos
  // colores que no son los que se ven. Aviso en falso, y podria haber sido al
  // contrario — dar por bueno un par que si se parece.
  const colores = fs.readFileSync(path.join(RAIZ, "constants/colors.ts"), "utf8");
  const bloque600 = /COLOR_HEX_600[\s\S]*?\n\};/.exec(colores)?.[0] ?? "";
  const hex = Object.fromEntries(
    [...bloque600.matchAll(/^\s{2}(\w+):\s*"(#[0-9a-fA-F]{6})"/gm)].map((m) => [m[1], m[2]])
  );
  // Y se comprueba que de verdad se leyo: con el bloque vacio, el bucle de abajo no
  // compararia nada y el auditor pasaria sin haber mirado.
  if (Object.keys(hex).length < 15) {
    fallo("categorias", "no se pudo leer la paleta del tono 600 (" + Object.keys(hex).length + ")");
  }

  // El ojo no ve igual los tres canales: el verde pesa mas y el azul menos.
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return Math.sqrt((r1 - r2) ** 2 * 2 + (g1 - g2) ** 2 * 4 + (b1 - b2) ** 2 * 3);
  };

  const cats = fs.readFileSync(path.join(RAIZ, "constants/categories.ts"), "utf8");
  // 65 y no mas: con 13 categorias y 18 colores, lo maximo que se puede
  // separar el par mas parecido es 69. Pedir mas seria pedir lo imposible.
  const MINIMO = 65;

  for (const bloque of ["EXPENSE_CATS", "INCOME_CATS"]) {
    const desde = cats.indexOf(bloque);
    const trozo = cats.slice(desde, desde + cats.slice(desde).indexOf("];"));
    const lista = [...trozo.matchAll(/id: "(\w+)"[\s\S]*?color: "(\w+)"/g)].map((m) => ({
      id: m[1],
      color: m[2],
    }));

    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = hex[lista[i].color];
        const b = hex[lista[j].color];
        if (!a || !b) {
          fallo("categorias", lista[i].id + " o " + lista[j].id + " usa un color que no esta en la paleta");
          continue;
        }
        const d = dist(a, b);
        if (d < MINIMO) {
          fallo(
            "categorias",
            lista[i].id + " (" + lista[i].color + ") y " + lista[j].id +
              " (" + lista[j].color + ") se parecen demasiado: " + d.toFixed(0)
          );
        }
      }
    }
    console.log("  " + bloque + ": " + lista.length + " categorias revisadas");
  }
}

// ---------------------------------------------------------------------------
console.log("\n=== RESULTADO ===");
if (problemas.length === 0) {
  console.log("Sin problemas\n");
} else {
  for (const p of problemas) console.log("  FALLA " + p);
  console.log(`\n${problemas.length} problemas\n`);
}
process.exit(problemas.length ? 1 : 0);
