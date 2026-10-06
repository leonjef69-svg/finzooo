# Guardado conjunto Personal/Cajas privadas — 05/10/2026

## Qué se encontró

- Personal, marcas de borrado y Cajas se escribían por separado, tras cambiar
  la pantalla. Una interrupción podía conservar solo una mitad de un aporte,
  edición, devolución, borrado, cierre o cambio de destino al compartir.
- Dos cifrados de la misma clave podían terminar en orden inverso. Una
  escritura antigua podía sustituir el valor nuevo, incluso después de un
  guardado inmediato. La regresión reproduce ese caso contra `4a97b15`.

## Qué se preparó

- `storage.ts` serializa las escrituras y confirma el lote cifrado mediante
  `AsyncStorage.multiSet`, leyendo exactamente lo enviado. El módulo Android
  instalado usa una transacción SQLite tanto en su implementación Java como
  en la alternativa Room/Kotlin. No se modificó el módulo ni una dependencia.
- Los guardados anteriores/tardíos de esas claves no pasan encima de un lote
  confirmado. Un intento rechazado antes de escribir conserva los cambios
  ordinarios pendientes. Cambiar de sesión invalida el trabajo viejo, también
  A → B → A; el cambio/archivo de cuenta comparte la cola local.
- Un fallo del lote no actualiza memoria, no cierra el formulario ni muestra
  éxito. Una respuesta perdida se comprueba por lectura, sin repetir dinero.
  Un resultado parcial o ilegible bloquea nuevas escrituras y conserva los
  originales, en vez de tratarlo como datos vacíos.
- El contexto prepara movimientos y marcas desde su referencia actual, sin
  depender de si React ya los dibujó. Comprueba ID, Caja, movimiento, dirección,
  monto, cuenta y fuente; impide guardar una mitad si falta su modificación
  enlazada. Conserva campos ajenos a la operación y lo consumido.
- Crear una Caja con aporte, agregar, editar aporte, devolver, borrar pares,
  cerrar y retirar/remapear la copia privada al compartir pasan por el lote.
  Los botones/formulario quedan bloqueados durante ese guardado. Una consulta
  Pro descartada durante el proceso se vuelve a pedir al terminar.
- Operaciones **enlazadas con Personal** se habilitan con esta garantía solo
  en Android. iOS/web muestran un aviso y no escriben dinero a medias; sus
  operaciones sin enlace Personal conservan el guardado de una sola clave.
  Falta implementar/comprobar un mecanismo equivalente para esas plataformas.
- Compartir se bloquea antes de enviar en plataformas sin garantía enlazada
  o si una mitad heredada no coincide. Una confirmación remota incierta o un
  fallo cerrando localmente una conversión ya completada deja la copia local
  conservada pero de solo lectura financiera; Compartir permite reintentar.
- La señal `Caja.sharingPending` se guarda cifrada ANTES de enviar la copia y
  sobrevive reinicio/cambio de cuenta. Se excluye de la huella financiera y
  de la copia Firebase, y una unión con nube no la quita. Sin Pro se puede
  reintentar una conversión así preparada; una Caja nueva sigue requiriendo Pro.
- El caso nuevo de creación compartida desde cero falló con las reglas previas:
  no dejaban consultar la inexistencia del destino antes de crearlo. El permiso
  nuevo solo confirma inexistencia para el prefijo propio, Pro y copia privada
  existente; no abre lectura de destinos ajenos/existentes ni un listado.
- No hay claves nuevas, cambio del archivo local por cuenta, datos recogidos
  nuevos ni envío adicional a Firebase. `PLAYSTORE.md` registra esa ausencia
  de cambio de datos; las políticas conservan la misma finalidad/retención.

Validación: 134 pruebas locales y 8 auditores (una prueba preexistente ajena no
registrada en Git: 133 en una copia limpia), TypeScript/ESLint aprobados; 57
unitarias de Functions y 73 comprobaciones SDK/reglas/HTTP/eventos bajo Node 22.
La prueba de Caja nueva falló antes del permiso limitado; la de escritura
atrasada falla contra `4a97b15`. La revisión no incluyó producción ni Android físico.

## Pruebas ejecutables

```powershell
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
node pruebas/correr.mjs
node pruebas/verificar-guardado-personal-cajas.mjs
```

La prueba usa el almacén, el contexto, las acciones de pantalla y los cálculos
reales. Simula traducción/teclado/React, la sesión y cifrado para controlar las
esperas. El cifrado real sigue cubierto por las pruebas existentes de seguridad.
El adaptador de almacenamiento ejecuta transacciones en **SQLite real** con
`node:sqlite`, no un mapa que considere atómicas escrituras separadas.
Requiere Node 22.13 o más nuevo por ese módulo; en este equipo se ejecutó con
Node 24. Las pruebas Firebase usaron el Node 22 portátil del proyecto.

Se comprueban escritura anterior lenta/nueva, lote frente a escrituras atrasadas,
rollback, respuesta perdida, cambio de generación, intento rechazado conservando
pendientes, cuenta/datos actuales, correspondencia entre ID y Caja, preservación
de campos y consumidos, y las acciones reales de crear/agregar/editar/devolver/
borrar/cerrar. La prueba anterior de compartir ejecuta también la acción de
pantalla y comprueba el orden frente al fallo de invitación.

Otro proceso termina entre los INSERT de Personal y Caja; al reabrir SQLite
quedan ambos originales. Si termina tras COMMIT, quedan ambos nuevos. Se
comprueba además que la dependencia Android instalada contiene los límites
de transacción usados. **No equivale a matar la app en un teléfono Android**.

Regresión: `FINO_TEST_BASELINE=4a97b15` solo para la prueba nueva. Falla por
`slow-old` sobreescribiendo `latest`; no reemplaza archivos de trabajo.

## Qué sigue y qué falta

- La cancelación comprobada que faltaba se prepara ahora en
  `PRUEBAS_CANCELACION_CAJA.md`: invalida el intento remoto antes de quitar
  la señal local y recupera un resultado ya publicado sin reabrirlo privado.
  No equivale a una entrega ni resuelve las otras limitaciones de esta guía.
- Sigue la limpieza de copias compartidas incompletas/índices al borrar cuenta.
- La reparación automática de pares **heredados** conserva su recorrido anterior;
  faltan su revisión indivisible y una resolución explícita de conflictos.
- Esto es atomicidad **local** de Cajas privadas, no una transacción conjunta
  Personal/Firestore de Familia o Cajas compartidas ni entre dos teléfonos.
- Faltan Android real/emulador, cierre forzado en las etapas de guardado,
  reinicio/cambio de cuenta, rendimiento con historiales grandes y espacio lleno.
  Revisar límites de lectura de AsyncStorage; no se declara tamaño ilimitado.
- En iOS/web faltan implementación y pruebas equivalentes antes de habilitar
  nuevamente operaciones enlazadas; no se supone que multiSet tenga el mismo
  contrato allí. Solo la parte Android se prepara para la entrega actual.
- No se desplegó Firebase, no se entregó APK/OTA y no se tocaron tarjetas ni
  código nativo. La entrega de todo lo anterior sigue requiriendo app, reglas
  y funciones coordinadas; Git no actualiza los teléfonos.
