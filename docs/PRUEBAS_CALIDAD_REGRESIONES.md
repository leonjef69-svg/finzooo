# FINO-33 y comprobación de FINO-52 — 08/10/2026

## Qué se corrigió en las comprobaciones

- Tres suites ignoraban el hash escrito en `FINO_TEST_BASELINE` y siempre
  cargaban HEAD: seguridad-continuacion, fusion-pro y nube-pro-servidor.
  Ahora fijan una revisión completa al arrancar, la muestran y rechazan una
  revisión/ruta inválida o un archivo ausente, sin caer al disco actual.
- En fusion-pro, mergeTransactions y ordenarMovimientos también se leen de
  esa revisión. Antes el empaquetado tomaba ambos del disco actual, aunque
  el resto del manejador se hubiera cargado de Git.
- `1` sigue significando HEAD por compatibilidad; NO significa «antes del
  arreglo» después de registrar un commit. Para regresiones duraderas se
  debe indicar el hash anterior concreto, no `1`.
- Las salidas distinguen ejecución original con IO adaptado de contratos
  estáticos; no afirman que se probaron Android ni reglas publicadas.
- Los contratos históricos de claves en categorías y Negocio se describen
  como aislamiento de la sesión activa, NO como destrucción deseable de
  datos. Su presencia en una lista por sí sola no demuestra conservación.

## Evidencia ejecutada

`node pruebas/verificar-fuentes-regresion.mjs` ejecuta las declaraciones
originales de los tres lectores, solicitando `5cd7e09`, cuyo archivo de unión
realmente difiere de HEAD. La versión anterior de los lectores devuelve HEAD
y falla en LOS TRES, no por falta de una API. Regresión:

```powershell
$env:FINO_TEST_SOURCE_READER_BASELINE='d7cdbe8'
node pruebas/verificar-fuentes-regresion.mjs
Remove-Item Env:FINO_TEST_SOURCE_READER_BASELINE
```

Actual verde; tres lectores antiguos rojos. Comprueba también hash completo,
HEAD explícito, disco actual, rechazo de rutas/revisiones y archivo ausente.
No ejecuta Git checkout ni usa producción.

`node pruebas/verificar-cierre-sesion-conserva-real.mjs` conecta el cuerpo
original de logout con bóveda, almacenamiento y cifrado originales. Sustituye
AsyncStorage/SecureStore/Crypto nativos por adaptadores, Auth/Google/nube por
respuestas y limpieza común por clearAccountData real. No monta React ni
ejecuta servicios, avisos, PIN o módulo de tarjetas. Comprueba:

1. Gratis A → cerrar → B sin ningún dato de A → cerrar → A recupera todos
   los datos ficticios probados. Volver a B también conserva sus propios datos.
2. Cambio de movimiento aún pendiente al tocar Cerrar conservado, categorías,
   foto local, presupuesto, calendario y Negocio (productos y ventas incluidos).
3. Pro con respaldo y salida expresa sin respaldo conservan la copia local.
4. Fallo al escribir el manifiesto, fallo Auth y fallo de respaldo Pro dejan
   sesión/datos intactos, sin limpieza, y recuperan la captura/configuración.
5. Gratis no llama al respaldo de Firebase.

Regresión con `FINO_TEST_LOGOUT_FLOW_BASELINE=276cf53`: se carga SOLO el
logout histórico anterior a la copia por cuenta, con dependencias actuales.
Falla porque limpia sin confirmar ningún manifiesto de A. NO es una ejecución
integral del APK histórico ni una prueba de hardware. Actual verde.

Se mantienen las pruebas de bóveda/cifrado/interrupciones de cuenta-local y
las de guardado dañado. Esta prueba complementa, no reemplaza, sus escenarios.

Verificación completa de esta tanda: TypeScript/ESLint sin avisos,
161 pruebas y 8 auditores verdes con `--sin-tarjetas`. El diagnóstico abierto
de FINO-52 NO cuenta como aprobado. Una prueba local anterior del propietario
no está versionada ni se añade a este commit: se prevén 160 en Git limpio,
pero no se ejecutó un segundo checkout. No se repitió el servidor emulado
porque no cambiaron Functions, reglas ni app, solo pruebas y documentación.

## FINO-52 confirmado y NO corregido

La antigua prueba ids-dispositivos solo buscaba cadenas del código y daba
verde aunque se perdiera un movimiento. Se reemplaza por un diagnóstico que
ejecuta dos instancias independientes de utils/id.ts, su reserva del máximo
y la fusión original de movimientos/metas. Mismo reloj, azar DISTINTO, máximo
común mayor que las propuestas: ambos producen `7500099267393296`. La fusión
conserva uno de dos movimientos y una de dos metas. No toca datos guardados.

```powershell
node pruebas/diagnosticos/reproducir-colision-identificadores.mjs
```

Sale con código 1 deliberadamente mientras el caso falle. No se transforma
ese error en éxito ni se cuenta como protección aprobada: el corredor normal
avisa expresamente del pendiente. Cambiarle el nombre no corrige FINO-52.

No se instaló el prototipo de sumar un aleatorio a cada ID: no garantizaba
unicidad y podía agotar antes el espacio numérico. No quedaron helpers muertos
ni cambios en el generador o los movimientos. Las tarjetas siguen intactas.

La solución requiere identidad de creación estable y tratamiento explícito
de colisiones, compatibilidad de registros numéricos, referencias de aportes,
metas, calendario, borrados, importaciones y documentos remotos. No basta con
aumentar Math.random ni renumerar historiales/aportes a ciegas. Deben probarse
dos clientes, ediciones frente a creación, reintentos, copias antiguas y límites
antes de migrar/publicar. Sigue pendiente, sin alterar las tarjetas excluidas.

## Límites y continuación

Todavía hay pruebas estáticas válidas como contratos de estructura; NO son
evidencia de que la pantalla o los servicios funcionan en Android. No se
declara ejecutado cada recorrido ni toda la seguridad comprobada. También
permanecen los cuatro escenarios de navegación fuera del conteo hasta Android.

**Qué sigue:** corregir FINO-52 con compatibilidad y pruebas antes de publicar;
revalidar 15, 16, 34, 37, 47, 49 y 50. **Qué falta:** Android/dos dispositivos,
consolas, políticas/trámites, cobros y entrega autorizada. Tarjetas y Sentry
externo siguen excluidos; no se desplegó ni generó APK/AAB/OTA.
