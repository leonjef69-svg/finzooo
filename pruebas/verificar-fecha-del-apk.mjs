// EL APK NUEVO PERDIA CONTRA UNA ACTUALIZACION VIEJA (12/08/2026)
//
// Le paso a el: instalo el APK nuevo tres veces y la app seguia mostrando el codigo anterior.
// Parecia que el archivo no se instalaba. Se instalaba perfectamente.
//
// QUE PASABA. Dentro del APK viaja un archivo, app.manifest, que dice CUANDO se hizo el codigo
// que trae. La app arranca con la version mas nueva de las dos que tiene: la que trae el APK o
// la que se bajo por internet. Compara por esa fecha.
//
// Gradle daba por hecha la tarea que escribe ese archivo y no lo volvia a generar. La fecha se
// quedo congelada en el 4 de agosto mientras el codigo de dentro SI se actualizaba en cada
// compilacion. Desde entonces, cualquier actualizacion por internet posterior al 4 de agosto le
// ganaba a un APK recien instalado.
//
// Y ES DE LO PEOR QUE PUEDE PASAR: la parte de Android SI era la nueva —esa viene del APK y no
// se puede sobreescribir por internet— pero la pantalla era la vieja. Media app nueva y media
// vieja, sin ningun aviso. Y el codigo de la pantalla de Informacion, que es lo unico que hay
// para comprobar que version se esta usando, mostraba el viejo: la unica prueba disponible
// decia lo contrario de la verdad.
//
// Por eso se borra a mano antes de compilar. Esta prueba vigila que ese borrado siga ahi.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- AL COMPILAR SE BORRA LA FECHA VIEJA ---");
{
  // LA CARPETA android NO ESTA EN EL REPOSITORIO: se genera con "expo prebuild", y al
  // regenerarla este arreglo se pierde. Que la prueba falle entonces es lo correcto — no es
  // ruido, es que la trampa acaba de volver a armarse y hay que reponerlo.
  const RUTA = "android/compilar.bat";
  if (!fs.existsSync(path.join(RAIZ, RUTA))) {
    console.log(`  FALLA falta ${RUTA} — hay que volver a poner el borrado de app.manifest`);
    console.log("\n1 falla");
    process.exit(1);
  }

  // Sin los comentarios: los de arriba en compilar.bat cuentan esta misma historia y nombran el
  // archivo, asi que la busqueda encontraria el nombre aunque el borrado no estuviera.
  const bat = leer(RUTA).replace(/^\s*rem .*$/gim, "");

  ok(/del\s+\/q[^\n]*createReleaseUpdatesResources[^\n]*app\.manifest/i.test(bat),
    "se borra el app.manifest que genera Gradle");
  // Y TAMBIEN LA COPIA. Gradle junta los archivos en otra carpeta antes de empaquetar: si solo
  // se borra el original, la copia vieja se cuela igual en el APK.
  ok(/del\s+\/q[^\n]*mergeReleaseAssets[^\n]*app\.manifest/i.test(bat),
    "y la copia que Gradle deja preparada para empaquetar");

  // ANTES DE COMPILAR, no despues. Borrarlo despues no serviria de nada: el APK ya estaria hecho
  // con la fecha vieja dentro.
  const borrado = bat.search(/del\s+\/q/i);
  const compilar = bat.search(/gradlew\.bat/i);
  ok(borrado >= 0 && compilar >= 0 && borrado < compilar, "y se borra ANTES de compilar");
}

console.log(fallos === 0 ? "\nTodo bien: un APK recien hecho gana a lo anterior" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
