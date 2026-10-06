# Diferencias de dinero — preparación del servidor (06/10/2026)

**Solo la parte del servidor. No está conectada a la pantalla ni al guardado
local. No distribuir ni desplegar todavía. Punto 1 y auditoría siguen abiertos.**

## Qué prepara

`resolvePrivateBoxMoney` corrige monto/fecha de un aporte Personal → Caja
privada, con IDs cruzados exactos, por elección explícita entre valores ya
existentes en sus cuatro originales (Personal/Caja, celular/nube).

- Identidad verificada de Auth y comprobación de cuenta real/no deshabilitada;
  UID siempre del servidor, nunca de una ruta elegida por la petición.
- Pro vigente comprobado dentro de la transacción; cuenta configurada, moneda
  igual y ninguna eliminación en curso. No abre copias Gratis ni crea un respaldo.
- Todos los originales deben conservar iguales enlaces y demás campos salvo
  monto/fecha/fecha de edición. Diferencias de notas, categoría, vínculo,
  liquidación, devoluciones y fuente ausente no se reemplazan por inferencia.
- Comprueba de nuevo ambas fuentes y la Caja en servidor. Una edición, marca
  de borrado, conversión o devolución posterior rechaza la decisión obsoleta.
- Historial antiguo: actualiza solo la fila exacta de su lista. Historial
  separado: actualiza el documento exacto con `syncAt`; una consulta acotada
  por un campo de enlace (máximo dos documentos) detecta duplicados. Comprobar
  sus índices reales antes de publicar: el emulador no acredita esa configuración.
- Saldo de esa Caja en unidades enteras según su moneda, sin perder fracciones
  por sumar flotantes. La elección no puede producir saldo negativo.
- Ambos registros remotos se actualizan en una sola transacción. Conserva los
  demás movimientos, metadatos raíz, marcadores, otras Cajas e historial.
- Repetir una elección ya vigente confirma sin otra escritura. Si otra edición
  cambió el resultado después, se rechaza, no se vuelve a imponer el dato viejo.
- Petición hasta 150.000 bytes, respuesta mínima ligada a IDs/valor/versiones,
  cinco instancias y plazo de 120 segundos. No es un tope global de factura ni
  reemplaza medidas generales contra abuso.

La validación y selección son puras y compartibles con la app en
`private-box-money-shared.js/.d.ts`; no eligen por sí mismas. `money-units`
extrae sin cambiar el cálculo que ya usaba la devolución del servidor, para
evitar dos versiones de la escala monetaria. Prueba compara el catálogo real.

No almacena otra colección ni un recibo nuevo: modifica únicamente los
registros existentes y sus fechas de edición. Requiere originales conservados
en el celular, decisión persistente y comprobación de respuesta antes de
habilitarlo allí. Esa integración **todavía falta**.

## Comprobaciones preparadas

Las diez pruebas unitarias ejecutan los auxiliares y función originales con
una transacción simulada: cuatro fuentes, interrupción, reintento, historial
separado, edición/duplicados/devoluciones/cierre/borrado, concurrencia, permisos,
moneda, fechas inválidas y tamaño. No equivalen a Firestore real ni Android.

La prueba de SDK/HTTP/Firestore local verifica resultado conjunto, reintento,
dos decisiones concurrentes, cambio de fuente, saldo negativo, devolución,
historial separado, duplicados/borrados, interrupción tras preparar el primer
`update`, cuenta ajena/eliminada, Pro y peticiones inválidas. La interrupción
usa la transacción Admin real con una excepción inyectada solo en el test.
No modifica el servicio con una opción de prueba.

## Regresión preparada

Con Node 22 y los requisitos de `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`:

```powershell
$env:FINO_TEST_MONEY_BASELINE='e10b2b6'
node scripts/verificar-servidor.mjs
```

El modo de regresión ejecuta solo la primera operación. Construye el cliente
original desde Git sin cambiar archivos: interrumpir el recorrido anterior
tras subir Caja permite dejar Caja S/100 y Personal S/80. No afirma que todos
los usuarios hayan visto esa diferencia. La corrección nueva debe confirmar
las dos mitades. Quitar la variable para la suite completa normal.

## Qué sigue y qué falta

1. **Sigue la integración:** obtener las fuentes confirmadas sin usar caché,
   mostrar valores/fechas y confirmar sin decidir automáticamente; guardar
   originales y elección cifrados por cuenta **antes** de enviar la petición.
2. Guardado conjunto local, bloqueo de acciones/subidas incompatibles mientras
   está pendiente, recepción propia verificada, recuperación tras reinicio,
   Pro vencido/cambio de cuenta/disco/red y decisiones obsoletas. La transacción
   remota sola no promete atomicidad servidor/celular ni resuelve todos esos casos.
3. Actualizar políticas si se añaden esas copias locales, comprobar rollback
   compatible, Android/visual, dos dispositivos, consolas y publicación coordinada
   autorizada. CODE_MARKER y app instalada sin cambios.
4. Mitades/repartos no demostrables, otros tipos de dinero y gasto concurrente
   desconectado siguen fuera de esta corrección limitada. Tarjetas excluidas.

## Resultado de ejecución

- TypeScript (`npx tsc --noEmit`) y ESLint de las carpetas exigidas: aprobados.
- `node pruebas/correr.mjs`: 140 pruebas locales y 8 auditores aprobados. Una
  prueba de resumen de gráficos pertenece a cambios ajenos sin registrar;
  se conservó sin incorporarla al cambio: la copia limpia tiene 139.
- Functions con Node 22 real: 73 pruebas unitarias aprobadas (63 anteriores
  y 10 nuevas); ninguna omitida ni cancelada.
- Suite completa de Auth/Firestore/Functions locales, SDK, reglas, HTTP y
  eventos: 110 pruebas aprobadas (99 anteriores y 11 contadas en la nueva
  integración), ninguna omitida ni cancelada. Incluye rechazo de valores
  no finitos sin convertirlos en datos vacíos ni alterar las dos fuentes.
- Regresión `FINO_TEST_MONEY_BASELINE=e10b2b6`: salida fallida **esperada**.
  El cliente SDK anterior deja Caja S/100 y Personal S/80; exigir Personal
  S/100 reproduce el fallo. La suite normal nueva guarda ambas juntas.
- La primera pasada local detectó el import extraído en la prueba de
  devolución; se conectó al módulo puro original, sin eliminar ni debilitar
  sus comprobaciones del catálogo monetario.
- Los emuladores se cerraron correctamente. No se consultó ni modificó
  producción. ADB no mostró dispositivos: no acredita ejecución en Android,
  rapidez real, disco lleno ni apariencia de la pantalla. La integración y
  las verificaciones enumeradas arriba siguen pendientes.
