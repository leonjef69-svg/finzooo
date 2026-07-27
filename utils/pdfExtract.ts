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

  return rows.map(row => {
    const byX = [...row].sort((a, b) => a.x - b.x);
    let line = byX[0].text;
    for (let i = 1; i < byX.length; i++) {
      // Estima el fin del fragmento anterior (~5 unidades por carácter)
      const prevEnd = byX[i - 1].x + byX[i - 1].text.length * 5;
      const gap = byX[i].x - prevEnd;
      // Brecha grande → columna nueva (tab); pequeña → mismo campo (espacio)
      line += gap > 10 ? '\t' : ' ';
      line += byX[i].text;
    }
    return line.trim();
  }).filter(Boolean).join('\n');
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
