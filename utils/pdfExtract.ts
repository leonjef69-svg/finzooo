// Extractor de texto para PDFs de estados de cuenta bancarios.
// Solo funciona con PDFs de texto (no imágenes escaneadas).
// Descomprime streams FlateDecode con fflate y rastrea la posición
// de cada fragmento de texto para reconstruir la tabla por filas.

import { decompressSync } from 'fflate';

// ── Helpers de bytes ─────────────────────────────────────────────────

function u8str(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function u8search(data: Uint8Array, needle: string, from = 0): number {
  const len = needle.length;
  const codes: number[] = [];
  for (let k = 0; k < len; k++) codes.push(needle.charCodeAt(k));
  outer: for (let i = from; i <= data.length - len; i++) {
    for (let j = 0; j < len; j++) {
      if (data[i + j] !== codes[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// ── Decodificadores de cadenas PDF ───────────────────────────────────

function decLiteral(s: string): string {
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] !== '\\') { out += s[i++]; continue; }
    i++;
    const c = s[i] ?? '';
    i++;
    switch (c) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      default:
        if (c >= '0' && c <= '7') {
          let oct = c;
          if (s[i] >= '0' && s[i] <= '7') oct += s[i++];
          if (s[i] >= '0' && s[i] <= '7') oct += s[i++];
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += c;
        }
    }
  }
  return out;
}

function decHex(s: string): string {
  const h = s.replace(/\s/g, '');
  let out = '';
  for (let i = 0; i + 1 < h.length; i += 2) {
    const code = parseInt(h.slice(i, i + 2), 16);
    if (!isNaN(code)) out += String.fromCharCode(code);
  }
  return out;
}

function decPdfStr(tok: string): string {
  if (tok.startsWith('<')) return decHex(tok.slice(1, -1));
  return decLiteral(tok.slice(1, -1));
}

// ── Tokenizador de stream de contenido PDF ───────────────────────────

type PdfToken = { type: 'str' | 'arr' | 'num' | 'op'; val: string };

function* tokenize(src: string): Generator<PdfToken> {
  let i = 0;
  const len = src.length;

  while (i < len) {
    const c = src[i];

    // Espacios en blanco
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\x0C' || c === '\x00') {
      i++; continue;
    }

    // Comentario
    if (c === '%') {
      while (i < len && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }

    // Cadena literal (...)
    if (c === '(') {
      let depth = 1, j = i + 1, raw = '(';
      while (j < len && depth > 0) {
        const ch = src[j];
        if (ch === '\\') { raw += ch + (src[j + 1] ?? ''); j += 2; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        raw += ch; j++;
      }
      yield { type: 'str', val: raw };
      i = j; continue;
    }

    // Diccionario << >> o cadena hex <>
    if (c === '<') {
      if (src[i + 1] === '<') {
        let depth = 1, j = i + 2;
        while (j < len && depth > 0) {
          if (src[j] === '<' && src[j + 1] === '<') { depth++; j += 2; }
          else if (src[j] === '>' && src[j + 1] === '>') { depth--; j += 2; }
          else j++;
        }
        i = j; continue;
      }
      const end = src.indexOf('>', i + 1);
      if (end < 0) { i++; continue; }
      yield { type: 'str', val: src.slice(i, end + 1) };
      i = end + 1; continue;
    }

    // Array [...]
    if (c === '[') {
      let depth = 1, j = i + 1, raw = '[';
      while (j < len && depth > 0) {
        const ch = src[j];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        // Cadena literal dentro del array
        if (ch === '(') {
          let d2 = 1; raw += ch; j++;
          while (j < len && d2 > 0) {
            const ch2 = src[j];
            if (ch2 === '\\') { raw += ch2 + (src[j + 1] ?? ''); j += 2; continue; }
            if (ch2 === '(') d2++;
            else if (ch2 === ')') d2--;
            raw += ch2; j++;
          }
          continue;
        }
        raw += ch; j++;
      }
      yield { type: 'arr', val: raw };
      i = j; continue;
    }

    // Saltar ] y >
    if (c === ']' || c === '>') { i++; continue; }

    // Nombre /Name
    if (c === '/') {
      let j = i + 1;
      while (j < len && !/[\s/<>[\](){}%]/.test(src[j])) j++;
      i = j; continue;
    }

    // Número u operador
    {
      let j = i;
      while (j < len && !/[\s/<>[\](){}%]/.test(src[j])) j++;
      const tok = src.slice(i, j);
      if (tok) {
        const isNum = /^-?(?:\d+\.?\d*|\.\d+)$/.test(tok);
        yield { type: isNum ? 'num' : 'op', val: tok };
      }
      i = j;
    }
  }
}

// ── Extracción de fragmentos de texto con posición ───────────────────

interface TextPiece {
  x: number;
  y: number;
  text: string;
}

function extractPieces(content: string): TextPiece[] {
  const pieces: TextPiece[] = [];

  let inText = false;
  let tlm_x = 0, tlm_y = 0;
  let cx = 0, cy = 0;
  let leading = 0;

  const nums: number[] = [];
  let lastStr = '';
  let lastArr = '';

  for (const tok of tokenize(content)) {
    if (tok.type === 'num') { nums.push(parseFloat(tok.val)); continue; }
    if (tok.type === 'str') { lastStr = tok.val; lastArr = ''; continue; }
    if (tok.type === 'arr') { lastArr = tok.val; lastStr = ''; continue; }

    const op = tok.val;

    switch (op) {
      case 'BT':
        inText = true;
        tlm_x = 0; tlm_y = 0; cx = 0; cy = 0;
        break;

      case 'ET':
        inText = false;
        break;

      case 'TL':
        if (nums.length >= 1) leading = nums[nums.length - 1];
        break;

      case 'Tm':
        if (inText && nums.length >= 6) {
          tlm_x = cx = nums[nums.length - 2];
          tlm_y = cy = nums[nums.length - 1];
        }
        break;

      case 'Td':
      case 'TD':
        if (inText && nums.length >= 2) {
          const tx = nums[nums.length - 2];
          const ty = nums[nums.length - 1];
          if (op === 'TD') leading = -ty;
          tlm_x += tx; tlm_y += ty;
          cx = tlm_x; cy = tlm_y;
        }
        break;

      case 'T*':
        if (inText) {
          tlm_y -= leading;
          cx = tlm_x; cy = tlm_y;
        }
        break;

      case 'Tj':
      case "'":
      case '"':
        if (inText && lastStr) {
          if (op === "'") { tlm_y -= leading; cx = tlm_x; cy = tlm_y; }
          const text = decPdfStr(lastStr).trim();
          if (text) pieces.push({ x: cx, y: cy, text });
        }
        break;

      case 'TJ':
        if (inText) {
          const arr = lastArr || lastStr;
          if (arr) {
            let text = '';
            for (const t of tokenize(arr.slice(1, -1))) {
              if (t.type === 'str') text += decPdfStr(t.val);
            }
            const trimmed = text.trim();
            if (trimmed) pieces.push({ x: cx, y: cy, text: trimmed });
          }
        }
        break;
    }

    nums.length = 0;
    lastStr = '';
    lastArr = '';
  }

  return pieces;
}

// Agrupa fragmentos por posición Y y los une en líneas separadas por tabulaciones
// (cada columna queda separada de la siguiente por un tab, que el parser reconoce).
function piecesToText(pieces: TextPiece[]): string {
  if (pieces.length === 0) return '';

  // Orden: Y descendente (arriba primero) → X ascendente (izquierda primero)
  const sorted = [...pieces].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
    return a.x - b.x;
  });

  // Agrupa por Y (tolerancia ±3 unidades PDF = misma fila visual)
  const rows: TextPiece[][] = [];
  let cur: TextPiece[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - cur[0].y) <= 3) {
      cur.push(sorted[i]);
    } else {
      rows.push(cur);
      cur = [sorted[i]];
    }
  }
  rows.push(cur);

  // Primero se juntan los trozos que son un mismo campo partido. Un texto puede llegar en
  // varias piezas seguidas —pasa con los acentos y con ciertas fuentes—, y separarlas en
  // columnas distintas partiría una descripción por la mitad.
  const celdas: TextPiece[][] = rows.map(row => {
    const byX = [...row].sort((a, b) => a.x - b.x);
    const juntas: TextPiece[] = [byX[0]];
    for (let i = 1; i < byX.length; i++) {
      const anterior = juntas[juntas.length - 1];
      // Estima el fin del fragmento anterior (~5 unidades por carácter)
      const finAnterior = anterior.x + anterior.text.length * 5;
      if (byX[i].x - finAnterior > 10) {
        juntas.push(byX[i]);
      } else {
        anterior.text += ' ' + byX[i].text;
      }
    }
    return juntas;
  });

  /**
   * LAS CASILLAS VACÍAS TAMBIÉN OCUPAN SITIO (13/08/2026).
   *
   * Antes esto pegaba las celdas de cada fila con un tab entre ellas, y ahí estaba el fallo:
   * en un PDF, una casilla vacía NO EXISTE — no hay texto, no hay nada—. Una fila con Cargo
   * vacío llegaba con tres celdas en vez de cuatro, y el monto del Abono terminaba en el sitio
   * del Cargo.
   *
   * Se vio con un estado de cuenta de ejemplo: "ABONO SUELDO JULIO — 2450" entraba como GASTO.
   * Plata que entra anotada como plata que sale, en silencio y en todos los bancos que separan
   * Cargo y Abono en dos columnas. De los errores que puede tener un cuaderno de gastos, este es
   * de los peores: no se nota mirando, solo cuando las cuentas no cuadran semanas después.
   *
   * Ahora se miran las POSICIONES. La fila con más celdas hace de plantilla —casi siempre la de
   * los títulos, o una fila completa— y cada celda de las demás cae en la columna que le toca
   * por dónde empieza. Las columnas sin nada salen vacías, pero salen: el tab que las separa es
   * lo que mantiene el monto en su sitio.
   */
  const plantilla = celdas.reduce((mejor, fila) => (fila.length > mejor.length ? fila : mejor), celdas[0]);

  // Con una sola columna no hay tabla que reconstruir, y con dos el riesgo de equivocarse supera
  // la ganancia: se deja el texto tal cual venía.
  if (plantilla.length < 3) {
    return celdas.map(fila => fila.map(c => c.text).join('\t').trim()).filter(Boolean).join('\n');
  }

  // La frontera entre dos columnas está a medio camino entre donde empiezan. Un número alineado
  // a la derecha empieza más adentro que su título, pero nunca antes de esa frontera.
  const inicios = plantilla.map(c => c.x);
  const fronteras: number[] = [];
  for (let i = 1; i < inicios.length; i++) fronteras.push((inicios[i - 1] + inicios[i]) / 2);

  const columnaDe = (x: number): number => {
    let i = 0;
    while (i < fronteras.length && x >= fronteras[i]) i++;
    return i;
  };

  return celdas
    .map(fila => {
      const columnas: string[] = new Array(inicios.length).fill('');
      for (const celda of fila) {
        const i = columnaDe(celda.x);
        // Dos celdas en la misma columna se juntan en vez de pisarse: perder texto es peor que
        // que una columna traiga de más.
        columnas[i] = columnas[i] ? `${columnas[i]} ${celda.text}` : celda.text;
      }
      // Se recortan las vacías del final: no aportan nada y ensucian las líneas de título.
      let ultima = columnas.length - 1;
      while (ultima >= 0 && columnas[ultima] === '') ultima--;
      return columnas.slice(0, ultima + 1).join('\t').trim();
    })
    .filter(Boolean)
    .join('\n');
}

// ── Función principal ────────────────────────────────────────────────

export async function extractPdfText(data: Uint8Array): Promise<string> {
  let pos = 0;
  const allPieces: TextPiece[] = [];

  while (pos < data.length) {
    const si = u8search(data, 'stream', pos);
    if (si < 0) break;

    // El PDF spec exige que "stream" sea seguido por \n o \r\n
    let ci = si + 6;
    if (data[ci] === 13) ci++; // \r
    if (data[ci] !== 10) { pos = si + 1; continue; }
    ci++;

    // Busca FlateDecode en el diccionario que precede al stream
    const dictText = u8str(data.slice(Math.max(0, si - 500), si));
    const isFlate = /\/FlateDecode\b|\/Fl\b/.test(dictText);

    const ei = u8search(data, 'endstream', ci);
    if (ei < 0) { pos = si + 1; continue; }

    const rawStream = data.slice(ci, ei);
    pos = ei + 9;

    let content: string;
    if (isFlate) {
      try {
        content = u8str(decompressSync(rawStream));
      } catch {
        continue; // stream corrupto o no es zlib, saltamos
      }
    } else {
      content = u8str(rawStream);
    }

    if (!content.includes('BT')) continue;

    allPieces.push(...extractPieces(content));
  }

  return piecesToText(allPieces);
}

/** Por qué un PDF no se dejó leer. */
export type PdfProblem = 'encrypted' | 'scanned' | 'sinLetras' | 'unknown';

/**
 * ¿Se entendió ALGO de este texto?
 *
 * Se busca una palabra de las que lleva cualquier estado de cuenta, en los tres idiomas.
 * Es la prueba más directa que hay: si no aparece ni una, no se entendió nada, y da igual
 * cuántos caracteres hayan salido.
 *
 * Se prefiere esto a contar caracteres porque contar engaña. Ver seEntiende.
 */
const PALABRAS_DE_ESTADO = [
  'fecha', 'saldo', 'monto', 'total', 'cuenta', 'pago', 'consumo', 'importe', 'operacion',
  'date', 'balance', 'amount', 'payment', 'account',
  'data', 'valor', 'conta', 'pagamento',
];

/**
 * ¿El texto que salió del PDF se entiende, o son letras sueltas sin sentido?
 *
 * HACE FALTA PORQUE UN PDF PUEDE DEVOLVER MUCHÍSIMO TEXTO Y NINGUNA LETRA (07/08/2026).
 *
 * El usuario subió su estado de cuenta de verdad —una tarjeta de crédito, diciembre— y le
 * salió *"no se pudo leer el texto de este PDF"*. Se probó ese archivo contra este mismo
 * extractor y salieron **7.024 caracteres**: texto había. Lo que no había era sentido.
 *
 * El motivo: ese PDF escribe con tipografías propias (`Identity-H`), donde cada letra
 * viaja como un número que hay que traducir con una tabla que el propio PDF debería
 * traer. Sin traducir, salen símbolos: `« ¬ ­ ® ¯ °`. Se midió: **12% de caracteres
 * ASCII y CERO palabras reconocibles**.
 *
 * Los dos números están medidos del archivo real, no elegidos a ojo. Un PDF de texto
 * normal pasa del 80% de ASCII y trae "fecha" y "saldo" por todas partes, así que entre
 * uno bueno y este no hay zona de duda: hay un abismo.
 *
 * SE MIRAN LAS DOS COSAS, y cada una tapa el hueco de la otra:
 *
 *   · La palabra sola fallaría con un banco que escriba distinto —"F. Proceso" en vez de
 *     "fecha"— y le diríamos que su PDF no se entiende cuando sí se entendía.
 *   · El porcentaje solo fallaría con este archivo: sus letras raras caen en parte dentro
 *     del ASCII, así que un umbral alto lo daría por bueno.
 */
export function seEntiende(texto: string): boolean {
  const enMinusculas = texto.toLowerCase();
  if (PALABRAS_DE_ESTADO.some((p) => enMinusculas.includes(p))) return true;

  const sinEspacios = texto.replace(/\s/g, '');
  if (sinEspacios.length < 200) return true; // demasiado poco para juzgarlo

  const legibles = (sinEspacios.match(/[a-zA-Z0-9]/g) ?? []).length;
  return legibles / sinEspacios.length >= 0.4;
}

/**
 * Averigua POR QUÉ no salió texto de un PDF.
 *
 * Antes, cualquier PDF que fallara daba el mismo mensaje: "no se pudo leer el
 * texto de este PDF, intenta exportarlo como CSV". Ese consejo sirve para un
 * caso y para los otros dos no, y quien lo lee se queda sin saber si el
 * problema tiene arreglo o si su banco no sirve.
 *
 * Son tres cosas distintas y cada una tiene su salida:
 *
 *   PROTEGIDO — el banco le puso contraseña, normalmente el DNI. Se abre en
 *   el celular porque el visor la pide, pero Fino no puede leer dentro. Se
 *   arregla guardando una copia sin contraseña.
 *
 *   ESCANEADO — las páginas son fotos, no texto. No hay letras que leer, por
 *   mucho que se vean en pantalla. Aquí sí hace falta reconocer la imagen.
 *
 *   OTRO — el PDF usa algo que este lector no entiende.
 *
 * Se mira solo el primer trozo del archivo: el diccionario del PDF y sus
 * cabeceras van al principio, y recorrer un estado de cuenta entero para esto
 * sería lento en un celular.
 */
export function diagnosePdf(data: Uint8Array, texto = ''): PdfProblem {
  const cabecera = u8str(data.slice(0, Math.min(data.length, 4096)));
  const cola = u8str(data.slice(Math.max(0, data.length - 4096)));

  // /Encrypt vive en el trailer, al final del archivo.
  if (/\/Encrypt\b/.test(cola) || /\/Encrypt\b/.test(cabecera)) return 'encrypted';

  // SALIÓ TEXTO PERO NO SE ENTIENDE: las letras van con códigos propios.
  //
  // Va ANTES de mirar si hay imágenes, y ese orden es el arreglo: con el orden anterior
  // este archivo se llevaba el mensaje de "escaneado", que es falso. Ver seEntiende.
  if (texto.replace(/\s/g, '').length >= 200 && !seEntiende(texto)) return 'sinLetras';

  // ESCANEADO: páginas que son fotos. Son imágenes JPEG o JPEG2000 incrustadas.
  //
  // Y AHORA SE EXIGE ADEMÁS QUE NO HAYA SALIDO TEXTO, porque solo con la imagen esto
  // estaba MAL (07/08/2026): **todos** los estados de cuenta traen el logo del banco en
  // JPEG, así que cualquiera daba "escaneado". El del usuario tenía cinco imágenes y 7.024
  // caracteres de texto, y se le dijo que eran fotos de las páginas.
  //
  // Una página de verdad escaneada no deja texto: si hay texto, las imágenes son adornos.
  const casiSinTexto = texto.replace(/\s/g, '').length < 200;
  if (casiSinTexto && (u8search(data, '/DCTDecode') >= 0 || u8search(data, '/JPXDecode') >= 0)) {
    return 'scanned';
  }

  return 'unknown';
}
