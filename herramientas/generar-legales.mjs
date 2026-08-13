// PUBLICA LOS TEXTOS LEGALES COMO PÁGINAS WEB
//
//   node herramientas/generar-legales.mjs
//
// Google Play exige una direccion web PUBLICA con la politica de privacidad, y la pide antes de
// dejar publicar nada. El texto ya existia dentro de la app —se lee en Ajustes— pero eso a
// Google no le sirve: tiene que poder abrirlo cualquiera desde un navegador, sin instalar nada.
//
// POR QUE SE GENERA Y NO SE ESCRIBE A MANO. Porque entonces habria DOS textos legales: el de la
// app y el de la web. Cambiaria uno, se olvidaria el otro, y acabariamos prometiendo por escrito
// dos cosas distintas sobre los datos de la gente. Ya paso algo asi el 08/08/2026, cuando la
// politica juraba que no se recogian fotos y la app llevaba semanas guardandolas.
//
// Aqui se lee constants/legal.ts —el mismo archivo que lee la app— y se vuelca a HTML. Si el
// texto cambia, se vuelve a correr esto y las dos versiones dicen lo mismo por construccion.
//
// Las paginas viven en docs/ porque es la carpeta que GitHub Pages sabe publicar sola.
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const SALIDA = path.join(RAIZ, "docs");
const TMP = path.join(RAIZ, "pruebas", ".tmp");

if (!fs.existsSync(path.join(RAIZ, "app.json"))) {
  console.error("Hay que correrlo desde la raiz del proyecto.");
  process.exit(1);
}
fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// legal.ts carga constants/anuncios, que a su vez arrastra cosas de React Native. Se empaqueta
// igual que las pruebas, con los mismos sustitutos.
const entrada = path.join(TMP, "legales-entrada.mjs");
fs.writeFileSync(
  entrada,
  `import { PRIVACY_POLICY, TERMS_AND_CONDITIONS, LEGAL_LAST_UPDATED, LEGAL_CONTACT_EMAIL } from "@/constants/legal";
console.log(JSON.stringify({ PRIVACY_POLICY, TERMS_AND_CONDITIONS, LEGAL_LAST_UPDATED, LEGAL_CONTACT_EMAIL }));`
);

const stub = (n) => path.join(RAIZ, "pruebas", "stubs", n);
const salida = path.join(TMP, "legales.mjs");
esbuild.buildSync({
  entryPoints: [entrada],
  bundle: true,
  platform: "node",
  format: "esm",
  alias: {
    "@": RAIZ,
    "react-native": stub("rn.ts"),
    "lucide-react-native": stub("lucide.ts"),
    "@expo/vector-icons": stub("vectoricons.ts"),
    "expo-font": stub("font.ts"),
    "@/modules/export-scheduler": stub("programador.ts"),
    "react-native-reanimated": stub("reanimated.ts"),
  },
  outfile: salida,
  logLevel: "silent",
});

const { execFileSync } = await import("child_process");
const textos = JSON.parse(execFileSync("node", [salida]).toString());

const escapar = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Convierte el texto plano en HTML.
 *
 * El texto viene con la forma con la que se lee en la app: numeros de seccion al principio de
 * linea y guiones para las listas. Se respeta tal cual — cambiar la redaccion aqui seria volver
 * a tener dos versiones distintas, que es justo lo que este archivo existe para evitar.
 */
function aHtml(texto) {
  const bloques = [];
  let lista = [];
  const cerrarLista = () => {
    if (lista.length) {
      bloques.push(`<ul>${lista.map((l) => `<li>${escapar(l)}</li>`).join("")}</ul>`);
      lista = [];
    }
  };
  for (const linea of texto.split("\n")) {
    const l = linea.trim();
    if (l === "") {
      cerrarLista();
      continue;
    }
    if (l.startsWith("- ")) {
      lista.push(l.slice(2));
      continue;
    }
    cerrarLista();
    if (/^\d+\.\s/.test(l)) bloques.push(`<h2>${escapar(l)}</h2>`);
    else bloques.push(`<p>${escapar(l)}</p>`);
  }
  cerrarLista();
  return bloques.join("\n");
}

const pagina = (titulo, cuerpo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${titulo} · Fino</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 720px; margin: 0 auto; padding: 28px 20px 64px;
    line-height: 1.65; color: #0f172a; background: #ffffff;
  }
  header { border-bottom: 3px solid #059669; padding-bottom: 14px; margin-bottom: 26px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 30px 0 8px; color: #065f46; }
  .marca { color: #059669; font-weight: 800; font-size: 15px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  a { color: #059669; }
  nav { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { color: #e2e8f0; background: #0f172a; }
    h2 { color: #6ee7b7; }
    nav { border-top-color: #1e293b; }
  }
</style>
</head>
<body>
<header>
  <div class="marca">Fino</div>
  <h1>${titulo}</h1>
</header>
${cuerpo}
<nav>
  <a href="./index.html">Inicio</a> ·
  <a href="./privacidad.html">Política de Privacidad</a> ·
  <a href="./terminos.html">Términos y Condiciones</a> ·
  <a href="./borrar-cuenta.html">Eliminar tu cuenta</a>
</nav>
</body>
</html>
`;

fs.writeFileSync(
  path.join(SALIDA, "privacidad.html"),
  pagina("Política de Privacidad", aHtml(textos.PRIVACY_POLICY))
);
fs.writeFileSync(
  path.join(SALIDA, "terminos.html"),
  pagina("Términos y Condiciones", aHtml(textos.TERMS_AND_CONDITIONS))
);
fs.writeFileSync(
  path.join(SALIDA, "index.html"),
  pagina(
    "Fino · Tus Gastos e Ingresos",
    `<p>Fino es una aplicación para anotar tus ingresos y gastos, ver en qué se va tu dinero cada mes y guardar para tus metas de ahorro.</p>
<p>Aquí están sus textos legales:</p>
<ul>
  <li><a href="./privacidad.html">Política de Privacidad</a></li>
  <li><a href="./terminos.html">Términos y Condiciones</a></li>
  <li><a href="./borrar-cuenta.html">Cómo eliminar tu cuenta</a></li>
</ul>
<p>Para cualquier duda: <a href="mailto:${textos.LEGAL_CONTACT_EMAIL}">${textos.LEGAL_CONTACT_EMAIL}</a></p>`
  )
);

console.log("Listo. Tres paginas en docs/ (actualizado: " + textos.LEGAL_LAST_UPDATED + ")");
