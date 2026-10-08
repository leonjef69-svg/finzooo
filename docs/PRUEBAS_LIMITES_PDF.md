# FINO-35 — PDF limitado durante la descompresión

Revisión: 07/10/2026. Código preparado, no entregado.

## Confirmación y cambio

Antes había límite de entrada de 15 MiB en la pantalla, pero decompressSync
expandía cada stream completo antes de comprobar nada. Una bomba sintética
de menos de 15 MiB que producía 9 MiB no se rechazaba; la prueba falló antes.
No se hizo una bomba de 300 MiB ni se provocó un cierre Android real.

Ahora el lector también limita directamente su entrada y usa Decompress
streaming de fflate 0.8.3 con pushes de 256 bytes. Comprueba cada salida antes
de concatenar/convertir todo: 8 MiB por stream, 32 MiB acumulados (también
streams sin texto o que fallan después de producirlo), 4096 streams y 100.000
fragmentos. Cabeceras sin salida no acumulan más de 128 KiB; deja margen para
bloques almacenados de 64 KiB. No se comprueba solo después de expandir todo.

El límite se propaga como PdfResourceLimitError: no se oculta como stream dañado
ni se devuelve la primera página parcial. La pantalla ofrece elegir menos
páginas/CSV/Excel, libera carga y conserva el historial; limpia la copia temporal
como antes. No cambia la interpretación de montos, signos o columnas.

Se evita concatenar bytes uno a uno/spread de todos los fragmentos. Delimitadores
desconocidos avanzan para no atascar el tokenizador; sin endstream posterior se
detiene la búsqueda, en vez de repetirla desde cada stream incompleto.

Los límites son defensivos, no garantizan un máximo exacto de RAM/tiempo total
de Android. Un documento legítimo enorme podría rechazarse: tiene salida CSV/
Excel o dividir meses/páginas, no aumentar ciegamente el límite. Conserva los
formatos zlib/gzip/raw y tratamiento previo de streams dañados. No es un lector
PDF completo ni corrige otras limitaciones de fuentes/diccionarios/cifrado.

## Pruebas

`node pruebas/verificar-pdf-limites-real.mjs` compila/ejecuta el extractor original
y fflate real, con compresión independiente de Node/zlib. Un observador de la
clase real mide pushes/salidas, sin sustituir el algoritmo. Para esa bomba,
entradas <=256 bytes y salidas individuales <1 MiB; no prueba todo archivo posible.

Comprueba stream/acumulado/entrada/fragmentos/cantidad; límite después de una
página válida sin devolverla; cabecera incompleta; bloques válidos sin compresión;
marcadores sin cierre; delimitadores; 10.000 filas; zlib/gzip/raw y stream dañado.
Ejecuta loadFile original con archivo/avisos sustituidos: mensaje específico,
ningún parse/import parcial y limpieza/liberación. No se monta interfaz React.

Regresión: `FINO_TEST_PDF_LIMITS_BASELINE=595cf99` falla al no rechazar la bomba;
actual verde. Guía de streaming primaria revisada:
[fflate](https://github.com/101arrowz/fflate#usage); se contrastó el código instalado.

## Android pendiente

1. PDFs bancarios habituales de texto: montos/fechas/signos/columnas iguales;
   elegir/compartir y cancelar como antes. No tocar tarjetas de crédito.
2. Archivos sintéticos con cada límite y después de una página válida: aviso
   comprensible, sin movimientos parciales ni cierre de app, opción de reintentar.
3. Memoria/tiempo/reacción en teléfono de pocos recursos y Hermes final. Los
   tiempos de Node no equivalen al teléfono ni autorizan declarar cero congelaciones.
4. PDF legítimo grande, no sólo malicioso: comprobar mensaje/salida CSV/Excel.
   Conectar un Android e instalar la versión acumulada; no hay dispositivo en ADB.

No añade datos/retención/nube/permisos ni cambia políticas de recogida. No hubo
APK/AAB/OTA/EAS ni despliegue. **Qué sigue:** permisos de avisos/restantes IDs.
**Qué falta:** Android, firma/manifiesto, consolas/trámites y entrega autorizada.
Tarjetas y comprobación externa de Sentry siguen excluidas; auditoría no terminada.
