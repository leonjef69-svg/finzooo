// LOS ÍCONOS FAVORITOS
//
// Pedido el 06/08/2026: una tercera pestaña, EN EL MEDIO entre Ícono y Color,
// con los dibujos que la persona marque. Son 236 en el catálogo, y quien usa
// siempre los mismos cinco no debería buscarlos entre todos cada vez.
//
// Lo que se comprueba aquí es lo que rompe una lista guardada en el disco: un
// repetido que sale dos veces en la cuadrícula, un valor raro de una versión
// anterior que la deja en blanco, y el tope que evita que los últimos queden
// fuera de la pantalla sin forma de llegar a ellos.
import fs from "fs";
import path from "path";
import {
  alternar,
  esFavorito,
  esFoto,
  getFavoritos,
  MAX_FAVORITOS,
  paraLaNube,
  setFavoritos,
} from "@/utils/iconosFavoritos";
import { enFilas, POR_FILA } from "@/constants/catalogoFilas";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- MARCAR Y DESMARCAR ---");
{
  ok(alternar([], "Coffee").join() === "Coffee", "marcar uno lo añade");
  ok(alternar(["Coffee"], "Coffee").length === 0, "y volver a tocarlo lo quita");
  // El recién marcado va PRIMERO: el último que interesó es el que más
  // probablemente se vuelva a usar, y así no hay que buscarlo entre los viejos.
  ok(alternar(["Car", "Pizza"], "Coffee").join() === "Coffee,Car,Pizza", "el nuevo va primero");
  // Marcar dos veces el mismo no puede dejarlo repetido: saldría dos veces en la
  // cuadrícula y tocar uno de los dos no se sabría cuál es.
  ok(alternar(alternar([], "Coffee"), "Coffee").length === 0, "no se puede repetir marcando dos veces");
}

console.log("\n--- EL TOPE ---");
{
  // La pestaña no se desliza: con ochenta marcados, los últimos quedarían fuera
  // de la pantalla y sin forma de llegar a ellos.
  const muchos = Array.from({ length: MAX_FAVORITOS }, (_, i) => `icono${i}`);
  const conUnoMas = alternar(muchos, "elNuevo");
  ok(conUnoMas.length === MAX_FAVORITOS, `nunca pasa de ${MAX_FAVORITOS} (hay ${conUnoMas.length})`);
  ok(conUnoMas[0] === "elNuevo", "el nuevo entra");
  // Y se cae el MÁS VIEJO, no se rechaza el nuevo: un "no caben más" obligaría a
  // ir a borrar uno antes de poder guardar el que importa ahora.
  ok(!conUnoMas.includes(`icono${MAX_FAVORITOS - 1}`), "y sale el más viejo, no se niega a guardar");
}

console.log("\n--- UNA FOTO PROPIA VALE COMO FAVORITO ---");
{
  const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg";

  // Se distingue por cómo empieza el texto, y no con un campo aparte, para que las
  // listas que ya estaban guardadas en los celulares se lean igual, sin convertir
  // nada.
  ok(esFoto(FOTO), "una foto se reconoce por su texto");
  ok(!esFoto("Coffee"), "y un dibujo del catálogo no es una foto");
  ok(!esFoto(""), "ni el vacío");
  ok(!esFoto(undefined as unknown as string), "ni algo que no es texto, sin reventar");

  // Y entra en la misma lista que los dibujos, sin tratarla distinto.
  const lista = alternar(alternar([], "Coffee"), FOTO);
  ok(lista.length === 2 && lista[0] === FOTO, "se marca igual que un dibujo, y va primera");
  ok(alternar(lista, FOTO).length === 1, "y se desmarca igual");

  // La limpieza del disco no puede tirarla por ser larga o traer signos raros.
  setFavoritos([FOTO, "Coffee"]);
  ok(getFavoritos().length === 2, "sobrevive a la limpieza de lo que llega del disco");
  setFavoritos([]);
}

console.log("\n--- LO QUE LLEGA DEL DISCO ---");
{
  // La lista llega de un archivo, y ahí pudo quedar cualquier cosa: una versión
  // anterior, una copia a medio escribir, o algo que no es un identificador. Un
  // valor raro no puede dejar la pestaña en blanco.
  setFavoritos(["Coffee", "Coffee", "", "Car"] as string[]);
  ok(getFavoritos().join() === "Coffee,Car", "se quitan repetidos y vacíos");

  setFavoritos([1, null, "Pizza", { a: 1 }] as unknown as string[]);
  ok(getFavoritos().join() === "Pizza", "y lo que no es texto se descarta, sin reventar");

  setFavoritos("no soy una lista" as unknown as string[]);
  ok(getFavoritos().length === 0, "si no es ni una lista, queda vacía");

  setFavoritos(Array.from({ length: 99 }, (_, i) => `x${i}`));
  ok(getFavoritos().length === MAX_FAVORITOS, "y el tope también se aplica a lo que venía guardado");

  setFavoritos(["Coffee"]);
  ok(esFavorito("Coffee"), "esFavorito reconoce el que está");
  ok(!esFavorito("Pizza"), "y no el que no está");
  setFavoritos([]);
}

console.log("\n--- SE VEN IGUAL QUE EL CATÁLOGO ---");
{
  // Los favoritos se dibujan con las MISMAS filas que el catálogo. Con dos
  // repartos distintos, saldrían de otro tamaño que los de al lado.
  const filas = enFilas(["a", "b", "c"]);
  ok(filas.length === 1, "tres dibujos caben en una fila");
  ok(filas[0].length === POR_FILA, `y la fila se rellena hasta ${POR_FILA}`);
  ok(filas[0][3] === null && filas[0][4] === null, "los huecos son espacio vacío, no dibujos");

  const seis = enFilas(["a", "b", "c", "d", "e", "f"]);
  ok(seis.length === 2, "seis dibujos son dos filas");
  ok(seis[1][0] === "f" && seis[1][1] === null, "y la segunda lleva el que sobra más huecos");

  ok(enFilas([]).length === 0, "sin favoritos no hay ninguna fila");
}

console.log("\n--- LA PANTALLA: LA PESTAÑA VA EN EL MEDIO ---");
{
  const pant = fs.readFileSync(path.join(process.cwd(), "screens/NuevaCategoria.tsx"), "utf8");
  // El usuario lo pidió así de explícito: "en el centro de icono y color".
  ok(
    /\["icono", "favoritos", "color"\]/.test(pant),
    "el orden de las pestañas es Ícono, Favoritos, Color"
  );

  // La estrella va junto a la vista previa, NO en cada casilla ni con toque
  // largo. En una casilla de 55 puntos la estrellita se toca sin querer al
  // elegir, y el toque largo ya se descartó en este proyecto por invisible.
  ok(/onPress=\{alternarFavorito\}/.test(pant), "hay una estrella que marca y desmarca");
  ok(!/onLongPress/.test(pant), "y no se usa el toque largo, que nadie descubre");

  // LAS FOTOS PROPIAS TAMBIÉN SE PUEDEN MARCAR (07/08/2026).
  //
  // Antes no se ofrecía —"un favorito es un ícono del catálogo, y una foto no está
  // en el catálogo"—. El usuario lo pidió y tenía razón: recortar una foto cuesta
  // cámara, encuadre y zoom, y volver a hacerlo para la siguiente categoría es
  // justo lo que un favorito evita. El argumento miraba de dónde sale el dibujo en
  // vez de cuánto cuesta conseguirlo.
  ok(!/\{!foto && \(/.test(pant), "la estrella ya no se esconde cuando hay foto");
  ok(/const loQueSeMarca = foto \?\? icono;/.test(pant), "y marca lo que se está viendo");
  ok(/alternar\(favoritos, loQueSeMarca\)/.test(pant), "que es lo que se guarda");
  // Tocar un favorito con foto tiene que ponerlo como FOTO. Sin distinguirlo, su
  // texto entero se guardaría como si fuera el nombre de un dibujo del catálogo y
  // saldría el de respaldo.
  ok(/if \(esFoto\(v\)\) setFoto\(v\);/.test(pant), "tocar una foto la pone como foto");
  ok(/esFoto\(id\)/.test(pant), "y en la cuadrícula se dibuja como foto, no como ícono");

  // Una pestaña vacía sin explicación deja sin saber si está roto o falta algo.
  ok(pant.includes("nuevaCat.favVacio"), "la pestaña vacía dice qué hacer");

  // Y se guarda POR EL CONTEXTO, no llamando al disco directamente.
  //
  // saveFavoritos escribe el disco pero no avisa a nadie, y la subida a la copia de
  // la cuenta es un efecto que solo se dispara cuando cambia algo de su lista: con
  // la llamada directa, marcar un favorito se guardaba aqui y NO se subia hasta que
  // cambiara cualquier otra cosa. Es el mismo fallo que ya tuvieron la
  // personalizacion y las categorias propias.
  ok(/guardarFavoritos\(siguiente\)/.test(pant), "marcar guarda por el contexto");
  ok(!/saveFavoritos\(/.test(pant), "y no salta al disco por su cuenta");
  const ctx = fs.readFileSync(path.join(process.cwd(), "contexts/AppDataContext.tsx"), "utf8");
  ok(/loadFavoritos\(\)/.test(ctx), "y se leen al arrancar la app");
}

console.log("\n--- Y VIAJAN A LA COPIA DE LA CUENTA ---");
{
  // Se pierden al cambiar de celular: eso era lo que quedaba pendiente y estaba
  // dicho al usuario. Lo pidió el 07/08/2026.
  const RAIZ = process.cwd();
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  const nube = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");

  ok(/iconosFavoritos\?: string\[\]/.test(nube), "el documento de la nube los contempla");
  ok(/iconosFavoritos: data\.iconosFavoritos \|\| \[\]/.test(nube), "y quien lo lee los devuelve");
  ok(/iconosFavoritos: paraLaNube\(iconosFavoritos\)/.test(ctx), "se suben");
  ok(/saveFavoritos\(cloud\.iconosFavoritos/.test(ctx), "y al bajarlos van al disco de este celular");

  // El estado existe SOLO para que la subida se dispare. Sin el, marcar un favorito
  // no cambiaba nada de lo que ese efecto vigila, asi que se quedaba en el celular.
  //
  // ANCLAR AQUI ES MAS DIFICIL DE LO QUE PARECE, Y YA FALLO DOS VECES:
  //
  //  · Anclar en "saveCloudData" no sirve: logout() tambien sube antes de cerrar sesion y
  //    aparece primero, asi que se leian las dependencias de otro efecto cualquiera.
  //  · Anclar en la espera de 1,5 segundos tampoco: el 07/08/2026 el Modo Negocio añadio
  //    OTRA subida agrupada, con la misma espera, y el primer "}, 1500);" del archivo paso a
  //    ser el suyo. Esta prueba empezo a leer las dependencias de la subida del negocio y a
  //    decir que marcar un favorito no dispara nada. Un fallo de la prueba, no del codigo.
  //
  // Ahora se ancla en la LINEA EXACTA que sube los datos de la cuenta, que es lo unico que
  // identifica ese efecto y no otro. Si mañana entra una tercera subida, sigue valiendo.
  //  · Y el 20/08/2026 fallo una TERCERA vez, por incluir el punto y coma en el ancla: la
  //    subida paso a mirar como fue —`saveCloudData(...).then(...)`— para poder decir si la
  //    copia se guardo, y el punto y coma dejo de estar pegado. Se ancla en la llamada sin
  //    el, que es lo que de verdad identifica a este efecto.
  const laSubidaDeLaCuenta = ctx.lastIndexOf("saveCloudData(uid, datosParaLaNube())");
  ok(laSubidaDeLaCuenta > 0, "se encontro la subida de los datos de la cuenta");
  const desdeLaSubida = ctx.slice(laSubidaDeLaCuenta);
  const deps = /\}, \[[\s\S]*?\]\);/.exec(desdeLaSubida)?.[0] ?? "";
  ok(deps.length > 0, "se encontro la lista de lo que dispara la subida");
  ok(deps.includes("iconosFavoritos"), "y marcar uno dispara la subida");
}

console.log("\n--- PERO LAS FOTOS NO VIAJAN, Y ES A PROPOSITO ---");
{
  // Una foto recortada pesa unos 18 KB y TODO el documento de la nube tiene un tope
  // de 1 MB, compartido con los movimientos y las fotos de las categorias. Treinta
  // fotos de favoritos serian medio megabyte gastado en atajos, y pasarse del tope
  // no deja el documento a medias: lo deja SIN GUARDAR, y con el los movimientos.
  // Perder un atajo es molesto; perder los gastos, grave.
  const FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg";
  const salen = paraLaNube([FOTO, "Coffee", "Car"]);
  ok(salen.join() === "Coffee,Car", "sube los dibujos del catalogo");
  ok(!salen.includes(FOTO), "y deja la foto en el celular");

  // Y la limpieza de siempre se sigue aplicando a lo que sube: un repetido o una
  // basura guardada no puede acabar en la copia de la cuenta.
  ok(paraLaNube(["Coffee", "Coffee", "", "Car"]).join() === "Coffee,Car", "sin repetidos ni vacios");
  ok(paraLaNube([1, null, "Pizza"] as unknown as string[]).join() === "Pizza", "ni cosas que no son texto");
  ok(paraLaNube("no soy lista" as unknown as string[]).length === 0, "y si no es una lista, no sube nada");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
