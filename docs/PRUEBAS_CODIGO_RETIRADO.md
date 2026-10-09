# FINO-37 — seis archivos sin consumidores retirados

09/10/2026. Limpieza de código, no de datos del usuario.

Se retiraron components/BudgetRing.tsx, components/FAB.tsx,
components/SpaceActionBar.tsx, utils/friendlyName.ts,
functions/src/telegram-handler.js y metro.config.cjs.

Comprobaciones: grafo AST de imports/require y búsqueda global de referencias
no encontraron consumidores activos. El servidor usa telegram-guided-handler;
Metro resuelve metro.config.js con su resolver original y carga adaptada, sin
iniciar watchers ni Sentry. Dos pruebas históricas se ajustaron para dejar de
exigir FAB/friendlyName muertos; conservaron comprobaciones de controles activos.

`node pruebas/verificar-codigo-huerfano-real.mjs` verde;
FINO_DEAD_CODE_BASELINE=b6cccc0 roja porque existían los archivos retirados.
Es un contrato de mantenimiento/resolución, no prueba de pantallas o Android.
La retirada es recuperable desde Git, revisión anterior b6cccc0.
No se modificaron ni auditaron funciones de tarjetas.

**Qué sigue:** construcción/arranque final en Android y mantener el inventario
de consumidores. **Qué falta:** verificación de entrega; no declara que no
exista ningún otro código muerto ni que toda la auditoría esté terminada.
