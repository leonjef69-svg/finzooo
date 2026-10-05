# Consultas atrasadas de Familia y Cajas compartidas

05/10/2026. Continuación local de FINO-02 y del riesgo de mezcla entre cuentas.
Sin datos reales, despliegue, APK, OTA ni cambios en tarjetas de crédito.

## Problemas comprobados

- Familia publicaba la lista y autorizaba conciliación antes de terminar de
  cargar sus miembros. El número de consulta evitaba dos cargas superpuestas,
  pero no invalidaba una carga iniciada antes de modificar/borrar un movimiento.
  Sus `catch`/`finally` también actuaban al terminar consultas ya superadas.
- Las respuestas no comprobaban la generación local de la cuenta. La caché
  familiar podía guardar datos recién recibidos bajo la UID que estuviera
  conectada en ese momento, no necesariamente la que inició la consulta.
- Cajas compartidas aceptaba miembros de una Caja anterior después de cambiar
  de selección. Usaba movimientos de caché como fuente financiera y no retiraba
  en Personal la contraparte de una devolución eliminada remotamente.
- Una lista vacía al purgar un espacio cerrado no demuestra que su aporte se
  haya deshecho. Interpretarla así devolvería dinero ya consumido a Personal.

## Correcciones

- Pantallas separadas por UID y generación local. Listas, formularios y códigos
  se reinician al cambiar de sesión. `captureAccountTask` comprueba identidad,
  generación y vigencia antes de enviar y después de recibir cada operación.
  A → B → A no permite reaplicar una respuesta de la primera sesión de A.
- Familia invalida lecturas antes y después de modificar. Una actualización
  manual recibida durante el borrado tampoco queda como fuente vigente. Cada
  respuesta completa se publica en conjunto; errores/finalización obsoletos
  no alteran la nueva pantalla. La conciliación exige la revisión confirmada
  correspondiente y vuelve a evaluarse cuando termina una acción.
- La consulta familiar financiera exige documentos del servidor, sin escrituras
  pendientes, y verifica después que el espacio sigue abierto. Una falla de
  conexión/permisos conserva lo anterior; no interpreta ausencia como borrado.
- Cajas invalida la escucha antes de modificar y la reinicia al terminar. Cada
  escucha queda ligada a cuenta, sesión, Caja y revisión. Miembros y callbacks
  atrasados de una escucha retirada se descartan.
- Los metadatos distinguen caché/escrituras pendientes de una respuesta del
  servidor; se reciben también los cambios de metadatos al reconectar aunque
  los documentos no cambien. La caché se puede mostrar, pero no concilia dinero.
- Antes de conciliar Cajas se confirma que el espacio está abierto. Otra
  instantánea o modificación invalida una confirmación anterior en vuelo.
  Solo se eliminan contrapartes ausentes de la Caja activa confirmada y no
  liquidadas; no se toca otra Caja, Familia ni aportes marcados consumidos.
- Los observadores de cierre tampoco usan ausencia de caché ni escrituras
  pendientes como prueba de que el servidor haya cerrado/eliminado el espacio.

Ejemplo: aporte S/100, gasto S/60 y devolución S/40. Deshacer la devolución
desde otro dispositivo elimina su ingreso S/40 en Personal al conciliar una
fuente confirmada: en Cajas mediante la escucha; en Familia al actualizar o
volver a entrar. Cerrar un espacio con aporte S/100 totalmente gastado conserva
ese débito de Personal; no devuelve los S/100.

No se añaden documentos de usuario, permisos, claves locales ni formato de
archivo. No cambia la privacidad declarada en PLAYSTORE.md. Se añade una lectura
de la cabecera por consulta familiar financiera/instantánea confirmada de Caja
para distinguir cierre de borrado; no se cobra aquí, todo corre en emuladores.
Los historiales todavía requieren optimización por páginas para reducir costos.

## Pruebas y reproducción

`node pruebas/correr.mjs`: 131 pruebas y 8 auditores; una prueba preexistente
ajena sigue sin registrar en Git, por lo que un clon limpio cuenta 130.
TypeScript/ESLint aprobados. Functions conserva 54 pruebas unitarias aprobadas.
Reglas/SDK/HTTP/eventos: 54 pruebas aprobadas con Node 22.23.3 real; incluye
las nuevas fuentes y la limpieza completa de Telegram.

- `pruebas/verificar-consultas-espacios.mjs` ejecuta los callbacks/manejadores
  originales extraídos por el AST de TypeScript con respuestas diferidas. No
  monta la UI completa de React ni sustituye su lógica por una copia. Comprueba
  publicación completa, A → B/A, borrado durante consulta, catch/finally viejos,
  siguiente petición bloqueada, miembros de otra Caja, caché, instantáneas
  superpuestas, cierre y conservación de otros espacios/aportes consumidos.
- Regresión: `FINO_TEST_BASELINE=ffca3eb` y ejecutar esa prueba. Falló contra
  la versión anterior: se publicaba una lista parcial antes de cargar miembros.
- `functions/integration-tests/shared-sources.test.js` carga los auxiliares TS
  reales con los SDK reales, reglas, Auth/Firestore locales y cuentas ficticias.
  Comprueba caché sin conexión, reconexión solo con cambio de metadatos,
  eliminación remota, cierre/purga y lectura familiar obligatoria del servidor.
  Se sustituye la configuración del proyecto por `demo-fino-node22` y los
  módulos de plataforma Android/aleatoriedad por sustitutos ya existentes;
  no se sustituye Firestore, Auth ni los auxiliares de lectura/conciliación.
- La prueba previa de limpieza de Telegram observaba que había desaparecido la
  conexión y comprobaba inmediatamente otros documentos. Son pasos/lotes
  distintos del mismo evento: ahora espera todos los documentos esperados,
  conservando las comprobaciones de ausencia y de datos de otras cuentas.
- Se ejecuta con Node 22 mediante `scripts/verificar-servidor.mjs`, como indica
  `PRUEBAS_NODE22_BORRADO_CUENTA.md`. No necesita una sesión de producción.

## Qué sigue y qué falta

- Revisar descarga/subida de Cajas privadas, conservación de marcas al reparar
  Personal y conflictos de ediciones/borrados realmente simultáneos.
- Familia no tiene escucha en vivo de movimientos: un cambio remoto se recoge
  al actualizar/volver a entrar. Las consultas de múltiples colecciones no son
  una fotografía transaccional de todas las Familias. Esta tanda no declara
  resuelta toda la sincronización entre dispositivos.
- Probar en Android cambios de cuenta, navegación/retorno, conexión intermitente,
  cierre y dos teléfonos operando a la vez. Esta tanda no ejecutó la UI nativa.
- Revisar y publicar conjuntamente el servidor/reglas/app de las tandas
  anteriores, y comprobar consolas y datos declarados antes de entregar.
  Estos cambios no están en los teléfonos de los testers todavía.
