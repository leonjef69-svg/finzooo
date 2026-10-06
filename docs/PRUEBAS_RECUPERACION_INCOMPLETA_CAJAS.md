# Recuperación incompleta de Personal/Cajas — 06/10/2026

Avance defensivo del punto 1, no conciliación completa entre dispositivos.
Preparado en código: no se instaló ni publicó app/Firebase. Sin tarjetas,
código nativo, claves nuevas, datos recogidos ni cambios de retención.

## Fallos comprobados y cambio

1. Una Caja marcada como borrada/cerrada, con sus filas antiguas aún presentes,
   podía reconstruir una mitad ausente de Personal como transferencia abierta.
   Ahora la marca o confirmación de conversión impide esa reconstrucción. Se
   conserva el archivo original; no se reabre, borra ni devuelve dinero.
2. Una fecha inexistente o un monto con una fracción inferior a la escala
   interna podía propagarse al reconstruir Personal. Se comprueban fecha real,
   valor positivo/finito y escala interna hasta tres decimales, con tolerancia
   únicamente al error numérico de representación. No redondea una cuarta cifra
   para reparar. Esto no sustituye validar la moneda de cada pantalla.
3. Un reparto de devolución que no era una lista podía provocar una excepción
   al abrir Cajas. Filas ilegibles, enlaces de tipo incorrecto, marcas de cierre
   inválidas, consumo superior al aporte, repartos duplicados o con montos
   inválidos se conservan para revisar, sin publicar un ajuste parcial.
4. Una devolución sin ID y sin mitad Personal enlazada requería revisión, pero
   podía quedar sin detectar. Ahora se señala; un ID cruzado exacto válido sí
   conserva la recuperación ya comprobada, sin crear otra devolución.

La explicación distingue datos inválidos de Caja cerrada/convertida/liquidada.
No ofrece botones de elegir dinero para esos casos. Mantiene la identidad
privada disponible al señalar el problema. El aviso habla de registros
disponibles: no promete dos copias cuando falta una mitad.

La validación se limita a referencias privadas conocidas, antiguas o sin
destino identificable; no intenta reparar ni validar el contenido del historial
de una Caja compartida ajena a ese archivo. La identidad ilegible se rechaza
porque no permite distinguir una colisión. Los destinos se indexan una vez,
sin buscar todas las Cajas por cada fila de Personal.

La validación se recalcula dentro del guardado conjunto original. Un plan
antiguo que proponga reconstruir datos inválidos no escribe ninguna clave ni
confirma cambios en pantalla. Fuente válida abierta con ID exacto, elección
de monto/fecha e identificación manual de pareja siguen funcionando.

## Evidencia y regresión

`pruebas/verificar-recuperacion-incompleta-cajas.mjs` ejecuta módulos y
manejadores originales. Comprueba el intento de recuperación al entrar,
cierres, conversión, montos/fechas inválidos, filas ilegibles, reparto dañado,
ID faltante, preservación de originales y exclusión de datos compartidos.
Ejecuta también el contexto/almacén originales sobre SQLite real: un plan
viejo no escribe Personal/Caja/marcas ni publica éxito. Auth/React/cifrado son
sustituidos en esa parte; no equivale a ejecutar Android ni su cifrado nativo.

Las pruebas de reparación previa y enlace heredado siguen aprobando sus
recuperaciones positivas. Los casos de aportes consumidos y nube Pro mantienen
sus comprobaciones, sin borrar aserciones ni modificar esos dos archivos.

`functions/integration-tests/private-boxes.test.js` lee fuentes confirmadas
con SDK/Auth/Firestore locales reales: Caja cerrada residual, reparto inválido
y fecha imposible no reconstruyen Personal ni cambian la copia remota.

```powershell
$env:FINO_TEST_INCOMPLETE_BASELINE='37ff973'
node pruebas/verificar-recuperacion-incompleta-cajas.mjs
```

Falla como se espera contra el código anterior: el manejador de pantalla sí
intentaba reconstruir la Caja cerrada. Código nuevo aprobado. Quitar esa
variable antes de la suite normal. No modifica archivos para la regresión.

Con la misma variable de baseline, `FINO_TEST_INCOMPLETE_CASE='allocations'`
reproduce la excepción anterior `items is not iterable`; `='date'` reproduce
el intento de reconstruir una fecha imposible. Los tres modos pasan con el
código nuevo. La prueba incluye además 10.001 filas y 1.001 Cajas conservadas,
sin ajustes; no es una medición de velocidad Android.

## Qué sigue y qué falta

- **Punto 1 sigue abierto:** resolver importes distintos local/nube de forma
  explícita y recuperable, mitades/repartos sin prueba y elecciones de nombre
  pendientes que quedaron obsoletas. Estas guardias conservan y bloquean; no
  reparan por aproximación los datos antiguos ni resuelven doble gasto offline.
- **Punto 2 pendiente:** Android/visual, cierres/reinicios, disco lleno,
  tamaños grandes y dos cuentas/dispositivos. ADB no detectó dispositivos.
- **Punto 3 pendiente:** consolas, publicación autorizada y coordinada de todo
  el conjunto, políticas reales y verificación posterior. Git no actualiza la
  app instalada. CODE_MARKER sin cambios.
- No es atomicidad global entre servidor/celular. No cambia reglas, Functions
  de producción, permisos ni la obligación Pro para consultar la nube.

## Resultado

TypeScript/ESLint aprobados, 140 pruebas locales y 8 auditores (una prueba
ajena preexistente sin registrar: 139 en copia limpia), 63 unitarias Functions
y 99 de SDK/reglas/HTTP/eventos con Node 22 real. Sin fallos, canceladas u
omitidas en la repetición completa. La primera pasada detectó que la validación
incluía registros compartidos y que perdía la identidad privada disponible;
se ajustó el código, sin retirar comprobaciones. Las tres regresiones contra
37ff973 fallan como se espera y el código nuevo pasa. ADB sin dispositivos.
Sin app/OTA/Firebase publicados, sin datos reales consultados o modificados.
