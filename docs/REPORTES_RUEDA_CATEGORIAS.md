# Rueda de categorías — 15/10/2026

Marca `15oct-rueda-categorias`. Se aplica la alternativa circular aprobada por
el propietario: iconos parejos, composición sin conectores y detalle central.

## Presentación y datos

Cada categoría conserva su icono, color y porcentaje real. Los botones miden
60 con hasta ocho categorías, 56 con más, o 48 en ancho reducido. Se reparten
por longitud de una órbita; si son muchas, el alto aumenta para conservar al
menos ocho puntos de separación. No se oculta ni agrupa ninguna categoría.

El anillo usa directamente los montos positivos y válidos del reporte. Se
retira el mínimo visual antiguo que ampliaba las categorías pequeñas; el
porcentaje impreso y la proporción del anillo proceden de los mismos valores.
Los huecos entre bloques son de hasta dos puntos y nunca superan el 12% de
la longitud del bloque, para no borrar uno pequeño por su separación.

El centro muestra el total, con el formateador y la moneda de Reportes.
Tocar un icono o bloque muestra nombre, monto y porcentaje de esa categoría;
el segundo toque devuelve el total. La porción seleccionada resalta y, si
es diminuta, un punto la localiza sin inventarle un ángulo mayor. La selección
es visual: no modifica movimientos ni presupuestos. Una categoría retirada
deja de mostrarse seleccionada. Cambiar tipo o mes remonta la rueda.

Los dos tipos usan `DonutChart`; el filtro original por tipo, mes y exclusión
de transferencias internas se conserva. El total inferior duplicado se retira.
Etiquetas accesibles anuncian monto, porcentaje y selección; menos de 1% y
más de 99% tienen descripción hablada en español, inglés y portugués.
Los colores de superficies y textos siguen la apariencia de la app.

## Comprobaciones y límites

`verificar-geometria-rosquilla.ts` ejecuta JSX y geometría originales con
React/Android adaptados: moneda/total, selección por icono y por bloque,
segundo toque, actualización de monto y categoría retirada; datos sin mutar,
proporciones sin inflación y 21 combinaciones de ancho/cantidad con botones
iguales, dentro del gráfico y sin choques. Comprueba 280/340/380 y
1/2/4/8/10/20/30 categorías. La revisión `1620792` falla por ausencia de total
central, no por una función importada faltante.

En emulator-5554 se comprueba Gastos con ocho categorías, selección de
Entretenimiento S/ 11 <1% y segundo toque al total S/ 1,382,858. Ingresos
muestra correctamente ausencia de datos; no se añaden movimientos para probar.
Al terminar queda abierto Reportes/Gastos. No se acepta ningún permiso,
no se cambia la apariencia, ni se alteran cuentas o datos financieros.

La captura de ventana falló con `FrameArrived timed out` y, al recuperar la
ventana, `window capture timed out`; se usó captura directa de Android.
TypeScript y ESLint completos, 222 pruebas y 8 auditores aprobados con tarjetas
excluidas por decisión vigente. No se acredita con estas pruebas TalkBack real,
letra grande, legibilidad central bajo 240 de ancho, teléfono físico o una
rueda de ingresos reales. No APK/AAB/OTA/Play ni cambios de nativo/servicios.
