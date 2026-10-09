# FINO-15 — consultas sin bucle, refuerzo parcial

Preparado el 09/10/2026. No se ha publicado ni desplegado.

## Fallo confirmado y arreglo

El efecto de recepción en `contexts/AppDataContext.tsx` dependía de
`deletedGoalIds`, pero cada descarga guardaba otra lista de metas borradas
aunque tuviera exactamente el mismo contenido. Una cuenta Pro sin novedades
creaba otra referencia, volvía a descargar y repetía el ciclo indefinidamente.
También recreaba movimientos y metas iguales, disparando guardados locales
y la subida automática posterior sin cambios reales.

Los dos caminos de recepción —al entrar y al volver al frente— ahora conservan
la referencia cuando las listas fusionadas o las marcas de borrado son iguales.
Una novedad auténtica, una edición o un borrado siguen aplicándose. No se
cambian límites del historial, IDs, montos, moneda, permisos ni reglas financieras.

## Evidencia reproducible

`node pruebas/verificar-consultas-estables-real.mjs`

La suite extrae por AST y ejecuta el efecto, el callback de reanudación y los
setters de `AppDataContext.tsx`, junto con las fusiones y el orden originales.
No reproduce la lógica de sincronización en una copia de prueba. Hooks, Auth
y red son adaptadores; la comparación de referencias utiliza `Object.is`.

Regresión contra `b6cccc09e568788119ae7b4008bcf37c2fed02cf`:

`$env:FINO_TEST_BASELINE='b6cccc0'; node pruebas/verificar-consultas-estables-real.mjs`

- Versión anterior: roja. La cuenta sin novedades hizo 11 solicitudes en 20
  ciclos de comprobación; se esperaba una.
- Versión preparada: verde. La cuenta sin novedades hace una consulta y no
  provoca otro guardado. Esto también se comprueba con 10.000 movimientos.
- Nuevos registros, edición remota posterior, metas y marcas de borrado sí
  se aplican; un cambio real de marcas admite la siguiente consulta y se estabiliza.
- Las altas locales llegadas durante la espera permanecen. Una meta borrada
  localmente no resucita al llegar la copia anterior.
- Respuesta de una sesión anterior, una consulta retirada o una revisión que
  no admite esa respuesta no modifica las listas.
- Volver al frente consulta una vez; recibir lo mismo no arranca otro ciclo.
- Sin Pro, sin cuenta o sin configuración preparada, ese efecto no consulta.

La prueba no factura operaciones, no ejecuta React Native/Hermes y no acredita
SDK/reglas publicados, Android, rendimiento físico ni ausencia de todo abuso.

## Lecturas de servidor después de comprobar permisos

changePersonalContribution, manageLinkedSpace y leaveLinkedSpace verifican
ahora permisos/espacio/operación antes de descargar el libro completo.
Deshacer una devolución y recuperar una confirmación de anulación no lo necesitan;
reintentar prepare-delete confirmado tampoco lo descarga.

Una salida propia ficticia sin membresía ya no permite leer todo un espacio
conocido. Tres consultas acotadas de una fila verifican referencias propias
pendientes; si no quedan, retorna sin cambios. Un exmiembro con anonimización
interrumpida sí puede reintentar. No añade campos, no requiere Pro para salir y
mantiene cálculos financieros, lecturas antes de escribir y cantidades originales.

El permiso Pro del dueño se confirma dentro de la misma transacción,
con máscara de isPremium/premiumTrialStartedAt/accountDeletionPending. No
descarga movimientos, fotos ni perfil del dueño para leer ese permiso.
La comprobación de pertenencia del aporte precede esa lectura; tester/prueba
también se leen transaccionalmente. SDK real comprueba la máscara solicitada.

verificar-consultas-autorizadas-real.mjs ejecuta envolturas originales con SDK
adaptado; baseline b6cccc0 roja por lectura antes de rechazar. La suite
functions/emulator-tests/query-authorization.test.js comprueba esas envolturas
con transacciones Firestore reales locales: 13 casos, cero omisiones, verdes
tras corregir un monto ficticio cero inválido por gasto/ingreso de S/1 compensados.
La protección que rechaza cero no se retiró ni cambió. La regresión real contra
b6cccc0 confirma las lecturas anteriores antes del rechazo.

Esto no cuenta operaciones dependientes de reglas, no impone cupo total de
llamadas ni mide precios. El participante legítimo sigue necesitando el libro
completo para comprobar saldo real. No son límites de factura ni App Check.

## Costos que siguen abiertos

FINO-15 no queda cerrado globalmente por este arreglo:

1. `utils/cloudHistoryV2.ts` conserva el checkpoint únicamente en memoria.
   Cada arranque frío restaura toda la subcolección antes de pasar a consultas
   incrementales. Persistir solo una fecha sería inseguro: exige copia completa
   y checkpoint atómicos por UID, conservación de lápidas, empates del servidor,
   sesión, errores y compatibilidad con la bóveda cifrada. No se hizo ese cambio.
2. Familia descarga los movimientos completos de todos los espacios al enfocar
   la pantalla (`screens/Family.tsx` y `utils/cloudFamilia.ts`). Cajas compartidas
   escucha el historial completo (`utils/cloudCajasCompartidas.ts`). El límite
   visual de 60 filas no limita la descarga. No se puede cortar la consulta sin
   rediseñar los totales, conciliación, aportes y devoluciones, porque requiere
   el libro completo para no inventar saldos ni considerar ausente un aporte.
3. Funciones que cambian aportes o devuelven dinero leen el libro para validar
   saldo real. Algunas llamadas tienen `maxInstances`; no todas tienen cupo por
   usuario. Ese máximo controla instancias concurrentes, no una factura máxima
   ni la cantidad total de llamadas. [Gestión de funciones](https://firebase.google.com/docs/functions/manage-functions?gen=2nd).
4. `utils/firebase.ts` aún no inicializa App Check. Activar su exigencia ahora
   rechazaría clientes sin token válido; requiere proveedor compatible,
   incorporación al cliente, prueba Android/firma, métricas y consola antes
   de exigirlo. App Check no elimina todas las formas de abuso ni sustituye
   autorización/límites. [App Check](https://firebase.google.com/docs/app-check).

Firestore puede cobrar documentos, determinadas entradas de índices, accesos
dependientes de reglas, almacenamiento y transferencia. El menor número de
llamadas observado aquí no es un precio final ni ahorro porcentual garantizado.
[Facturación de Firestore](https://firebase.google.com/docs/firestore/pricing).

## Qué sigue y qué falta

Sigue diseñar y probar checkpoint/copia coherentes y consultas compartidas
incrementales con cálculos financieros completos, además de evaluar límites
de abuso por operación sin impedir devoluciones, borrado o salida de usuarios.
Falta comprobar métricas de uso real, región/tarifas/cuotas, App Check y reglas
efectivamente desplegados en consola, y recorridos Android con dos dispositivos.
El código preparado y Git no alteran por sí solos la app instalada o Firebase.
Tarjetas de crédito y Sentry permanecen fuera de esta revisión.
