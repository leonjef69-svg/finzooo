# Moneda: desaparición de filas al deslizar rápido

13/10/2026. Corrección solicitada por el propietario durante punto 5 de la
auditoría de Bienvenida a Inicio. No autoriza arreglos de otros hallazgos.

## Qué se cambió

El usuario confirmó que solo las filas desaparecen y vuelven con otro gesto.
En `screens/CurrencyPicker.tsx` se desactivó `removeClippedSubviews` (en Android
era verdadero por defecto) y se amplió la reserva: initialNumToRender 20,
windowSize 21, maxToRenderPerBatch 20, updateCellsBatchingPeriod 16. El dueño
informó que la versión previa aún fallaba; por eso se amplió la ventana. Puede
preparar las 155 filas en el teléfono de prueba y ocupar más memoria mientras
Moneda está abierta. No se impone altura fija para nombres de dos líneas/letra
grande. No cambia selección, búsqueda, catálogo, cuenta o cantidades.

La documentación [React Native 0.81](https://reactnative.dev/docs/0.81/optimizing-flatlist-configuration)
describe riesgos de contenido faltante por recorte y huecos por dibujo
diferido/reserva pequeña. Son mecanismos candidatos mitigados por esta
corrección; no se afirma haber aislado una causa nativa única del reporte.
Se consultó [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) antes de editar.

## Regresión

`node pruebas/verificar-moneda-deslizamiento-real.mjs` ejecuta el componente
original con JSX/React/Android adaptados; catálogo y búsqueda son originales.
Verifica configuración de dibujo acotada, 155 IDs únicos, filtrado/no resultados,
retorno al catálogo, selección PEN y bloqueo/acción USD en cuenta nueva/fija.
Antes de modificar la pantalla, devolvió AssertionError por recorte no
desactivado. Con `FINO_CURRENCY_SCROLL_BASELINE=8803281` falla por la misma
conducta; versión actual aprueba. `verificar-selectores-iniciales-real.mjs`
también aprobó, conservando doble toque, vuelta y cancelación al abandonar.
No prueba píxeles, FPS, memoria física ni simula una lista nativa.

## Validación y entrega

TypeScript/ESLint generales: aprobados (exit 0). Batería completa sin tarjetas:
209 pruebas y 8 auditores aprobados, exit 0. Incluye una suite UI ajena no
versionada ya documentada en ESTADO; no se incluyó en este cambio/commit.
Recarga confirmada: `Android Bundled 76173ms index.js (3953 modules)` y regreso
a Inicio con los mismos datos. Es tiempo de compilación local de desarrollo,
no tiempo normal de apertura ni benchmark de APK final. Se abrió Ajustes y
Moneda; capturas Android tras gestos de 50 ms en ambos sentidos mantuvieron
cabecera, buscador y filas (`C:/finzo/.tmp/fino-moneda-antes-gesto.png`,
`fino-moneda-gesto-arriba.png`, `fino-moneda-gesto-abajo.png`). No se eligió
ninguna moneda. Las capturas no acreditan todos los fotogramas del gesto ni
el primer instante de entrada del reporte humano. No se afirma causa nativa
única ni ausencia absoluta de huecos a cualquier velocidad.
Se reinició solo el servidor propio 8081 (17280 → 11936), verificado por comando
y puerto, para leer los cambios que el servidor anterior en CI no vigilaba.
No se detuvo el servidor desconocido 8082, borró caché/datos ni reinstaló Fino.
Marcador `13oct-moneda-window`. Sin APK/AAB/OTA, Firebase o Play publicados.

Qué sigue/falta: recargar esta segunda versión y repetir el gesto humano
específico; probar visualmente búsqueda y letras grandes.

## Segunda revisión tras el reporte de persistencia

Tras probar la primera versión, el dueño informó que el fallo persistía. No se
presenta el cambio inicial como exitoso. Se amplió la ventana a 21 pantallas y
se ajustó la regresión para exigir ese valor. La prueba enfocada de moneda y la
de selectores originales ya aprobaron; compilación de TypeScript y ESLint en
aprobaron. Falta recargar esta revisión y repetir el gesto que lo reproduce.
La batería completa 209/8 aprobó antes del cambio de ventana y no se ha repetido.
Los demás hallazgos de la auditoría permanecen pendientes.
