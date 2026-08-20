/**
 * EL CALENDARIO DE PAGOS — las cuentas, sin React ni Android (18/08/2026)
 *
 * Lo que pidió: *"un calendario para que la gente pueda poner en una fecha el monto —mi
 * suscripción de Netflix, el recibo del agua o la luz— y pueda personalizar qué día y a qué
 * hora me avise para pagarlo"*, con colores por estado: *"verde pagado, otro color
 * pendiente"*.
 *
 * Todo lo de aquí son funciones puras que reciben la fecha de hoy en vez de mirarla ellas.
 * Es lo que permite comprobar con números el día 31 en febrero, el aviso que cae en el mes
 * anterior y el cambio de año, que es donde esto se rompe — y ninguno de los tres se puede
 * probar esperando a que llegue esa fecha.
 */

/**
 * QUÉ SE PUEDE ANOTAR EN EL CALENDARIO.
 *
 * Los tres nacen a la vez y no por completar: un calendario que solo admite pagos convierte
 * *"el 30 me llega el sueldo"* en un pago de mentira, y *"el 22 llamar al banco"* no cabe en
 * ninguna parte. El `recordatorio` es el que **no lleva monto** y por eso no toca las cuentas.
 */
export type TipoDeAnotacion = "pago" | "ingreso" | "recordatorio";

/** Verde, ámbar y rojo de la pantalla. */
export type EstadoDelPago = "pagado" | "pendiente" | "vencido";

export type PagoProgramado = {
  id: string;
  nombre: string;
  tipo: TipoDeAnotacion;
  /** En soles. **Un recordatorio no tiene**, y por eso es opcional y no un cero. */
  monto?: number;
  /** Día del mes, 1 a 31. Ver `fechaEnElMes` para lo que pasa con el 31 en febrero. */
  dia: number;
  /**
   * `mensual` es lo normal —Netflix, la luz, el sueldo—. `unica` es para lo que pasa una vez
   * y entonces `mesUnico` dice en cuál; sin ese campo, un pago único saldría todos los meses.
   */
  repite: "mensual" | "unica";
  mesUnico?: string;
  /** La categoría del movimiento que se crea al marcarlo pagado. */
  categoria?: string;
  icono?: string;
  /** 0 = el mismo día. */
  avisoDiasAntes: number;
  /** "09:00", en hora del celular. */
  avisoHora: string;
  /**
   * LOS MESES YA PAGADOS, Y NO UN `pagado: boolean`.
   *
   * Con un booleano, un pago mensual solo podría estar pagado "en general": al llegar el mes
   * siguiente habría que apagarlo, y el que lo apagara sería un reloj — que no corre con la
   * app cerrada—. Así, "¿pagué la luz de julio?" se contesta mirando, y el historial queda.
   */
  pagados: string[];
  creado: number;
};

/** Cuántos días tiene un mes "2026-02". */
function diasDelMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** El mes de una fecha, como "2026-08". */
export function mesDe(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}`;
}

/**
 * LA FECHA DE ESTE PAGO EN ESE MES, con el día recortado al último si no existe.
 *
 * Quien paga el 31 de cada mes **no deja de pagar en febrero**. Sin recortar, `new Date` se
 * come el sobrante y el 31 de febrero se convierte en el 3 de marzo: el pago desaparecería
 * del mes que toca y aparecería en el siguiente, con un aviso tres días tarde. Es el error
 * clásico de esta clase de pantallas y no se ve hasta que llega ese mes.
 *
 * Devuelve "" si ese pago no toca en ese mes (uno único de otro mes).
 */
export function fechaEnElMes(p: PagoProgramado, mes: string): string {
  if (p.repite === "unica" && p.mesUnico !== mes) return "";
  const dia = Math.min(p.dia, diasDelMes(mes));
  return `${mes}-${dosDigitos(dia)}`;
}

/**
 * PAGADO, PENDIENTE O VENCIDO.
 *
 * "Vencido" es **solo** si ya pasó el día y no está marcado. Se compara texto con texto
 * (`"2026-08-05" < "2026-08-16"`) y no restando fechas: de las restas salen los errores del
 * día 1 y los saltos de hora, y aquí el día es justo lo único que importa. Es la misma
 * decisión que ya se tomó en los reportes del negocio.
 *
 * **El día de hoy NO está vencido.** Quien paga la luz el 18 la paga el 18, y ver "se te
 * pasó" a las nueve de la mañana de ese mismo día es la app mintiendo.
 */
export function estadoEn(p: PagoProgramado, mes: string, hoy: Date): EstadoDelPago {
  if (p.pagados.includes(mes)) return "pagado";
  const fecha = fechaEnElMes(p, mes);
  if (fecha === "") return "pendiente";
  const hoyClave = `${mesDe(hoy)}-${dosDigitos(hoy.getDate())}`;
  return fecha < hoyClave ? "vencido" : "pendiente";
}

/** Los de ese mes, del día 1 al 31. */
export function pagosDelMes(lista: PagoProgramado[], mes: string): PagoProgramado[] {
  return lista
    .filter((p) => fechaEnElMes(p, mes) !== "")
    .sort((a, b) => fechaEnElMes(a, mes).localeCompare(fechaEnElMes(b, mes)));
}

/**
 * LO QUE TE FALTA ESTE MES.
 *
 * **Solo los pagos**, y ni los ingresos ni los recordatorios. Un sueldo que aún no llega no
 * es algo que "te falte pagar", y meterlo restaría al total: el número de arriba diría que
 * te falta menos por el hecho de que vas a cobrar. Un recordatorio no tiene monto siquiera.
 */
export function faltaPorPagar(lista: PagoProgramado[], mes: string, hoy: Date): number {
  return pagosDelMes(lista, mes)
    .filter((p) => p.tipo === "pago" && estadoEn(p, mes, hoy) !== "pagado")
    .reduce((suma, p) => suma + (p.monto ?? 0), 0);
}

/** Cuántos hay de cada estado, para los números de los filtros. */
export function cuentaPorEstado(
  lista: PagoProgramado[],
  mes: string,
  hoy: Date
): Record<EstadoDelPago, number> {
  const cuenta: Record<EstadoDelPago, number> = { pagado: 0, pendiente: 0, vencido: 0 };
  for (const p of pagosDelMes(lista, mes)) cuenta[estadoEn(p, mes, hoy)]++;
  return cuenta;
}

/** Cuántos hay de cada tipo. Decide si la segunda fila de filtros existe. */
export function cuentaPorTipo(
  lista: PagoProgramado[],
  mes: string
): Record<TipoDeAnotacion, number> {
  const cuenta: Record<TipoDeAnotacion, number> = { pago: 0, ingreso: 0, recordatorio: 0 };
  for (const p of pagosDelMes(lista, mes)) cuenta[p.tipo]++;
  return cuenta;
}

/**
 * ¿HACE FALTA LA FILA DE FILTROS POR TIPO?
 *
 * Solo con más de un tipo en el mes. Con únicamente pagos, esos tres botones no pueden
 * cambiar nada de lo que se ve: son tres cosas más que mirar para nada. Es la misma regla
 * que ya sacó del panel del negocio lo que era un cero permanente.
 */
export function hayVariosTipos(lista: PagoProgramado[], mes: string): boolean {
  const cuenta = cuentaPorTipo(lista, mes);
  return Object.values(cuenta).filter((n) => n > 0).length > 1;
}

/**
 * EL QUE VA ARRIBA EN GRANDE: el siguiente que hay que pagar.
 *
 * **Lo vencido manda sobre lo que viene.** Si se te pasó el agua el 5 y la luz vence el 18,
 * el que tiene que salir grande es el agua: es el que cuesta dinero dejar ahí.
 *
 * Mira este mes y el siguiente, porque el día 29 lo que viene ya no está en este mes y la
 * tarjeta se quedaría vacía justo en los días en que más sirve.
 */
export function proximoPago(lista: PagoProgramado[], hoy: Date): { pago: PagoProgramado; mes: string } | null {
  const meses = [mesDe(hoy), mesSiguiente(mesDe(hoy))];
  const candidatos: { pago: PagoProgramado; mes: string; fecha: string; estado: EstadoDelPago }[] = [];
  for (const mes of meses) {
    for (const p of pagosDelMes(lista, mes)) {
      const estado = estadoEn(p, mes, hoy);
      if (estado === "pagado") continue;
      candidatos.push({ pago: p, mes, fecha: fechaEnElMes(p, mes), estado });
    }
  }
  if (candidatos.length === 0) return null;
  const vencidos = candidatos.filter((c) => c.estado === "vencido");
  const cola = vencidos.length > 0 ? vencidos : candidatos;
  cola.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { pago: cola[0].pago, mes: cola[0].mes };
}

/** "2026-12" → "2027-01". Tiene prueba: el salto de año es un error de una línea. */
export function mesSiguiente(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 12 ? `${anio + 1}-01` : `${anio}-${dosDigitos(m + 1)}`;
}

/**
 * CUÁNDO SUENA EL AVISO DE ESTE PAGO EN ESTE MES.
 *
 * Restando los días a la fecha del pago, a la hora elegida. Se usa `new Date(anio, mes, dia)`
 * y no restar milisegundos: **los días no duran siempre 24 horas** y con un cambio de horario
 * el aviso saldría una hora antes o después. Aquí no hay ninguna resta de tiempo.
 *
 * Puede caer en el mes anterior —el 2 de agosto avisando con 5 días es el 28 de julio— y eso
 * es correcto y está en las pruebas.
 */
export function cuandoAvisar(p: PagoProgramado, mes: string): Date | null {
  const fecha = fechaEnElMes(p, mes);
  if (fecha === "") return null;
  const [anio, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = p.avisoHora.split(":").map(Number);
  return new Date(anio, m - 1, d - p.avisoDiasAntes, hh, mm, 0, 0);
}

/**
 * CUÁNDO VA A SONAR EL PRIMER AVISO DE VERDAD.
 *
 * Existe porque hay un caso que confunde a cualquiera y no se ve por ningún lado: elegir hoy
 * con "1 día antes" pide un aviso de **ayer**, y un aviso en el pasado no se programa —Android
 * lo dispararía al instante—. Sin decirlo, la pantalla promete un aviso que no va a llegar.
 *
 * Busca el primer mes, de los próximos doce, cuyo aviso todavía no haya pasado. Devuelve
 * `null` si es un pago único cuya fecha ya pasó, que es el único caso en que de verdad no
 * habrá aviso nunca.
 */
export function primerAviso(p: PagoProgramado, ahora: Date): Date | null {
  let mes = mesDe(ahora);
  for (let i = 0; i < 12; i++) {
    const cuando = cuandoAvisar(p, mes);
    if (cuando != null && cuando.getTime() > ahora.getTime()) return cuando;
    if (p.repite === "unica") return null;
    mes = mesSiguiente(mes);
  }
  return null;
}

/** Marca o desmarca un mes como pagado. Devuelve una copia; no toca el original. */
export function marcarPagado(p: PagoProgramado, mes: string, pagado: boolean): PagoProgramado {
  const sinEste = p.pagados.filter((m) => m !== mes);
  return { ...p, pagados: pagado ? [...sinEste, mes].sort() : sinEste };
}

/**
 * ¿SE PUEDE GUARDAR ESTO?
 *
 * Un pago sin monto sería una fila que no dice nada y que al marcarla pagada crearía un
 * movimiento de cero soles. Un recordatorio, en cambio, **no puede llevar monto**: si lo
 * llevara sería un pago, y la diferencia entre los dos es justo que uno toca las cuentas.
 */
export function validarPago(
  nombre: string,
  tipo: TipoDeAnotacion,
  monto: number | undefined,
  dia: number
): { ok: true } | { ok: false; motivo: "nombre" | "monto" | "dia" } {
  if (nombre.trim().length === 0) return { ok: false, motivo: "nombre" };
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, motivo: "dia" };
  if (tipo !== "recordatorio" && (monto == null || monto <= 0)) {
    return { ok: false, motivo: "monto" };
  }
  return { ok: true };
}

/**
 * EL MOVIMIENTO QUE SE CREA AL MARCARLO PAGADO.
 *
 * Devuelve `null` para un recordatorio: no tiene monto y no puede tocar las cuentas.
 *
 * **La fecha es la del pago, no la de hoy.** Quien marca el 20 el recibo que vencía el 5
 * está anotando un gasto del 5: con la fecha de hoy, el mes que lo pagó y el mes al que
 * pertenece dejarían de coincidir y los reportes de los dos meses saldrían mal.
 */
export function movimientoDelPago(
  p: PagoProgramado,
  mes: string
): { type: "income" | "expense"; amount: number; date: string; description: string } | null {
  if (p.tipo === "recordatorio" || p.monto == null) return null;
  const fecha = fechaEnElMes(p, mes);
  if (fecha === "") return null;
  return {
    type: p.tipo === "ingreso" ? "income" : "expense",
    amount: p.monto,
    date: fecha,
    description: p.nombre,
  };
}

/**
 * EL DIBUJO QUE LE PEGA AL NOMBRE, SIN QUE HAYA QUE ELEGIRLO (19/08/2026)
 *
 * Pedido suyo: *"que el usuario pueda agregarle un icono personalizado a su recordatorio,
 * pago, ingreso"*, junto con *"que el usuario tenga la menor interacción"*. Las dos cosas a
 * la vez se resuelven así: **el icono aparece solo al escribir el nombre**, y el lápiz lo
 * cambia si no acierta. En el caso normal son cero toques.
 *
 * Las palabras van **sin tildes y en minúscula** porque así llega lo que se compara: quien
 * escribe "Luz" y quien escribe "LUZ" tienen que ver el mismo rayo.
 *
 * **Se busca por trozo y no por igualdad**: "recibo de luz" y "luz del mes" tienen que dar
 * el rayo igual. Y el orden importa — gana la primera que encaja, así que las palabras más
 * específicas van antes: "internet" antes que "net" no, pero "netflix" antes que "net" sí.
 */
const DIBUJO_POR_PALABRA: [string, string][] = [
  // Marcas primero: son las más concretas y las que más ilusión hacen.
  ["netflix", "marca:youtube"],
  ["spotify", "marca:spotify"],
  ["youtube", "marca:youtube"],
  ["disney", "marca:youtube"],
  ["amazon", "marca:amazon"],
  ["prime", "marca:amazon"],
  ["steam", "marca:steam"],
  ["playstation", "marca:playstation"],
  ["xbox", "marca:xbox"],
  ["discord", "marca:discord"],
  ["whatsapp", "marca:whatsapp"],
  // Servicios de casa.
  ["luz", "Zap"],
  ["electric", "Zap"],
  ["recibo de agua", "Droplet"],
  ["agua", "Droplet"],
  ["gas", "Flame"],
  ["internet", "Wifi"],
  ["wifi", "Wifi"],
  ["cable", "MonitorSmartphone"],
  ["telefono", "Phone"],
  ["celular", "Smartphone"],
  ["plan", "Smartphone"],
  // Casa y vida.
  ["alquiler", "Home"],
  ["renta", "Home"],
  ["casa", "Home"],
  ["colegio", "School"],
  ["universidad", "School"],
  ["matricula", "School"],
  ["pension", "School"],
  ["seguro", "ShieldCheck"],
  ["salud", "HeartPulse"],
  ["clinica", "HeartPulse"],
  ["gimnasio", "Dumbbell"],
  ["gym", "Dumbbell"],
  ["auto", "Car"],
  ["carro", "Car"],
  ["gasolina", "Fuel"],
  ["mascota", "PawPrint"],
  ["perro", "Dog"],
  ["gato", "Cat"],
  // Dinero.
  ["sueldo", "Wallet"],
  ["salario", "Wallet"],
  ["pago", "Wallet"],
  ["prestamo", "Landmark"],
  ["tarjeta", "CreditCard"],
  ["banco", "Landmark"],
];

/** Con qué se queda cuando ninguna palabra encaja. Uno por tipo, para que nunca salga vacío. */
const DIBUJO_POR_DEFECTO: Record<TipoDeAnotacion, string> = {
  pago: "Wallet",
  ingreso: "TrendingUp",
  recordatorio: "Bell",
};

/** Quita tildes y mayúsculas, que es la única forma de que "Água" y "agua" se comparen igual. */
function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function iconoSugerido(nombre: string, tipo: TipoDeAnotacion): string {
  const limpio = sinTildes(nombre);
  for (const [palabra, dibujo] of DIBUJO_POR_PALABRA) {
    if (limpio.includes(palabra)) return dibujo;
  }
  return DIBUJO_POR_DEFECTO[tipo];
}

/**
 * QUÉ DICE EL RENGLÓN DE DEBAJO DEL NOMBRE, EN LENGUAJE DE PERSONA.
 *
 * Antes decía *"el 19"* y *"se pasó el 5"*, y él lo cortó en seco: *"no tiene sentido esas
 * letras"*. Tenía razón — un número suelto obliga a mirar el calendario y restar. Ahora dice
 * **hoy**, **mañana**, **en 3 días** o el día de la semana con su fecha, que es como lo diría
 * cualquiera.
 *
 * Devuelve la clave y sus valores en vez del texto ya hecho: traducir es cosa de la pantalla,
 * y así esto se puede comprobar con números en las pruebas, sin idioma de por medio.
 *
 * **El verbo cambia con el tipo**, y no es un adorno: un sueldo no "vence", llega. Un
 * recordatorio tampoco vence: avisa.
 */
export function cuandoTexto(
  p: PagoProgramado,
  mes: string,
  hoy: Date
): { clave: string; dias?: number; fecha?: string } {
  const estado = estadoEn(p, mes, hoy);
  const fecha = fechaEnElMes(p, mes);
  if (fecha === "") return { clave: "calendario.cuando.sinFecha" };

  if (estado === "pagado") return { clave: `calendario.cuando.pagado.${p.tipo}`, fecha };

  // Días entre hoy y el día del pago. Se cuenta a mediodía a propósito: comparando a las
  // 00:00 un cambio de horario puede dar 0,99 días y "mañana" se convertiría en "hoy".
  const [aa, mm, dd] = fecha.split("-").map(Number);
  const alMediodia = new Date(aa, mm - 1, dd, 12).getTime();
  const hoyAlMediodia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12).getTime();
  const dias = Math.round((alMediodia - hoyAlMediodia) / 86400000);

  if (dias < 0) return { clave: "calendario.cuando.vencio", dias: -dias };
  if (dias === 0) return { clave: `calendario.cuando.hoy.${p.tipo}` };
  if (dias === 1) return { clave: `calendario.cuando.manana.${p.tipo}` };
  if (dias <= 6) return { clave: `calendario.cuando.enDias.${p.tipo}`, dias };
  return { clave: `calendario.cuando.fecha.${p.tipo}`, fecha };
}

/**
 * CÓMO SE CUENTA LA REPETICIÓN, SIN NOTA AL PIE.
 *
 * El texto viejo era *"Todos los 31 de cada mes. En los meses que no tienen ese día, el
 * último."* — dos frases para explicar un recorte. Con el 31 no hace falta explicar nada:
 * **el 31 de cada mes ES el último día**, así que se llama por su nombre y la nota sobra.
 *
 * El 29 y el 30 son los únicos que siguen necesitando la aclaración, y son raros.
 */
export function textoDeRepeticion(
  dia: number,
  repite: boolean
): { clave: string; dia?: number } {
  if (!repite) return { clave: "calendario.repite.unaVez", dia };
  if (dia === 31) return { clave: "calendario.repite.ultimoDia" };
  if (dia === 29 || dia === 30) return { clave: "calendario.repite.casiUltimo", dia };
  return { clave: "calendario.repite.cadaMes", dia };
}
