# Rueda de categorías — 15/10/2026

Marca vigente `15oct-bloques-conectados`. El propietario corrigió la propuesta
anterior: se amplían los bloques pequeños y se restituyen sus conexiones.
Todas las categorías con movimientos conservan bloque, icono y línea propios.

## Presentación y datos

Cada categoría conserva su icono, color y porcentaje real. Los botones miden
60 con hasta ocho categorías, 56 con más, o 48 en ancho reducido. Se reparten
por longitud de una órbita; si son muchas, el alto aumenta para conservar al
menos ocho puntos de separación. No se oculta ni agrupa ninguna categoría.

Montos y porcentajes usan los valores positivos y válidos del reporte. El
dibujo reserva un mínimo de 5.5% por bloque o 80% dividido entre la cantidad
de categorías, lo que sea menor. Los demás bloques comparten el espacio
restante según sus montos. El aviso «Porciones pequeñas ampliadas» aparece
cuando corresponde: el dibujo ajustado no se presenta como proporción exacta.
Nunca se unen categorías en Otros ni se descarta una por ser pequeña.
Los huecos entre bloques son de hasta dos puntos y nunca superan el 12% de
la longitud del bloque, para no borrar uno pequeño por su separación.

El centro muestra el nombre y porcentaje de la categoría elegida o Todas las
categorías/100%. El monto usa un resumen sin alto fijo ni límite de líneas y
conserva fmtExact y la moneda real, sin K/M/B. Si el espacio inmediatamente
debajo del anillo está libre de iconos/conectores y el texto cabe en una fila,
el resumen ocupa ese hueco y alinea el nombre a la izquierda y el monto a la
derecha. Si alguna categoría necesita esa franja o la cifra es demasiado larga,
el resumen vuelve debajo del gráfico con su distribución vertical anterior.
Tocar icono o bloque selecciona su categoría; el segundo toque devuelve el
total. La selección no modifica movimientos ni presupuestos. Una categoría
retirada deja de mostrarse seleccionada; tipo/mes reinicia. En anchos muy
reducidos, el nombre permanece en el resumen y el centro prioriza el porcentaje,
para no invadir el anillo.

Cada conector sale del punto medio del bloque, a radio +10 (borde exterior
del trazo de 20), y llega al borde de su icono. La curva interpola ángulos en
orden y se mantiene fuera del anillo. El contorno circular se alarga como
cápsula al crecer la cantidad: mantiene curvatura y espacio para llegar a
todos los iconos, evitando que uno quede detrás de otro. La frontera interior
común permite separar las rutas sin atravesar burbujas ni cruzarlas.

Los dos tipos usan `DonutChart`; el filtro original por tipo, mes y exclusión
de transferencias internas se conserva. El total inferior duplicado se retira.
Etiquetas accesibles anuncian monto, porcentaje y selección; menos de 1% y
más de 99% tienen descripción hablada en español, inglés y portugués.
Los colores de superficies y textos siguen la apariencia de la app.

## Comprobaciones y límites

`verificar-geometria-rosquilla.ts` ejecuta JSX y geometría originales con
React/Android adaptados: moneda/total, selección por icono y por bloque,
segundo toque, actualización de monto y categoría retirada; datos sin mutar,
porcentajes/importes reales y mínimo visual explicado; 21 composiciones con
todos sus bloques/iconos/líneas y 28 escenarios de conectores en anchos
244/280/340/380 y 1/2/4/8/10/20/30 categorías. Comprueba puntos de origen y
destino, todos los tramos contra cruces y el espacio de cada icono. Importes
S/ 445,443,876,578 se renderizan completos en el resumen de gastos e ingresos
en tres anchos, sin elipsis ni contenedor absoluto o de alto fijo. La revisión
e4e10fd falla por ausencia de las ocho líneas, no por una API inexistente.

En emulator-5554 se comprueban las nueve categorías presentes, incluida Hogar,
con bloques ampliados, sus conexiones y el aviso. Entretenimiento muestra
S/ 11 <1%; Hogar muestra S/ 1,099 <1%; segundo toque regresa a S/ 1,383,957.
La categoría Hogar ya estaba registrada durante la revisión, no se añadió por
el agente. Ingresos comparte componente/filtro; el mes no tiene ingresos para
verificarlo con datos reales. No se añaden movimientos ni importes ficticios
a la cuenta. Al terminar queda abierto Reportes/Gastos. No se acepta ningún
permiso ni se cambia apariencia, cuentas o datos financieros.

La captura de ventana falló con `FrameArrived timed out` y, al recuperar la
ventana, `window capture timed out`; se usó captura directa de Android.
TypeScript y ESLint completos, 222 pruebas y 8 auditores aprobados con tarjetas
excluidas por decisión vigente. No se acredita con estas pruebas TalkBack real,
letra grande, teléfono físico, importes extremos nativos o ingresos reales.
La prueba de cifras grandes es del componente original adaptado, no una
captura Android de esa cifra. No APK/AAB/OTA/Play ni cambios nativos/servicios.
