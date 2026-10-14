# Movimientos por día y hora registrada — 14/10/2026

Marca: 14oct-movimientos-por-dia. Solicitud aprobada: una fecha encima del
grupo de tarjetas, sin repetirla dentro, y horas procedentes del registro.

## Alcance

Inicio Personal e Historial conservan sus listas virtualizadas, filtros,
búsqueda, selección y destinos. Familia, Cajas privadas/compartidas, cajas
archivadas de consulta y el historial de Negocio usan el mismo encabezado.
El nombre del mes sigue el idioma; incluye año para distinguir búsquedas
entre años. No usa UTC para reagrupar la fecha guardada.

La presentación agrupa fechas descendentes y conserva el orden original
dentro de cada día. Los encabezados no son movimientos ni forman parte de
la selección, de los totales o de los límites de carga. No cambia campos
financieros almacenados, saldos ni permisos. Las exportaciones conservan
fecha/importe; el mismo formateador evita exportar una hora inventada.

Las transferencias resumidas se compactan dentro del día, no entre fechas
o meses. Se conservan enlaces, originales y las protecciones de borrado.
Seleccionar un resumen familiar/privado incluye solo sus enlaces de ese día,
no los de otros grupos. Una tarjeta que resume varias horas conocidas muestra
su intervalo real; el filtro de transferencias en Personal permite ver cada
registro. La devolución no se cuenta como ingreso/gasto normal.

## Hora: causa y corrección

Personal capturaba la hora al abrir Agregar, no al pulsar Guardar; también
asignaba esa hora al editar un movimiento antiguo/importado sin hora.
Ahora una creación manual toma el reloj al Guardar y una edición conserva
el valor anterior, incluida su ausencia. No se reconstruyen ni se sustituyen
horas históricas ya guardadas: no hay forma de conocer una hora perdida.

Familia/Cajas compartidas convertían un sello remoto ausente en Date.now(),
que era la hora de lectura. Ahora usan cero como ausencia; horaDe no dibuja
una hora para cero, negativos o instantes inválidos. Un sello confirmado
del servidor se conserva y se convierte a la hora local del dispositivo.
Caja privada usa su creadoEn guardado; Personal/Negocio su hora guardada.
AM/PM conserva precisión de minutos existente, no pretende dar segundos.
La exactitud del reloj del teléfono requiere que su hora esté bien ajustada.

No se agregan datos recogidos, campos remotos, permisos ni destinatarios:
PLAYSTORE no necesita una nueva declaración por este cambio de presentación.
No se activan Telegram/tarjetas ni se publica Firebase, APK/AAB/OTA/Play.

## Verificación

Dos suites nuevas ejecutan algoritmos, campos y JSX originales con
React/Android/callbacks adaptados. Incluyen encabezados, filtros/búsqueda,
edición sin hora, reloj distinto entre apertura y guardado, sello remoto,
selección de transferencias por día, archivo/Negocio y 10.000 movimientos.
Ambas fallan contra f7f8800 por comportamiento anterior: fecha dentro de
tarjeta y hora de apertura 08:05 en vez de guardado 08:12.

TypeScript y ESLint aprobados. Batería final: 216 pruebas y 8 auditores sin
tarjetas; una suite local ajena no versionada forma parte del conteo
(215 previstas en Git limpio, no otro checkout ejecutado).
Primera pasada: un contrato estático de selección familiar esperaba el
objeto viejo sin el grupo de día. Se actualizó ese contrato y la selección
original se comprobó en la suite nueva; repetición completa aprobada.
Android confirma Inicio e Historial con fechas externas, hora dentro y
filtro de gastos; entrar y cancelar selección no quita los encabezados.
Familia y Caja privada también muestran el día exterior y el intervalo de
su aporte/devolución guardados. Archivo, Negocio y Caja compartida se
comprobaron con JSX/callbacks adaptados; falta su recorrido físico completo.

Qué sigue/falta: prueba en teléfono físico/letra grande/TalkBack y registrar
personalmente con el reloj visible para contrastar dispositivo y servidor.
No se registraron ni eliminaron movimientos reales desde las herramientas.
El respaldo remoto rechazado sigue pendiente y separado de este cambio.
