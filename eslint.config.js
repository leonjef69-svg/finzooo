// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .expo/ lo genera Expo automáticamente; no es código nuestro y no
    // tiene sentido revisarlo (generaba un aviso falso en cada análisis).
    ignores: ['dist/*', '.expo/*'],
  },
]);
