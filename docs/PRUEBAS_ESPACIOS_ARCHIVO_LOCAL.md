# Botones de espacios y archivo local — 13/10/2026

## Regresiones

Desde `C:\finzo`:

```powershell
node pruebas/verificar-cambio-espacios-real.mjs
node pruebas/verificar-metro-artefactos-real.mjs
node pruebas/verificar-archivo-caja-antigua-real.mjs
```

Las tres admiten respectivamente `FINO_TEST_SPACE_NAV_BASELINE`,
`FINO_TEST_METRO_BASELINE` y `FINO_TEST_BOX_ARCHIVE_BASELINE` con `3cb9b90`.
Las tres fallan contra esa revisión por comportamiento: regreso omitido,
carpeta efímera no excluida y cierre antiguo sin alternativa reversible.
No hacen checkout ni consultas de producción.

Navegación: manejador original del selector y módulo original con navegador/
reloj adaptados. Regresos entre los tres espacios, doble toque, reintento tras
error, ruta con parámetros y protección de pantallas apiladas. No monta React.

Metro: configuración original, bibliotecas reales, rutas Windows/normalizadas,
exclusiones heredadas conservadas y fuentes/dependencias no ocultadas. El
servidor real se inició y sobrevivió al auditor que crea/retira carpetas.

Archivo: fixture equivalente a «hj» con cuatro registros, tres enlaces antiguos
y saldo S/20. Conserva movimientos, Personal y marcas; rechaza cambios
financieros encubiertos, compartir incierto y revisión monetaria pendiente.
Filtro original, reactivación, fusión y subida original sin preferencia remota.
Contexto/almacén originales con SQLite real, adaptadores de IO/cifrado:
rollback, respuesta perdida, publicación de memoria después de confirmación
y cambio de sesión. No acredita cifrado nativo/Android ni Firebase publicado.

## Android observado y límites

La app actual cargó desde Metro (3953 módulos). Se observaron Personal,
Familia, Cajas y regresos con capturas/árbol Android; no se hicieron altas,
devoluciones, borrados o archivos reales. No se midió latencia por fotogramas,
ni se verificó el recorrido completo de archivo/restauración en Android.
Conservar las restricciones de dinero, cuenta y Pro. No confundir una Caja
archivada local con eliminada o financieramente cerrada.

Qué sigue/falta: medición sin otras pruebas pesadas, archivo visual, dos cuentas
compartidas/concurrencia y Personal/Familia; publicación/autorización de nube
real siguen pendientes. Sin APK/AAB/OTA nuevos, tarjetas o Telegram.
