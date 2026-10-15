# FINO-16/34/47/49 — privacidad, ficha y activación pendientes

## Revisión adicional — 14/10/2026 (código local, no publicado)

El registro automático ahora se presenta como función de pago y no se habilita
sin Premium vigente en esta versión de trabajo. La nube tiene una preferencia
local para pausar futuras sincronizaciones; apagarla no borra la copia remota.
El respaldo sigue asociado al Premium existente y la prueba autorizada. No hay
Billing, Plus, planes cobrables ni compras habilitadas. La propuesta comercial
actual del propietario es Plus S/ 3.60 mensual y Pro S/ 9.99 mensual o S/ 84
anual, pero no debe mostrarse como precio disponible hasta implementar y probar
los productos de Play.

Hallazgo crítico de coherencia: `constants/legal.ts` todavía dice que el registro
no se envía a otro sitio y que los avisos quedan en el dispositivo/copia de la
cuenta; `PLAYSTORE.md` también declara que no se envían a terceros. El código
permite respaldo de movimientos derivados en Firebase con Premium. Además, los
identificadores de eliminación sincronizados pueden conservar un `captureId`
que incluye título/texto del aviso. No declarar que ese texto nunca sale del
dispositivo ni que se conservan únicamente hashes. La política pública, el
consentimiento/huellas aceptadas y Seguridad de los datos deben revisarse juntos
con campos reales, retención y proveedores antes de distribuir. No se cambiaron
los textos legales aceptados, su huella ni HTML público en esta revisión.

Uso de marca: el lector está limitado en código a avisos de Yape y a Perú o
Bolivia según configuración, pero citar una marca no concede autorización ni
garantiza que Google o el titular la aprueben. Mantener una descripción factual,
sin sugerir afiliación, y pedir revisión competente antes de publicar ficha,
vídeo o capturas con marca. La marca no se usa como nombre del producto.

El Reglamento peruano de la Ley 29733 (D.S. 016-2024-JUS) y las reglas de datos
de Google Play requieren transparencia sobre recogida, uso, almacenamiento y
compartición. Esta lectura es una revisión de consistencia, no dictamen jurídico
ni aprobación de Play. Referencias oficiales: [Reglamento en gob.pe](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus),
[Datos de usuario en Google Play](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es-419),
[Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es-419),
[Propiedad intelectual](https://support.google.com/googleplay/android-developer/answer/9888072?hl=es-419).

**Qué sigue:** corregir en una entrega coordinada los textos legales y la ficha,
después verificar permisos, captura y respaldo en el APK final. **Qué falta:**
actualizar legal público/huellas con autorización expresa, confirmar tratamiento
real de Firebase y conservación de `captureId`, revisar la marca con asesoría,
completar Billing/Play si se decide vender, y prueba física antes de publicación.

09/10/2026. Revisión de código y HTTP público, no certificación jurídica,
aceptación de Play ni modificación de datos reales. Tarjetas/Sentry externo fuera.

## Corrección del registro de publicación

HTTP respondió 200 en privacidad.html, terminos.html y borrar-cuenta.html,
con Last-Modified Fri, 09 Oct 2026 06:17:23 GMT. Por tanto las notas históricas
«políticas solo en archivos / nada publicado» no sirven como garantía actual
para la web. Esto no demuestra qué APK, reglas o formulario están publicados.

La configuración de Pages no se pudo consultar con gh porque no hay sesión.
No se editó ningún HTML: como la web sirve archivos del repositorio, se debe
tratar su edición/push como potencial publicación y pedir autorización aparte.
Commit/push autorizado no autoriza Firebase, Play, AAB/OTA o alterar un texto
legal público. Antes de activar, verificar la fuente y automatización reales.

## Contradicciones verificadas, sin omitir

| Pieza | Problema actual | Corrección/condición |
|---|---|---|
| HTML de Términos público y local | «Al usar Fino, aceptas» y aceptación por seguir usando | Debe alinearse con la casilla explícita, nuevas versiones y recuperación/salida sin aceptación obligatoria. Fuente canónica constants/legal.ts; no se cambiaron sus hashes. |
| HTML de borrado | Desaparición «al instante» y «no conservamos ninguna copia» | Explicar proceso, errores/reintento, barreras técnicas temporales, historial ajeno anonimizado y archivos exportados que no controla Fino. |
| Borrado parcial | Promete eliminar nube en el momento | Gratis mantiene la copia remota anterior bloqueada; borrar local no demuestra actualización remota. Pro depende de conexión/confirmación y hay marcas de borrado. |
| Autenticación al borrar | Solo dice contraseña | Diferenciar contraseña y reautenticación Google; no pedir clave de Google a soporte. |
| Cómo borrar categoría | Ruta Presupuestos por categoría no confirmada como editor | Revisar recorrido Categoría/Personalizar, confirmar en Android y no publicar una ruta inventada. |
| Ficha larga/corta | Vendía nube/exportación/metas/Negocio sin indicar Pro; prometía cifrado total e inmediatez | PLAYSTORE.md corregido como borrador con Gratis/Pro, dictado Pro, prueba 24 h, sin cobro/anuncios activos, restricciones Android y entrega no confirmada por abrir otra app. |
| Seguridad de los datos | Equiparaba iniciar sesión a subir todas las finanzas; fotos de boletas/avisos brutos recogidos, UID solo Telegram, «No comparte» global | Borrador separa Auth, copia Pro, fotos realmente transmitidas, escaneo local, buzón local, Telegram/denuncias/dictado; cada respuesta requiere APK/proveedor/versión final. |
| Listas históricas del proyecto | Ocho funciones/«consejos financieros»/nube gratis | Son históricas; las rutas actuales y Premium prevalecen. Reportes gráficos son gratis y dictado es Pro. El registro Yape no estaba bloqueado por Pro en la revisión del 09/10; el código local del 14/10 ya exige Premium para Ajustes, la ruta y la captura, pendiente de entrega/verificación Android. No inventar consejos de inversión ni precios activos. |
| Planes S/3 y S/9,90 | Propuesta comercial, no Billing habilitado | No declarar ingresos/cobros/anuncios existentes. Faltan productos, periodicidad y pruebas con Play. |
| Retención/solicitudes por correo | Texto de plazo no prueba atención efectiva | Confirmar responsable, proceso, proveedor y evidencia; no garantizar que el correo se recibió. |
| Legal compartido | Recibo local/servidor preparados no implica activación real | Coordinar app, reglas, servidor, versiones/huellas y web; probar cuentas antiguas sin bloquear leer/devolver/salir/borrar. |

Verificador `pruebas/verificar-ficha-planes-real.mjs`: contrato estático de
borrador contra rutas/condiciones originales, no auditoría jurídica ni Play.
Una prueba de textos que dice «todo bien» no acredita todos estos puntos.

## Contenido compartido y moderación

Familia/Cajas son espacios por invitación; no se observó feed público ni mensajes
directos. Eso no prueba una exención: la política general pide moderación efectiva
y sistemas de denuncia/bloqueo adecuados, con requisitos particulares según la
experiencia. Revisar usuario/contenido/amenazas/fotos y rutas antes de clasificarlos.
[Política CGU de Google](https://support.google.com/googleplay/android-developer/answer/9876937?hl=es-419).

Aceptación y denuncia están preparadas, pero SMTP no está configurado y no se
ha probado recepción/atención. Su ausencia se informa como indisponible, no como
éxito. El propietario confirmó que atenderá en dinero123xc@gmail.com.
Falta resolver bloqueo/moderación de textos/usuarios sin esconder movimientos
financieros, cambiar importes ni saldos; no se implementó un filtro improvisado.

## Servidor publicado: comprobación acotada

Firebase CLI functions:list --project dotero-2d430 --json, Node 22, respondió
success con array de cero funciones (09/10). Se repitió y confirmó tipo/cantidad;
no se imprimieron secretos ni leyeron historiales. No hay un runtime publicado
que esta consulta permita verificar. No implica que Auth/Firestore estén vacíos,
que otros proyectos no tengan funciones ni que las reglas actuales sean correctas.
El código Node 22 está preparado, pero activación real permanece pendiente.

## Qué sigue y qué falta

Sigue preparar textos públicos coherentes y un plan de activación coordinado.
Falta autorización para publicación, revisión de Play/ley peruana/proveedores,
trámites, cuentas/configuración de correo, bloqueo/moderación y APK/Android real.
Revisar además FINO-52 antes de migrar o distribuir. No publicar una parte y
dar por actualizado el conjunto.
[Datos del usuario](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es-419);
[Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es-419).
