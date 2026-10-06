# Coordinación de respaldo Personal/Caja (06/10/2026)

**Preparación limitada. El botón monetario, petición y guardado financiero
final todavía no se conectan. No publicar; punto 1/auditoría siguen abiertos.**

## Problema comprobado

Con una revisión local pendiente, el respaldo anterior todavía podía subir
Personal S/80 y conservar Caja S/100. Bloquear únicamente el uploader Caja no
protegía esa otra mitad. La regresión usa `cloudSync` original de c24eff0,
sin modificar el checkout, y falla al exigir que se detenga ese respaldo.

## Qué se prepara

- `privateBoxSync` coordina lecturas/subidas ordinarias de Personal y Caja
  mediante una cola por UID. Comprueba identidad, generación y datos locales
  legibles; lee/valida Cajas antes de consultar datos financieros.
- Una revisión monetaria pendiente del archivo cifrado pausa ambas copias,
  incluso al reiniciar o si el llamador conserva una Caja sin esa revisión.
  La consulta separada de permisos sigue permitida; Gratis no obtiene nube.
- El historial v2 reutiliza dentro del respaldo una autorización ordinaria
  auténtica, no adquiere otra cola sobre sí mismo. Su API directa también
  verifica la barrera. No acepta autorizaciones inventadas, de otra cuenta,
  de revisión o reutilizadas después de terminar su operación.
- Antes de escribir y tras cada espera se verifica la vigencia. Una revisión
  futura invalida respuestas antiguas desde que se solicita y espera el desenlace
  de subidas anteriores. **No cancela una escritura ya enviada ni la deshace.**
  Dentro de esa cola habrá que volver a obtener las fuentes reales antes de
  conservar/confirmar una elección; una foto previa de la nube no sirve.
- Respuestas ordinarias llevan solo un sello en memoria, no datos añadidos al
  archivo o a Firebase. Contexto e hidratación comprueban ese sello antes de
  aplicar perfil/moneda/movimientos. Cajas hace lo mismo antes de fusionar su
  descarga. Una respuesta vieja no se rejuvenece reutilizando el mismo objeto.
- Cambios A → B → A invalidan tareas de la primera sesión. Una lectura local
  fallida no se convierte en Cajas vacías. La restauración pendiente conserva
  una cuenta ya configurada; si no existe perfil válido, se detiene en vez de
  presentar esa situación como una cuenta nueva sin datos.
- Ajustes explica la pausa del respaldo en los tres idiomas y no lo marca
  actualizado si su confirmación ya no es vigente. No guarda nuevos datos,
  claves, retención o servicios: PLAYSTORE/políticas no cambian en esta tanda.

## Pruebas

```powershell
node pruebas/verificar-barrera-personal-caja.mjs
$env:FINO_TEST_BOX_BARRIER_BASELINE='c24eff0'
node pruebas/verificar-barrera-personal-caja.mjs
```

La segunda ejecución debe fallar por el respaldo anterior no bloqueado. Quitar
la variable para la ejecución normal. Los módulos originales de nube/cola/
historial se empaquetan; red y almacenamiento nativo se aíslan en esta prueba.
Se ejecutan también guardias originales del contexto, no una copia de su lógica.
Cubre pendencia al iniciar, archivo dañado/fallo de lectura, dos formatos,
subidas en vuelo antes/después de preparar escritura, cola entre Personal/Caja,
autorización anidada/inventada/cerrada, respuesta vieja, cambio de cuenta y
conservación de permisos del servidor. No es ejecución física ni Firebase real.

La suite SDK/Firestore local añade dos casos con credenciales/SDK auténticos:
revisión local pendiente no cambia documentos (incluidas sus fechas de escritura),
ni deja subir una Caja vieja; sello anterior se invalida y otro dispositivo
legítimo conserva su acceso. Su archivo nativo se sustituye; el cifrado/archivo
por cuenta originales fueron comprobados en la tanda previa. No hay prueba de
envío/confirmación monetaria completa desde la pantalla.

Las pruebas anteriores se adaptan para cargar los nuevos auxiliares; sus
aserciones financieras se conservan. La comprobación Premium manual ahora
ejecuta el auxiliar original en vez de depender de la forma exacta del `await`.
La prueba de barrera ejecuta además la escritura real que conserva ese permiso.

El propietario excluyó las tarjetas. `node pruebas/correr.mjs --sin-tarjetas`
no ejecuta sus dos suites específicas y lo indica expresamente: no las cuenta
como aprobadas. Un filtro también cuenta únicamente lo realmente ejecutado;
la ejecución normal sin opciones mantiene todas las suites. No se modificó ni
revisó el módulo de tarjetas. Compilación/lint generales siguen cubriendo el
proyecto compartido; no equivalen a auditar funciones de ese módulo.

## Qué sigue y qué falta

1. Conectar pantalla y selección con `withPrivateBoxMoneyReview`, obtener
   fuentes frescas **dentro** de la cola y conservar los originales/elección
   cifrados antes de red. Este coordinador todavía no se llama desde esa pantalla.
2. Petición monetaria preparada, respuesta propia vigente, lote local conjunto
   y recuperación después de interrupción. No permitir salidas ordinarias ni
   acciones incompatibles mientras se confirma. Las mutaciones locales aún
   requieren su propia comprobación de fuentes en esa integración.
3. Revisión/elección obsoleta, Pro vencido, mitad/reparto sin prueba, Android/
   espacio/tamaño/dos dispositivos, índices y consolas. No activar el botón ni
   declarar resuelto todo FINO-02 antes de comprobarlo. No existe atomicidad
   global entre servidor y teléfono por tener una cola local.
4. Publicación coordinada autorizada y comprobación posterior, más los otros
   hallazgos de la auditoría. Nativos, tarjetas y CODE_MARKER sin cambios;
   no instalable, OTA o despliegue de Firebase en esta tanda.

## Resultado

- TypeScript y ESLint de la app: aprobados después de los cambios finales.
- `node pruebas/correr.mjs --sin-tarjetas`: 140 pruebas y 8 auditores
  aprobados. Dos suites específicas de tarjetas excluidas por autorización
  del propietario y no contadas; una prueba ajena sigue sin registrar en Git
  (139 pruebas del ámbito en copia limpia).
- Functions con Node 22 real: 73 unitarias y 112 SDK/reglas/HTTP/eventos
  aprobados, sin omisiones ni cancelaciones en esa suite. La primera pasada
  completa detectó adaptadores antiguos incompletos y un tipo de error de
  cambio de sesión distinto; se actualizaron los adaptadores y se conservó
  el contrato `account-task-obsolete`, sin quitar ni ampliar sus aserciones.
  Se repitió todo el conjunto, incluidos 10.000 movimientos y dos clientes.
- Regresión c24eff0: fallo esperado porque el respaldo anterior confirma el
  guardado cuando debería detenerse ante una revisión pendiente. La ejecución
  normal nueva aprueba. Filtros del lanzador comprobados con resultado real
  de una prueba, no el total de toda la carpeta.
- ADB sin dispositivos. No prueba física/visual, no envío monetario nuevo desde
  pantalla, no producción consultada/modificada y no despliegue. Emuladores
  detenidos al concluir. Lo descrito en «Qué sigue y qué falta» permanece abierto.
