# Exportación: resumen limpio y filtro coherente

Preparación local del 14/10/2026. Marca `14oct-exportacion-limpia`.

## Qué fallaba y qué cambia

Los movimientos llegaban filtrados, pero el resumen recibía ingresos y gastos
del mes completo. Pedir solo gastos podía mostrar ingresos en el encabezado.
El saldo del bolsillo, el resultado del mes y el total de las filas eran además
varias tarjetas distintas que se prestaban a confusión.

- Un solo resumen sencillo, sin tarjetas de totales repetidas.
- En «Todos», saldo disponible real del espacio; presupuesto solo si es finito
  y positivo, saldo anterior solo si existe y no es cero. Ingresos y gastos solo
  si hay movimientos de ese tipo en el documento.
- En «Gastos» o «Ingresos», únicamente el total de las filas elegidas. No se
  presenta el saldo de todo el bolsillo como si fuera un resultado filtrado.
  El presupuesto positivo puede acompañar gastos, nunca ingresos.
- El resultado del mes no se repite en otra tarjeta; se conserva el total
  firmado al pie de las filas. No cambian saldos, importes ni transferencias.
- Tabla con «Método de pago» (también inglés/portugués). Los puntos de categoría
  señalados por el usuario son azules, sin darles significado de ingreso.
  Montos de gastos rojos e ingresos verdes; gráficos conservan sus categorías.

El armador compartido aplica estas reglas a manual y automática. La selección
se extrae a un módulo puro, reexportado desde el módulo de archivos existente:
el PDF no necesita cargar Excel para filtrar. En Todos se mantienen las
transferencias identificadas; en filtros de gasto/ingreso se excluyen como antes.
Excel/CSV conservan cuentas y signos; solo cambia su cabecera traducida.

## Evidencia y límites

`pruebas/verificar-exportacion-resumen-real.mjs` ejecuta los armadores
originales y los manejadores manual/automático con almacenamiento y destino
ficticios. Comprueba tres idiomas, cada filtro, presupuesto ausente/cero/negativo,
saldo anterior cero, filas/colores, transferencia y resumen. El caso automático
no fuerza la exportación: simula una programación habilitada y cuenta Pro.

La misma prueba contra `20b8877` falla por las tarjetas del resumen anterior,
no por una API ausente ni por no compilar. Dos comprobaciones antiguas que
exigían la tarjeta eliminada se adaptan al nuevo requisito del usuario.

Validación final: TypeScript y ESLint aprobados; batería completa con
`node pruebas/correr.mjs --sin-tarjetas`, 219 pruebas y 8 auditores verdes
(incluye una suite ajena no versionada; 218 previstas en Git limpio, no se
ejecutó otro checkout). Las tarjetas de crédito siguen excluidas.

El HTML real se convirtió localmente con Chromium a PDF A4, se renderizó con
Poppler y se revisaron imágenes: mixto con presupuesto, gasto, ingreso, sin
presupuesto y documento largo de tres páginas con cabeceras repetidas. Sin
columnas desbordadas; datos de ejemplo, no de la cuenta del usuario.

Qué sigue/falta: exportar y abrir un archivo desde Android y comprobar el
convertidor/entrega de una programación real. Chromium no certifica el motor
Android ni la recepción en un destino externo. No se exportaron, cambiaron ni
borraron datos reales, ni se enviaron documentos a ningún servicio.

No cambia nativo, permisos, datos recopilados, nube/planes, Telegram ni tarjetas.
No requiere APK nuevo por estos cambios; no se publicó APK/AAB/OTA/Play ni
servicio remoto. No es cierre de la auditoría global de Fino.
