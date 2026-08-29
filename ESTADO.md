# Estado actual de Fino

Actualizado: **29 de agosto de 2026**.

Este archivo permite retomar el proyecto sin empezar de cero. No contiene
credenciales, correos, UID, huellas completas ni datos privados de testers.

## Qué es Fino

Fino es una aplicación Android de presupuesto personal, gastos e ingresos.
Usa React Native, Expo SDK 54, Expo Router, TypeScript estricto, NativeWind,
Firebase Authentication, Firestore y módulos Android propios.

Paquete Android: `com.finoapp.gastos`.

## Versiones

- Disponible en prueba cerrada: **1.0.4**, `versionCode 5`.
- Próxima corrección: **1.0.5**, `versionCode 6`.
- Marca visible de 1.0.5: **23ago-09**.
- El AAB firmado solo se genera en la computadora autorizada.

## Acceso con Google

El código G10 se debía a que el APK protegido que entrega Google Play usa una
firma diferente a la firma de subida. La firma real fue obtenida del APK
universal de Play, registrada en Firebase y el acceso quedó confirmado en un
teléfono. No existe una lista de Firebase que limite quién puede crear cuenta.

El código también muestra los errores de Google debajo de su botón, no debajo
de Contraseña, distingue las causas y no muestra error cuando el usuario cancela.

## Correcciones preparadas en 1.0.4 y 1.0.5

- Bienvenida breve, cálida y con identidad de Fino.
- Detección automática de país y moneda, con opción para cambiarlos.
- Catálogo mundial con 250 países o territorios y 154 monedas, ambos con
  búsqueda y nombres localizados.
- El país se guarda localmente sin cambiar el formato de la copia en Firestore;
  los perfiles anteriores siguen funcionando.
- Las monedas respetan 0, 2 o 3 decimales y el escáner conserva el tratamiento
  cotidiano de pesos argentinos y colombianos.
- La elección se conserva aunque Android cierre Fino al verificar el correo.
- Solicitud del permiso de avisos antes del formulario de cuenta.
- La bienvenida conserva su paso al volver del permiso de Android.
- Verificar correo tiene tiempo máximo de espera y nunca queda cargando.
- Se indica revisar Spam o correo no deseado.
- CLP, COP y ARS se muestran sin centavos y con separadores locales.
- Inicio y Reportes usan cantidades compactas en espacios pequeños.
- Gráficos, leyendas y ejes reservan espacio para monedas grandes.
- El saludo nunca muestra el correo electrónico completo.
- El micrófono entiende frases naturales como «almorcé por 20», «sueldo
  1500» o «me cayó un Yape de 30».
- Si falta el monto, Fino lo pregunta sin obligar a repetir toda la frase.
- El usuario puede corregir monto, tipo o método de pago con la voz.
- El dictado conserva efectivo, tarjeta, transferencia, Yape o Plin.
- La voz del registro automático dice «un pago de un sol», no «un pago por
  uno sol», sin cambiar la detección ni el movimiento guardado.
- El inicio queda reducido a exactamente tres pantallas, usando los tres
  paneles exactos del diseño aprobado: bienvenida, configuración y acceso.
- Se eliminan del recorrido las pantallas antiguas de presentación, país,
  avisos y formulario que aparecían como cinco pasos separados.
- Los controles dibujados de país, moneda, avisos y acceso son zonas táctiles
  reales y conservan toda la lógica existente.

## Registro automático

Fino detecta avisos reales de Yape mediante el acceso de notificaciones de
Android. La prueba desde una instalación de Google Play confirmó que registra y
lee el Yape en voz alta. Publicidad y avisos ajenos se descartan. No ampliar a
correo o bancos diferentes sin diseñar antes privacidad y duplicados.

## Funciones

Plan gratuito:

- Gastos e ingresos ilimitados.
- Presupuesto mensual, saldo anterior, historial, búsqueda y reportes.
- Sincronización de cuenta y temas claro/oscuro.

Premium preparado:

- Consejos financieros y presupuestos por categoría.
- Importación, exportación y exportación automática.
- Modo Negocio, registro automático y dictado por voz.
- Bloqueo biométrico/PIN y metas de ahorro.

El cobro Premium aún no está habilitado; existe una prueba local de 24 horas.

## Google Play: qué falta

- Generar y subir el AAB 1.0.5 a la misma prueba cerrada.
- Pedir a los testers que actualicen desde Google Play.
- Conseguir al menos 12 testers aceptados y mantener el periodo exigido.
- Completar la cuenta preparada para revisión con datos de ejemplo.
- Enviar a revisión cuando Play Console habilite el siguiente paso.

Agregar un correo no cuenta como aceptación: cada tester debe abrir el enlace,
aceptar y descargar con la misma cuenta de Google.

## Estado de calidad

- TypeScript: aprobado.
- ESLint: aprobado sin errores ni advertencias en el código de la app.
- Expo Doctor: **18 de 18 comprobaciones aprobadas**.
- Pruebas: **80 aprobadas**.
- Auditores: **7 aprobados**.
- El lector de Excel usa SheetJS 0.20.3 desde su distribución oficial; se
  retiró la versión 0.18.5 afectada por dos vulnerabilidades conocidas.
- `npm audit` conserva avisos transitivos del conjunto de herramientas de
  Expo SDK 54. Resolverlos exige migrar de SDK y no se debe forzar sin probar
  esa actualización mayor. No hay vulnerabilidades críticas.

Comando principal: `node pruebas/correr.mjs`.

## En preparación

- País y moneda ahora usan listas virtualizadas: no dibujan los cientos de
  opciones a la vez, por lo que abrirlas y buscar debe ser inmediato incluso
  en celulares modestos.

## Pendientes actuales

Esta lista reemplaza los pendientes antiguos que hablaban de dos carpetas o de
rescatar Excel/Premium: eso ya quedó consolidado en `C:\finzo` y subido a
`master`.

### Correcciones y comprobaciones antes del próximo AAB

- Corregir la fila `Diario / Semanal / Mensual / Personalizado`: en celulares
  estrechos `Personalizado` cae solo a una segunda fila. Debe quedar ordenada
  como 2 × 2 en pantallas estrechas y como una sola fila cuando haya espacio.
- Probar esa adaptación con pantalla pequeña, mediana y grande, letra ampliada
  y escala de pantalla aumentada.
- Mejorar el selector de monedas para enseñar primero el símbolo junto con el
  código ISO, por ejemplo `S/ · PEN`, `$ · USD` y `€ · EUR`. No ocultar el ISO
  por completo: distintas monedas comparten símbolos como `$` y se volverían
  indistinguibles. Comprobar también símbolos largos y monedas de 0 o 3
  decimales en pantallas estrechas.
- Adaptar los métodos de pago de `Registrar gasto` al país configurado: `Plin`
  solo debe aparecer para Perú; `Yape` solo para Perú y Bolivia. En los demás
  países deben ocultarse sin borrar ni modificar movimientos antiguos que ya
  tengan esos métodos. Mantener las alternativas universales como efectivo,
  tarjeta y transferencia.
- Dar más visibilidad a las acciones del saldo anterior: resaltar su tarjeta
  con un color coherente con Fino y hacer más grandes y reconocibles los iconos
  de borrar y revertir. Añadir color/contraste y una zona táctil suficiente para
  que el usuario descubra que puede usarlos, sin confundir una acción destructiva
  con una acción normal.
- Probar en un teléfono real el nuevo selector mensual: solo muestra meses con
  movimientos y `Probar ahora` exporta el mes elegido. En el emulador ya quedó
  comprobado.
- Confirmar la sincronización Firebase en los dos sentidos entre un teléfono y
  el emulador usando la misma cuenta: crear un movimiento en cada dispositivo
  y comprobar que aparece en el otro sin duplicarse ni perder datos.
- Revisar la entregabilidad del correo de verificación para reducir que llegue
  a Spam. La app ya avisa dónde buscarlo y no queda cargando, pero falta evaluar
  dominio/remitente y plantilla antes de prometer bandeja principal.
- Verificar el caso del tester al que Google Play mostró «Tu versión de Android
  no es compatible con este artículo»: comprobar su versión de Android, el
  catálogo de dispositivos excluidos y el AAB activo.
- Repetir el recorrido completo en una instalación limpia: Google, correo
  existente, cuenta nueva, verificación, permisos, país, moneda, presupuesto,
  restauración de nube y entrada a Inicio.
- Confirmar en Firebase, Google Play App Signing y el AAB final que siguen
  registradas las firmas necesarias para Google. El acceso G10 ya fue corregido
  y probado, pero debe validarse otra vez con la entrega final de Play.
- Ejecutar TypeScript, ESLint, Expo Doctor, las 80 pruebas y los 7 auditores
  después de la corrección responsive y antes de compilar.

### Publicación en Google Play

- Definir la versión siguiente, aumentar `versionCode` y actualizar
  `CODE_MARKER`.
- Generar un único AAB firmado en la computadora autorizada, probarlo y subirlo
  a la misma prueba cerrada.
- Preparar una cuenta de revisión con datos de ejemplo y comprobar que no
  exponga datos personales.
- Pedir a los testers que actualicen desde Google Play y prueben los recorridos
  principales.
- Alcanzar al menos 12 testers aceptados, mantener el periodo exigido por Play
  Console y enviar la app a revisión cuando el panel lo permita.

### Funciones e integraciones todavía incompletas

- Activar compras reales de Premium. Hoy no existe cobro: falta cerrar precios,
  beneficios, productos de Google Play Billing, restauración de compras y
  pruebas de compra/cancelación.
- Registrar Fino en Microsoft Azure y colocar el identificador público para
  habilitar OneDrive. El código está preparado, pero `CLIENT_ID` sigue vacío y
  la opción se oculta correctamente.
- Revisar los PDF bancarios concretos que algún usuario no pudo importar; hace
  falta conservar una muestra sin datos privados para reproducir cada formato.
- Diseñar antes de ampliar el registro automático desde Yape hacia Plin y
  bancos: permisos, privacidad, formatos reales, falsos positivos y duplicados.
- Evaluar lectura de correos solo después de definir consentimiento, privacidad,
  seguridad, duplicados y coste. No está implementada.
- Definir CI/CD gratuito para pruebas y controles; los AAB firmados deben seguir
  generándose únicamente en el equipo autorizado.
- Los avisos transitivos no críticos de `npm audit` dependen de Expo SDK 54.
  Revisarlos al migrar de SDK, sin forzar una actualización mayor antes del AAB.

## Reglas para continuar

1. Leer `AGENTS.md`, este archivo y `ENTREGAS.md`.
2. No publicar secretos ni datos privados.
3. No cambiar el paquete `com.finoapp.gastos`.
4. Aumentar `versionCode` y `CODE_MARKER` por cada entrega.
5. Ejecutar TypeScript, ESLint, pruebas y auditores antes de publicar.
6. Crear commit y push al terminar.
7. Entregar un solo instalable a la vez.

## Próximo paso exacto

Generar el AAB 1.0.5 con `generar-aab.bat`, subirlo a prueba cerrada y probar
una instalación nueva desde bienvenida hasta el acceso.
