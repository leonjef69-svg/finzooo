# FINO-16/34/47/49 — privacidad, ficha y activación pendientes

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
| Listas históricas del proyecto | Ocho funciones/«consejos financieros»/nube gratis | Son históricas; las rutas actuales y Premium prevalecen. Reportes gráficos son gratis; dictado es Pro; registro Yape no está bloqueado por Pro para Personal. No inventar consejos de inversión ni nuevos precios. |
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
