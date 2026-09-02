// CREAR CATEGORIAS PROPIAS
//
// Pedido el 03/08/2026: un boton "Nueva" en la cuadricula de categorias que
// abra una pantalla con icono, color y vista previa.
//
// Lo que de verdad hay que proteger no es la pantalla: es que una categoria
// creada por la persona se comporte EXACTAMENTE igual que una de fabrica en
// los 38 sitios donde se dibuja una categoria. Si en uno solo se ve como
// "Otros", eso se descubre meses despues y por casualidad.
import fs from "fs";
import path from "path";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import {
  CATALOGO_EN_FILAS,
  CATALOGO_EN_TROZOS,
  FILAS_AL_ABRIR,
  FILAS_POR_TANDA,
  GRUPOS_AL_ABRIR,
  POR_FILA,
} from "@/constants/catalogoFilas";
import { iconoDe } from "@/constants/iconos";
import { setOverrides } from "@/utils/categoryCustom";
import { crear, borrar, editar, esPropia, nombreRepetido, setPropias, type CategoriaPropia } from "@/utils/categoriasPropias";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

/**
 * El mismo archivo sin comentarios, para las comprobaciones de "esto NO debe
 * estar".
 *
 * Existe porque cuatro aserciones se cayeron por su propia explicacion: el
 * comentario que cuenta por que se quito algo contiene su nombre (Catalogo,
 * dibujar, removeClippedSubviews, allowsEditing). Una prueba que castiga
 * documentar el motivo acaba haciendo que se borre el motivo.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

console.log("\n--- SE CREA Y SE COMPORTA COMO UNA DE FABRICA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  setPropias(lista);

  const c = catInfo(creada.id);
  ok(c.id === creada.id, "catInfo la encuentra");
  ok(c.label === "Broster", "con su nombre tal cual, sin traducir");
  ok(c.color === "orange", "y su color");
  ok(typeof c.icon === "function" || typeof c.icon === "object", "y un dibujo de verdad");

  // Aparece donde toca y NO donde no toca.
  ok(gastosDisponibles().some((x) => x.id === creada.id), "sale en la lista de gastos");
  ok(!ingresosDisponibles().some((x) => x.id === creada.id), "y NO en la de ingresos");
  setPropias([]);
}

console.log("\n--- CADA CATEGORIA SABE EL NOMBRE DE SU DIBUJO ---");
{
  // De un dibujo ya hecho no se puede volver atras a su nombre, y hay una
  // pantalla que lo necesita: al tocar "Salud" en la lista, la vista previa tiene
  // que quedarse con SU dibujo y el catalogo tiene que marcar cual es.
  //
  // Sin este campo, tocar "Salud" cambiaba el nombre y el color pero el dibujo se
  // quedaba quieto. Lo reporto el usuario el 07/08/2026: "por que cuando le doy
  // click al icono de salud, en la imagen de arriba no cambia, se queda estatica".
  const todas = [...gastosDisponibles(), ...ingresosDisponibles()];
  const sinNombre = todas.filter((c) => !c.iconoNombre);
  ok(
    sinNombre.length === 0,
    `las ${todas.length} categorias traen el nombre de su dibujo${sinNombre.length ? ": falta en " + sinNombre.map((c) => c.id).join(", ") : ""}`
  );
  ok(catInfo("salud").iconoNombre === "HeartPulse", "y es el que corresponde (salud)");

  // Y el nombre tiene que ser DE VERDAD el del dibujo que se esta usando. Escritos
  // por separado se pueden desincronizar, y seria un fallo silencioso: la
  // categoria se veria bien en todas las pantallas y solo al abrir el catalogo
  // apareceria marcado el dibujo equivocado.
  const descuadradas = todas.filter((c) => iconoDe(c.iconoNombre ?? "") !== c.icon);
  ok(
    descuadradas.length === 0,
    `y el nombre coincide con el dibujo${descuadradas.length ? ": no en " + descuadradas.map((c) => c.id).join(", ") : ""}`
  );
}

console.log("\n--- SE LE PUEDE CAMBIAR EL DIBUJO A UNA DE FABRICA ---");
{
  // Desde el 07/08/2026 la pantalla de elegir categoria deja tocar "Comida",
  // cambiarle el dibujo y darle a Aplicar. Sin que catInfo lea ese campo, el
  // dibujo nuevo se veria en la vista previa y al guardar volveria el de antes:
  // la pantalla prometiendo algo que no puede cumplir.
  const deFabrica = catInfo("comida").icon;

  setOverrides({ comida: { icono: "Coffee" } });
  ok(catInfo("comida").icon !== deFabrica, "el dibujo puesto a mano manda sobre el de la app");
  // Y lo demas de esa categoria no se toca: cambiar el dibujo no puede cambiarle
  // el nombre ni el color de rebote.
  ok(catInfo("comida").label === "category.comida", "sin tocarle el nombre");

  // Sin dibujo puesto, vuelve el de la app. Es lo que hace que quitar el parche
  // devuelva la categoria original en vez de dejarla a medias.
  setOverrides({ comida: { color: "sky" } });
  ok(catInfo("comida").icon === deFabrica, "y sin ponerle ninguno, queda el de siempre");
  ok(catInfo("comida").color === "sky", "mientras el color si cambia");

  // Tambien vale para las propias: ahi el dibujo es suyo, pero el parche manda
  // igual — es lo que ya pasaba con el nombre y el color.
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  setPropias(lista);
  const suyo = catInfo(creada.id).icon;
  setOverrides({ [creada.id]: { icono: "Coffee" } });
  ok(catInfo(creada.id).icon !== suyo, "en una propia el parche tambien manda");

  setOverrides({});
  setPropias([]);
}

console.log("\n--- EL ID NO PUEDE CHOCAR CON LOS DE LA APP ---");
{
  // Sin prefijo, quien cree una "Comida" tendria el mismo id que la de
  // fabrica y una de las dos desapareceria, llevandose la categoria de todos
  // sus movimientos anteriores.
  const { creada } = crear([], { nombre: "Comida", tipo: "expense", color: "green", icono: "Utensils" });
  ok(creada.id !== "comida", "una propia llamada Comida no pisa a la de fabrica");
  ok(esPropia(creada.id), "se reconoce como propia");
  ok(!esPropia("comida"), "y las de fabrica no");

  setPropias([creada]);
  ok(catInfo("comida").label === "category.comida", "la de fabrica sigue intacta");
  setPropias([]);
}

console.log("\n--- BORRARLA NO ROMPE SUS MOVIMIENTOS ---");
{
  // Un movimiento guarda el ID de su categoria. Si al borrarla el movimiento
  // se rompiera, se perderia un gasto — que es mucho peor que perder un
  // nombre.
  const { lista, creada } = crear([], { nombre: "Gaseosas", tipo: "expense", color: "sky", icono: "CupSoda" });
  setPropias(lista);
  setPropias(borrar(lista, creada.id));

  const huerfano = catInfo(creada.id);
  ok(huerfano.id === "otros", "cae en Otros en vez de romperse");
  ok(huerfano.label === "category.otros", "con nombre de verdad, no vacio");
  setPropias([]);
}

console.log("\n--- NO SE PERMITEN DOS IGUALES DEL MISMO TIPO ---");
{
  // Dos categorias llamadas igual en la misma lista no se pueden distinguir
  // al anotar: se elige una al azar y los totales quedan repartidos entre las
  // dos sin que nadie entienda por que.
  const { lista } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  ok(nombreRepetido(lista, "Broster", "expense"), "avisa del repetido");
  ok(nombreRepetido(lista, "  broster ", "expense"), "sin importar espacios ni mayusculas");
  ok(!nombreRepetido(lista, "Broster", "income"), "pero de gasto e ingreso si pueden llamarse igual");
  ok(!nombreRepetido(lista, "Pollo", "expense"), "y otro nombre pasa");
}

console.log("\n--- LO GUARDADO A MEDIAS NO ENTRA ---");
{
  // Los datos vienen del disco y de la nube. Una entrada rota no se ve al
  // guardarla: revienta despues, al dibujar una lista, en una pantalla que no
  // tiene nada que ver.
  setPropias([
    { id: "propia_ok", nombre: "Buena", tipo: "expense", color: "red", icono: "Tag" },
    { id: "sin_prefijo", nombre: "Mala", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_x", nombre: "", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_y", nombre: "Sin tipo", color: "red", icono: "Tag" } as unknown as CategoriaPropia,
    null as unknown as CategoriaPropia,
  ]);
  const quedan = gastosDisponibles().filter((c) => esPropia(c.id));
  ok(quedan.length === 1, `solo entra la buena (entraron ${quedan.length})`);
  setPropias([]);
}

console.log("\n--- EDITAR NO BORRA LO QUE NO SE TOCA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  const despues = editar(lista, creada.id, { color: "red" })[0];
  ok(despues.color === "red", "cambia lo que se pide");
  ok(despues.nombre === "Broster", "y deja el nombre");
  ok(despues.icono === "Drumstick", "y el dibujo");
}

console.log("\n--- LOS 236 DIBUJOS NO SE REHACEN EN CADA LETRA ---");
{
  // Reportado el 04/08/2026: "al usar la categoria, poner nueva y mas, se pone
  // lento". Eran dos cosas, y las dos medibles:
  //
  //   1. iconoDe devolvia un componente RECIEN CREADO para cada logo. Para
  //      React eso no es "el mismo dibujo otra vez": es otro componente, asi
  //      que tiraba el anterior y lo construia de cero. 55 logos por pulsacion.
  //   2. La cuadricula entera se redibujaba con cada letra del nombre.
  const iconos = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  ok(iconos.includes("LOGOS_HECHOS"), "los logos se guardan y se reutilizan");
  ok(/LOGOS_HECHOS\.get\(nombre\)/.test(iconos), "se busca el ya hecho antes de crear otro");

  // Comprobacion de verdad, no de texto: dos llamadas seguidas tienen que
  // devolver EL MISMO componente. Si devuelven distintos, el fallo volvio.
  const { iconoDe: resolver } = require("@/constants/iconos") as {
    iconoDe: (id: string) => unknown;
  };
  ok(resolver("marca:youtube") === resolver("marca:youtube"), "el mismo logo dos veces es el MISMO objeto");
  ok(resolver("Utensils") === resolver("Utensils"), "y lo mismo con los de linea");
  ok(resolver("marca:youtube") !== resolver("marca:spotify"), "pero dos logos distintos son distintos");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");

  const codigo = sinComentarios(pant);

  ok(pant.includes("memo(function Dibujito"), "cada dibujo esta memorizado");
  ok(pant.includes("memo(function Fila"), "y las filas");
  // Recibir la funcion de traducir bastaba para que memo no sirviera de nada:
  // cambia en cada dibujado del padre.
  // El nombre de la variable cambio de "grupo" a "trozo" el 07/08/2026, al repartir el
  // catalogo por filas en vez de por grupos. Lo que se vigila es lo mismo: que llegue el
  // titulo YA TRADUCIDO y no la funcion de traducir.
  ok(pant.includes("titulos[trozo.titulo]"), "los titulos llegan traducidos, no la funcion de traducir");

  // LOS DIBUJOS SE QUEDAN PUESTOS. ESTO NO ES UN DESCUIDO, ES EL PEDIDO.
  //
  // Hubo aqui una FlatList, que es lo recomendado para listas largas y aqui
  // estuvo mal. Arma y suelta segun lo que se ve, y por mas reserva que se le
  // diera —se probo windowSize 2, 3 y 5, tandas de 4 y de 8, quitar
  // removeClippedSubviews y darle las medidas con getItemLayout— un deslizon
  // fuerte le ganaba siempre y se veia la pantalla en blanco. Cuatro entregas.
  //
  // El usuario lo dijo tal cual: "los iconos ya deberian estar ahi fijos, no
  // deberian cargar recien cuando yo deslizo". Asi que se arman los 236 una vez
  // y no se sueltan. Si alguien vuelve a meter una lista virtual aqui creyendo
  // que optimiza, vuelve el fallo.
  ok(!codigo.includes("FlatList"), "el catalogo NO va en una lista que arma y suelta");
  ok(!codigo.includes("getItemLayout"), "ni hace falta adivinarle las medidas");
  ok(!codigo.includes("windowSize"), "ni hay reserva que un deslizon pueda agotar");
  ok(!codigo.includes("memo(function Catalogo"), "y tampoco vuelve el catalogo que los armaba todos de golpe");

  // EL CATALOGO LLEGA EN DOS TANDAS, NI EN UNA NI DE A POQUITOS.
  //
  // AQUI DECIA "estan los 236 desde el principio", y eso cambio el 07/08/2026. Se
  // deja escrito por que, porque la regla de antes tenia buenos motivos:
  //
  //   · Hubo un escalonado que metia los grupos DE A UNO y dejaba huecos que se
  //     veian al deslizar ("se pone asi cuando deslizo rapido"), y una version que
  //     no dibujaba nada hasta acabar la animacion ("aparecen luego de 1 segundo").
  //     Las dos las rechazo el usuario, y siguen rechazadas.
  //   · Pero ponerlos TODOS de golpe deja las 227 medidas de texto encima de la
  //     animacion de entrada, y la pantalla llega a trompicones: "el cambio de
  //     pantalla debe verse fluido y mas rapido".
  //
  // AQUI DECIA ADEMAS "el resto llega TODO de una vez", Y ESO CAMBIO EL 07/08/2026.
  // Se deja escrito el porque, porque tambien esa regla tenia su motivo:
  //
  //   · El medidor dio un numero: el PRIMER toque tras abrir tardaba 6000 ms. Marcar una
  //     casilla no cuesta eso: el toque hacia cola detras del golpe que armaba los 223
  //     dibujos que faltaban. Mientras ese golpe dura, el dedo no existe para la app.
  //   · El trabajo total no se puede abaratar —son 227 letras que Android tiene que
  //     medir— pero si PARTIR. Entre trozo y trozo la app respira y el toque entra.
  //
  // Lo que se vigila ahora son tres cosas, y las tres son la diferencia con lo que el
  // usuario ya rechazo:
  //
  //   1. Las tandas llegan SOLAS, no al deslizar: *"los iconos ya deberian estar ahi
  //      fijos, no deberian cargar recien cuando yo deslizo"*.
  //   2. La primera llena mas de tres pantallas, asi que lo que se ve esta completo
  //      desde el primer instante (esto no cambio).
  //   3. Y acaban TODOS puestos. Una tanda que no converge dejaria el catalogo a medias
  //      para siempre, que seria peor que el problema que arregla.
  // Y AQUI DECIA "el resto llega TODO de una vez" Y LUEGO "tandas de dos GRUPOS". Las dos
  // cambiaron el 07/08/2026, y las dos veces por un numero del celular:
  //
  //   · Todo de una vez → el primer toque tras abrir tardaba 6000 ms. El toque hacia cola
  //     detras de 223 dibujos, y mientras el golpe dura el dedo no existe para la app.
  //   · Tandas de dos GRUPOS → 136 a 353 ms. Muchisimo mejor, y todavia se notaba. Un
  //     grupo no sirve de medida: los hay de 6 dibujos y de 20, asi que la tanda mas gorda
  //     era el triple de la mas chica y el peor caso lo marcaba ella.
  //   · Ahora tandas de dos FILAS: diez dibujos exactos, siempre.
  //
  // Lo que se vigila son cuatro cosas:
  ok(!codigo.includes("gruposArmados"), "no se cargan de a poquitos, como se rechazo");
  ok(/useState\(FILAS_AL_ABRIR\)/.test(codigo), "arranca con las filas de los primeros grupos");

  // 1. Solas. Si esto se cae, se cae en silencio: la pantalla funcionaria igual y el
  //    usuario volveria a ver iconos apareciendo bajo el dedo.
  //
  //    ESTA PASABA TAMBIEN ANTES DEL CAMBIO, y es a proposito: no describe el arreglo,
  //    guarda la puerta. Cargar al deslizar es LA solucion que se le ocurre a cualquiera
  //    al ver el problema de los 6000 ms —se me ocurrio a mi— y es justo la que el
  //    usuario ya rechazo por escrito. La prueba esta para que la proxima vez el aviso
  //    llegue antes de entregarlo.
  ok(!/onScroll/.test(codigo), "el resto NO llega al deslizar, llega solo");
  ok(/setTimeout\(mirar,/.test(codigo), "y lo trae un reloj, sin que nadie tenga que tocar nada");

  // 2. Converge en el catalogo entero. Una tanda que no converge dejaria el catalogo a
  //    medias PARA SIEMPRE, que seria peor que el problema que arregla.
  ok(
    /Math\.min\(n \+ FILAS_POR_TANDA, CATALOGO_EN_TROZOS\.length\)/.test(codigo),
    "cada tanda suma hasta llegar al catalogo completo, sin pasarse"
  );

  // 3. El reparto SE PARA MIENTRAS SE TOCA, y ESPERA SIN REDIBUJAR NADA.
  //
  //    AQUI HUBO UN BUCLE Y ERA GRAVE (07/08/2026). La primera version de esta espera tenia
  //    un estado, "reintento", y al encontrar un dedo reciente hacia setReintento para
  //    volver a mirar. Eso montaba un bucle:
  //
  //      · Pedir volver a mirar es un CAMBIO DE ESTADO, asi que la pantalla se rehacia
  //        ENTERA.
  //      · El reloj se rearmaba con espera CERO y disparaba al instante.
  //      · Seguia habiendo un toque reciente, porque faltaba medio segundo. Vuelta a empezar.
  //
  //    Mientras el dedo estaba sobre un icono, la pantalla se rehacia decenas de veces por
  //    segundo SIN HACER NADA. Reportado como "la pestaña de elegir icono esta lenta, se
  //    siente raro" — y raro es la palabra exacta: no era trabajo de mas, era trabajo inutil
  //    ahogando al dedo.
  //
  //    Lo que se vigila son las dos mitades del arreglo, porque con una sola el bucle vuelve.
  ok(/ULTIMO_TOQUE\.cuando = Date\.now\(\)/.test(codigo), "se apunta cuando se toco por ultima vez");
  ok(
    /const falta = QUIETO_MS - \(Date\.now\(\) - ULTIMO_TOQUE\.cuando\)/.test(codigo),
    "y no se arma nada mientras haya un dedo reciente en la pantalla"
  );
  // MITAD A: se espera LO QUE FALTA, no cero. Con cero se vuelve a mirar para encontrar
  // exactamente lo mismo, una y otra vez.
  ok(
    /if \(falta > 0\) \{\s*reloj = setTimeout\(mirar, falta\);/.test(codigo),
    "cuando falta espera, se vuelve a mirar EN ESE MOMENTO y no al instante"
  );
  // MITAD B: y se espera SIN ESTADO. Volver a mirar no cambia lo que se ve, solo la hora, asi
  // que no puede redibujar la pantalla. Si alguien vuelve a meter un estado aqui, vuelve el
  // bucle — y no se rompe nada a la vista, solo se siente raro.
  ok(!/setReintento/.test(codigo), "y esperar no usa ningun estado, o volveria el bucle");
  ok(!/reintento\]/.test(codigo), "ni queda en la lista de lo que reejecuta el reparto");
  // Apuntar la hora NO PUEDE ser un estado: si lo fuera, cada toque rehaceria la pantalla,
  // que es justo el coste que se esta quitando.
  ok(
    /const ULTIMO_TOQUE = \{ cuando: 0 \}/.test(codigo),
    "y esa hora no vive en un estado, para que apuntarla no redibuje nada"
  );

  /* 4. LA TANDA TIENE QUE CABER EN UN SUSPIRO, Y EL TOPE SE MIDE EN LO QUE CUESTA UN
        DIBUJO, no en un numero suelto.

        El tope era 10 dibujos, y salio de cuando cada uno era un componente de Expo con
        estado. Con eso, diez ya se notaban.

        El 21/08/2026 subio a 40, y no por impaciencia: los genericos pintan una letra suelta
        desde el 07/08 y las marcas desde el 21/08, asi que un dibujo pasó de tres componentes
        anidados a un <Text>. Y el reparto tenia un precio escondido: cada tanda es un cambio
        de estado, o sea un redibujado de la pantalla ENTERA. Con tandas de dos filas eran 28
        redibujados reconciliando una lista cada vez mas larga — trabajo al cuadrado. Con ocho
        filas son 7.

        LA COMPROBACION SIGUE SIENDO LA MISMA IDEA: que nadie ponga "todas de golpe". Lo que
        cambia es el numero, y cambia atado a una razon escrita. Si los dibujos vuelven a ser
        caros, esto tiene que volver a bajar. */
  ok(FILAS_POR_TANDA >= 1, "la tanda trae al menos una fila, o no avanzaria nunca");
  ok(
    FILAS_POR_TANDA * POR_FILA <= 40,
    `la tanda son ${FILAS_POR_TANDA * POR_FILA} dibujos como mucho (tope 40)`
  );

  // Y que siga habiendo reparto: sin tope por arriba, "de golpe" volveria por la puerta de
  // atras poniendo un numero enorme.
  {
    const trozos = CATALOGO_EN_TROZOS.length;
    const tandas = Math.ceil((trozos - FILAS_AL_ABRIR) / FILAS_POR_TANDA);
    ok(tandas >= 3, `el catalogo se sigue repartiendo en tandas (${tandas}), no de una vez`);
  }

  // Y AL REPARTIR POR FILAS NO SE PUEDE PERDER NI REPETIR NADA. Es el riesgo real de
  // cambiar de grupos a filas, y es de los que no se ven: sobraria o faltaria un dibujo en
  // medio del catalogo y nadie lo notaria hasta buscarlo.
  const enGrupos = CATALOGO_EN_FILAS.flatMap((g) => g.filas.flat()).filter((x) => x !== null);
  const enTrozos = CATALOGO_EN_TROZOS.flatMap((t) => t.fila).filter((x) => x !== null);
  ok(
    enTrozos.join("|") === enGrupos.join("|"),
    `los ${enGrupos.length} dibujos son los mismos y en el mismo orden (${enTrozos.length})`
  );
  // Y cada grupo pone su titulo UNA vez, en su primera fila. Con el titulo en todas, el
  // catalogo saldria repitiendo el encabezado entre fila y fila.
  const titulos = CATALOGO_EN_TROZOS.filter((t) => t.titulo !== null).map((t) => t.titulo);
  ok(
    titulos.length === CATALOGO_EN_FILAS.length,
    `hay un titulo por grupo (${titulos.length} de ${CATALOGO_EN_FILAS.length})`
  );
  ok(
    titulos.join("|") === CATALOGO_EN_FILAS.map((g) => g.titulo).join("|"),
    "y en el mismo orden que los grupos"
  );
  // Las filas del principio son los primeros grupos ENTEROS: un grupo cortado por la
  // mitad al abrir se veria como un catalogo a medio armar.
  ok(
    CATALOGO_EN_TROZOS[FILAS_AL_ABRIR]?.titulo !== null,
    "lo que se dibuja al abrir acaba justo donde empieza un grupo nuevo"
  );

  // Y la primera tanda tiene que llenar la pantalla de sobra. Se cuenta de verdad:
  // con menos, un deslizon rapido llega al final de lo dibujado y ahi si se veria el
  // hueco que el usuario rechazo.
  const CABEN_EN_PANTALLA = 20;
  const primeros = CATALOGO_EN_FILAS.slice(0, GRUPOS_AL_ABRIR).reduce(
    (suma, g) => suma + g.filas.length * POR_FILA,
    0
  );
  ok(
    primeros >= CABEN_EN_PANTALLA * 3,
    `la primera tanda son ${primeros} dibujos, mas de tres pantallas (${CABEN_EN_PANTALLA * 3})`
  );
  // Y no puede ser el catalogo entero: entonces no habria dos tandas y volveriamos
  // al trompicon.
  const total = CATALOGO_EN_FILAS.reduce((s, g) => s + g.filas.length * POR_FILA, 0);
  ok(primeros < total, `pero no el catalogo completo (${primeros} de ${total})`);

  // NI SE REHACEN AL CAMBIAR DE PESTAÑA.
  //
  // Reportado el 07/08/2026: "cuando le doy a elegir categoria como que se demora
  // en entrar a la pestaña donde estan los iconos". Cada pestaña se dibujaba solo
  // si era la elegida, asi que volver a la de los dibujos construia LAS 236
  // CASILLAS OTRA VEZ, y otra vez en cada ida y vuelta.
  //
  // Con display none se construyen una sola vez, al abrir, y cambiar de pestaña ya
  // no cuesta nada. Se cuentan las cuatro: con tres, la que quede fuera vuelve a
  // pagar el precio y nadie lo notara hasta que sea la de los dibujos.
  //
  // EL ESTILO PASO DE ESCRIBIRSE A MANO EN CADA PESTAÑA A SALIR DE DOS CONSTANTES
  // (07/08/2026), y no fue por limpieza: escrito cuatro veces, la cuarta se olvida. Lo que
  // se vigila es lo mismo —que sean CUATRO y que se escondan en vez de desmontarse— mas la
  // regla nueva de abajo.
  const escondidas = (codigo.match(/pestana === "[a-z]+" \? PESTANA_A_LA_VISTA : PESTANA_ESCONDIDA/g) ?? []).length;
  ok(escondidas === 4, `las cuatro pestañas se esconden en vez de desmontarse (${escondidas})`);
  ok(
    !/display: pestana ===/.test(codigo),
    "y ninguna se esconde con el estilo escrito a mano, que es el que se olvidaba"
  );

  // Y LA ESCONDIDA TIENE QUE RECORTAR LO QUE LLEVA DENTRO. DOS FALLOS EN UNO.
  //
  // Con "display: none" a secas, Yoga deja la caja en cero de alto pero ANDROID SIGUE
  // DIBUJANDO SUS HIJOS. El usuario lo vio y lo mando con foto: *"cuando salgo de la pestaña
  // se pone asi"* — los colores encima de "Tu propia foto" y del catalogo, las dos pestañas
  // dibujadas a la vez.
  //
  // Y ese mismo fallo es la explicacion de lo lento, que es lo que no se veia: si el
  // contenido escondido se sigue dibujando, ESCONDER UNA PESTAÑA NO AHORRABA NADA. Estando
  // en "Color", Android seguia dibujando las 227 casillas del catalogo ademas de los
  // colores.
  //
  // El alto cero va ademas del display a proposito: si una version de React Native cambia
  // como trata "display", el alto cero con el recorte sigue escondiendola.
  const laEscondida = /const PESTANA_ESCONDIDA: ViewStyle = \{([^}]*)\}/.exec(codigo)?.[1] ?? "";
  ok(laEscondida.length > 0, "se encuentra el estilo de la pestaña escondida");
  ok(/display: "none"/.test(laEscondida), "la escondida no se dibuja");
  ok(/overflow: "hidden"/.test(laEscondida), "y RECORTA lo que lleva dentro, o se dibuja encima");
  ok(/height: 0/.test(laEscondida), "y mide cero, por si algun dia display deja de bastar");
  ok(
    !/pestana === "(tuyas|color|favoritos)" \? \(/.test(codigo),
    "ninguna se desmonta al cambiar de pestaña"
  );

  // PERO SE CONSTRUYEN LA PRIMERA VEZ QUE SE MIRAN, NO TODAS AL ABRIR.
  //
  // Dejarlas las cuatro puestas arreglo el cambio de pestaña y EMPEORO lo que mas
  // molestaba: abrir la pantalla paso a construirlas todas —incluida la lista de
  // categorias con sus fotos— cuando antes solo montaba una. Y entrar era justo la
  // queja: "se demora 2 a 3 segundos en entrar".
  //
  // Con esto, abrir cuesta solo la pestaña de los dibujos y cambiar se paga una vez.
  const perezosas = (codigo.match(/vistas\.has\("[a-z]+"\) && \(/g) ?? []).length;
  ok(perezosas === 4, `y cada una se construye la primera vez que se mira (${perezosas})`);
  // Arranca con la de los dibujos, que es la que se ve al abrir.
  ok(/new Set\(\["icono"\]\)/.test(codigo), "arranca con la de los dibujos, que es la que se ve");
  // Y el conjunto solo se toca la primera vez: pasarlo nuevo en cada toque haria que
  // todo lo que dependa de el se rehiciera sin motivo.
  ok(/if \(!vistas\.has\(cual\)\) setVistas/.test(codigo), "y solo se apunta la primera vez");

  // UN DIBUJADO DE LA PANTALLA NO PUEDE ARRASTRAR LAS OTRAS DOS CUADRICULAS.
  //
  // Reportado el 07/08/2026, despues de diez arreglos: *"se siente lento no fluido, piensa
  // diferente"*. Y pensar diferente era mirar FUERA de lo que se llevaba toda la tarde
  // optimizando.
  //
  // Lo que decia el medidor: UN DIBUJADO DE ESTA PANTALLA CUESTA ENTRE 136 Y 353 ms. Se
  // habia atacado cuantas VECES se dibuja —tandas, pausas, memorizar filas— y nunca cuanto
  // CUESTA cada vez.
  //
  // Y costaba eso porque cada dibujado arrastraba las 14 casillas de "Tus categorias" y
  // los 18 colores: unas 50 piezas con clases, varias ARMADAS AL VUELO (bg-${color}-100),
  // que es lo mas caro que hay porque no se pueden preparar de antemano. El catalogo ya
  // estaba arreglado; estas dos, en la misma pantalla, nunca recibieron el mismo trato.
  //
  // OJO CON EL ARREGLO QUE NO SE HIZO: no se les quitaron las clases, solo se memorizaron.
  // Quitarlas ahorraria un poco mas y obliga a reescribir medidas a mano, y eso ya salio
  // mal una vez ("no quiero que se vea asi, estaba bien como estaba antes"). Memorizadas,
  // un dibujado no las toca y sus clases no se resuelven: el mismo ahorro sin poder
  // cambiar como se ven.
  ok(/const CasillaCategoria = memo\(/.test(codigo), "la casilla de una categoria esta memorizada");
  ok(/const CasillaColor = memo\(/.test(codigo), "y la de un color tambien");

  // Y HAY QUE PASARLES COSAS QUE NO CAMBIEN, o la memorizacion no sirve de nada. Es la
  // mitad que se olvida: memorizar y luego pasarle una funcion nueva en cada dibujado deja
  // el trabajo hecho a medias y sin que nada avise.
  ok(
    /onElegir=\{elegirDeLaListaEstable\}/.test(codigo),
    "se les pasa una funcion que no cambia, no una escrita al vuelo"
  );
  ok(
    /const elegirDeLaListaEstable = useCallback\(/.test(codigo),
    "y esa funcion sale de una caja, para que sea siempre la misma"
  );
  ok(/nombre=\{t\(c\.label\)\}/.test(codigo), "y el nombre ya traducido, no la funcion de traducir");
  ok(/onElegir=\{setColor\}/.test(codigo), "al color se le pasa setColor, que ya no cambia nunca");

  // Y LAS FILAS DE FAVORITOS, DE UNA CAJA. enFilas(favoritos) devuelve un array NUEVO en
  // cada dibujado, y con un array nuevo la memorizacion de la fila no vale: las casillas de
  // favoritos se rehacian aunque los favoritos no hubieran cambiado.
  ok(
    /const filasDeFavoritos = useMemo\(\(\) => enFilas\(favoritos\), \[favoritos\]\)/.test(codigo),
    "las filas de favoritos se calculan una vez por lista"
  );
  ok(!/enFilas\(favoritos\)\.map/.test(codigo), "y no se vuelven a repartir en cada dibujado");

  // LA MEDIDA DE LA CASILLA VA EN UN OBJETO, NUNCA EN UNA FUNCION.
  //
  // Se probo cambiar TouchableOpacity por Pressable para ahorrar 236 vistas
  // animadas. La idea era buena y rompio la cuadricula: para dar el aviso de
  // "estoy tocando" con Pressable hay que pasar la medida en una FUNCION
  // —style={({pressed}) => [...]}— y las clases de NativeWind se aplican tambien
  // por "style", asi que con una funcion de por medio el ancho y el alto no
  // llegan. Las casillas salieron como pastillas altas y estrechas.
  //
  // Lo vio el usuario en el celular: "no quiero que se vea asi, estaba bien como
  // estaba antes". Asi que lo que se vigila no es que use Pressable —eso da igual—
  // es que la medida llegue.
  const laCasilla = /const Dibujito = memo\([\s\S]*?\n\}\);/.exec(codigo)?.[0] ?? "";
  ok(laCasilla.length > 0, "la casilla del catalogo sigue siendo su propia pieza");
  // Y LA CASILLA NO USA NI UNA CLASE. Este es el arreglo de la lentitud que el
  // usuario midio con el celular: 2 a 3 segundos en entrar y 1 a 2 en marcar un
  // dibujo.
  //
  // Un componente con clases se apunta al sistema de estilos para enterarse de los
  // cambios de tema, y resuelve su cadena: son 236 apuntes y 236 resoluciones solo
  // para abrir, y otros tantos que comparar en cada toque. Con el aspecto ya
  // calculado, las 236 comparten dos objetos.
  ok(!laCasilla.includes("className"), "la casilla del catalogo no usa ninguna clase");
  // EL GRIS Y EL DEL COLOR VAN POR SEPARADO. Esto cambio el 07/08/2026 por la noche y aqui
  // decia "y toma el aspecto ya calculado", con UN solo aspecto.
  //
  // El fallo: ese aspecto recibia el color, asi que cambiar de color creaba un objeto NUEVO,
  // ese objeto viajaba a las 46 filas y de ahi a las 227 casillas, y LAS 227 SE REHACIAN.
  // Estando en la pestaña de Color, con el catalogo ni a la vista.
  //
  // El usuario lo describio exacto: *"toco un color rojo y paso a otro, se siente como una
  // lentitud... en iconos parece que ya esta bien"*. La pestaña de iconos ya estaba
  // arreglada; lo que la hacia lenta era lo que pasaba EN LAS OTRAS.
  //
  // Ahora la casilla recibe SOLO el gris —que no sabe nada del color y por tanto no cambia al
  // cambiarlo— y el del color lo mira del canal la unica casilla que lo necesita.
  ok(/aspectoElegida \?\? normal/.test(laCasilla), "la casilla toma el gris ya calculado");
  ok(
    !/aspecto: AspectoCasilla/.test(codigo),
    "y a las filas ya NO les llega el aspecto que depende del color"
  );
  ok(/normal=\{aspectoGris\}/.test(codigo), "a las filas les llega solo el gris");

  // El gris tiene que ser SIEMPRE EL MISMO objeto mientras no cambie la medida ni el tema, o
  // la memorizacion no vale de nada. Y sobre todo: NO puede depender del color.
  ok(/const aspectoGris = useMemo\(\(\) => casillaNormal\(lado, oscuro\), \[lado, oscuro\]\)/.test(codigo),
    "el gris se calcula una vez y no depende del color");

  // Y el del color viaja por el canal, no como propiedad.
  ok(/ponerAspectoDeLaMarca\(color, aspectoDelColor\)/.test(codigo), "el del color va por el canal de la marca");
  ok(/apuntarAspectoDeLaMarca\(color, aspectoDelColor\)/.test(codigo), "y la primera vez se apunta sin avisar");
  // Sin funcion de estilo: ahi se perdian el ancho y el alto. Ver la nota de la
  // casilla.
  ok(!/style=\{\(\{ pressed/.test(laCasilla), "sin funcion de estilo, que se come el tamaño");

  // Y NO RECORTA SU CONTENIDO SALVO QUE HAYA FOTO.
  //
  // Recortar obliga a Android a darle a esa casilla su propia capa para cortar lo
  // que sobresale. Puesto en todas eran 236 capas, y solo hace falta en las de
  // foto: un dibujo de la tipografia cabe dentro y no sobresale de nada.
  ok(/foto\s*\r?\n?\s*\? \[/.test(laCasilla), "y solo recorta cuando la casilla lleva una foto");
  ok(/overflow: "hidden"/.test(laCasilla), "con el recorte puesto a mano, no por clase");

  // NINGUN COLOR PUEDE QUEDARSE SIN SU TONO.
  //
  // Al pasar de clases a numeros, el color de una casilla elegida sale de dos mapas
  // (el 100 para el fondo y el 500 para el borde). Si a un color le falta su entrada,
  // no hay error: cae en el gris de reserva y esa casilla se ve apagada mientras las
  // demas se ven bien — de las cosas que se descubren por casualidad meses despues.
  //
  // Se comprueban los 18 colores que la pantalla ofrece, leidos de la propia
  // pantalla, contra los tres mapas.
  const paleta = fs.readFileSync(path.join(RAIZ, "constants/colors.ts"), "utf8");
  const ofrecidos = /const COLORES = \[([\s\S]*?)\];/.exec(codigo)?.[1] ?? "";
  const lista = [...ofrecidos.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  ok(lista.length >= 15, `se leyeron los colores que ofrece la pantalla (${lista.length})`);
  for (const mapa of ["COLOR_HEX_100", "COLOR_HEX_500", "COLOR_HEX_600"]) {
    const bloque = new RegExp(`${mapa}[\\s\\S]*?\\n\\};`).exec(paleta)?.[0] ?? "";
    const faltan = lista.filter((c) => !new RegExp(`^ {2}${c}:`, "m").test(bloque));
    ok(faltan.length === 0, `${mapa} tiene los 18${faltan.length ? ": falta " + faltan.join(", ") : ""}`);
  }
  ok(!codigo.includes("altoDeLasFilas"), "ni hay huecos reservados que llenar despues");

  // 05/08/2026, con foto: "esta disparejo los iconos". Al pasar a filas de
  // cinco quedaron con ancho fijo, asi que no llegaban al borde y sobraba un
  // vacio a la derecha. Se comprueba con numeros mas abajo, en su seccion.
  //
  // Se mira SOLO dentro de la casilla del catalogo, y no el archivo entero: desde
  // el 06/08/2026 la misma pantalla lleva arriba la lista de categorias, y esas
  // casillas si son de tamaño fijo con toda la razon —son cuatro por fila con su
  // nombre debajo, no parte de la cuadricula de dibujos—. Mirando el archivo
  // completo, esta prueba se caia por algo que esta bien.
  const casilla = /const Dibujito = memo\([\s\S]*?\n\}\);/.exec(codigo)?.[0] ?? "";
  ok(casilla.length > 0, "la casilla del catalogo sigue siendo su propia pieza");
  ok(!/w-\d+ h-\d+/.test(casilla), "ninguna casilla del catalogo lleva ancho fijo");
  ok(/width: lado, height: lado/.test(casilla), "su lado sale del ancho de la pantalla");
  ok(/style=\{\{ width: lado, height: lado \}\}/.test(pant), "el lado sale del ancho de la pantalla");
  ok(pant.includes('key={"hueco"'), "y las filas cortas se rellenan con espacio vacio");

  // Mismo reporte: "se siente feo al abrirlo". Se intento dos veces APARTAR el
  // dibujado de la animacion de entrada, y las dos salieron peor:
  //
  //   1. No dibujar nada hasta que la animacion acabara -> "luego de 1 segundo
  //      aparece los iconos como si estuviera cargando".
  //   2. Igual pero solo los dibujos, con la cuadricula vacia ya puesta -> se
  //      seguia viendo el momento en que aparecian. "Ni bien entro deberia ya
  //      estar los iconos".
  //
  // Ojo con la diferencia: los grupos que entran de a uno NO son esto. Lo que se
  // ve al abrir esta completo desde el primer instante; lo que entra despues
  // esta fuera de pantalla. Aquello hacia esperar a lo que se estaba mirando.
  ok(!codigo.includes("InteractionManager"), "lo que se ve no espera a nada para salir");
  ok(!/\bdibujar\b/.test(codigo), "ni sale la casilla vacia primero y el dibujo despues");

  // removeClippedSubviews suelta las vistas que salen de pantalla: en Android es
  // una causa conocida de celdas en blanco, porque al volver hay que rehacerlas.
  // Con 236 casillas la memoria no es el problema; los huecos si lo eran.
  ok(!codigo.includes("removeClippedSubviews"), "no suelta las vistas que salen de pantalla");

  // Con los iconos ya al instante, lo que quedaba era el cambio de pantalla en
  // si: "podrias agregarle una transicion suave, se ve brusco al momento de
  // cambiar". Sin declarar la ruta tomaba la animacion por defecto de Android y
  // ademas pintaba el fondo nativo blanco un instante — las dos mitades de lo
  // brusco. La animacion la corre el sistema, no nuestro codigo, asi que sigue
  // suave aunque la pantalla este armando sus iconos.
  const layout = fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8");
  const suya = /name="nueva-categoria"[\s\S]{0,300}?\/>/.exec(layout)?.[0] ?? "";
  ok(suya.length > 0, "la ruta de nueva categoria esta declarada en el layout");
  // Se probo el fundido y el usuario lo quito el mismo dia: sobre el papel es
  // mas suave, pero al usarlo la pantalla aparece de la nada y se nota como un
  // parpadeo. Queda el deslizamiento. Se guarda la eleccion concreta, no un
  // generico "que haya animacion": es gusto suyo y no se deduce del codigo.
  ok(/animation: "slide_from_right"/.test(suya), "y entra deslizandose, no de golpe");
  ok(!/animation: "fade"/.test(suya), "sin el fundido, que se probo y no gusto");
  ok(/backgroundColor: screenBg/.test(suya), "con el fondo del tema, para que no destelle blanco");
}

console.log("\n--- SE PUEDE PONER UNA FOTO PROPIA, Y QUITARLA ---");
{
  // Pedido el 05/08/2026: "agregale una opcion un icono para tomar foto o una
  // imagen de galeria". El dato ya existia (CategoriaPropia.image, catInfo,
  // CategoryAvatar); lo que faltaba era la forma de elegirla.
  const FOTO = "data:image/jpeg;base64,xxxx";

  const { lista, creada } = crear([], {
    nombre: "Broster",
    tipo: "expense",
    color: "orange",
    icono: "Drumstick",
    image: FOTO,
  });
  setPropias(lista);
  ok(creada.image === FOTO, "se crea con la foto puesta");
  // Lo importante no es que la guarde: es que LLEGUE a las 38 pantallas que
  // dibujan una categoria, y todas pasan por catInfo.
  ok(catInfo(creada.id).image === FOTO, "y catInfo la reparte a toda la app");

  // Sin foto NO tiene que quedar la clave suelta. La copia de nube es un solo
  // documento con un tope de 1 MB, y un `image: undefined` viaja como campo.
  const sinFoto = crear([], { nombre: "Taxi", tipo: "expense", color: "sky", icono: "Car" }).creada;
  ok(!("image" in sinFoto), "sin foto no queda ni la clave vacia");

  // Quitarla. El null es lo que distingue "no la toques" de "borrala": sin el,
  // no habria forma de volver a un dibujo, porque la foto siempre manda.
  const quitada = editar(lista, creada.id, { image: null })[0];
  ok(!("image" in quitada), "el null la borra de verdad");
  const intacta = editar(lista, creada.id, { nombre: "Broster pollos" })[0];
  ok(intacta.image === FOTO, "y cambiar el nombre no se la lleva");

  // El icono sigue debajo: quien prueba una foto y no le gusta no pierde lo que
  // habia elegido antes.
  ok(quitada.icono === "Drumstick", "al quitar la foto vuelve a salir su dibujo");
  setPropias([]);
}

console.log("\n--- Y LA PANTALLA LA SABE PEDIR DE LAS DOS FORMAS ---");
{
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");

  ok(/launchCameraAsync/.test(pant), "la camara");
  ok(/launchImageLibraryAsync/.test(pant), "y la galeria");
  // Cada una pide SU permiso. El de camara no sirve para la galeria ni al
  // contrario, y sin permiso la app se queda sin decir nada.
  ok(/requestCameraPermissionsAsync/.test(pant), "pidiendo permiso de camara");
  ok(/requestMediaLibraryPermissionsAsync/.test(pant), "y permiso de fotos");
  ok(pant.includes("catCustom.cameraPermission"), "y avisando si lo niegan (camara)");
  ok(pant.includes("settings.photoPermission"), "y si lo niegan (galeria)");

  // LAS DOS terminan en el recortador propio. El recorte que trae Android
  // cambia de un celular a otro y en algunos no deja cuadrado, asi que hay UNA
  // sola forma de encuadrar.
  const veces = [...pant.matchAll(/setRecortando\(r\.assets\[0\]\.uri\)/g)].length;
  ok(veces === 2, `camara y galeria terminan las dos en el recortador (${veces} de 2)`);
  ok(!/allowsEditing/.test(sinComentarios(pant)), "sin usar el recorte de Android");
  ok(/<ImageCropper/.test(pant), "y el recortador esta puesto");

  // La foto manda sobre el dibujo, igual que en el resto de la app. Si aqui se
  // viera al contrario, la categoria saldria de una forma al crearla y de otra
  // en Inicio — ya paso con los emojis.
  ok(/foto \? \(/.test(pant), "la vista previa ensena la foto si la hay");
  ok(/<Image source=\{\{ uri: foto \}\}/.test(pant), "dibujandola de verdad");
  ok(/overflow-hidden/.test(pant), "recortada a la forma del cuadrito");

  // Y tiene que haber forma de sacarla: elegir un icono no la quita, porque la
  // foto manda. Sin esto se entra en un callejon sin salida.
  ok(/setFoto\(undefined\)/.test(pant), "y se puede quitar");
  // Al guardar, la foto quitada viaja como null. Si viajara como undefined, la
  // de antes se quedaria puesta y "quitar" no haria nada.
  ok(/image: foto \?\? null/.test(pant), "y al guardar la quitada se borra de verdad");
}

console.log("\n--- LOS 173 NOMBRES DE LA TIPOGRAFIA EXISTEN DE VERDAD ---");
{
  // Los dibujos genericos pasaron de vectores (lucide) a tipografia
  // (MaterialCommunityIcons) el 05/08/2026, porque armar 236 vectores tarda
  // cerca de un segundo y ese segundo no se puede esconder — se intento cinco
  // veces. Una tipografia se pinta como una letra.
  //
  // El riesgo nuevo: un nombre mal escrito NO DA ERROR. La casilla sale vacia y
  // nadie se entera. Asi que se comparan con la lista real de la tipografia.
  const glifos = JSON.parse(
    fs.readFileSync(
      path.join(
        RAIZ,
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json"
      ),
      "utf8"
    )
  ) as Record<string, number>;
  ok(Object.keys(glifos).length > 1000, `la tipografia trae ${Object.keys(glifos).length} dibujos`);

  const { NOMBRES_EN_TIPOGRAFIA: nombres, TODOS_LOS_GRUPOS: grupos, iconoDe: resolver2 } =
    require("@/constants/iconos") as typeof import("@/constants/iconos");

  const inventados = Object.entries(nombres).filter(([, v]) => !(v in glifos));
  ok(
    inventados.length === 0,
    `los ${Object.keys(nombres).length} nombres existen en la tipografia${
      inventados.length ? " — no existen: " + inventados.map(([k, v]) => `${k}->${v}`).join(", ") : ""
    }`
  );

  // Y al reves: todo id que se pueda ELEGIR tiene que tener su nombre. Sin el,
  // esa casilla del catalogo sale con los puntos suspensivos de respaldo.
  const idsElegibles = grupos.flatMap((g) => g.iconos).filter((id) => !id.startsWith("marca:"));
  const sinNombre = idsElegibles.filter((id) => !nombres[id]);
  ok(
    sinNombre.length === 0,
    `los ${idsElegibles.length} dibujos del catalogo tienen nombre${sinNombre.length ? " — sin nombre: " + sinNombre.join(", ") : ""}`
  );

  // El respaldo tiene que existir, o iconoDe se cae justo cuando llega un id
  // desconocido: el unico caso para el que el respaldo existe.
  const respaldo = resolver2("esto-no-existe-en-ningun-sitio");
  ok(typeof respaldo === "function", "un id desconocido devuelve un dibujo, no un hueco");
  ok(respaldo === resolver2("Ellipsis"), "y es el de los puntos suspensivos");

  // Dos ids con el MISMO dibujo se ven identicos en la cuadricula y no hay forma
  // de saber cual se eligio. En el catalogo de elegir eso no puede pasar.
  const porGlifo = new Map<string, string[]>();
  for (const id of idsElegibles) {
    const n = nombres[id];
    porGlifo.set(n, [...(porGlifo.get(n) ?? []), id]);
  }
  const gemelos = [...porGlifo].filter(([, ids]) => ids.length > 1);
  ok(
    gemelos.length === 0,
    `ningun dibujo sale dos veces${gemelos.length ? " — repetidos: " + gemelos.map(([n, ids]) => `${n} (${ids.join("/")})`).join(", ") : ""}`
  );
}

console.log("\n--- LA LETRA SE PINTA DIRECTA, SIN EL COMPONENTE DE EXPO ---");
{
  // Por que existe esta prueba (07/08/2026):
  //
  // Cada icono de @expo/vector-icons NO es un dibujo: es una CLASE CON ESTADO. Se
  // leyo su codigo en node_modules/@expo/vector-icons/build/createIconSet.js —
  //   state = { fontIsLoaded: Font.isLoaded(fontName) }
  //   componentDidMount() { ...await Font.loadAsync(font); this.setState(...) }
  //   render() { if (!this.state.fontIsLoaded) return <Text />; ... }
  // — y por dentro envuelve OTRO componente. Con 227 casillas eso son 227 clases
  // con estado, y si la tipografia no estaba lista, 227 avisos de "ya cargue" que
  // vuelven a dibujar la cuadricula 227 veces.
  //
  // Ahora la letra se calcula UNA VEZ al guardar el dibujo en la memoria y se pinta
  // con un <Text> pelado. Esto es exactamente lo que hace el componente de Expo por
  // dentro, sin la clase ni el estado ni la capa de mas.
  //
  // La prueba mira el codigo escrito porque lo que se vigila es la FORMA de dibujar,
  // y eso no se puede preguntar al resultado: un dibujo hecho de las dos maneras se
  // ve igual. Si alguien vuelve al componente de Expo "para simplificar", la
  // lentitud regresa sin que nada se rompa a la vista.
  const fuente = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  const codigo = sinComentarios(fuente);

  // 1. La letra sale de la tabla de la tipografia, y se calcula FUERA del dibujo.
  //    Si se calculara dentro, se recalcularia en cada pintada de cada casilla.
  const laLetra = /const\s+letra\s*=[^;]*String\.fromCodePoint/.test(codigo);
  ok(laLetra, "la letra se saca con String.fromCodePoint al guardar el dibujo, no al pintarlo");

  // Esta de aqui, sola, no comprueba nada —contra la version vieja pasaba, porque
  // alli no habia ningun fromCodePoint en ninguna parte—. Vale unicamente pegada a
  // la anterior: entre las dos dicen "se calcula, y se calcula FUERA".
  const dentroDelDibujo = codigo.slice(codigo.indexOf("const Dibujo"));
  ok(
    !dentroDelDibujo.includes("String.fromCodePoint"),
    "y no se vuelve a calcular dentro del dibujo"
  );

  // 2. Se pinta con un <Text> propio, no con el componente de Expo.
  ok(
    /<Text\b/.test(dentroDelDibujo) && /fontFamily:\s*FAMILIA/.test(dentroDelDibujo),
    "el dibujo pinta un <Text> con la tipografia de los iconos"
  );

  // 3. El camino de reserva sigue existiendo. Sin el, si la tipografia no estuviera
  //    lista TODAS las casillas saldrian vacias — el fallo mas caro posible aqui.
  ok(
    /Font\.isLoaded\(\s*FAMILIA\s*\)/.test(codigo),
    "se pregunta si la tipografia esta lista antes de pintar la letra"
  );
  ok(
    /if\s*\(\s*!letra\s*\|\|\s*!Font\.isLoaded/.test(dentroDelDibujo),
    "y si no lo esta —o el nombre no existe— se usa el componente de Expo de reserva"
  );

  // 4. Y hay que PEDIR la tipografia al arrancar. Es el detalle que se puede perder
  //    sin que nada avise: quien la pedia era el componente de Expo, la primera vez
  //    que se dibujaba. Al dejar de usarlo, si nadie la pide, la respuesta de arriba
  //    es siempre "no esta lista", cada casilla cae en la reserva y no se gana nada.
  //    La prueba se ve tonta —comprueba una linea— y es justo la que salva el cambio.
  ok(
    /MaterialCommunityIcons\.loadFont\(\)/.test(codigo),
    "la tipografia se pide al cargar el archivo, para que no se use la reserva"
  );

  // 5. Detalles de como se ve. El componente de Expo pone estos cuatro; si falta
  //    alguno el dibujo cambia de tamano o de grosor y parece "otro icono".
  for (const detalle of [
    "allowFontScaling={false}", // sin esto, la letra escala con el tamano del sistema y se sale de la casilla
    'fontWeight: "normal"', // heredaria la negrita del texto de alrededor
    'fontStyle: "normal"', // heredaria la cursiva
    "selectable={false}", // se podria seleccionar el icono como si fuera texto
  ]) {
    ok(codigo.includes(detalle), `se conserva ${detalle}`);
  }

  // 6. LAS MARCAS, POR LO MISMO Y CON UN AGRAVANTE (20/08/2026).
  //
  // El 07/08 se sacó a los genéricos del componente de Expo y las 55 marcas se quedaron con
  // él. El usuario siguió viendo la lentitud: *"ya probé, sigue lenta"*. Y aquí era peor que
  // en los genéricos, porque `FontAwesome5` NO TIENE `loadFont()` —es un juego de cuatro
  // tipografías y la API no lo expone—, así que la de marcas no la pedía nadie nunca: los 55
  // logos se dibujaban vacíos, la pedían cada uno por su cuenta y se redibujaban solos.
  //
  // Se vigila igual que arriba, y con la misma razón: hecho de las dos maneras se ve idéntico.
  const dentroDelLogo = codigo.slice(codigo.indexOf("const Logo"), codigo.indexOf("const Dibujo"));
  ok(
    /<Text\b/.test(dentroDelLogo) && /fontFamily:\s*FAMILIA_MARCAS/.test(dentroDelLogo),
    "el logo pinta un <Text> con la tipografia de marcas, no el componente de Expo"
  );
  ok(
    /if\s*\(\s*!letra\s*\|\|\s*!Font\.isLoaded/.test(dentroDelLogo),
    "y si la tipografia de marcas no esta lista se usa el de Expo de reserva"
  );
  ok(
    /Font\.loadAsync\(\{[\s\S]*FAMILIA_MARCAS/.test(codigo),
    "la tipografia de marcas se pide al cargar el archivo (FontAwesome5 no trae loadFont)"
  );

  // Y que cada marca del catalogo TENGA su letra. Un nombre mal escrito no da error:
  // la casilla sale vacia y nadie se entera hasta que alguien la mira.
  const glifosMarcas = JSON.parse(
    fs.readFileSync(
      path.join(
        RAIZ,
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome5Free.json"
      ),
      "utf8"
    )
  ) as Record<string, number>;
  const metaMarcas = JSON.parse(
    fs.readFileSync(
      path.join(
        RAIZ,
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome5Free_meta.json"
      ),
      "utf8"
    )
  ) as Record<string, string[]>;
  const { TODOS_LOS_GRUPOS: grupos3 } =
    require("@/constants/iconos") as typeof import("@/constants/iconos");
  const marcas = grupos3
    .flatMap((g) => g.iconos)
    .filter((id) => id.startsWith("marca:"))
    .map((id) => id.slice("marca:".length));
  const sinLetra = marcas.filter((n) => typeof glifosMarcas[n] !== "number");
  ok(
    sinLetra.length === 0,
    `las ${marcas.length} marcas tienen letra${sinLetra.length ? " — sin letra: " + sinLetra.join(", ") : ""}`
  );
  // Y que sean DE MARCA: una que estuviera en otro estilo saldria en blanco, porque la
  // tipografia que se carga aqui es solo la de marcas.
  const noSonMarca = marcas.filter((n) => !(metaMarcas.brands ?? []).includes(n));
  ok(
    noSonMarca.length === 0,
    `y todas estan en la tipografia de marcas${noSonMarca.length ? " — no lo estan: " + noSonMarca.join(", ") : ""}`
  );
}

console.log("\n--- LAS MEDIDAS DE LA CUADRICULA CUADRAN ---");
{
  // Estas cuentas son la parte fragil: de ellas sale el hueco que se reserva
  // para los grupos que todavia no estan armados. Si un hueco mide de menos, el
  // contenido crece bajo el dedo y la pantalla salta sola. Por eso se comprueban
  // con numeros y no leyendo el codigo.
  const {
    ALTO_FILA_DE: altoFilaDe,
    CATALOGO_EN_FILAS: catalogo,
    LADO_DE: ladoDe,
    MARGEN_LATERAL: margen,
    POR_FILA: porFila,
    SEPARACION: sep,
    altoDeLasFilas,
    LADO_MAXIMO: ladoMaximo,
  } = require("@/constants/catalogoFilas") as typeof import("@/constants/catalogoFilas");
  // Los grupos vienen de su propio archivo: hubo un momento en que existieron
  // dos "TODOS_LOS_GRUPOS", uno en cada sitio. Dos listas de lo mismo es una
  // que se queda atras.
  const { TODOS_LOS_GRUPOS: grupos } = require("@/constants/iconos") as typeof import("@/constants/iconos");

  /* 1. LAS CINCO CASILLAS LLENAN EL ANCHO... HASTA EL TOPE.
        Si sobra sitio en un celular normal, se ve el vacio a la derecha que el usuario
        reporto; si falta, la quinta casilla se sale.

        PERO YA NO PUEDEN CRECER SIN FIN (21/08/2026). Al soltar la orientacion para que la app
        gire, en horizontal el ancho casi se duplica y las cinco casillas se volvian gigantes:
        cinco cuadrados enormes con un iconito diminuto en medio, tres dibujos por pantalla.

        Asi que la regla ahora tiene dos mitades: por debajo del tope llenan justo -que es el
        caso de cualquier celular en vertical, y por eso ahi no cambia nada-, y por encima se
        quedan en el tope y el ancho que sobra se reparte como aire. */
  for (const ancho of [320, 360, 393, 412, 480, 600]) {
    const lado = ladoDe(ancho);
    const ocupado = lado * porFila + sep * (porFila - 1) + margen * 2;
    if (lado < ladoMaximo) {
      ok(Math.abs(ocupado - ancho) < 0.001, `en ${ancho} de ancho las cinco casillas llenan justo`);
    } else {
      ok(ocupado <= ancho + 0.001, `en ${ancho} de ancho las casillas no se salen (tope ${ladoMaximo})`);
    }
    ok(lado <= ladoMaximo + 0.001, `en ${ancho} de ancho ninguna casilla pasa del tope`);
    ok(lado > 0, `y el lado sale positivo en ${ancho}`);
    ok(altoFilaDe(ancho) === lado + sep, `y la fila mide la casilla mas su hueco en ${ancho}`);
  }

  // 2. TODAS las filas tienen las mismas casillas. Una fila corta se reparte el
  //    ancho de otra forma y sus dibujos salen mas grandes: eso fue "disparejo".
  const filas = catalogo.flatMap((g) => g.filas);
  ok(filas.length > 0, "hay filas que comprobar");
  ok(
    filas.every((f) => f.length === porFila),
    `las ${filas.length} filas tienen ${porFila} casillas exactas`
  );

  // 3. Ni un dibujo perdido ni uno repetido al partir en filas. Es donde se
  //    pierde un icono sin que nadie lo note: el catalogo sigue "funcionando".
  const enGrupos = grupos.flatMap((g) => g.iconos);
  const enFilas = filas.flat().filter((x) => x !== null);
  ok(enFilas.length === enGrupos.length, `los ${enGrupos.length} dibujos estan todos, ni uno mas`);
  ok(new Set(enGrupos).size === enGrupos.length, "y ninguno esta repetido en el catalogo");
  ok(catalogo.length === grupos.length, "y estan los mismos grupos");
  ok(
    catalogo.every((g, i) => g.titulo === grupos[i].titulo),
    "en el mismo orden"
  );

  // 4. LA CAUSA RAIZ DE UN BUG DE DOS DIAS, encontrada por esta prueba el
  //    05/08/2026: dos grupos se llamaban "iconos.servicios" —el de luz, agua e
  //    internet, y el de Uber, Airbnb y Dropbox—. El titulo "Servicios" salia
  //    dos veces en la pantalla, y los dos grupos compartian clave. Existio
  //    desde que nacio el catalogo, sin que se notara.
  const titulos = grupos.map((g) => g.titulo);
  const titulosRepes = titulos.filter((tt, i) => titulos.indexOf(tt) !== i);
  ok(titulosRepes.length === 0, `ningun grupo repite nombre${titulosRepes.length ? " — " + titulosRepes.join(", ") : ""}`);

  // 5. Cada grupo tiene las filas justas para sus dibujos: ni una de sobra
  //    (dejaria una fila vacia) ni una de menos (perderia dibujos).
  const altoFila = altoFilaDe(412);
  let cuadran = true;
  for (const g of catalogo) {
    const suyos = g.filas.flat().filter((x) => x !== null).length;
    if (g.filas.length !== Math.ceil(suyos / porFila)) cuadran = false;
    if (altoDeLasFilas(g, altoFila) !== g.filas.length * altoFila) cuadran = false;
  }
  ok(cuadran, "cada grupo tiene las filas justas para sus dibujos");
}

console.log("\n--- NI UN LOGO DE BANCO EN EL CATALOGO ---");
{
  // Una app de dinero mostrando el logo de un banco es lo que hace pensar
  // "esto tiene relacion con mi banco": el reclamo mas facil de recibir y el
  // mas dificil de defender. Se decidio con el usuario el 03/08/2026.
  const cat = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  const prohibidas = ["paypal", "visa", "mastercard", "cc-", "stripe", "bitcoin", "btc", "amex", "discover", "bancomat"];
  const coladas = prohibidas.filter((p) => cat.includes('marca:' + p));
  ok(coladas.length === 0, `sin marcas financieras${coladas.length ? ": " + coladas.join(", ") : ""}`);

  // Y las que si estan, todas en un solo sitio: quitar una si alguien reclama
  // tiene que ser borrar una linea, no buscar por el proyecto.
  const otros = fs.readdirSync(path.join(RAIZ, "constants"))
    .filter((f) => f !== "iconos.tsx")
    .filter((f) => fs.readFileSync(path.join(RAIZ, "constants", f), "utf8").includes("marca:"));
  ok(otros.length === 0, `las marcas viven en un solo archivo${otros.length ? " (tambien en " + otros.join(", ") + ")" : ""}`);
}

console.log("\n--- Y LA APP DE VERDAD LO USA ---");
{
  // Un motor perfecto que ninguna pantalla llama no sirve de nada.
  const add = fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8");
  ok(add.includes("gastosDisponibles"), "la pantalla de agregar usa las listas con las propias");
  ok(add.includes("categoriaRecienCreada"), "y la deja elegida al volver");

  // La cuadricula salio de la pantalla de agregar el 06/08/2026 y se fue a la
  // MISMA pantalla del catalogo de dibujos: se elige una de las que hay, o se
  // baja y se crea. Se comprueba alli, no aqui, pero se sigue comprobando: sin
  // esa puerta no habria forma de crear una.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("gastosDisponibles"), "la pantalla de crear tambien lista las propias");
  ok(add.includes("/nueva-categoria"), "y se llega a ella desde el movimiento");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("savePropias"), "el contexto las guarda en disco");
  ok(ctx.includes("loadPropias"), "y las lee al arrancar");
}

console.log("\n--- EDITAR Y BORRAR SE PUEDEN ALCANZAR ---");
{
  // Sin una puerta visible, quien cree una categoria con el icono equivocado se
  // queda con ella para siempre. Se descarto el toque largo: es invisible, y quien
  // no lo sepa no lo encuentra nunca.
  //
  // Y ESTUVO ESCONDIDA IGUAL, dos veces. Hasta el 07/08/2026 lo unico visible era
  // "Editar «X»", y dentro de ese enlace estaban quitarle la foto y borrarla: el
  // usuario reporto las dos como imposibles ("no me deja eliminar los iconos, en
  // tus categorias se quedan"). Ahora las tres cosas estan EN LA LISTA, donde se
  // esta mirando, y por eso se comprueban aqui una por una.
  const pant0 = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant0.includes("esPropia(suya)"), "las acciones solo salen con una propia marcada");
  ok(pant0.includes("nuevaCat.borrarLa"), "se puede borrar desde la lista");
  ok(pant0.includes("nuevaCat.quitarFotoDe"), "y quitarle la foto");
  // Con su numero delante: "se va a borrar" no informa igual que "tus 3
  // movimientos pasan a Otros", y es el dato que hace dudar o seguir.
  ok(/movimientosDeCategoria\(suya\)/.test(pant0), "diciendo cuantos movimientos pasan a Otros");
  // Y sin salir de la pantalla: quien borra una de sus pruebas borra tres, y
  // volver al movimiento tras cada una obligaria a entrar otra vez.
  const cuerpo = /function borrarDeLaLista\(id: string\) \{([\s\S]*?)\n  \}/.exec(pant0)?.[1] ?? "";
  ok(cuerpo.includes("borrarCategoria(id)"), "borrar desde la lista borra de verdad");
  ok(!cuerpo.includes("onBack("), "y no cierra la pantalla al hacerlo");
  // Si era la marcada, hay que soltarla: el formulario se quedaria hablando de algo
  // que ya no existe y Aplicar intentaria guardar cambios sobre una categoria
  // borrada.
  ok(cuerpo.includes("setElegida(null)"), "y suelta la marcada si era esa");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("editandoId"), "la pantalla sabe editar, no solo crear");
  ok(pant.includes("borrarCategoria"), "y borrar");

  // Los valores se leen UNA vez, al abrir. Leidos en cada dibujado, cada toque
  // en el catalogo pisaria lo que la persona acaba de elegir.
  ok(
    pant.includes("useState(() => original?.icono"),
    "y arranca con lo que la categoria ya tenia, sin pisarlo despues"
  );
}

console.log("\n--- VIAJAN A LA COPIA DE LA NUBE ---");
{
  // Sin esto, cambiar de celular las pierde: los movimientos vuelven de la
  // nube pero con la categoria en "Otros", y no hay forma de recuperar los
  // nombres. Se descubre justo cuando mas duele.
  const cloud = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");
  ok(cloud.includes("categoriasPropias?:"), "el documento de la nube las contempla");
  ok(/categoriasPropias\?:/.test(cloud), "y como opcional, para no romper cuentas viejas");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");

  // HAY UN SOLO ARMADOR DEL PAQUETE, y esa es la proteccion de verdad.
  //
  // Antes se escribia en cada subida: en la normal y en la de cerrar sesion. Al
  // añadir los favoritos el 07/08/2026 la primera los llevaba y la segunda no — y
  // subir REEMPLAZA el documento entero, asi que cerrar sesion los habria borrado
  // de la nube justo despues de guardarlos. Ya habia pasado con la personalizacion
  // y con las propias.
  //
  // Con un solo armador, un campo nuevo entra en las dos subidas a la vez.
  ok(/function datosParaLaNube\(\): CloudData/.test(ctx), "hay un solo armador del paquete");
  ok(/categoriasPropias,/.test(ctx), "y lleva las categorias propias");
  const subidas = [...ctx.matchAll(/saveCloudData\(/g)].map((m) => m.index ?? 0);
  const conArmador = subidas.filter((i) => ctx.slice(i, i + 60).includes("datosParaLaNube()"));
  ok(
    subidas.length > 1 && conArmador.length === subidas.length,
    `lo usan los ${subidas.length} sitios que suben (${conArmador.length} lo hacen)`
  );
  // Y ninguno puede volver a escribir su propia lista.
  ok(!/saveCloudData\(uid, \{/.test(ctx), "ninguno arma su propia lista");

  // Y AL BAJARLAS HACEN FALTA LOS TRES SITIOS: catInfo, el estado y el DISCO.
  //
  // Aqui se usaba setPropias, que solo pone la variable de modulo que consulta
  // catInfo. Con eso se veian bien hasta cerrar la app: al reabrir se lee el disco,
  // que seguia vacio, y las categorias propias desaparecian otra vez con la copia
  // correcta guardada en la nube. savePropias hace las dos cosas.
  // Se lee el cuerpo entero de la funcion que trae los datos, no un trozo contado
  // a mano: contando caracteres, la prueba pasa o falla segun donde caiga un
  // comentario.
  const traer = /async function hydrateFromCloud\([\s\S]*?\n  \}/.exec(ctx)?.[0] ?? "";
  ok(traer.length > 0, "se encontro la funcion que trae los datos de la nube");
  ok(traer.includes("savePropias(cloud.categoriasPropias"), "al bajarlas van a catInfo y al disco");
  ok(
    traer.includes("setCategoriasPropiasState(cloud.categoriasPropias"),
    "y al estado, para que las pantallas se redibujen"
  );
  // LO MISMO PARA LA PERSONALIZACION, que tenia el mismo agujero.
  ok(traer.includes("saveOverrides(cloud.categoryOverrides"), "y la personalizacion igual");
  // Y que no vuelvan las versiones que solo tocan memoria.
  ok(!/setPropias\(cloud\./.test(traer), "sin quedarse solo en memoria");
  ok(!/setOverrides\(cloud\./.test(traer), "ninguna de las dos");

  // Y EL FALLO GORDO: se subian y NO SE BAJABAN. Estaban en el tipo, se enviaban
  // bien, y quien lee el documento no las leia — asi que al entrar desde otro
  // celular volvian vacias, sin ningun error. La prueba de antes solo comprobaba
  // que el TIPO las nombrara, que es lo que dejo pasar esto durante dias.
  const nube = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");
  ok(/categoriasPropias: data\.categoriasPropias \|\| \[\]/.test(nube), "quien lee la nube las devuelve");
  ok(/categoryOverrides: data\.categoryOverrides \|\| \{\}/.test(nube), "y la personalizacion tambien");
}

console.log("\n--- AL CERRAR SESION NO SE QUEDA NADA DE LA CUENTA ANTERIOR ---");
{
  // FALLO DE PRIVACIDAD, encontrado el 07/08/2026 mientras se añadian los
  // favoritos a la nube.
  //
  // El borrado de fin de sesion tenia una lista escrita a mano, y tres claves no
  // estaban en ella: las categorias propias, la personalizacion y los favoritos.
  // Vivian cada una en su propio archivo, asi que esta lista no las conocia.
  //
  // Lo que se veia: alguien cerraba sesion y la siguiente cuenta que entrara en ese
  // celular heredaba las categorias que la persona anterior habia creado, sus
  // nombres y colores, Y SUS FOTOS. Datos de una cuenta a la vista de otra.
  //
  // Asi que no se comprueban esas tres, se comprueban TODAS: cualquier clave que se
  // añada y no entre en el borrado hace fallar esto.
  const almacen = fs.readFileSync(path.join(RAIZ, "utils/storage.ts"), "utf8");
  const declaradas = [...almacen.matchAll(/^ {2}([a-zA-Z]+): "finzo:/gm)].map((m) => m[1]);
  ok(declaradas.length >= 8, `se leyeron las claves guardadas (${declaradas.length})`);

  const inicioBorrado = almacen.indexOf("export async function clearAccountData");
  const finBorrado = almacen.indexOf("export async function loadJSON", inicioBorrado);
  const borrado = inicioBorrado >= 0 && finBorrado > inicioBorrado
    ? almacen.slice(inicioBorrado, finBorrado)
    : "";
  ok(borrado.length > 0, "se encontro el borrado de fin de sesion");
  // themeMode se queda a proposito: es preferencia del aparato, no de la cuenta.
  const fuera = declaradas.filter(
    (k) => k !== "themeMode" && !borrado.includes(`STORAGE_KEYS.${k}`)
  );
  ok(fuera.length === 0, `todas se borran al cerrar sesion${fuera.length ? ": falta " + fuera.join(", ") : ""}`);

  // Y las tres claves viven en la lista comun, no cada una en su archivo: es lo que
  // hace que la prueba de arriba pueda verlas.
  // sendContacts entra aquí el 18/08/2026: era la CUARTA con el mismo agujero —su clave
  // escrita dentro de su propio archivo, invisible para el borrado— y son correos y
  // teléfonos de otras personas, lo más delicado que guarda la app.
  for (const archivo of ["categoriasPropias", "categoryCustom", "iconosFavoritos", "sendContacts"]) {
    const suyo = fs.readFileSync(path.join(RAIZ, `utils/${archivo}.ts`), "utf8");
    ok(
      new RegExp(`STORAGE_KEY = STORAGE_KEYS\\.${archivo}`).test(suyo),
      `${archivo} lee su clave de la lista comun`
    );
  }
}

console.log("\n--- ANTES DE BORRAR SE DICE QUE PASA CON LOS MOVIMIENTOS ---");
{
  // "Se va a borrar" no informa igual que "3 movimientos quedaran en Otros", y
  // ese numero es justo lo que hace dudar o seguir. Con dinero, el aviso tiene
  // que traer el dato.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("movimientosDeCategoria"), "se cuentan los movimientos afectados");
  ok(pant.includes("nuevaCat.borrarConMovs"), "y se avisa con el numero");
  ok(pant.includes("nuevaCat.borrarSinMovs"), "o que no hay ninguno, si es el caso");
  ok(pant.includes("confirmandoBorrado"), "y se confirma antes, no se borra de un toque");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const aviso = i18n.slice(i18n.indexOf('"nuevaCat.borrarConMovs"'));
  const linea = aviso.slice(0, aviso.indexOf("\n"));
  ok(linea.includes("{count}"), "el aviso lleva el numero de verdad, no un 'algunos'");
  ok(/NO se borran/.test(linea), "y deja claro que los movimientos NO se pierden");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
