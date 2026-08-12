// LA FOTO DE LA BOLETA, PEGADA AL MOVIMIENTO (12/08/2026)
//
// Pedido suyo: tomar una foto o elegirla de la galeria al anotar un gasto, ver desde la lista
// cuales la tienen, y poder cambiarla desde el detalle.
//
// LO QUE ESTA PRUEBA VIGILA NO ES QUE SE VEA LA FOTO. Es lo que puede salir caro:
//
//   1. QUE LA FOTO NO ENTRE EN EL MOVIMIENTO. Todo lo que se sube a la nube va en UN documento
//      con tope de 1 MB —movimientos, presupuestos, metas, todo junto— y pasarse no lo deja a
//      medias: lo deja SIN GUARDAR. Una foto de boleta legible pesa entre 60 y 90 KB; con doce,
//      esa persona pierde su copia de seguridad entera sin enterarse hasta que cambie de
//      celular. Por eso en el movimiento va la RUTA, que pesa sesenta bytes.
//
//   2. QUE BORRAR EL MOVIMIENTO SE LLEVE SU FOTO. Si no, cada gasto borrado deja una imagen
//      ocupando sitio para siempre, sin ninguna pantalla desde la que verla ni quitarla.
//
//   3. QUE LA FOTO QUE NO ESTA SE EXPLIQUE. La ruta viaja a la nube y el archivo no: en otro
//      celular la imagen no existe. Un recuadro roto ahi se lee como "la app perdio mis datos",
//      cuando lo unico que falta es la foto.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const sinComentarios = (f) =>
  leer(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- LA FOTO NO VIAJA DENTRO DEL MOVIMIENTO ---");
{
  const util = sinComentarios("utils/fotoMovimiento.ts");
  // Se guarda como archivo y se devuelve su ruta. Si esto se volviera base64, el documento de
  // la nube reventaria a la docena de fotos.
  ok(/export async function guardarFoto/.test(util), "la foto se guarda como archivo");
  ok(/destino\.uri/.test(util), "y lo que se devuelve es su ruta");
  ok(!/base64/.test(util), "nunca se convierte a texto, que es lo que reventaria la copia en la nube");

  // Y se achica antes: una foto de celular son varios megas, y ninguna boleta necesita eso.
  ok(/resize\(\{ width: \d+ \}\)/.test(util), "se achica antes de guardarla");
  ok(/SaveFormat\.JPEG/.test(util), "y en JPEG, que pesa cinco veces menos que PNG");
}

console.log("\n--- BORRAR EL MOVIMIENTO SE LLEVA LA FOTO ---");
{
  const ctx = sinComentarios("contexts/AppDataContext.tsx");
  ok(/borrarFoto\(transactions\.find/.test(ctx), "al borrar uno");
  ok(/for \(const p of transactions\) if \(ids\.includes\(p\.id\)\) borrarFoto\(p\.photo\)/.test(ctx), "y al borrar varios de golpe");

  // Y al CAMBIARLA por otra: sin esto, cada reemplazo deja la anterior tirada.
  const comp = sinComentarios("components/FotoDelMovimiento.tsx");
  ok(/borrarFoto\(ruta\);\s*onChange\(nueva\)/.test(comp), "y al cambiarla por otra");
}

console.log("\n--- LA FOTO QUE SE QUEDO EN EL OTRO CELULAR SE EXPLICA ---");
{
  const comp = sinComentarios("components/FotoDelMovimiento.tsx");
  ok(/hayFoto\(ruta\)/.test(comp), "se comprueba si el archivo sigue estando");
  ok(/perdida &&/.test(comp), "y si no, se dice en vez de enseñar un hueco");

  const i18n = leer("constants/i18n.ts");
  ok(/El movimiento está completo/.test(i18n), "y el texto aclara que el gasto no se perdio");
  for (const clave of ["fotoMov.titulo", "fotoMov.tomar", "fotoMov.enOtroCelular", "fotoMov.verEtiqueta"]) {
    const veces = (i18n.match(new RegExp('"' + clave.replace(".", "\\.") + '":', "g")) ?? []).length;
    ok(veces === 3, clave + " esta en los tres idiomas (" + veces + ")");
  }
}

console.log("\n--- Y SE PUEDE TOMAR Y CAMBIAR DESDE LOS DOS SITIOS ---");
{
  // Un solo componente para las dos pantallas: dos copias acabarian guardando con calidades
  // distintas, y un dia una de las dos dejaria de borrar la foto vieja al cambiarla.
  for (const [ruta, nombre] of [
    ["screens/AddSheet.tsx", "al anotar el gasto"],
    ["screens/Detail.tsx", "y al mirarlo despues"],
  ]) {
    ok(/FotoDelMovimiento/.test(sinComentarios(ruta)), nombre);
  }
  // Desde la lista se ve cuales la llevan, sin entrar uno por uno.
  ok(/fotoMov\.verEtiqueta/.test(sinComentarios("screens/Home.tsx")), "y la lista marca los que tienen foto");
  // Una foto que no se pudo guardar NO puede impedir que se anote el gasto: el gasto es el
  // dato, la foto es el recuerdo.
  ok(/return null;\s*\}\s*\}/.test(sinComentarios("utils/fotoMovimiento.ts")), "y si la foto falla, el gasto se anota igual");
}

console.log(fallos === 0 ? "\nTodo bien: la foto acompaña al gasto sin ponerlo en riesgo" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
