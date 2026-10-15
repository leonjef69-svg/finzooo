# Exportación: resumen limpio y filtro coherente

Preparación local del 14/10/2026. Marca `14oct-pdf-montos-completos`.

## Qué fallaba y qué cambia

Los movimientos llegaban filtrados, pero el resumen recibía ingresos y gastos
del mes completo. Pedir solo gastos podía mostrar ingresos en el encabezado.
El saldo del bolsillo, el resultado del mes y el total de las filas eran además
varias tarjetas distintas que se prestaban a confusión.

- Ajuste posterior solicitado por el propietario: tarjetas de color, una por
  dato, sin repetir resultado/balance. Saldo azul (rojo si negativo), ingresos
  verdes, gastos rojos y saldo anterior violeta/rojo.
- Saldo disponible real del espacio/mes en Todos, Gastos e Ingresos. El filtro
  limita las filas y los totales de tipo; no altera el saldo de ese espacio.
- Saldo y presupuesto comparten UNA tarjeta: «Saldo disponible», monto y
  debajo «de [monto] presupuestado». Sin tarjeta separada de presupuesto.
  Presupuesto solo si es finito y positivo, también al pedir gastos o ingresos.
  Saldo anterior no cero en Todos. Ingresos/gastos solo si hay filas de ese tipo
  y el filtro los incluye: un reporte de gastos no muestra tarjeta de ingresos.
- Números completos en tarjetas, filas, totales y gráficos; sin K/M/B/T.
  La moneda, separadores y decimales proceden del espacio. La columna de monto
  gana ancho según su contenido y puede envolver texto, sin sustituir cifras.
  `fmtExact` conserva el formato monetario compartido sin abreviar acumulados;
  no cambia el formato compacto que usan otras pantallas.
- El resultado del mes no se repite en otra tarjeta; se conserva el total
  firmado al pie de las filas. No cambian saldos, importes ni transferencias.
- Tabla con «Método de pago» (también inglés/portugués). Los puntos de categoría
  señalados por el usuario son azules, sin darles significado de ingreso.
  Montos de gastos rojos e ingresos verdes; gráficos conservan sus categorías.

El armador compartido aplica estas reglas a manual y automática. La selección
se extrae a un módulo puro, reexportado desde el módulo de archivos existente:
el PDF no necesita cargar Excel para filtrar. En Todos se mantienen las
transferencias identificadas; en filtros de gasto/ingreso se excluyen como antes.
Excel/CSV conservan cuentas y signos; cabecera traducida y texto de totales
completo, sin modificar sus celdas numéricas.

## Evidencia y límites

`pruebas/verificar-exportacion-resumen-real.mjs` ejecuta los armadores
originales y los manejadores manual/automático con almacenamiento y destino
ficticios. Ejecuta además `resumenFinanciero`, saldo anterior, balance Personal
y formateador originales con un libro sintético que incluye otro mes y
transferencias; compara el saldo calculado, no uno escrito como respuesta.
Comprueba tres idiomas, seis monedas, cifras grandes/céntimos, filtros,
presupuesto ausente/cero/negativo, saldo anterior cero, tarjetas únicas,
filas/colores y transferencias. Familia/Cajas no toman presupuesto de Personal.
El caso automático no fuerza la exportación: simula programación y cuenta Pro.

La primera versión de la prueba contra `20b8877` fallaba por el resumen anterior.
La ampliación contra `acf28d9f` falla porque faltan las tarjetas y el saldo en
los filtros, no por una API ausente ni por no compilar. Dos comprobaciones
antiguas conservan que no se repita la tarjeta de resultado eliminada.

Validación final, incluida la tarjeta conjunta: TypeScript y ESLint aprobados;
batería completa con
`node pruebas/correr.mjs --sin-tarjetas`, 219 pruebas y 8 auditores verdes
(incluye una suite ajena no versionada; 218 previstas en Git limpio, no se
ejecutó otro checkout). Las tarjetas de crédito siguen excluidas.

El HTML real se convirtió localmente con Chromium a PDF A4, se renderizó con
Poppler y se revisaron imágenes: mixto con presupuesto/saldo anterior, gasto,
ingreso, sin presupuesto, saldo negativo y tres páginas con cifras grandes.
Cabeceras repetidas en el documento largo. Sin
columnas desbordadas; datos de ejemplo, no de la cuenta del usuario.

Qué sigue/falta: exportar y abrir un archivo desde Android y comprobar el
convertidor/entrega de una programación real. Chromium no certifica el motor
Android ni la recepción en un destino externo. No se exportaron, cambiaron ni
borraron datos reales, ni se enviaron documentos a ningún servicio.

Hallazgo separado de precisión: el estrés con un gasto de 9 billones de soles
y muchos gastos de S/ 50.15 puede acumular diferencias de céntimos en las sumas
binarias preexistentes (por ejemplo .62 frente a .60). Esta entrega conecta
las cuentas originales y no altera esa aritmética global; no certifica
exactitud decimal de acumulados extremos. Requiere revisión financiera
compartida para no corregir un documento y desalinearlo de Inicio.

No cambia nativo, permisos, datos recopilados, nube/planes, Telegram ni tarjetas.
No requiere APK nuevo por estos cambios; no se publicó APK/AAB/OTA/Play ni
servicio remoto. No es cierre de la auditoría global de Fino.
