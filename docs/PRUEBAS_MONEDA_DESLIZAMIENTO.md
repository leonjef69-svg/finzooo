# Moneda: desaparición de filas al deslizar rápido

13/10/2026. Corrección solicitada por el propietario durante punto 5 de la
auditoría de Bienvenida a Inicio. No autoriza arreglos de otros hallazgos.

## Qué se cambió

El usuario confirmó que solo las filas desaparecen y vuelven con otro gesto.
En `screens/CurrencyPicker.tsx` se desactivó `removeClippedSubviews` (en Android
era verdadero por defecto) y se amplió la reserva: initialNumToRender 20,
windowSize 11, maxToRenderPerBatch 20, updateCellsBatchingPeriod 16.
La lista sigue virtualizada; no se convierte a un contenedor que monta las
155 filas de golpe ni se impone altura fija para nombres de dos líneas/letra
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
Marcador `13oct-moneda-lista`. Sin APK/AAB/OTA, Firebase o Play publicados.

Qué sigue/falta: repetir el gesto humano específico al entrar, búsqueda visual
y letras grandes; los gestos en ambos sentidos ya se comprobaron por capturas.
Los demás hallazgos de la auditoría permanecen pendientes.
