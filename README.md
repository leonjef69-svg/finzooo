# Fino

Aplicación de presupuesto personal para Android, hecha con React Native,
Expo SDK 54 y TypeScript.

Antes de cambiar el proyecto, leer [ESTADO.md](ESTADO.md),
[ENTREGAS.md](ENTREGAS.md) y [PLAYSTORE.md](PLAYSTORE.md). La guía de pruebas
está en [pruebas/LEEME.md](pruebas/LEEME.md).

Para iniciar el desarrollo local: instalar las dependencias con `npm install`
y ejecutar `npm run start:dev-build`. Antes de una entrega, ejecutar
`npx tsc --noEmit`, `npx eslint app screens components utils constants contexts modules`
y `node pruebas/correr.mjs`.

`functions/local.js` modifica el webhook del bot de Telegram. No se ejecuta
por defecto: exige un proyecto Firebase explícito y una autorización
específica para cambiar el webhook. Para producción exige otra autorización
explícita. No lo uses con datos reales para hacer pruebas locales.
