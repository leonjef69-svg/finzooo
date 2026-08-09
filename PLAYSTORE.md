# Lo que hay que rellenar en Play Console

Preparado el **08/08/2026**, antes de que exista la cuenta, para que el día que se abra sea
copiar y pegar en vez de redactar bajo presión.

**Todo lo de aquí está sacado del código, no de la memoria.** Los permisos salen del
`AndroidManifest`, los datos que se guardan salen de `utils/storage.ts` y de
`constants/legal.ts`. Si mañana la app guarda algo nuevo, **este archivo también hay que
tocarlo**: un formulario de datos que no cuadra con lo que hace la app es motivo de suspensión,
y Google lo revisa de verdad.

---

## Datos básicos

| | |
|---|---|
| Nombre | **Finzo** |
| Identificador | `com.finzo.app` |
| Versión | 1.0.0 |
| Categoría | **Finanzas** |
| Público | Mayores de 18 (no dirigida a niños) |
| País principal | Perú |
| Precio | Gratis, con compras dentro de la app |
| Correo de contacto | dinero123xc@gmail.com |
| Política de privacidad | https://leonjef69-svg.github.io/finzooo/privacidad.html |
| Borrado de cuenta | https://leonjef69-svg.github.io/finzooo/borrar-cuenta.html |

---

## Descripción corta (máx. 80 caracteres)

```
Controla tus gastos y los de tu negocio, en soles. Yape se registra solo.
```

**73 caracteres** de los 80 que deja Google. Contado, no estimado — pasarse hace que el
formulario lo rechace al pegarlo, y ahí se recorta a las prisas.

La descripción completa son **1.399** de los 4.000 permitidos.

---

## Descripción completa

```
Finzo es una app de presupuesto pensada para Perú: lleva tus gastos de casa y los de tu negocio por separado, en soles.

LO QUE HACE SOLO
Enciende el registro automático y cuando te yapeen, el movimiento se anota sin que toques nada. Funciona incluso con la app cerrada.

TU DINERO ORDENADO
• Ingresos y gastos con categorías
• Presupuesto del mes y por categoría
• Metas de ahorro
• Reportes en PDF, Excel y CSV
• Copia de seguridad en la nube

MODO NEGOCIO
Si tienes un negocio, su plata va aparte de la de tu casa. Nunca se mezclan, ni en los totales.
• Los yapeos que recibes entran directo a la caja del negocio
• Anota tus gastos: insumos, gas, alquiler
• Mira cuánto hiciste hoy, este mes o desde el primer día
• Compara un mes con el anterior
• Registra ventas por producto, si quieres llevar esa cuenta

HABLA EN VEZ DE ESCRIBIR
Anota un gasto, pregunta cuánto llevas o pide un reporte, dictando.

TUS REPORTES DONDE QUIERAS
Guárdalos en tu celular, en Google Drive o en Dropbox. También puedes programarlos para que salgan solos cada día, semana o mes.

TUS DATOS SON TUYOS
Se guardan cifrados en tu celular. No vendemos tu información. Puedes borrar tu cuenta entera cuando quieras, desde la app o desde nuestra web.

Finzo no es un banco, no mueve dinero y no se conecta a tus cuentas bancarias. Es tu cuaderno de gastos, pero que hace las cuentas por ti.
```

---

## Formulario de seguridad de los datos

> **Lo que decide la mayoría de respuestas:** los datos **se recogen** (viajan a Firebase si la
> persona inicia sesión) y **no se comparten** con terceros. Todo va **cifrado en tránsito** y
> **se puede pedir el borrado**. Nada de esto es opcional en el formulario y equivocarse aquí
> es lo que más rechazos causa.

### ¿Recoge o comparte datos? → **Sí, recoge. No comparte.**

| Categoría | ¿Se recoge? | ¿Obligatorio? | Para qué |
|---|---|---|---|
| **Nombre** | Sí | No (solo con cuenta) | Funciones de la app |
| **Correo electrónico** | Sí | No | Funciones de la app · Gestión de la cuenta |
| **Fotos** | Sí | No | Funciones de la app (foto de perfil, dibujos de categorías, boletas) |
| **Información financiera del usuario** *(otra)* | Sí | No | Funciones de la app |
| **Mensajes en la app** *(otros: contenido de notificaciones)* | Sí | No | Funciones de la app |
| **Grabaciones de voz** | **No se recoge** | — | Se procesa en el celular y no se guarda |

**Para las cinco que sí:** marcar **cifrado en tránsito** y **se puede solicitar el borrado**.

> **Los contactos de envío (correos y teléfonos ajenos) van dentro de "Correo electrónico" y
> "Números de teléfono"**, y hay que declararlos: los escribe la persona, pero se guardan y se
> suben a su copia en la nube. Que no vengan de la agenda del celular no los vuelve invisibles.

---

## Permiso delicado: lector de notificaciones

Es la declaración más importante del formulario y **la que puede tumbar la publicación**.
Google exige justificar `BIND_NOTIFICATION_LISTENER_SERVICE` con la función principal de la app.

**Texto para el formulario:**

```
Finzo es una app de control de gastos. El acceso a las notificaciones se usa
para una única función: leer los avisos de pago de Yape y registrar
automáticamente el movimiento (monto, fecha y contraparte) en el presupuesto
del usuario, sin que tenga que escribirlo a mano.

Es una función opcional que viene desactivada. Solo funciona si el usuario la
enciende expresamente dentro de la app y concede el permiso.

Finzo filtra por paquete de origen ANTES de procesar nada: solo se leen los
avisos de Yape. Los avisos de cualquier otra aplicación se descartan sin
guardarse. Los avisos de códigos de verificación y claves se detectan y su
texto NO se guarda.

Los datos se quedan en el dispositivo del usuario y en la copia de seguridad
de su propia cuenta. No se envían a terceros, no se usan para publicidad y no
se venden. El usuario puede desactivar la función y borrar el registro en
cualquier momento desde Ajustes.
```

**Vídeo de demostración:** Google suele pedirlo. Grabar la pantalla mostrando:
Ajustes → Registro automático → encender el interruptor → conceder el permiso → llega un yapeo
→ aparece el movimiento solo.

---

## Otros permisos que preguntarán

| Permiso | Para qué, en una línea |
|---|---|
| `CAMERA` | Escanear boletas para leer el monto |
| `RECORD_AUDIO` | Dictar movimientos por voz |
| `POST_NOTIFICATIONS` | Avisar de la exportación programada |
| `READ/WRITE_EXTERNAL_STORAGE` | Guardar los reportes en la carpeta que elija |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Bloquear la app con huella |
| `SYSTEM_ALERT_WINDOW` | El acceso rápido de voz |

---

## Clasificación de contenido

Es un cuestionario. Con una app de finanzas sin contenido sensible, todo va en **No**:
violencia, sexo, drogas, lenguaje, apuestas, contenido de usuarios, compartir ubicación.

**La única que sí:** *"¿La app permite comprar bienes o servicios digitales?"* → **Sí**
(la suscripción Premium).

Resultado esperado: **apto para todos**.

---

## Lo que NO se puede prometer

- **No decir "sin publicidad"** mientras no haya publicidad. Se quitó el 08/08/2026 por eso
  mismo: es lo que Google llama afirmación engañosa. Ver `constants/anuncios.ts`.
- **No decir "conecta con tu banco"**: no se conecta con ningún banco. Se leen avisos de Yape,
  que es otra cosa, y la diferencia importa.
- **No usar logos de bancos ni de Yape** en el icono, las capturas ni el gráfico. Es marca
  registrada y en una app de dinero es lo que hace pensar que es oficial de esa marca. Ya se
  decidió el 03/08/2026 y por eso no hay ni un logo financiero en la app.
