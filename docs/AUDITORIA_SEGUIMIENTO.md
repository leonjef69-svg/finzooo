# Seguimiento de la auditoría de Claude

Última revisión: 07/10/2026. Este archivo separa tres cosas distintas: código
corregido, pruebas locales aprobadas y acciones que realmente están publicadas.

## FINO-14 — lector de avisos sin descifrar historiales en cada pulso (07/10/2026)

- Confirmado: con captura activada, la app volvía a leer y descifrar la lista
  completa de movimientos, el registro de avisos y la caja del negocio cada
  ocho segundos aunque no hubiera novedades. Ahora consulta el buzón y el
  registro breve; las listas completas se reconcilian al llegar un aviso,
  cambiar el registro que escribe Android en segundo plano, volver al frente
  o cumplir un minuto de repaso. Un cambio de fondo se detecta en el siguiente
  pulso, sin esperar al minuto.
- Las tres lecturas de la conciliación se completan antes de modificar los
  datos visibles. Si alguna falla, un aviso pendiente no se confirma ni se
  registra sobre una copia incompleta. La prueba de regresión falló antes del
  cambio; se conservó la protección del negocio contra duplicados.
- TypeScript, ESLint, 148 pruebas sin tarjetas y 8 auditores aprobados. La
  prueba del registro falló antes del cambio; la del negocio se actualizó
  para comprobar el nombre nuevo sin quitar su protección. No se tocó el
  código nativo ni se publicó.
- **Qué sigue:** revisar el siguiente hallazgo de riesgo. **Qué falta:** medir
  en un Android con historial grande, probar
  avisos con la app abierta/cerrada, consolas y entrega; tarjetas excluidas.

## FINO-39/56 — fecha y finalización de metas (07/10/2026)

- Confirmado: `toISOString()` ponía la fecha UTC y `GoalFormSheet` conservaba
  `completed` al editar el objetivo. Ahora fecha local y estado derivado de
  `saved >= target`, tanto al entregar el formulario como al guardar en el
  contexto. Prueba con 23:30 en Lima demuestra el salto UTC; subir/bajar el
  objetivo comprueba ambos sentidos.
- Regresión roja antes del cambio; TypeScript/ESLint y 148 pruebas sin tarjetas/
  8 auditores aprobados. No se cambian fechas de metas antiguas sin saber qué
  día quiso la persona; código no publicado ni probado tocando Android.
- **Qué sigue:** FINO-14 y demás riesgos de datos/rendimiento.
  **Qué falta:** prueba física, consolas y entrega autorizada; tarjetas fuera.

## FINO-46 — abono positivo en columna Monto única (07/10/2026)

- Confirmado: con `Monto=-80` y `Monto=+1500`, el lector original devolvía
  dos gastos. Ahora decide la convención por el archivo: con un cargo negativo
  real, el positivo es ingreso; sin negativos, no cambia compras positivas.
  No infiere desde una fila TOTAL inválida, respeta Tipo escrito y conserva
  el tipo en filas que esperan fecha.
- Prueba del lector real roja antes del cambio, verde después; TypeScript,
  ESLint, 148 pruebas sin tarjetas y 8 auditores aprobados. No se modificaron
  datos existentes ni se publicó el código. La vista previa muestra el signo,
  pero no permite corregir el tipo fila por fila: esa mejora y los extractos
  reales/Android siguen pendientes antes de cerrar el hallazgo completo.
- **Qué sigue:** continuar riesgos de pérdida/corrupción e importación.
  **Qué falta:** revisión manual de tipo, pruebas Android/consolas/entrega;
  tarjetas fuera del ámbito.

## FINO-12 — monto de pagos del calendario (07/10/2026)

- Confirmado en `NuevoPagoProgramado`: `Number(monto.replace(",", "."))`
  convertía `1,500` en 1,5. El formulario ahora usa la conversión compartida
  con validación de grupos, moneda y límite; mantiene el texto original hasta
  guardar. No altera montos de pagos ya guardados: esos requieren revisión
  humana, no una corrección automática que podría inventar otro valor.
- La prueba nueva falló con el código previo; tras el arreglo pasaron
  TypeScript/ESLint, 147 pruebas sin tarjetas y 8 auditores. No se ejecutó el
  toque del campo en Android ni se entregó una nueva versión.
- **Qué sigue:** revisar los demás errores de importes y datos. **Qué falta:**
  prueba Android y consola/entrega del conjunto; FINO-12 no está cerrado en
  usuarios publicados. Tarjetas de crédito excluidas.

## Continuación punto 1 — nueva elección conserva la revisión anterior (06/10/2026)

- Regresión 1084e38 reproduce `money-pending` al comparar una revisión antigua.
  Pro ahora revisa fuentes actuales y confirma explícitamente otra elección.
- Anterior sustituida/nueva pendiente y Personal/borrados/Caja guardados juntos;
  anteriores originales/elección conservados. Nueva versión supera la anterior;
  ambas subidas permanecen pausadas hasta confirmar. No copia ningún enlace
  local al servidor ni vuelve a enviar desde UI el intento sustituido.
- Cadena mutua/identidad/moneda/versiones, límites, fusión atrasada, fallos por
  fase/reinicio, respuesta vieja y componente original comprobables. Guía:
  `docs/PRUEBAS_SUSTITUCION_IMPORTE_CAJA.md`. Políticas solo en archivos.
- Verificación: TypeScript/ESLint completos; 146 pruebas locales/8 auditores,
  77 unitarias de servidor y 126 SDK/reglas/HTTP/eventos Node 22 real aprobados.
  Ningún fallo/omisión/cancelación en servidor. Una prueba local ajena sin
  registrar se cuenta pero no se incorpora al commit; checkout limpio no
  probado. Dos suites específicas de tarjetas excluidas, no verificadas.
- **Qué sigue:** retirar sin sucesora/Pro o revisar fuentes iguales/incompletas/
  incompatibles, sin adivinar. **Qué falta:** Android/disco/tamaño/dos dispositivos
  (ADB vacío), demás hallazgos, consolas y entrega conjunta autorizada. Revisar
  compatibilidad antes de rollback. Tarjetas intactas; sin nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría abiertos.

## Continuación punto 1 — recuperar resultado vigente sin Pro (06/10/2026)

- Regresión 48e9f95: flujo real rechazaba recuperar por Pro antes de consultar
  una corrección ya terminada. No se afirma afectación de entrega publicada.
- Función solo lectura con Auth/cuenta real y transacción exige resultado
  exacto vigente. Respuesta mínima propia, sin historial ni nueva colección/
  recibo. Endpoint de escritura y descarga Firestore mantienen Pro.
- Cliente/flujo/botón originales permiten recuperación Gratis; solo rechazo
  definitivo «no aplicada» permite escritura con Pro. No vía alternativa tras
  red/cambio/acuse falso. Comprobante genuino y lote local, originales/versiones
  conservados. Políticas preparadas en archivos, no publicadas. Guía:
  `docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`.
- TypeScript/ESLint y 145 locales/8 auditores aprobados (prueba local ajena no
  registrada conservada fuera del commit; tarjetas específicas excluidas).
  77 unitarias y 124 SDK/reglas/HTTP/eventos Node 22 real aprobados, sin fallos,
  omisiones ni cancelaciones. Incluye resultados/permisos/barreras de borrado.
- **Qué sigue:** sustituir o retirar revisión obsoleta/no aplicada con elección
  explícita y sin perder originales. **Qué falta:** Android/espacio/tamaño/dos
  dispositivos (ADB vacío), demás hallazgos, consolas/políticas reales y entrega
  coordinada autorizada de funciones/reglas/app. Sin tarjetas/nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría siguen abiertos.

## Continuación punto 1 — comparación/elección/reintento conectados (06/10/2026)

- Cajas muestra cuatro fuentes (monto/moneda/fecha), exige confirmación humana
  y reconsulta antes de conservar elección/originales y fuentes locales juntas.
  Respuesta genuina y lote financiero en la misma cola. Pendientes visibles
  aun con descarga pausada; historial de originales confirmados disponible.
- Fallos/red/respuesta perdida/reinicio conservan elección; no se fabrica otra
  versión ni se duplica. Pro antes de HTTP/copia obsoleta detienen la corrección
  preservando originales; Pro después de respuesta genuina no impide lote local.
- Modal/dos toques, aviso de caché a pantalla nueva y lectura/render antiguos
  protegidos. Guía: `docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md`. Pruebas de código original
  y SQLite/demo Firebase no equivalen a Android visual ni consola de producción.
- Verificación: TypeScript/ESLint completos, 144 locales/8 auditores, 73
  unitarias y 121 SDK/reglas/HTTP/eventos bajo Node 22 real aprobados. Ningún
  fallo/omisión/cancelación de servidor. La prueba local ajena sin registrar se
  conserva fuera del commit; tarjetas: dos suites específicas excluidas, no
  verificadas. Regresión cbe2b08 falla por nuevo contrato ausente.
- **Qué sigue:** recuperación/desbloqueo de elección obsoleta o Pro vencido antes
  de respuesta, sin borrar originales. **Qué falta:** Android/cierres/espacio/
  tamaño/dos dispositivos, restantes hallazgos, consolas/políticas reales y
  publicación coordinada autorizada. Tarjetas intactas; sin nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría permanecen abiertos.

## Continuación punto 1 — lote monetario local preparado (06/10/2026)

- Contexto exige comprobante HTTP genuino/cuenta/generación/cola y relee
  originales cifrados dentro de la cola de escritura. Personal/borrados/Caja
  juntos, versión exacta de servidor, originales conservados y otras filas.
- Reserva corta durante SQLite/lectura, mutaciones rechazadas antes de memoria,
  captura en cola espera; durante cifrado se reprepara con los datos nuevos.
  Fallo mantiene originales; lectura incierta congela escrituras sin borrar.
  Pantalla cerrada tras iniciar lote no recibe éxito, pero cuenta vigente sí
  refleja lo verificado. Reserva liberada incluso ante error.
- Guía: `docs/PRUEBAS_LOTE_IMPORTE_CAJA.md`. Código original y SQLite real con
  sustitutos de React/nativos; no Android. Regresión ddde38d por API nueva
  ausente, no fallo de usuarios publicados. Datos/claves/retención sin cambios.
- 120 pruebas SDK/reglas/HTTP/eventos bajo Node 22 real aprobadas, sin fallos,
  omisiones ni cancelaciones; 73 unitarias del servidor aprobadas. ADB vacío.
- Auditor que expiró recorría artefactos/cachés. Excluidos esos directorios,
  recorrido original probado (regresión ddde38d), sin omitir código propio ni
  ampliar el timeout. No se cuenta la pasada interrumpida como aprobada.
- TypeScript/ESLint y repetición final: 143 locales/8 auditores aprobados; una
  prueba ajena sin registrar conservada pero no incluida en commit. Tarjetas:
  dos suites específicas excluidas, no consideradas verificadas.
- **Qué sigue:** selección/petición/lote/recuperación visible, controles y
  lecturas visuales concurrentes, decisiones obsoletas/Pro vencido. **Qué falta:**
  Android/espacio/tamaño/dos dispositivos/otros conflictos y 61 hallazgos,
  consolas/políticas publicadas/publicación autorizada. Sin tarjeta/nativos/
  marca/instalable/OTA/despliegue. No botón ni petición monetarios en pantalla;
  contexto preparado no equivale a punto 1 ni auditoría terminados.

## Continuación punto 1 — cliente monetario preparado (06/10/2026)

- Fuentes frescas en cola auténtica, consulta exacta/limitada de historial v2;
  archivo pendiente con originales comprobados antes/después de HTTP, pareja
  actual válida, cuenta/generación/moneda. Respuesta genuina ligada a la misma
  cola; calcular/copiar campos de un ack no equivale a recibirlo.
- Cliente original y SDK/HTTP demo comprueban recuperación vigente sin otra
  escritura, Pro revocado, pantalla cerrada y cambios posteriores. No modifica
  dinero local ni confirma su guardado por recibir HTTP. Guía:
  `docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`. Regresión aee6653 del contrato nuevo
  falla por cliente/verificador ausente, no por bug de la app publicada.
- TypeScript/ESLint, 141 locales/8 auditores (una prueba ajena sin registrar), 73
  unitarias y 117 SDK/reglas/HTTP/eventos Node 22 reales aprobados; prueba
  directa final del cliente repetida. Sin omisiones/cancelaciones en servidor;
  tarjetas específicas excluidas del ámbito. ADB no encontró dispositivos.
- **Qué sigue:** lote financiero/mutaciones protegidas, selección humana y
  caminos para decisión obsoleta/Pro vencido. **Qué falta:** Android/tamaño/
  dos dispositivos/consolas/otros hallazgos/publicación coordinada autorizada.
  Ningún import del contexto/pantalla ni nuevo botón o envío habilitados.
  Mismo esquema documentado; no claves/retención/nativos/tarjetas/marca/entrega.
  No cerrar punto 1/auditoría ni prometer atomicidad servidor/teléfono.

## Continuación punto 1 — barrera del respaldo Personal/Caja (06/10/2026)

- Pendencia local pausa ambos respaldos/lecturas ordinarios, incluso tras reinicio;
  misma cola por UID y autorización anidada genuina para historial v2. Identidad,
  generación, archivo legible y verificación antes de escribir/tras esperas.
- Recepción/hidratación/contexto descartan sellos viejos. No rejuvenece otra
  respuesta/autorización. Espera el desenlace de escrituras en vuelo, no las deshace.
  Ajustes explica la pausa sin anunciar una confirmación vieja como respaldo actual.
- Regresión c24eff0 reproduce Personal S/80 contra Caja S/100 pese a pendencia.
  Pruebas nuevas aíslan red/almacén, ejecutan módulos/contexto originales; SDK
  real añade casos sin escrituras y respuesta vieja/otro dispositivo. Guía:
  `docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`. TypeScript/ESLint, 140 pruebas del
  ámbito/8 auditores (una ajena sin registrar), 73 unitarias y 112 SDK/reglas/
  HTTP/eventos bajo Node 22 real aprobados. Regresión anterior falla; adaptadores
  y contrato de sesión corregidos sin quitar aserciones, suite completa repetida.
- **Qué sigue:** pantalla, fuentes frescas dentro de cola, originales, mutaciones
  protegidas, petición, lote financiero y recuperación. **Qué falta:** resto de
  conflictos/hallazgos, Android/tamaño/consolas/publicación autorizada. Sin cierre
  de punto 1/auditoría ni atomicidad global. No nativos/tarjetas/marca/entrega.
  Dos suites específicas de tarjetas excluidas expresamente por el propietario.

## Continuación punto 1 — originales de importe locales (06/10/2026)

- Cuatro fuentes/elección/versiones conservadas en Cajas cifrado y archivo por
  cuenta. Normalizar no descarta, confirmada no vuelve a pendiente ni cambia
  originales. Hasta 50 revisiones/400.000 bytes totales, sin borrar anteriores.
- Validación común del servidor, propuesta local de dos mitades, respuesta exacta,
  fuentes/moneda/borrados/saldo y metadata conservados. Fusión/recuperación/subida
  Caja ordinarias no resuelven una pendiente; copias no viajan como respaldo.
- Regresión sintética contra b48e703 pierde las revisiones al normalizar. Archivo
  y cifrado originales comprobados con sustitutos Android, no teléfono real.
  Guía: `docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md`. TypeScript/ESLint,
  141 locales/8 auditores (una prueba ajena sin registrar), 73 unitarias
  Functions y 110 SDK/reglas/HTTP/eventos Node 22 reales aprobados. Sin pruebas
  omitidas/canceladas; lectores adaptados a módulos originales sin quitar aserciones.
- **Qué sigue:** botón/fuentes frescas, barrera Personal/subidas en vuelo,
  petición, lote financiero confirmado y recuperación. **Qué falta:** otras
  discrepancias, Android/tamaño/consolas/políticas publicadas y entrega autorizada.
  No conectado a pantalla, no publicado, no atomicidad servidor/celular ni auditoría
  cerrada. Tarjetas/nativos/marca sin cambios. Políticas local/web/Play preparadas.

## Continuación punto 1 — base de corrección monetaria en servidor (06/10/2026)

- Servicio limitado a aporte propio exacto Personal/Caja privada; cuatro
  originales/elección de monto-fecha, Pro/cuenta/moneda/fuentes y saldo comprobados.
  Una transacción remota guarda ambos registros, no otros; replay vigente no escribe.
- Historial antiguo/separado, duplicados, borrados, cierre, conversión, devolución,
  edición concurrente y datos no finitos protegidos. Sin colección/recibo nuevo ni
  nueva retención de servidor. Una decisión obsoleta no fuerza datos actuales.
- Regresión contra e10b2b6 usa SDK original: interrupción tras subir Caja deja
  S/100 en Caja y S/80 en Personal. Guía y límites:
  `docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`. Regresión falla como se esperaba;
  TypeScript/ESLint, 140 locales/8 auditores (una prueba ajena sin registrar),
  73 unitarias de Functions y 110 SDK/reglas/HTTP/eventos aprobados bajo Node 22
  real, sin pruebas omitidas ni canceladas. ADB sin dispositivos; no prueba Android.
- **Qué sigue:** integrar pantalla/confirmación, originales y decisión cifrados,
  guardado conjunto local, bloqueos y recuperación. **Qué falta:** otras discrepancias,
  Android, índices/consolas, políticas de la integración y publicación autorizada.
  No conectado a la app, no publicado ni desplegado, tarjetas/nativos sin cambios.
  No declara punto 1, auditoría o atomicidad servidor/celular resueltos.

## Continuación punto 1 — reconstrucción incompleta protegida (06/10/2026)

- Tres regresiones contra 37ff973 comprueban Caja cerrada reconstruida como
  abierta, fecha imposible propagada y reparto no iterable que rompía Cajas.
  Se conserva y señala, sin escribir dinero ni confirmar un plan viejo inseguro.
- Devolución sin ID/mitad requiere revisión. Recuperaciones positivas siguen;
  conserva identidad privada y no valida/repara movimientos compartidos ajenos.
  Explicaciones específicas, sin prometer dos copias cuando falta una mitad.
- Contexto/almacén originales con SQLite y SDK/Auth/Firestore locales reales;
  10.001 filas/1.001 Cajas sin ajuste. No Android físico ni medición de su rapidez.
- TypeScript/ESLint, 140 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 99 SDK/reglas/HTTP/eventos bajo Node 22 aprobados. La primera
  pasada detectó ámbito/identidad: se corrigió código, sin quitar aserciones.
  Guía: `docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`.
- **Qué sigue:** resolver desacuerdos monetarios locales/remotos, mitad/reparto
  sin prueba y elecciones obsoletas. **Qué falta:** Android, consolas, publicación
  coordinada/autorizada y comprobación posterior. ADB sin dispositivos; sin
  datos/retención/claves/reglas/servicios nuevos, nativos, tarjetas o publicación.
  Punto 1 y auditoría no cerrados; no es atomicidad global servidor/celular.

## Continuación punto 1 — nombres distintos de Caja (06/10/2026)

- Elección explícita solo ante empate de versión/nombre, no decide dinero.
  Guarda ambas versiones locales cifradas antes de red; transacción exige
  la fuente remota exacta y cambia solo nombre/versión, preservando demás datos.
- Reintento vigente idempotente; fallos/cambios de cuenta/fuente/Pro/respuesta
  no confirman éxito. Hasta 50 revisiones locales conservadas por cuenta,
  no subidas a Firebase. Políticas y compatibilidad preparadas, no publicadas.
- TypeScript/ESLint, 139 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 97 SDK/reglas/HTTP/eventos aprobados con Node 22 real.
  Regresión contra 482f2fd falla como se espera. Guía:
  `docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`.
- **Qué sigue:** punto 1 no cerrado: diferencias de dinero/mitad ausente/
  reparto no demostrable y elecciones obsoletas conservadas para revisar.
  **Qué falta:** puntos 2/3, Android visual/cierre/espacio/tamaño/dos dispositivos,
  consolas y publicación autorizada. ADB sin dispositivos; no se publicó nada,
  no se tocaron tarjetas ni código nativo. No es atomicidad global con Firebase.

## Continuación punto 1 — selección de enlace heredado (06/10/2026)

- Elección y confirmación unen una pareja existente con igual importe/fecha,
  sin cambiar dinero o campos. No se decide por coincidencia ni se fuerza una
  edición/borrado remoto no recibido; aviso específico conserva la revisión.
- Elegibilidad se vuelve a comprobar dentro del guardado conjunto original:
  IDs únicos, no borrados/cierre/otro enlace/espacio/devoluciones posteriores.
- TypeScript/ESLint, 138 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 92 SDK/reglas/HTTP/eventos aprobados. Regresión contra 410bbb3
  falla como se espera. Guía: `docs/PRUEBAS_ENLACE_HEREDADO.md`.
- **Punto 1 no cerrado:** siguen diferencias concurrentes, mitad ausente y
  reparto antiguo no demostrable. **Qué falta:** puntos 2/3, Android visual/
  cierre/espacio/tamaño/dos dispositivos y publicación autorizada. ADB sin
  dispositivo conectado; no se publicó nada ni se tocaron tarjetas.

## Continuación FINO-02 — copias incompletas al borrar cuenta (05/10/2026)

- S/100 copiados podían bloquear como deuda ficticia el borrado de cuenta.
  El índice sin destino también fallaba por las reglas SDK. Regresión cliente
  anterior reproduce el bloqueo; el servidor verifica primero sin escribir.
- Nueva limpieza limitada sin Pro, identidad reciente y UID autenticado:
  congela/limpia clones demostrados, conserva origen durante esa fase y barrera
  hasta Auth. Publicación real, invitados, diferencias o legado no demostrable
  no se descartan a ciegas. Recibos se comprueban antes de retirarlos.
- Reglas protegen la barrera e impiden índices arbitrarios/atrasados o nuevas
  copias legacy sin protocolo. Se mantienen creación/unión atómicas normales.
- Guía/evidencia: `docs/PRUEBAS_BORRADO_CAJAS_INCOMPLETAS.md`. Preparado en código,
  no publicado ni probado físicamente; no declara FINO-02 totalmente resuelto.
- TypeScript/ESLint, 136 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 89 SDK/reglas/HTTP/eventos aprobados con Node 22 real. Regresiones
  local/SDK contra 51a57d0 detectan la deuda ficticia; JWT atrasado no recrea índice.
- **Qué sigue:** pares heredados y conflictos. **Qué falta:** legado no
  demostrable, Android/cierres/dos dispositivos, tamaño/espacio lleno, consolas/
  índices y publicación coordinada. No se tocaron tarjetas ni código nativo.

## Continuación FINO-02 — no revivir una devolución anulada (05/10/2026)

- Falla confirmada: borrar el retorno no invalidaba su confirmación privada.
  Un reintento la recuperaba como vigente. Además, la recepción en el contexto
  no comprobaba si su ID ya se había borrado.
- Anulación y comprobante se actualizan conjuntamente; repetir la anulación
  no escribe ni exige Pro otra vez. El replay del retorno anulado se rechaza.
- Orden pendiente: retiro verificado, sin convertir errores de red en anulación.
  Borrado inmediato en referencia y guardia también al procesar la recepción.
- Pruebas y alcance: `docs/PRUEBAS_DEVOLUCION_ANULADA.md`. No abre Gratis para
  nuevas ediciones/borrados Pro ni declara corregidas todas las consultas de UI.
  TypeScript/ESLint, 130 pruebas locales y 8 auditores, 54 unitarias de Functions
  y 50 de SDK/reglas/HTTP/eventos aprobados; una prueba local es ajena no registrada.
- **Qué sigue:** conciliación/consultas atrasadas entre dispositivos.
  **Qué falta:** Android/dos teléfonos, producción y entrega coordinada.
  No se publicaron cambios ni se tocaron tarjetas.

## FINO-05 y continuación FINO-02 — Node 22 y borrado probado (05/10/2026)

- Node 22.23.3 real, portátil y SHA-256 oficial verificado. Se cargaron las
  Functions originales, con llamadas HTTP de SDK y eventos Auth/Firestore
  auténticos de sus emuladores, no envolturas de Auth sustituidas.
- Hallazgo adicional confirmado: el borrado de Familia intentaba consultar
  índices privados de otro miembro y fallaba por las reglas correctas de
  privacidad. La regresión reproduce el rechazo usando el cliente anterior.
- `finalizeLinkedSpaceDeletion`: identidad reciente, dueño, borrado preparado,
  movimientos ya retirados y ninguna exigencia Pro. Limpia solo índices del
  espacio; conserva los del propietario para reintentar y retira raíz/índice/
  membresía propios conjuntamente al final. Sin ampliar reglas privadas.
- Devolución con prueba vencida, historial de 405 documentos, espacios propios,
  limpieza Auth de permisos/comprobantes y limpieza de Telegram comprobados;
  otra cuenta se conserva. Pruebas y límites en
  `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`.
  TypeScript/ESLint, 129 pruebas locales y 8 auditores, 53 de Functions y 48
  de reglas/SDK/HTTP/eventos aprobados. Una prueba local es ajena no registrada.
- **Qué sigue:** recorrido Android y demás riesgos de datos. **Qué falta:**
  teléfono/dos dispositivos, Google real, configuración de producción y
  publicación coordinada. No se declara auditoría completa ni FINO-05 resuelto
  en producción; tarjetas siguen excluidas.

## FINO-02 — recuperación del saldo sin renovar Pro (05/10/2026)

- Nuevo servicio estrecho: S/100 aportados, S/60 gastados y S/40 recuperables
  permiten devolver S/40 a Personal sin Pro y cerrar el espacio sin deuda ficticia.
  No permite otras operaciones Pro ni tocar el aporte de otra cuenta.
- Transacción financiera con identificador persistente, orden local cifrada y
  confirmación privada. Reintentos no generan otro ingreso; se recupera aun
  después de borrar el grupo o salir de él, sin conceder acceso al grupo.
- Nuevas devoluciones SDK bloqueadas, también Pro. La copia histórica de una
  Caja privada solo admite su origen exacto y una fase de migración irreversible.
  El evento Auth limpia confirmaciones por UID; bloqueo de cuenta en eliminación.
- Pruebas y límites: `docs/PRUEBAS_DEVOLUCION_SIN_PRO.md`. La decisión de lo
  consumido y conservación del historial continúan vigentes.
  TypeScript/ESLint aprobados; 129 pruebas locales y 8 auditores, 49 de Functions
  y 40 del emulador Firestore. Una prueba local preexistente ajena sigue sin
  registrar en Git. La regresión nueva falla contra el manejador anterior.
- **Qué sigue:** FINO-05 (Node 22) y comprobar eliminación de cuenta de punta
  a punta. **Qué falta:** Android/dos cuentas/dispositivos, Functions/Auth reales,
  consolas, transición de versiones y publicación autorizada. FINO-02 preparado
  en estas rutas, no declarado resuelto en producción. Tarjetas excluidas.

## FINO-02 — consumido sin deuda ficticia, avance parcial (05/10/2026)

- El propietario autorizó considerar consumido el aporte gastado. Saldo cero
  permite cerrar/preparar borrado sin exigir devolución de dinero inexistente.
  El miembro con dinero ya consumido también puede salir. Devoluciones inválidas,
  saldos disponibles y borrado de aportes gastados siguen bloqueados.
- Se conserva Personal al cerrar: marcador e importe consumido, sin alterar
  saldo ni generar ingresos. Las ausencias de espacios cerrados no se purgan
  como huérfanos, también si la copia de destino llega antes que la Personal.
- Borrado de Caja privada corregido: no llama a Functions compartidas; prueba
  real del método, aporte intacto/gastado y par devuelto. Familia conserva los
  vínculos de cierre para limpieza posterior. Guía de pruebas y límites:
  `docs/PRUEBAS_APORTES_CONSUMIDOS.md`.
- Verificado: TypeScript, ESLint, 128 pruebas locales y 8 auditores; 42 de
  Functions y 31 del emulador. Una prueba local es preexistente ajena no registrada.
- **Qué sigue:** devolución del saldo aún disponible tras vencer Pro y Node 22.
  La excepción de devolución está preparada en la sección superior.
  **Qué falta:** completar esa excepción segura, teléfono/dos dispositivos,
  Functions reales/consolas y publicación coordinada. No se considera FINO-02
  completamente resuelto ni se migraron cuentas; tarjetas siguen excluidas.

## FINO-04 — protección Pro preparada, no publicada (05/10/2026)

- Personal/historial, Negocio y Cajas privadas requieren Pro también en reglas.
  Gratis mantiene su uso local; se conservan copias antiguas al bajar de plan.
  Consulta de permisos separada y limitada a metadatos, sin descargar fotos,
  movimientos ni perfil de la persona Gratis.
- Borrado Personal administrativo sin Pro, con identidad reciente, bloqueo y
  limpieza por lotes. Registro privado de prueba por UID y limpieza de Auth
  reintentable. La prueba no se reinicia borrando solo la copia financiera.
- Cajas distingue copia vacía de consulta fallida y no repara eliminando datos
  por un fallo de permisos/red. No se revisó toda su fusión en esta tanda.
- TypeScript, ESLint, 127 pruebas locales, 8 auditores, 41 de Functions y 26
  comprobaciones reales del emulador Firestore en verde.
  Una prueba local es preexistente ajena y continúa sin registrar en Git.
  Regresión contra reglas anteriores confirma acceso Gratis no autorizado.
- **Qué sigue:** decisión sobre aportes gastados (FINO-02), Node 22 y entrega
  coordinada de Functions/reglas/app/política. **Qué falta:** teléfono, llamadas
  reales de Functions/evento Auth y consolas. No se desplegó ni publicó nada;
  el cobro real no existe y tarjetas de crédito siguen excluidas. Este cambio
  no soluciona el bloqueo de devolución/cierre por aportes al vencer Pro.
  Detalle y límites: `docs/PRUEBAS_NUBE_PRO.md`.

## Auditoría FINO — avance de pérdida de datos (05/10/2026)

- FINO-01: cierre de sesión con copia local cifrada por UID, ya preparado y
  probado localmente; pendiente el recorrido Android con dos cuentas.
- FINO-03: unión por elemento/campo de la copia Personal, también al recibir
  y restaurar. Presupuestos, límites, categorías y calendario se conservan;
  borrados explícitos no reaparecen. Ver `docs/PRUEBAS_FUSION_PRO.md`.
- Validación actual: TypeScript, ESLint, 126 pruebas locales, 8 auditores,
  39 pruebas de Functions y 15 comprobaciones en el emulador Firestore.
  Las nuevas pruebas de fusión y reglas fallan contra la versión anterior.
  Una de las 126 pruebas es preexistente, ajena y no registrada en Git.
- No se publicó la app, las reglas ni Functions; no se usaron cuentas reales.
  Las reglas nuevas deben admitir `syncFormat: 2` antes de distribuir la app.
  El requisito Pro aún no está aplicado a todas las rutas del servidor.
- **Qué sigue:** FINO-04 (Pro en servidor), FINO-02 (decisión sobre aportes),
  comprobar Functions en Node 22 y preparar una entrega coordinada.
  **Qué falta:** dispositivo, consolas/producción y revisión independiente de
  Negocio/Cajas y del pago simultáneo del mismo mes desde dos teléfonos.

## Corregido y probado localmente

- CRI-01 a CRI-04: acceso a Familia/Caja, separación entre cuentas, borrado de
  cajas y protección de cuentas sin verificar/cierre de sesión.
- ALT-02 a ALT-05, ALT-07, ALT-09 a ALT-11 y ALT-13: montos, sincronización,
  errores de nube, importación, Cajas, Negocio y Telegram.
- ALT-08: historial Personal separado, compatible con el formato anterior,
  probado con dos clientes y 10.000 movimientos. Aún no está activado fuera
  del emulador.
- MED-01 a MED-17 y MED-21/MED-22: correcciones preparadas en código. La prueba
  Premium ahora se concede una sola vez desde una función del servidor.
- BAJ-01 a BAJ-11 y BAJ-13: corregidos en código. Un auditor automático revisa
  texto JSX, placeholders, etiquetas accesibles, alertas y mensajes breves en
  Inicio, bienvenida, Familia, Cajas, Caja compartida, calendario, Telegram,
  navegación y pantallas secundarias. Falta la comprobación física con TalkBack.

## Pendiente por decisión o trabajo externo

- ALT-01 y BAJ-12, tarjetas de crédito: excluidos por indicación del usuario.
- ALT-06: publicar de forma coordinada reglas y Cloud Functions.
- ALT-08: crear la nueva versión, probarla físicamente y migrar cuentas reales
  solo después de confirmar que ya no escriben versiones antiguas.
- ALT-12: rotar la clave de firma desde Google Play Console. Las contraseñas ya
  fueron retiradas del proyecto, pero la rotación no puede hacerse solo en código.
- MED-19, App Check: Firebase JS en React Native exige un proveedor de
  atestación nativo personalizado. Requiere código nativo, consola Firebase y
  un AAB nuevo; no se debe activar la exigencia antes de que la app entregue
  tokens válidos porque bloquearía a todos los usuarios.
- MED-18: el límite de 15 MB ya existe; falta medir en un teléfono de gama baja
  que el procesamiento de PDF no bloquee la interfaz.
- MED-20: la limpieza y menor captura del lector nativo están en código, pero
  requieren un AAB y prueba física para considerarlas terminadas.
- MED-23: ya existen pruebas reales del emulador de reglas y dos clientes. La
  prueba de la campana ya valida comportamiento y la del flujo inicial ejecuta
  las traducciones reales. Las pruebas de importación rápida y presupuesto
  exacto también ejecutan ya la lógica real; todavía quedan otras pruebas
  antiguas por reemplazar gradualmente.
- VER-01 y VER-04 a VER-06: verificar consola/producción, correo fuera de la
  app, avisos tras reiniciar y requisitos fiscales de Google Play.
- Pruebas físicas: dos teléfonos/dos cuentas, red intermitente, Drive/Dropbox,
  TalkBack, reinicio de Android e iPhone. Las pruebas automáticas no sustituyen
  estas comprobaciones.

## Siguiente orden

1. Sustituir más pruebas antiguas de texto por pruebas de comportamiento.
2. Revisar los pendientes de rendimiento y pruebas reales que aún puedan
   simularse localmente, sin tocar tarjetas de crédito.
3. Preparar una sola versión de prueba con los cambios nativos acumulados.
4. Con autorización previa: publicar servidor/reglas, instalar la versión en
   prueba cerrada y ejecutar la lista manual en dispositivos.
5. Migrar primero una cuenta de prueba y después decidir el despliegue general.

### Familia/Caja: invitaciones, disponibilidad y presentación (02/10/2026)

- El selector muestra tarjetas de Familia y Caja más compactas, con altura y
  espaciado consistentes; Inicio ya no muestra el estado “En control”.
- La barra inferior anima cada toque, resalta el botón + y muestra una sola vez
  la indicación para registrar el primer movimiento.
- El código de invitación se presenta en una hoja inferior compartida. La
  lectura nativa del portapapeles se retrasa hasta tocar “Copiar”, para que una
  versión instalada sin `ExpoClipboard` no falle al abrir Familia.
- “Unirme” en Cajas ahora introduce el código en la misma pantalla y abre la
  caja después de aceptar la invitación. Los errores de permisos ya no se
  confunden con una desconexión.
- Simulación de saldo ejecutada: S/ 500 − S/ 120 (Familia) − S/ 80 (Caja) +
  S/ 50 (devolución) = S/ 350. Seleccionar el origen no modifica el saldo.
- TypeScript, ESLint, 118 pruebas y 8 auditores aprobados. El emulador y las
  escrituras de Firebase aún deben verificarse; no se han publicado reglas,
  Functions ni app. Las reglas desplegadas podrían rechazar los campos nuevos
  `category` y `notes` hasta publicar `firestore.rules` con autorización.

### Auditoría externa — pruebas reales de importación y presupuesto (28/09/2026)

- La prueba de importación dejó de buscar una frase en el archivo fuente: ahora
  ejecuta el detector y comprueba el límite de 14 días, la exclusión desde el
  día 15 y que una coincidencia no pueda reutilizarse.
- La prueba del presupuesto también ejecuta la función usada por Inicio:
  confirma que 1.359 llega completo al formateador y que un monto oculto no se
  procesa ni se muestra.
- Los métodos de pago ahora se filtran mediante una función probada: Yape solo
  aparece en Perú/Bolivia, Plin solo en Perú, los métodos universales siguen en
  todos los países y una edición conserva métodos antiguos.
- La importación ya no recorre todo el historial por cada fila. Construye una
  sola vez un índice por fecha y consulta únicamente la ventana de 14 días; una
  prueba local indexa y busca entre 10.001 movimientos, incluido un cambio de
  mes.
- El catálogo mundial dejó de comprobarse leyendo su código como texto. La
  prueba carga los 250 países y 155 monedas reales, valida símbolos, decimales,
  asignaciones, orden y búsquedas por nombre, código, moneda y símbolo. Cambiar
  moneda conserva el país local y el país continúa fuera del respaldo en nube.
- La categoría de cada fila importada se decide ahora en una función probada:
  lo escrito en el archivo tiene prioridad, los sinónimos reales se reconocen,
  lo aprendido por la persona se conserva y una categoría de ingreso no puede
  entrar en un gasto. La confirmación de borrado mensual permanece vigilada en
  una prueba independiente.
- Una prueba sintética procesa 10.000 filas CSV, comprueba que ninguna se pierda
  ni cambie de tipo y limita el tiempo local a 3 segundos; en esta revisión
  terminó en menos de 100 ms. Esto no reemplaza la medición física de PDF.
- La carga de archivos usa ahora un límite de 15 MB con fronteras probadas. Un
  XLSX real de 10.000 filas se abre, convierte y analiza sin pérdidas; preparar
  el HTML de un PDF con 10.000 movimientos conserva la primera y última fila,
  escapa el texto y queda bajo el límite temporal local. La impresión nativa
  del PDF todavía necesita medirse en un teléfono de gama baja.
- Los avisos del calendario dejaron de comprobarse leyendo el efecto como
  texto. La prueba programa tres meses reales, cambia de PEN a USD, confirma
  que no se dupliquen, omite el mes pagado y cancela únicamente avisos del
  calendario sin retirar el aviso independiente de exportación.
- La misma prueba cubre permiso denegado, error nativo al programar y dos
  reprogramaciones simultáneas. Los fallos conservan su etapa y motivo, y la
  última moneda queda activa con tres avisos, no seis.
- El botón de prueba del calendario también se ejecuta: programa un aviso a
  tres segundos con título, texto, sonido y marca correctos; distingue permiso
  denegado de un error del servicio.
- La recuperación de exportaciones al abrir la app ya conserva el destino real
  (Drive, Dropbox, OneDrive o carpeta), el espacio Personal/Familia/Caja y la
  opción de gráficos. Solo confirma la ejecución después de guardar bien; si
  falla la red, permite reintentar en el próximo arranque sin entrar en bucle
  durante la misma sesión. Un mes sin movimientos termina limpiamente y no
  deja una pantalla invisible abierta.
- Se retiraron cálculos de gráficos y comparaciones mensuales que ya no usaba
  ninguna pantalla. El total mensual que antes estaba huérfano ahora alimenta
  realmente a Inicio y separa gastos, ingresos, envíos y devoluciones; así una
  transferencia interna no puede volver a entrar en los totales normales.
- TypeScript, ESLint, 117 pruebas y 8 auditores están aprobados para esta
  tanda. No se modificaron tarjetas de crédito ni se publicó ningún cambio.

### Cierre de validación local Android (28/09/2026)

- Se comprobó que el proyecto usa `package-lock.json`; las dependencias se
  reinstalaron con `npm ci` para respetar exactamente las versiones aprobadas y
  evitar las rutas profundas que producía una instalación local con pnpm.
- Gradle completó `:app:assembleDebug`: 755 tareas y `BUILD SUCCESSFUL`. El APK
  de comprobación quedó en `android/app/build/outputs/apk/debug/app-debug.apk`
  con SHA-256
  `18C5B16E7A7EB7046DCEB06BCF94A63E09912390F05A9EBC29A42CA8BC90058E`.
- Con esa instalación exacta volvieron a pasar TypeScript, ESLint, las 117
  pruebas, los 8 auditores y las 38 pruebas de Cloud Functions.
- Se retiraron las cachés y copias temporales creadas durante la compilación.
  `output/` se preservó sin cambios. No se modificaron tarjetas de crédito y no
  se publicó, instaló ni desplegó nada.
- No quedan hallazgos locales de código de la auditoría original fuera del
  módulo de tarjetas de crédito excluido por decisión del usuario. `npm audit`
  pasó de 90 avisos a 22 (20 moderados y 2 altos) al actualizar sin rupturas
  `fast-uri`, `undici` y React Navigation. Los restantes son transitivos de
  Expo Router, Metro, PostCSS y `xcode`; corregirlos automáticamente exige
  bajar Expo Router o saltar de Expo 54 a 57, por lo que se documentan para una
  migración controlada y no se aplicó `--force`.
- Siguen pendientes las comprobaciones físicas y acciones externas enumeradas:
  reglas/Functions, AAB de prueba, dos dispositivos y dos cuentas, red
  intermitente, Drive/Dropbox, TalkBack, reinicio, iPhone, App Check, rotación
  de firma, requisitos de Play y la migración posterior del historial.

## Continuación FINO-02 — pares heredados protegidos (06/10/2026)

- Falla comprobada en el efecto anterior: monto de Caja imponía otra cifra
  sobre Personal. Recuperación por IDs y guardado conjunto sustituyen la
  coincidencia débil y las escrituras separadas, conservando campos y borrados.
- Elección de monto/fecha únicamente con pareja inequívoca; sin saldo negativo
  ni ajustes parciales de devoluciones. Ausencia/consumo/duplicados/marca antigua
  conservan registros y piden revisión; no fabrican devolución.
- Pro comprueba en servidor los IDs afectados; copia remota no recibida bloquea
  la reconstrucción. No se otorga nube a Gratis ni se cambia el contrato nativo.
- Guía: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`. No afirma FINO-02 corregido
  globalmente ni en producción. **Qué sigue:** legado/diferencias local-nube.
  **Qué falta:** Android/cierres/espacio/tamaño/dos dispositivos, revisión del
  aviso, consolas y publicación coordinada. Tarjetas excluidas.
- TypeScript/ESLint, 137 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias Functions y 91 SDK/reglas/HTTP/eventos aprobados. Regresión
  contra 0f0588f confirma la sobrescritura antigua; ninguna cuenta real tocada.
