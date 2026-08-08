# Entregas

Qué se le dio al usuario y cuándo. Los archivos viven en Expo; aquí están los
enlaces y **de qué commit salió cada uno**, que es lo que permite saber qué
lleva dentro una versión instalada.

Carpeta del proyecto: `C:\finzo` — se movió ahí el 03/08/2026 porque las rutas
largas rompían la compilación local. El porqué, en ESTADO.md.

El APK se compila en la PC: `android\compilar.bat`. Los de Expo siguen
valiendo cuando haya cupo.

Proyecto en Expo: `expo.dev/accounts/asdsadasd23213/projects/finzo`
Canal y rama de actualizaciones: `preview` · Versión de ejecución: `1.0.0`

---

## APK

Se necesita APK cuando cambia código nativo (`modules/*/android/`). Todo lo
demás llega por actualización.

**Dar UN SOLO enlace por mensaje.** Ver ESTADO.md.

| Fecha | Commit | Qué trae de nuevo (lo nativo) | Archivo |
|---|---|---|---|
| 06/08/2026 | `0f9fbb8` | **El PDF automático ya no se cuelga de verdad**: se colgaba por ESPERAR la medida del documento, que en una ventana sin pantalla no contesta nunca. Se copia lo que hace expo-print. Y el mismo papel que el PDF de a mano (Carta a 72, no A4 a 300) | `finzo-6ago-10.apk` |
| 06/08/2026 | `0f67e81` | Intento fallido: tamaño A4 a mano para la ventana + tope de tiempo. El tamaño NO era la causa; **el tope sí sirvió**, es lo que dio el mensaje con el que se encontró el fallo | `finzo-6ago-09.apk` |
| 06/08/2026 | `737713f` | El PDF se arma con la app cerrada (conversor propio de Android). **Se colgaba, sin decir nada** | `finzo-6ago-03.apk` |
| 03/08/2026 | `b3f7e4e` | La voz habla sin espera (hilo propio). **Primer APK compilado en la PC** — en Descargas, no en Expo | `finzo-3ago-02.apk` |
| 02/08/2026 | `f3e9951` | La voz habla sin espera: el motor se enciende al conectar el servicio y ya no se apaga por tiempo | [APK](https://expo.dev/artifacts/eas/VT__wfJVHE1OVfXdNse9Ju32C1ZjwrzCLwrSkSYOlNo.apk) |
| 02/08/2026 | `e77d47e` | Varios yapes seguidos hablan uno detrás de otro (antes, todos a la vez); solo Yape en la pantalla | [APK](https://expo.dev/artifacts/eas/ujCXYt2AuT6DxGw1HmcIb5i2Rov9LWJ8LiOq7NLO4n4.apk) |
| 02/08/2026 | `ba4972c` | El yapeo se registra AL INSTANTE con la app abierta: el servicio avisa en vez de que la app pregunte cada 8 s | [APK](https://expo.dev/artifacts/eas/77nNwoRExlh1N7eGe-XGI-cfGbS-eI3R8DDNN9PaTqY.apk) |
| 02/08/2026 | `d9d5208` | La voz vuelve a sonar con el yapeo real (el espacio duro del monto), y la pantalla dice por qué se calló | [APK](https://expo.dev/artifacts/eas/QCEnZchxy9lw_KBXlc7vafGh-xhDJqLFCP78_YFa4Co.apk) |
| 02/08/2026 | `ec34687` | La voz ya no lee "hemos generado y autocompletado la clave" ni otros avisos que no son un yapeo — pero se quedó muda con los yapes de verdad | [APK](https://expo.dev/artifacts/eas/kAElW5weRwYiCoBqfbSvRwHzCE_1h-bZHzkLQ2bZvAQ.apk) |
| 02/08/2026 | `c4b715e` | El celular dice en voz alta quién te yapeó y cuánto (instalado, pero sin el arreglo de arriba) | [APK](https://expo.dev/artifacts/eas/0mgFL8IanSBxIoNpKAsSvW9Flf6y8-Qk1RPOFDVC234.apk) |
| 01/08/2026 | `8e631a3` | Correo directo a la app predeterminada, sin el menú de "¿con qué aplicación?" | [APK](https://expo.dev/artifacts/eas/PG0k80A7RIXHPhFAsjfe7TQXTprSQJqkZeVrWoGtBGs.apk) |
| 01/08/2026 | `5a0bcd7` | Elegir la pantalla de WhatsApp y Gmail que sabe leer el destinatario | [APK](https://expo.dev/artifacts/eas/FjIQf0opU7Xgx00fiYmlWaXkfKr6dTti8WVrDZkGYgs.apk) |
| 01/08/2026 | `51594c7` | Compartir a Finzo, Gmail directo, escáner | [APK](https://expo.dev/artifacts/eas/FBqFLxeSyq0TD5Qh7kIAnrjR1m6WgGkGlitq67pJ_GY.apk) |

Cómo saber cuál está instalado: Ajustes → Acerca de → la línea de partes
nativas. `✓ correo directo` significa el del 1 de agosto o posterior, y
`✓ voz afinada` el del 2 de agosto por la tarde — el primero cuya voz suena
con un yapeo de verdad.

Y si la voz no suena: Ajustes → Registro automático, debajo del interruptor,
dice el motivo ("Calló: no le vio el monto"). Antes había que hacer un yapeo
real y adivinar entre tres causas que se veían igual.

---

## Actualizaciones (solo JavaScript)

La marca de código sale en Ajustes → Acerca de. Es la forma de saber por chat
qué está corriendo el celular.

| Código | Qué se arregló |
|---|---|
| `8ago-06` | "Lo que más vendes": cuánto salió de cada producto (V2, parte 2) |
| `8ago-05` | El panel del negocio por **Hoy · Este mes · Todo** (V2, parte 1) |
| `8ago-04` | El yapeo que recibes entra solo a la caja del negocio, con su interruptor. **Cierra la V1 del Modo Negocio** |
| `8ago-03` | Anotar gastos e ingresos en la caja del negocio. **Cierra el paso 4 del Modo Negocio** |
| `8ago-02` | Registrar ventas del negocio: tocar productos, cantidad y cómo pagaron |
| `8ago-01` | El panel del negocio: saldo, ventas, gastos e historial |
| `2ago-21` | El yapeo se registra al instante (la parte de JavaScript; lo demás va en el APK) |
| `2ago-20` | La pantalla de registro automático se actualiza sola, sin reiniciar la app |
| `2ago-19` | La hora en el diagnóstico de la voz |
| `1ago-19` | Auditoría a fondo: borrar el contacto que se editaba, `textWidth` duplicada, el cálculo de la hoja |
| `1ago-18` | Pantalla de comandos de voz en Ajustes |
| `1ago-17` | Gráficos apagados por defecto; se encienden diciendo "gráficos" |
| `1ago-16` | Una sola rosquilla; el documento se aprieta para caber en una hoja |
| `1ago-15` | La pantalla dice qué APK está instalado |
| `1ago-14` | (revertido en el 16) los gráficos de gastos e ingresos |
| `1ago-13` | El micrófono aguanta 5 segundos de silencio |
| `1ago-12` | La voz entiende gastos/ingresos y el nombre en cualquier posición |
| `1ago-11` | Correo directo (la parte de JavaScript) |
| `1ago-10` | El contacto recién guardado ya no se suelta solo |
| `1ago-09` | Editar un contacto guardado |
| `1ago-08` | Atrás cierra la vista previa; borrar contacto con su ✕ |
| `1ago-07` | Avisa si al número le falta un dígito |
| `1ago-05` | El número se perdía justo antes de mandarlo a WhatsApp |
| `1ago-03` | "gmail mi correo" pasa a entenderse |
| `1ago-02` | "whatsapp mi numero" sin decir "a" |

Para el detalle de cada una, el mensaje de su commit lo explica entero:

```bash
git log --oneline
```

---

## Cómo se publica

Una actualización (lo normal):

```bash
npx eas-cli@latest update --branch preview --platform android --message "1ago-20: qué cambia"
```

Un APK (solo si cambió código nativo):

```bash
npx eas-cli@latest build --platform android --profile preview --non-interactive --no-wait
```

`--platform android` no es opcional en `update`: sin eso intenta armar también
el paquete de web y falla por `getReactNativePersistence`.

---

## Si se quieren los archivos EN GitHub

Se puede, pero **no dentro del repositorio**: git guarda todas las versiones
para siempre y cada APK son unos 70 MB. Diez entregas serían 700 MB que se
bajan enteros en cada clon.

La forma correcta son las **Releases** de GitHub, que guardan binarios aparte
del historial. Hace falta tener instalado `gh` y haber iniciado sesión:

```bash
gh release create v1.0.0-1ago19 finzo.apk --notes "Correo directo"
```

Ahora mismo `gh` no está instalado en esta computadora.
