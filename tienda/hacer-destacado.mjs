// EL GRÁFICO DESTACADO DE LA FICHA (1024 × 500), hecho el 10/08/2026.
//
// Es la banda ancha de arriba de la ficha de Play Store. Google no deja publicar sin ella.
//
// SE GENERA CON UN GUIÓN Y NO A MANO CON UN EDITOR para poder cambiar el texto sin volver a
// dibujar nada — y porque el icono va incrustado desde `icono-512.png`, así que si el icono
// cambia, basta con volver a correr esto y los dos van a juego.
//
//   node tienda/hacer-destacado.mjs
//
// Hace falta sharp, que no es dependencia del proyecto: se baja al vuelo con npx.
//
// LO QUE PIDE GOOGLE, Y QUE HAY QUE RESPETAR SI SE TOCA:
//   · 1024 × 500 exactos.
//   · SIN transparencia. Por eso el `flatten`: un PNG con canal alfa, aunque esté opaco del
//     todo, se ha visto rechazar. El resultado sale como PNG de 24 bits.
//   · El texto, poco y grande. En el teléfono esta banda se ve a un tercio de su tamaño.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const VERDE = "#059669";

const icono = fs.readFileSync(path.join(AQUI, "icono-512.png")).toString("base64");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${VERDE}"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <clipPath id="redondo"><rect x="88" y="110" width="280" height="280" rx="64"/></clipPath>
  </defs>
  <rect width="1024" height="500" fill="url(#fondo)"/>
  <circle cx="120" cy="60" r="200" fill="#ffffff" opacity="0.05"/>
  <circle cx="960" cy="470" r="240" fill="#ffffff" opacity="0.05"/>
  <rect x="76" y="98" width="304" height="304" rx="76" fill="#ffffff" opacity="0.16"/>
  <image x="88" y="110" width="280" height="280" clip-path="url(#redondo)" xlink:href="data:image/png;base64,${icono}"/>
  <text x="432" y="212" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#ffffff" letter-spacing="-2">Finzo</text>
  <text x="436" y="286" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="38" font-weight="600" fill="#ffffff" opacity="0.95">Tus gastos y los de tu negocio,</text>
  <text x="436" y="336" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="38" font-weight="600" fill="#ffffff" opacity="0.95">cada uno por su lado.</text>
  <rect x="436" y="374" width="392" height="58" rx="29" fill="#ffffff" opacity="0.18"/>
  <text x="462" y="412" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#ffffff">Te yapean y se anota solo</text>
</svg>`;

const temporal = path.join(AQUI, ".destacado.svg");
const destino = path.join(AQUI, "destacado-1024x500.png");
fs.writeFileSync(temporal, svg);
try {
  execFileSync("npx", ["-y", "sharp-cli", "-i", temporal, "-o", destino, "-f", "png", "flatten", VERDE], {
    stdio: "inherit",
    shell: true,
  });
} finally {
  fs.unlinkSync(temporal);
}

// Se comprueba lo que salió, en vez de confiar: el tamaño y el tipo de color van escritos en
// la cabecera del PNG, y una banda de 1023 píxeles la rechaza el formulario sin decir por qué.
const png = fs.readFileSync(destino);
const ancho = png.readUInt32BE(16);
const alto = png.readUInt32BE(20);
const tipoColor = png[25];
if (ancho !== 1024 || alto !== 500) throw new Error(`Tamaño mal: ${ancho}x${alto}`);
if (tipoColor === 6) throw new Error("Salió con transparencia; falta el flatten");
console.log(`Listo: ${destino} (${ancho}x${alto}, sin transparencia)`);
