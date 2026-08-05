# Finzo

App de presupuesto personal para Android, en soles peruanos (S/).
React Native + Expo SDK 54, Expo Router, NativeWind, TypeScript estricto.

## LEE ESTO PRIMERO

**[ESTADO.md](ESTADO.md)** — dónde nos quedamos: qué funciona, qué falta para
Play Store, qué está en pausa y qué decisiones ya se tomaron y no conviene
deshacer.

**[ENTREGAS.md](ENTREGAS.md)** — qué APK y qué actualizaciones se entregaron,
de qué commit salió cada una y cómo publicar.

Sin leer esos dos se empieza de cero, se rehace lo hecho y se vuelve a
tropezar con lo mismo.

## Con quién se habla

El usuario **no es programador** y escribe en español. Las respuestas van en
español llano: nada de "estado", "props", "efecto", "race condition". Se dice
qué se veía mal, por qué pasaba y qué se hizo.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/
before writing any code.

## Git: commit y push automáticos

El usuario pidió explícitamente que, después de cualquier cambio de código en
este repositorio, se haga `git add -A && git commit` (con un mensaje
descriptivo) y `git push` de forma automática, sin pedir confirmación cada vez.
El remoto ya está configurado (`origin` →
https://github.com/leonjef69-svg/finzooo.git, rama `master`).

Esto cubre **solo** `commit` y `push`. Nada destructivo —`reset --hard`,
`push --force`, borrar ramas— entra en ese permiso.

En Windows, `git commit -m` parte los mensajes de varias líneas: usar siempre
`git commit -F archivo`.

## Antes de publicar cualquier cosa

```bash
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

Y las pruebas, que ahora corren con un solo comando:

```bash
node pruebas/correr.mjs
```

Son 40 pruebas y 7 auditores. Ver [pruebas/LEEME.md](pruebas/LEEME.md).

Cada prueba nueva tiene que **fallar contra la versión anterior**: una que
pasa siempre no está probando nada.

Y si la prueba está escrita en otro lenguaje que el código que prueba (las de
Kotlin corren en Node), tiene que **traducir también las diferencias del
lenguaje**. Escribir `\s` en JavaScript para imitar un `\s` de Kotlin dio una
prueba en verde y una voz muda en el celular: en JavaScript incluye el espacio
duro y en Java no. El porqué entero está en ESTADO.md.

## Dos cosas que se olvidan y cuestan horas

1. **El código nativo no viaja por actualización.** Si tocas
   `modules/*/android/`, hace falta APK nuevo. Se arregló dos veces lo mismo
   por no tenerlo presente.

   Y **las compilaciones se acaban**: el plan gratuito de Expo da unas pocas
   al mes. El 02/08/2026 se gastaron todas en una tarde, una por arreglo, y
   quedó uno hecho sin poder entregar hasta el mes siguiente. **Junta los
   cambios nativos y compila una vez.** El porqué está en ESTADO.md.
2. **Sube `CODE_MARKER`** en `screens/AppInfo.tsx` en cada entrega, y escribe
   **la dirección del APK UNA sola vez en toda la conversación**. Ni una más:
   para volver a mencionarlo, "el APK que te pasé". Pegarlo otra vez —aunque
   sea el mismo— deja dos enlaces en su pantalla, y eso ya confundió tres
   veces el 02/08/2026. No des el enlace hasta tener el arreglo hecho. El
   porqué está en ESTADO.md.
