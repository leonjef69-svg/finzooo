// LA PRUEBA GRATUITA DE PREMIUM: 24 HORAS, UNA SOLA VEZ
//
// Llegó el 07/08/2026 con el rediseño de la pantalla de Premium, que el usuario pidió
// con tres maquetas. Una de ellas trae el botón "Probar Premium gratis por 24 horas" y
// el aviso que dice cuánto dura, que es una sola vez y que no hace falta tarjeta.
//
// LO QUE HAY QUE PROTEGER AQUÍ NO ES LA CUENTA DE HORAS
//
// Es que la prueba NO SE MEZCLE con el Premium de la cuenta. Son dos cosas, y si se
// guardaran juntas pasarían las dos peores versiones de este fallo:
//
//   · alguien que ya tiene Premium toca "probar" por curiosidad, y al día siguiente
//     lo ha perdido, porque al caducar la prueba se apagó todo;
//   · o al revés: la prueba se guarda como Premium comprado y queda para siempre,
//     también en la nube y en cualquier otro celular.
//
// Lo otro que se comprueba son los bordes del tiempo, que es donde estas cosas fallan:
// el instante exacto en que caduca, y un reloj movido hacia atrás.
import fs from "fs";
import path from "path";
import {
  DURACION_PRUEBA_HORAS,
  DURACION_PRUEBA_MS,
  pruebaHorasRestantes,
  pruebaRestanteMs,
  pruebaVigente,
  pruebaYaUsada,
} from "@/utils/pruebaPremium";

const RAIZ = process.cwd();
let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const HORA = 60 * 60 * 1000;
const INICIO = new Date(2026, 7, 7, 12, 0, 0).getTime();

console.log("\n--- CUÁNDO ESTÁ VIGENTE ---");
{
  ok(pruebaVigente(INICIO, INICIO), "recién activada, vale");
  ok(pruebaVigente(INICIO, INICIO + 23 * HORA), "a las 23 horas todavía vale");
  // El borde exacto. Con ">=" en vez de ">" aquí, la prueba duraría un instante más
  // que lo que dice el texto — y peor: el caso limite es el unico que nadie prueba.
  ok(!pruebaVigente(INICIO, INICIO + DURACION_PRUEBA_MS), "al cumplirse las 24 se acaba, justo en el borde");
  ok(!pruebaVigente(INICIO, INICIO + 25 * HORA), "y una hora después, tampoco");

  // Sin activar nunca no hay prueba: es lo que distingue "no la ha usado" de "la
  // usó y caducó", y de eso depende que se le pueda ofrecer.
  ok(!pruebaVigente(null, INICIO), "sin activar, no hay prueba");

  // EL RELOJ MOVIDO HACIA ATRÁS. Pasa de verdad: basta cambiar la fecha del
  // teléfono después de activarla. Sin esta comprobación, la resta da negativo,
  // "menos de 24 horas" se cumple, y la prueba quedaría vigente para siempre.
  ok(!pruebaVigente(INICIO, INICIO - HORA), "con el reloj movido atrás no se queda abierta para siempre");
}

console.log("\n--- UNA SOLA VEZ ---");
{
  ok(!pruebaYaUsada(null), "sin activar, se puede usar");
  ok(pruebaYaUsada(INICIO), "activada, ya está usada");
  // Y SIGUE usada cuando caduca. Mirando si está vigente en vez de si existe, al
  // caducar se podría activar otra vez: serían 24 horas gratis cada día.
  ok(pruebaYaUsada(INICIO), "y sigue usada aunque haya caducado");
}

console.log("\n--- LO QUE LE QUEDA ---");
{
  ok(pruebaRestanteMs(INICIO, INICIO) === DURACION_PRUEBA_MS, "recién activada le quedan las 24 enteras");
  ok(pruebaRestanteMs(INICIO, INICIO + 24 * HORA) === 0, "caducada no le queda nada");
  ok(pruebaRestanteMs(null, INICIO) === 0, "y sin activar, nada");

  // Se REDONDEA HACIA ARRIBA. Con media hora restante, "queda 1 hora" es verdad y
  // "quedan 0 horas" no: hacia abajo, la última hora se anunciaría como ninguna y
  // parecería que ya caducó.
  ok(pruebaHorasRestantes(INICIO, INICIO + 23.5 * HORA) === 1, "con media hora dice que queda 1");
  ok(pruebaHorasRestantes(INICIO, INICIO) === DURACION_PRUEBA_HORAS, `recién activada dice ${DURACION_PRUEBA_HORAS}`);
  ok(pruebaHorasRestantes(INICIO, INICIO + 24 * HORA) === 0, "y caducada dice cero");
}

console.log("\n--- EL TEXTO DICE LAS MISMAS HORAS QUE EL CÓDIGO ---");
{
  // El aviso dice "durante {horas} horas" y el número lo pone la pantalla desde la
  // constante, no escrito a mano: así no pueden decir cosas distintas. Se comprueba
  // que la pantalla lo pase de verdad.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/Premium.tsx"), "utf8");
  ok(/horas: DURACION_PRUEBA_HORAS/.test(pant), "la pantalla saca las horas de la constante");
  ok(DURACION_PRUEBA_MS === DURACION_PRUEBA_HORAS * HORA, "y las dos formas del número cuadran");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["premium.pruebaTitulo", "premium.pruebaTexto", "premium.probarGratis"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} está en los tres idiomas (${veces})`);
  }
  // Y el texto no puede llevar el número escrito: ahí es donde se separaría del
  // código sin que nadie lo note.
  const textos = [...i18n.matchAll(/"premium\.pruebaTexto": "([^"]*)"/g)].map((m) => m[1]);
  ok(textos.length === 3 && textos.every((v) => v.includes("{horas}")), "y lo pide, no lo escribe");
}

console.log("\n--- LA PRUEBA NO SE MEZCLA CON EL PREMIUM DE LA CUENTA ---");
{
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");

  // Lo que ven las pantallas es la SUMA, y se calcula en un solo sitio: si cada
  // pantalla tuviera que acordarse de mirar también la prueba, alguna no lo haría y
  // ahí la prueba no serviría de nada.
  // El 08/08/2026 se le añadio un tercer factor y por eso ya no se compara la linea entera:
  // "verComoGratis", el interruptor de Acerca de que sirve para mirar la app como alguien que
  // no paga. Lo que sigue importando —y es lo que se comprueba— es que la suma se haga en UN
  // solo sitio, y que ese interruptor solo pueda QUITAR: puesto con un "||" en vez de un "&&"
  // seria una puerta trasera que regala Premium con siete toques.
  ok(
    /const isPremium = \(isPremiumDeLaCuenta \|\| pruebaCorriendo\) && !verComoGratis/.test(ctx),
    "las pantallas ven el de la cuenta O la prueba"
  );

  // Y lo que SE GUARDA es solo el de la cuenta. Guardando la suma, activar la prueba
  // dejaria Premium marcado para siempre en este celular.
  ok(
    /saveJSON\(STORAGE_KEYS\.isPremium, isPremiumDeLaCuenta\)/.test(ctx),
    "y lo que se guarda es solo el de la cuenta"
  );
  // Lo mismo con la nube: si subiera la prueba como Premium comprado, volveria en
  // cualquier celular donde se entrara, y para siempre.
  ok(/isPremium: isPremiumDeLaCuenta,/.test(ctx), "a la nube tampoco sube la prueba");

  // La prueba en si NO viaja a la nube. Sincronizarla haria que la consumida en un
  // telefono bloqueara la de otro, y tambien lo contrario segun quien subiera
  // ultimo.
  // Sin comentarios: ahi la palabra "prueba" sale hablando de otra cosa (de una
  // prueba del proyecto), y una asercion que se cae por un comentario acaba haciendo
  // que se borre el comentario. Cuarta vez que pasa aqui.
  const nube = fs
    .readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  ok(!/prueba/i.test(nube), "la prueba se queda en este celular");

  // Y al cerrar sesion se suelta: es de la cuenta que se va, no del aparato. Sin
  // esto, la cuenta siguiente entraria con la prueba de la anterior a medio correr.
  ok((ctx.match(/setPruebaInicio\(null\)/g) ?? []).length >= 2, "al cerrar sesion y al borrar la cuenta, se suelta");
  const almacen = fs.readFileSync(path.join(RAIZ, "utils/storage.ts"), "utf8");
  ok(/STORAGE_KEYS\.pruebaPremium,/.test(almacen), "y su marca se borra del celular");
}

console.log("\n--- LA PANTALLA NO PROMETE UN COBRO QUE NO EXISTE ---");
{
  // No hay pago integrado. Un boton "ADQUIRIR VERSION PREMIUM" que no cobra y no lo
  // advierte es lo que hace que alguien se sienta engañado, asi que la pantalla lo
  // dice con letra pequeña. Y esta en la lista de Play Store de ESTADO.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/Premium.tsx"), "utf8");
  ok(pant.includes("premium.sinCobro"), "se avisa de que el pago no esta disponible");

  // Los precios salen de UN sitio. Los mismos numeros aparecen en cuatro lugares de
  // la pantalla; escritos a mano, cambiar el precio una vez dejaria dos diciendo
  // otra cosa, y un precio que se contradice en una app de dinero se paga caro.
  // AQUI DECIA "los precios salen de un solo sitio", Y ESO CAMBIO EL 07/08/2026.
  //
  // La regla vieja tenia su motivo y conviene dejarlo escrito: los mismos numeros aparecian
  // en cuatro lugares de la pantalla, y escritos a mano bastaba cambiar uno para que dos
  // dijeran otra cosa. Un precio que se contradice en una app de dinero se paga caro.
  //
  // Pero el fallo era mas grande que la coherencia: NO HAY COBRO. No hay Play Billing ni
  // pasarela, asi que esos precios eran lo que COSTARIA, y el boton "ADQUIRIR" lo unico que
  // hacia era regalar Premium (setIsPremium(true)). Google trata como engañoso un precio con
  // un boton de compra que no cobra, y era el bloqueo NUMERO UNO para publicar.
  //
  // Y EL 08/08/2026 SE AFINO OTRA VEZ, con su motivo, porque "que no haya precio" dejo de ser
  // la regla correcta el dia que se preparo el cobro (utils/compras.ts).
  //
  // La regla de verdad nunca fue "sin precio": era **sin precio mientras no se pueda cobrar**.
  // Prohibirlo para siempre obligaria a borrar esta comprobacion el dia que llegue Play
  // Billing, y una prueba que estorba es una prueba que alguien quita sin leerla.
  //
  // Asi que lo que se vigila ahora es que el precio viva DENTRO de la rama de
  // comprasDisponibles(): si aparece antes de esa condicion, es que alguien volvio a enseñar un
  // precio en una version que no cobra.
  const sinComentarios = pant.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dondeLaCondicion = sinComentarios.indexOf("comprasDisponibles()");
  const dondeElPrecio = sinComentarios.indexOf("PRECIOS.");
  ok(dondeLaCondicion !== -1, "la pantalla pregunta si se puede cobrar");
  ok(
    dondeElPrecio === -1 || dondeElPrecio > dondeLaCondicion,
    "y ningun precio se enseña fuera de esa condicion"
  );
  ok(
    !/\b9\.9\b|\bmensualPromo\b|\banualDetalle\b/.test(sinComentarios),
    "ni un precio escrito a mano ni el selector de planes"
  );

  // Y LO QUE DE VERDAD IMPORTA: que nadie pueda "comprar" y llevarse Premium gratis. Es lo
  // que hacia el boton, y es el motivo del rechazo.
  const ruta = fs.readFileSync(path.join(RAIZ, "app/premium.tsx"), "utf8");
  const rutaLimpia = ruta.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/setIsPremium/.test(rutaLimpia), "y no hay ningun boton que regale Premium");
  ok(!/premium\.adquirir/.test(sinComentarios), "no queda el boton de adquirir");

  // PERO LA PRUEBA DE 24 HORAS SE QUEDA, y esto es decision suya del 07/08/2026: *"al app de
  // premium tendra una prueba de 24 horas que finaliza luego de eso para que puedan probar
  // las funciones que tiene"*.
  //
  // Es la mitad que hace que quitar el precio no deje la pantalla en un escaparate inutil:
  // sin poder pagar Y sin poder probar, las ocho funciones quedarian fuera del alcance de
  // cualquiera que instale la app.
  ok(/activarPruebaPremium/.test(pant), "la prueba de 24 horas se queda");
  ok(/premium\.llegaPronto/.test(sinComentarios), "y se dice que el pago llega pronto");

  // "Sin anuncios" ya no se anuncia: no hay anuncios que quitar, asi que era una
  // promesa vacia. Esta en la lista de cosas que bloquean Play Store.
  ok(!pant.includes("premium.perkNoAds"), "y no se promete quitar anuncios que no existen");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
