# Enlace heredado elegido por el usuario — 06/10/2026

Avance del punto 1, no cierre del bloque ni de la auditoría. Sin app/Firebase
publicados, cambios nativos, tarjetas o nuevas claves de almacenamiento.

## Qué quedaba bloqueado

Dos mitades existentes, del mismo monto y fecha, no tenían IDs cruzados.
La versión 410bbb3 las conservaba, pero no ofrecía una forma de identificarlas.
Una coincidencia no prueba el vínculo: no se vuelve a unir automáticamente.

## Qué permite ahora

- Revisión de Caja con su nombre, movimiento, monto y fecha; lista de
  alternativas de Personal con descripción, monto, fecha y hora disponibles.
- El usuario elige y confirma que son la misma transferencia; cancelar no
  modifica datos. La afirmación procede del usuario, no de una prueba automática.
- Solo muestra aportes con igual monto/fecha y tipo correcto, sin ID cruzado,
  espacio incompatible, duplicación de ID, borrado, consumo marcado como cerrado,
  conversión pendiente o devoluciones posteriores. No enlaza con ingresos
  ordinarios, Familia, otro aporte ya enlazado ni otro espacio conocido.
- Une IDs en el guardado conjunto original, conservando montos, fechas, notas,
  imágenes y campos. No crea otro movimiento ni devuelve dinero.
- Recalcula la elegibilidad dentro del guardado real. Una pantalla/cuenta/
  copia/plan cambiado rechaza el aviso antiguo. Un fallo conserva la revisión.
- Alternativas de 20 en 20, sin imponer una primera opción, sin exigir Pro
  para corregir datos locales; la comprobación Pro de IDs remotos se mantiene.
- Un cambio remoto todavía no recibido muestra un aviso persistente específico,
  conserva la revisión y no se oculta bajo un error genérico de guardado.
- No fuerza una edición o borrado remoto no recibido, ni resuelve por esta vía
  una mitad desaparecida, aportes liquidados o un reparto de devolución dudoso.

## Comprobaciones

`pruebas/verificar-enlace-heredado-explicito.mjs` ejecuta auxiliares y acción
de confirmación originales: candidatos múltiples, cancelación, coincidencias
incorrectas, duplicados, borrados, cierres, devoluciones, fuente obsoleta,
cambio de cuenta/plan y fallo del guardado. No ejecuta la interfaz nativa.

La regresión usa Git sin cambiar el proyecto:

```powershell
$env:FINO_TEST_LINK_BASELINE='410bbb3'
node pruebas/verificar-enlace-heredado-explicito.mjs
```

Falla como se espera: la acción anterior rechaza la elección explícita. La
versión nueva pasa. No dejar esa variable activa al ejecutar la suite normal.

La prueba de pares original amplía su matriz del contexto/almacén sobre SQLite
real: selección de enlace, rollback, respuesta perdida y fuente remota. El
SDK real emulado comprueba la lectura propia y escritura de Caja con el ID
elegido, sin otro movimiento, y rechaza consultar otra UID.

## Qué sigue y qué falta

- **Punto 1 sigue abierto:** diferencias local/nube con ediciones concurrentes,
  mitades desaparecidas y repartos antiguos no comprobables. Conservar no se
  presenta como resolver esas diferencias.
- **Punto 2 pendiente:** Android, revisión visual, cierres/reinicios, conexión
  inestable, espacio lleno, datos grandes y dos cuentas/dispositivos.
  ADB no mostró dispositivos conectados al comprobar el entorno.
- **Punto 3 pendiente:** autorización/publicación coordinada, consolas y
  verificación posterior. Git no actualiza la app instalada.
- No es una transacción conjunta con Firebase ni resuelve doble gasto offline.
  iOS/web siguen sin habilitar operaciones enlazadas sin contrato equivalente.

## Resultado de esta tanda

TypeScript/ESLint aprobados; 138 pruebas locales y 8 auditores (una prueba
ajena sin registrar, 137 en copia limpia), 63 unitarias Functions y 92 pruebas
de SDK/reglas/HTTP/eventos con Node 22 real. La ejecución final aprobó sin
canceladas ni omitidas. La regresión contra 410bbb3 falló por el rechazo
anterior de la selección explícita. Sin dispositivos Android conectados,
sin APK/OTA o despliegue, sin cuentas reales consultadas.
