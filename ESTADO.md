# Dónde nos quedamos

Actualizado: **1 de agosto de 2026** · Código publicado: **1ago-19**

Este archivo existe para que una sesión nueva —de Claude o de quien sea— no
empiece de cero. No cuenta lo que ya se ve en el código ni en el historial de
git: cuenta el **estado** y las **decisiones**, que es lo que no se deduce
mirando archivos.

Al terminar algo relevante, actualízalo. Si queda desfasado deja de servir y
se vuelve peor que no tenerlo, porque se cree.

---

## Qué es esto

**Finzo**, una app de presupuesto personal para Android, en soles peruanos
(S/). React Native + Expo SDK 54, Expo Router, NativeWind, TypeScript.

El usuario **no es programador** y escribe en español. Las explicaciones van
en español llano, sin jerga: nada de "efecto", "estado", "props", "race
condition". Se dice qué se veía mal, por qué pasaba y qué se hizo.

---

## Cómo se entrega

Dos caminos, y confundirlos cuesta horas:

| | Qué lleva | Cómo llega |
|---|---|---|
| **Actualización (OTA)** | Solo JavaScript | `eas update`, y el usuario toca Ajustes → Buscar actualización |
| **APK** | Todo, incluido el código nativo | Se compila con `eas build` y hay que instalarlo a mano |

**El código nativo NO viaja por actualización.** Todo lo que toque
`modules/*/android/` necesita APK nuevo. Esto se olvidó varias veces y se
arregló dos veces lo mismo.

### Reglas que costó aprender

- **UN SOLO enlace de APK por mensaje.** Nunca uno "de respaldo": el 30/07/2026
  se dieron dos, el usuario instaló el viejo, y dos funciones que estaban bien
  parecieron rotas. Se perdió medio día.
- **Subir `CODE_MARKER`** en `screens/AppInfo.tsx` en cada entrega. Es la única
  forma de saber por chat qué código está corriendo el celular. Sin eso, cada
  arreglo es a ciegas y puede estar ya hecho.
- **Commit y push automáticos** tras cada cambio, sin preguntar. Lo pidió el
  usuario expresamente. Solo `commit` y `push` — nada destructivo.

---

## Antes de publicar nada

```
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

Y los auditores y las pruebas, que viven fuera del repositorio (ver abajo).
Cada prueba nueva tiene que **fallar contra la versión anterior**: una que
pasa siempre no está probando nada.

---

## Lo que funciona hoy

- Movimientos, presupuesto mensual y por categoría, metas de ahorro
- **Micrófono**: anotar, preguntar, comparar meses y exportar. El orden de las
  palabras no importa (probado con las 720 combinaciones de una frase)
- **Exportar** a PDF, Excel y CSV; a WhatsApp, Gmail, correo, Drive o el menú
  de compartir, con el destinatario ya puesto
- Contactos de envío guardados, con editar y borrar
- Importar estados de cuenta (PDF, Excel, CSV) y archivos compartidos a Finzo
- Personalizar categorías: imagen propia con recorte, color y nombre
- Bloqueo con PIN o huella, copia en la nube, tres idiomas (es/en/pt)
- Pantalla **Comandos de voz** en Ajustes, que enseña qué se le puede decir

---

## Lo que falta para Play Store

Esto es lo pendiente de verdad, en orden de bloqueo:

1. **Premium se regala.** No hay Play Billing. O se cobra de verdad o se quita
   la etiqueta PRO.
2. **"Sin anuncios" es una promesa vacía** en los textos de Premium: no hay
   anuncios que quitar. Google lo trata como afirmación engañosa.
3. **Política de privacidad sin URL pública.** Además está desfasada: ahora se
   guardan también correos, números de teléfono e imágenes de categorías, y
   tiene que decirlo.
4. **Falta la página web de borrado de cuenta.** Google la exige aunque la app
   ya tenga el botón: se pide poder borrar la cuenta *sin* instalar la app.
5. **Declarar el lector de notificaciones** en el formulario de permisos
   sensibles, si se mantiene esa función.
6. **12 probadores × 14 días** en prueba cerrada, para cuentas nuevas de
   desarrollador.

---

## Pendientes que no bloquean

- **Escáner de boletas: EN PAUSA** desde el 30/07/2026, a pedido del usuario.
  Nunca se probó con una boleta real. Antes de darlo por bueno, hay que
  probarlo con una de verdad.
- **El presupuesto mensual no se repite solo** cada mes: hay que volver a
  ponerlo.
- **La exportación programada sale sin gráficos** desde el 1ago-17, porque no
  manda ese dato. Es coherente con "gráficos solo si se piden", pero si se
  quiere que los lleve siempre, necesita su propio interruptor.

---

## Decisiones tomadas (no volver sobre ellas sin motivo)

- **Los gráficos vienen apagados.** Ocupan media hoja y empujan la lista de
  movimientos a la siguiente. Se encienden a mano o diciendo "gráficos".
- **Una sola rosquilla, la de gastos.** Se probó dibujar también la de
  ingresos y se quitó: en un mes normal los ingresos son dos o tres
  categorías, y esa rosquilla costaba una hoja entera.
- **El destinatario se elige cada vez, no se guarda como fijo.** Un
  destinatario fijo se olvida a los tres meses y un día el estado de cuenta se
  va a quien no toca.
- **Con dos contactos que encajan, no se elige ninguno.** Mandar un documento
  de dinero a la persona equivocada por adivinar es peor que preguntar.
- **Los fallos silenciosos se convierten en visibles.** Es el hilo conductor de
  medio proyecto: banner en Inicio cuando un archivo compartido no se pudo
  abrir, el motivo exacto del error de actualización escrito en pantalla, el
  aviso de "no elegiste a quién", el conteo de dígitos del teléfono. Un fallo
  que no avisa cuesta días.

---

## Historial de entregas

Ver [ENTREGAS.md](ENTREGAS.md).

---

## Lo que NO está en este repositorio

- **Los APK y las actualizaciones** viven en Expo, no aquí. Un APK pesa unos
  70 MB y git guarda **todas** las versiones para siempre: diez entregas serían
  700 MB que se descargan enteros en cada clon. Lo que sí está aquí son los
  enlaces y de qué commit salió cada uno, que es lo que hace falta saber.
- **Los auditores y las pruebas** (`verificar-*.ts`, `auditar-*.mjs`) están en
  la carpeta temporal de la sesión, no versionados. Es una deuda: convendría
  traerlos a `pruebas/` para que sobrevivan a la sesión.
- **Los datos del usuario**: movimientos, contactos y presupuestos están solo
  en su celular, cifrados, y en su copia de nube. Nunca en el repositorio.
