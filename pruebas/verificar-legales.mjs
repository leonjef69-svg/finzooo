// LO QUE LA APP PROMETE Y LO QUE LA APP HACE TIENEN QUE COINCIDIR (08/08/2026)
//
// Esta prueba no mira cuentas ni pantallas: mira que los textos legales y de venta digan la
// verdad. Es el tipo de fallo que no rompe nada y que sin embargo tumba una publicacion en
// Play Store, porque Google lo trata como afirmacion engañosa.
//
// Los dos casos que la hicieron falta, y los dos estaban vivos hasta hoy:
//
//   1. "Sin publicidad" en la pantalla de Premium. NO HAY ANUNCIOS QUE QUITAR: se estaba
//      cobrando por retirar algo que nunca estuvo. Prometer lo que ya tienes gratis es
//      exactamente lo que Google llama engañoso.
//   2. La politica de privacidad decia "no recogemos fotos" y para entonces la app YA guardaba
//      fotos en las categorias propias y en el escaner de boletas. Y no mencionaba en ninguna
//      linea la lectura de notificaciones, que es el permiso mas delicado de toda la app.
//
// Lo segundo es peor que un descuido legal: la persona da un permiso que ve TODOS sus avisos
// creyendo lo que dice esa pantalla.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const legal = fs.readFileSync(path.join(RAIZ, "constants/legal.ts"), "utf8");
const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");

console.log("\n--- NADA DE PROMETER LO QUE NO SE DA ---");
{
  // NO HAY ANUNCIOS EN FINZO, asi que no se puede vender el quitarlos. Se busca en los textos
  // que ve la persona, en los tres idiomas.
  for (const frase of ["Sin publicidad", "Sem anúncios", "No ads"]) {
    ok(!i18n.includes(frase), `no se promete "${frase}": no hay anuncios que quitar`);
  }
}

console.log("\n--- LA POLITICA DE PRIVACIDAD DICE LA VERDAD ---");
{
  // LO QUE DECIA Y ERA FALSO. La app guarda fotos desde que existen las categorias propias
  // (03/08/2026) y el escaner de boletas.
  ok(!/No recogemos tu ubicación, contactos, fotos/.test(legal), 'ya no dice "no recogemos fotos", que era falso');

  // Y LO QUE TIENE QUE DECIR, porque la app lo hace. Cada una de estas es un dato que se
  // guarda de verdad: si algun dia se deja de guardar, esta prueba avisa de que sobra el texto
  // — y si se añade otro dato nuevo, hay que sumarlo aqui.
  const obligatorio = [
    ["notificaciones", /lectura de notificaciones/i],
    ["que el permiso de avisos es de TODOS", /el permiso es para todos/i],
    ["que solo se miran los avisos de Yape", /solo mira los avisos de Yape/i],
    ["que viene apagado", /viene apagada/i],
    ["las fotos de las categorias", /categorías propias/i],
    ["las boletas del escaner", /boletas/i],
    ["los contactos de envio", /correos y números de teléfono/i],
    ["los datos del Modo Negocio", /negocios, productos, ventas/i],
    ["el microfono", /micrófono/i],
    ["Drive y Dropbox", /Dropbox/i],
  ];
  for (const [que, re] of obligatorio) {
    ok(re.test(legal), `dice lo de ${que}`);
  }

  // DE LOS AVISOS DE CLAVES NO SE GUARDA EL TEXTO, y eso hay que decirlo: es la diferencia
  // entre "leemos tus avisos" y "leemos tus avisos MENOS tus codigos".
  ok(/códigos de verificación/i.test(legal), "y que de las claves no se guarda el texto");

  // BORRAR LA CUENTA SIN LA APP. Google lo exige aunque la app tenga el boton.
  ok(/sin instalar la app/i.test(legal), "y como borrar la cuenta sin instalar la app");

  // La fecha tiene que haberse movido: una politica que cambia y mantiene la fecha vieja hace
  // creer que no cambio nada.
  ok(!/21 de julio de 2026/.test(legal), "la fecha se actualizo al cambiar el texto");
}

console.log("\n--- LAS PAGINAS QUE PIDE GOOGLE, Y QUE COINCIDAN CON LA APP ---");
{
  // Google exige DOS direcciones publicas: la politica de privacidad y una forma de borrar la
  // cuenta SIN instalar la app. Que existan aqui no basta —hay que publicarlas— pero sin estos
  // archivos no hay nada que publicar.
  for (const archivo of ["docs/privacidad.html", "docs/borrar-cuenta.html", "docs/index.html"]) {
    ok(fs.existsSync(path.join(RAIZ, archivo)), `existe ${archivo}`);
  }

  const web = fs.readFileSync(path.join(RAIZ, "docs/privacidad.html"), "utf8");
  const borrado = fs.readFileSync(path.join(RAIZ, "docs/borrar-cuenta.html"), "utf8");

  // EL CORREO DE CONTACTO TIENE QUE SER EL MISMO QUE EL DE LA APP. Con dos correos distintos,
  // quien escriba al de la web pide el borrado a un buzon que nadie mira.
  const correo = /LEGAL_CONTACT_EMAIL = "([^"]+)"/.exec(legal)?.[1] ?? "";
  ok(correo !== "", "la app tiene un correo de contacto");
  ok(web.includes(correo), "y la web de privacidad usa el mismo");
  ok(borrado.includes(correo), "y la de borrar la cuenta tambien");

  // LA PAGINA DE BORRADO TIENE QUE DECIR QUE SE BORRA Y EN CUANTO TIEMPO: es literalmente lo
  // que Google pide comprobar en esa pagina.
  ok(/30 días/.test(borrado), "la pagina de borrado dice en cuanto tiempo se borra");
  ok(/no se puede deshacer/i.test(borrado), "y que no se puede deshacer");
  ok(/Modo Negocio/.test(borrado), "y enumera lo que se borra, incluido el negocio");

  // Y LA PAGINA TIENE QUE SEGUIR A LA APP: si manana se mueve el boton de borrar cuenta, aqui
  // quedaria una instruccion que no lleva a ningun sitio, en la unica pagina que lee alguien
  // que quiere irse.
  //
  // Se miran los DOS lados, que es donde vive el camino de verdad: la fila esta en la pantalla
  // de Ajustes y la ruta se abre desde la pestaña. La primera version de esta comprobacion
  // buscaba la ruta dentro de screens/Settings.tsx y fallaba teniendo la app razon — el fallo
  // era de la prueba, no del codigo.
  const ajustes = fs.readFileSync(path.join(RAIZ, "screens/Settings.tsx"), "utf8");
  const pestana = fs.readFileSync(path.join(RAIZ, "app/(tabs)/settings.tsx"), "utf8");
  ok(/settings\.deleteAccount/.test(ajustes), "Ajustes tiene la fila de eliminar cuenta");
  ok(/router\.push\("\/delete-account"\)/.test(pestana), "y lleva a la pantalla de borrado");

  // Y QUE SE LLAME IGUAL EN LA WEB QUE EN LA APP. Si la fila dijera "Cerrar mi cuenta" y la web
  // "Eliminar cuenta", quien siga las instrucciones no encuentra el boton y se queda dentro.
  const etiqueta = /"settings\.deleteAccount": "([^"]+)"/.exec(i18n)?.[1] ?? "";
  ok(etiqueta !== "" && borrado.includes(etiqueta), `la web nombra el boton igual que la app ("${etiqueta}")`);
}

console.log(fallos === 0 ? "\nTodo bien: los textos legales dicen la verdad\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
