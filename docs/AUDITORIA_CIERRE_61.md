# Control de cierre de los 61 hallazgos originales y ampliaciones

Revisión: 11/10/2026. Este índice conserva todos los IDs del informe de Claude
y añade FINO-62/63, sin sustituir ni omitir los 61 originales.
No es un porcentaje de correcciones ni declara la auditoría terminada.
Las notas de código preparado remiten al seguimiento y a Git; no equivalen a
pruebas físicas ni a publicación. «Revalidar» significa que falta contrastar
el hallazgo con el código actual y dejar una prueba vinculada; no presupone que
siga fallando ni que ya esté corregido.

En la comprobación inicial no había teléfono ni AVD disponible. En la pasada
del video/acceso del 08/10 sí estuvo conectado el emulador `emulator-5554`;
la inspección fue parcial y no completa los recorridos Android de esta tabla.
Guía `PRUEBAS_ACCESO_INICIAL_VIDEO.md`: 1.870 fotogramas, acceso simulado
con SDK de la app, 189/189 comprobaciones SDK/HTTP locales aprobadas y
correcciones de registro/verificación. Google/correos reales siguen pendientes.
Las tarjetas de crédito permanecen excluidas por decisión del propietario.

Ampliación: PRUEBAS_CONFIGURACION_INICIAL.md documenta guardado inicial,
Idioma/Moneda separados, banderas decorativas y protección adicional de legado
sin dueño. 180/8 aprobadas sin tarjetas, no cierre de pruebas físicas ni de los
61 IDs. Las decisiones anteriores sobre País se sustituyen por la nueva petición.

Ampliación del 09/10: consultas repetidas y lecturas previas al permiso corregidas;
Pro se verifica transaccionalmente con datos acotados. Borrados no se olvidan por
superar 5000 movimientos/1000 metas; catálogo y controles etiquetados; seis
archivos sin consumidores retirados; ficha local de Play rectificada.
Guías PRUEBAS_CONSULTAS_ESTABLES, PRUEBAS_COMPATIBILIDAD_PENDIENTE,
PRUEBAS_ACCESIBILIDAD_PANTALLAS, PRUEBAS_CODIGO_RETIRADO y
REVISION_PRIVACIDAD_FICHA conservan evidencias/regresiones y pendientes.
En esa pasada FINO-52 tenía siete casos ROJOS fuera del conteo. La ampliación
siguiente conserva los siete: cuatro se detienen con fuentes intactas y TRES
siguen rojos. No queda cerrado por la batería aprobada.
La web pública sí respondió con textos antiguos contradictorios; no se editó
HTML ni se publicó app/servidor/reglas. Git no acredita esas activaciones.

Ampliación posterior: PRUEBAS_FORMATO_COPIA documenta rechazo de revisiones
desconocidas sin rebajarlas, mensajes distintos para revisión futura/dato inválido
y barreras de importación/TS/Admin. 188 pruebas/8 auditores sin tarjetas, 92
unitarias y 208 SDK/reglas/HTTP locales aprobadas; seis casos SDK de formato
recomprobados al final. El propietario aceptó actualizar antes de sincronizar,
no desplegar ni migrar datos reales. El mínimo global todavía necesita contrato
e implementación/activación compatible; los bloqueos no certifican versiones APK.

Ampliación del 10/10: contrato de origen/generaciones de borrado-recuperación,
lote local confirmado antes de memoria y migrador Admin con relectura del
destino preparados. FINO-62 nuevo: aportes independientes a una misma meta.
Regresiones c6959c6 muestran aporte 10+20 perdido, borrado en memoria pese a
disco lleno, carrera Admin que pisaba 30 con 10, referencia ausente aceptada
y callbacks que salían antes del ACK; originales con IO adaptado, no API faltante.
Final exit0: app 194 pruebas/8 auditores sin tarjetas, incluida UNA prueba del
usuario no versionada; 193 previstas en Git limpio, no otro checkout ejecutado.
Node 22: 64/64 seleccionadas fuera de Telegram/tarjetas. TypeScript/ESLint
generales finales aprobados. SDK/HTTP/reglas final: 229/229, sin omisiones,
cancelaciones ni fallos (.tmp/auditoria-punto1-sdk-final.log). El candidato
anterior 226/227 falló por exceso de expresiones en conversión válida; corrección
enfocada 7/7 y repetición integral aprobadas, SHA/recibo/tuplas/escape conservados
y sello fresco de escritores 2 también en raíz 1. ADB sin dispositivo/emulador
conectado; sin Android ni acreditación de integración Telegram.
Los siete diagnósticos FINO-52 ahora se detienen conservando fuentes y FINO-62
suma 30 en ambos órdenes. Las notas antiguas rojas quedan como antecedentes.
FINO-52/62 no cerrados globalmente: faltan Android/antiguos/activación autorizada.
Telegram EN PAUSA por decisión del propietario del 10/10; evidencia histórica
conservada, no autorización para retomarlo. Tarjetas/Sentry externo fuera,
rediseño diferido. No se publicaron app/reglas/funciones/HTML por este bloque.
Orden posterior: terminar SOLO el punto 1 y parar; no iniciar los puntos 2/3.
Punto 1 de preparación/código/pruebas locales TERMINADO; trabajo detenido.
Este cierre local no equivale a cerrar FINO-52/62
globalmente ni a una aceptación jurídica, publicación o prueba en teléfonos.

Orden posterior retomó el punto 2. Se corrigen viaje descartado de Bienvenida,
continuaciones de rutas de entrada abandonadas y fundido/rótulo de cubierta.
PRUEBAS_ACCESO_INICIAL_VIDEO, sección 11/10: app 196/8 sin tarjetas (una ajena
no versionada), Auth aislado 5/5 Node 22 y regresiones ed0cb18 rojas/verde actual.
No cerrar FINO-41/58/61 ni añadir esos casos como Android probado: falta recorrido
físico. La MISMA cuenta Google sigue rechazada, causa pendiente; no se quita guardia.
**Qué sigue/falta:** diagnóstico seguro y resto Android (2); servicios/consolas/
publicación (3). Sin entrega/despliegue; tarjetas fuera, Telegram en pausa.

Ampliación 11/10, 12:24:29: sesión exacta y respuesta Google verificadas en
originales; FINO-63 nuevo detiene borrado/sustitución con perfil ausente.
201/8 sin tarjetas (una ajena no versionada), TS/lint aprobados. Diagnóstico
local solo lectura solicitado, captura Reloading/resultado pendiente; NO
causa de misma Google demostrada. Detalle en PRUEBAS_ACCESO_INICIAL_VIDEO.
No entrega funcional ni cierre de recorridos Android/tareas ya enviadas.

| Hallazgo | Tema original | Situación y condición de cierre |
|---|---|---|
| FINO-01 | Cerrar sesión en el plan Gratis borra todos los datos del teléfono sin copia ni salida segura | Copia local por cuenta; 26c0e51. Falta recorrido Android A → B → A. |
| FINO-02 | Dinero aportado desde Personal queda atrapado y el borrado de cuenta se bloquea cuando vence el Premium del dueño de Familia/Caja | Correcciones de aportes/conciliación preparadas. Último cierre espera el ACK local; fallo conserva ficha, reintento no repite cierre remoto confirmado y error RPC anterior permite lectura fresca. verificar-espera-borrados-cierres-real: originales/IO adaptado y regresión c6959c6. Faltan dos dispositivos, Android, fallos de red físicos y despliegue autorizado. |
| FINO-03 | La fusión por bloques reemplaza enteros los presupuestos, categorías y calendario de la nube con la copia más reciente del teléfono | Fusión por elemento; 481220d. Falta actualización y dos dispositivos. |
| FINO-04 | La regla 'la nube personal es solo Pro' existe solo en la app nueva y está incompleta: el servidor permite leer/escribir a cualquier cuenta verificada | Reglas Pro preparadas; ab1fbe2. Falta comprobar/publicar reglas y funciones juntas. |
| FINO-05 | Las Cloud Functions usan Node.js 20: desde el 30/10/2026 no se podrán desplegar ni corregir y podrían deshabilitarse | Node 22 preparado y probado. CLI solo lectura devolvió success/0 funciones en dotero-2d430 el 09/10; no hay runtime observable en ese inventario. Falta activación coordinada y comprobarla, no significa que la app se detenga automáticamente por la fecha. |
| FINO-06 | La prueba Premium de 24 h puede repetirse indefinidamente borrando el propio documento de la cuenta | Revalidado: registro privado/transacción del servidor independiente del respaldo; pruebas premium-trial y nube-pro-servidor aprobadas. Guía PRUEBAS_INVITACIONES_UNICAS.md distingue adaptadores de pruebas reales. Falta recorrido Android y comprobar funciones/reglas publicadas. |
| FINO-07 | Para las funciones locales, Premium se decide en el teléfono (bandera guardada y reloj del dispositivo) | Decisión comercial e integración futura de cobros. No declarar suscripciones/anuncios existentes; requiere configuración de Play y pruebas de compra. |
| FINO-08 | La exportación automática se apaga sola para quienes tienen Premium de tester | Programación de tester corregida; 8c4883b. Falta Android cerrado/reinicio. |
| FINO-09 | La hora exacta prometida para la exportación automática no está garantizada (alarma exacta sin permiso) | Preparado: ficha advierte retrasos, intento previsto, consulta de acceso Android 12+ y política Kotlin con fallback/revocación comprobada. Regresión del catálogo roja/verde, Gradle debug aprobado. Guía PRUEBAS_HORARIO_EXPORTACION.md. Falta servicio/alarmas físicos, release y nueva instalación; no se promete puntualidad. |
| FINO-10 | Tocar un aviso de pago del calendario en el teléfono no abre el pago correspondiente | Toque del aviso preparado; cc385ae. Falta Android con candado y arranque en frío. |
| FINO-11 | El movimiento creado al confirmar un pago del calendario no guarda hora, método ni origen propio | Fecha/hora real preparada; d5909e6. Falta recorrido visual. |
| FINO-12 | En el calendario, un monto escrito como '1,500' se guarda como 1,5 | Lectura del monto corregida; bef0601. Falta formulario Android. |
| FINO-13 | Un fallo al descifrar se trata como 'no hay datos' y termina sobrescribiendo el historial | Lecturas dañadas no se sobrescriben; prueba error-guardado-local. Falta Android. |
| FINO-14 | Con el registro automático activo, la app descifra todo el historial cada 8 segundos aunque no haya avisos nuevos | Lecturas repetidas reducidas; a74afb5. Falta medir batería/rendimiento físico. |
| FINO-15 | Sincronización y funciones con lecturas/escrituras que crecen con el historial, sin App Check ni límites | PARCIAL: bucle de recepción eliminado; rechazos antes del libro, reintentos acotados y Pro transaccional con máscara, originales/adaptadores y SDK real/regresiones comprobados. Guía PRUEBAS_CONSULTAS_ESTABLES. Faltan checkpoint persistente/coherente, consultas compartidas completas, cupos/App Check, métricas/Android y activación autorizada; no ahorro garantizado ni techo de factura. |
| FINO-16 | Política, página de borrado y Seguridad de los datos no coinciden con lo que hace el código, y la web publicada está desfasada | CONFIRMADO pendiente: HTTP público 200 en tres páginas; Términos con aceptación implícita y borrado con inmediatez/copia/contraseña contradictorios. Ficha local corregida, no HTML ni Play. Guía REVISION_PRIVACIDAD_FICHA. Faltan autorización/publicación coherente, APK/proveedores, consola/retención y revisión jurídica; notas históricas «web no publicada» quedan supersedidas. |
| FINO-17 | Tras vencer Premium, los yapes siguen yendo a la caja del negocio y el acceso a Negocio es inconsistente | Vencimiento y destino corregidos; 446ba3d. Falta captura real Android. |
| FINO-18 | Los planes del código no coinciden con los propuestos: no hay plan 'sin anuncios', ni anuncios, ni cobro; periodicidad en conflicto | Decisión comercial e integración futura de cobros. No declarar suscripciones/anuncios existentes; requiere configuración de Play y pruebas de compra. |
| FINO-19 | El script de AAB toma el google-services*.json más reciente de Descargas | Selección y validación explícitas; 89820a1. Falta compilación limpia. |
| FINO-20 | Las reglas no obligan a consumir el código de invitación al unirse | Corregido en reglas preparadas: consumo y membresía juntos, revocación propia y rechazo de cuenta en eliminación. Regresión real de Firestore roja/verde y métodos originales; 142 pruebas de servidor local aprobadas. Guía PRUEBAS_INVITACIONES_UNICAS.md. Falta Android/dos cuentas, desplegar reglas y comprobar sesión antigua después de terminar el borrado Auth (no se declara cubierta). |
| FINO-21 | El receptor de exportación es público y acepta la acción de exportar desde cualquier app | Preparado: trabajo privado y entrada de arranque separada. Regresión estática/Kotlin JVM roja-verde; Gradle debug y manifiesto fusionado real aprobados. Guía PRUEBAS_RECEPTOR_EXPORTACION.md. Falta Android, release/firma y nueva instalación; no llega por OTA. |
| FINO-22 | Sin protección de capturas ni de la miniatura de 'recientes' cuando el candado está activo | Preparado: FLAG_SECURE nativo desde arranque, confirmado por Gate y conservado en margen/pausa. Kotlin JVM y Gradle debug/registro de módulo aprobados; regresión roja/verde. Guía PRUEBAS_PRIVACIDAD_CANDADO_INICIO.md. Falta Android/OEM, release y nueva instalación; APK anterior no queda protegido por OTA. |
| FINO-23 | El ojo de privacidad de Inicio oculta solo el disponible y el presupuesto, sin etiqueta accesible | Formato compartido de Inicio preparado: todos sus importes, filas/avisos/aportes y barra, con acción/estado accesibles en tres idiomas. Formato/fila/transferencias originales ejecutados; regresión roja/verde. Falta Android/TalkBack. No oculta descripciones ni otras pantallas. |
| FINO-24 | El lector de avisos guarda en claro el texto de los últimos 300 avisos de Yape y los nombres de las apps que notifican | Preparado: buzón 200 + lote reclamado 200 y 300 marcas cifrados AES-GCM/Keystore; diagnóstico JS ya cifrado hasta 40, no confundir ambos. Conversión antigua sin pérdida, guardado fallido restaurado en memoria, clave no sustituida y nombres ajenos retirados. Kotlin/JSON/JCE originales con adaptadores y regresiones rojas-verdes. Guía PRUEBAS_BUZON_YAPE_CIFRADO.md. Falta Keystore/servicio Android, nueva instalación acumulada y política publicada. |
| FINO-25 | La afirmación 'la voz se procesa en el celular' no está asegurada en código | Textos preparados ya no garantizan procesamiento local: política/HTML/ayuda traducida explican proveedor e internet, borrador Play marca audio por verificar. Política exportada ejecutada, regresión roja/verde; no se fuerza offline. Guía PRUEBAS_VOZ_CAMPANA.md. Falta proveedor/APK/tráfico/retención, consola y publicación de política; no confirma consentimiento legal. |
| FINO-26 | Animaciones y textos accesibles: la campana se sacude en cada apertura, sin 'reducir movimiento'; textos fijos en español | Preparado: fotografía inicial sin sacudida, IDs nuevos incluso con contador igual, control/cancelación dinámica de reducir movimiento y etiquetas de transferencias traducidas. Efecto/hook originales con adaptadores y catálogo real ejecutados; rojo/verde. Reanimated ya respeta sistema por defecto, se refuerza. Guía PRUEBAS_VOZ_CAMPANA.md. Falta Android/TalkBack; FINO-50 y tarjetas propias siguen fuera de este cierre. |
| FINO-27 | La ruta /import acepta cualquier archivo desde un enlace finzo:// y lo borra al terminar, incluidos archivos internos de la app | Canal externo restringido según seguimiento de seguridad. Falta probar enlace en Android. |
| FINO-28 | El manifiesto release combinado (02/10) incluye componentes exportados de librerías, uno de depuración | Preparado: plugin quita PreviewActivity y conserva recortador privado; launcher/receptores/compartir intactos. Proveedor Clipboard no se falsea (su implementación exige público, cache/.clipboard/ limitada). Mods originales/prebuild sin clean y merger debug real comprobados, guía PRUEBAS_ANDROID_CONFIGURACION.md. Falta manifiesto release final, recorte/compartir/avisos físicos y APK acumulado. |
| FINO-29 | La configuración de firma release vive solo en la carpeta android/ generada e ignorada por Git | Preparado: plugin en Git/app.json reconstruye release por FINZO_* sin valores secretos, idempotente sobre plantilla SDK real, conserva debug y falla cerrado sin claves/lenguaje inesperado. Groovy original con DSL/grafo adaptados y config Gradle debug real aprobados. Guía PRUEBAS_ANDROID_CONFIGURACION.md. No acredita firma/certificado real, clave custodiada, EAS ni AAB; pendientes credenciales/huella/Play/release y entrega. |
| FINO-30 | La exportación manual por WhatsApp/correo/compartir se marca como hecha al abrir la otra app | Preparado: externos solo archivo preparado, nunca confirma envío/ejecución al abrir/cancelar; ausencia explicada. Carpeta/nube esperan guardado real y error no confirma. Manejadores/catálogo originales con IO adaptado; regresión roja/verde, doble toque/reintento. Guía PRUEBAS_ENTREGA_EXPORTACION.md. Marca anterior no era historial visible de recepción. Falta Android/adjunto/servicios reales y entrega. |
| FINO-31 | Para decidir 'solo Pro', la app descarga primero el documento completo (con el historial v1) | Revalidado: permiso por llamada/máscara de campos; loadCloudData Gratis no lee el documento financiero. Prueba del método original nube-pro-servidor y reglas cloud-pro; guía PRUEBAS_INVITACIONES_UNICAS.md. Falta verificar versión desplegada y Android. |
| FINO-32 | El permiso de notificaciones se pide al arrancar, fuera de contexto, si hay pagos en el calendario | Preparado: programado automático no pide; intención de Guardar consumida una vez, activar/Probar explícitos, canal antes del diálogo y canAskAgain respetado. Apagar retira solo calendario; interruptor espera escritura confirmada y no finge éxito/doble toque. Programador/efecto/contexto/manejador originales con IO adaptado y regresión roja-verde. Guía PRUEBAS_PERMISOS_CALENDARIO.md. Falta Android/canales/sonido/cuentas y entrega; no es confirmación física. |
| FINO-33 | Las pruebas automáticas validan mucho texto del código y una de ellas consolida la pérdida de datos al cerrar sesión | Revalidado: logout+bóveda/cifrado originales conectados con IO adaptado conservan Gratis A→B→A, último cambio y fallos; regresión roja/verde. Tres lectores de regresión corregidos para respetar hash, salidas y contratos de aislamiento precisados. Prueba falsa de IDs retirada y diagnóstico rojo de FINO-52 explícito. Guía PRUEBAS_CALIDAD_REGRESIONES.md; los contratos estáticos NO prueban Android. Falta recorrido físico, no cobertura total por estar verde. |
| FINO-34 | Documentos del proyecto y de la ficha contradicen el código | PARCIAL: borrador PLAYSTORE actualizado a Gratis/Pro/dictado/ausencia de Billing y anuncios; recogida por recorrido, boleta/buzón locales y UID Firebase. Contrato estático original y regresión b6cccc0 comprobados. Listas históricas no prevalecen sobre rutas actuales. Faltan coherencia de páginas públicas, APK/ficha/formulario realmente publicados y revisión jurídica. |
| FINO-35 | La lectura de PDF descomprime sin límite | Preparado: streaming acotado antes de concatenar, límite por stream/acumulado/entrada/cantidad/fragmentos/cabecera, mensaje sin importación parcial. Extractor/fflate reales con compresión independiente, manejador adaptado, regresión roja-verde y 10.000 filas. Guía PRUEBAS_LIMITES_PDF.md. Falta RAM/Hermes Android y PDFs habituales grandes; no se garantiza cero cierres ni se declara lector PDF completo. |
| FINO-36 | Módulo de tarjetas de crédito oculto pero accesible por enlace/aviso y sincronizado sin plan | Excluido: tarjetas de crédito. No modificar ni dar por corregido. |
| FINO-37 | Código aparentemente sin uso | Seis huérfanos retirados con grafo/imports/búsqueda de consumidores y resolver original de Metro comprobados; regresión b6cccc0 roja. Guía PRUEBAS_CODIGO_RETIRADO; recuperables en Git, sin datos del usuario. Falta arranque/entrega Android; no garantía de cero código muerto restante. |
| FINO-38 | Crear una Familia con aporte valida contra el disponible del mes que se esté mirando, no del mes actual | Saldo del mes correspondiente; 6d4a211. Falta recorrido Android. |
| FINO-39 | La fecha de creación de una meta se calcula en hora UTC | Fecha local; 634ec94. Falta dispositivo con cambio de fecha. |
| FINO-40 | Eliminar la cuenta no hace la limpieza del teléfono que sí hace cerrar sesión | Limpieza y cierre preparados según seguimiento. Falta eliminación real con cuenta de prueba; tarjetas excluidas. |
| FINO-41 | Los paneles nativos (campana, selector de mes, confirmaciones, hojas de espacios) quedan por encima del candado | Cubierta de 276cf53 reforzada con PrivateModal: suspende paneles hasta desbloqueo y los recrea para heredar FLAG_SECURE; componente original comprobado. Guía PRUEBAS_PRIVACIDAD_CANDADO_INICIO.md. Faltan todos los recorridos Android; tarjetas excluidas. |
| FINO-42 | Un enlace finzo://export-pdf puede generar y enviar a otra app o a la nube el reporte, sin pasar por el candado | Enlace de exportación restringido; 276cf53. Falta guía Android. |
| FINO-43 | La copia en la nube del Modo Negocio no recuerda lo borrado: ventas, productos y negocios borrados reaparecen | Preparado: versiones/marcas, lote cifrado, copia por cuenta v3 compatible v1/v2 y reglas verificadas en Firestore local; regresión roja/verde. Guía PRUEBAS_NEGOCIO_BORRADOS.md. Falta Android/dos dispositivos y entrega coordinada con reglas. |
| FINO-44 | Al importar fusionando con un movimiento existente no se marca la edición, y otro teléfono puede revertirla | Corregido con prueba del manejador original y fusión entre clientes: edición fechada, conflictos rechazados y lote sin duplicados. Falta recorrido Android/dos teléfonos. |
| FINO-45 | Al exportar la Familia se usa la moneda del usuario y todos sus movimientos salen como 'Otros' | Corregido y probado con carga real de espacios: moneda Familia, categoría y notas conservadas. Falta abrir PDF/Excel/CSV reales en Android. |
| FINO-46 | Al importar un archivo con una sola columna de monto, los abonos positivos se guardan como gastos | Signos al importar corregidos; bf321b4. Falta importación visual. |
| FINO-47 | Entrar con Google crea la cuenta sin mostrar ni aceptar Términos y Privacidad; con correo la aceptación es implícita | PARCIAL: casilla previa, recibo local por cuenta y confirmación privada versionada del servidor. Reglas/edición de aporte/inicio de conversión requieren aceptación propia vigente; recuperación/salidas financieras conservadas. SDK/HTTP/Auth locales comprobados; guía PRUEBAS_ACEPTACION_SERVIDOR.md. Falta activación compatible app/servidor/huellas/reglas, Android y revisión jurídica; no acredita consentimiento sensible ni cierre FINO-48/49. |
| FINO-48 | Ley peruana de datos personales: los ingresos son 'dato sensible' y no hay evidencia de consentimiento por escrito, registro del banco de datos ni comunicación de transferencias | Comprobación jurídica y trámites externos pendientes; no pueden acreditarse desde el código. |
| FINO-49 | Familia y Cajas compartidas tienen contenido entre usuarios sin términos aceptados, ni denuncia ni bloqueo | PARCIAL: denuncias/responsable preparados y aceptación propia vigente en cliente/servidor/reglas. SDK/Admin/HTTP/Auth locales comprobados; guías PRUEBAS_DENUNCIAS_CONTENIDO.md y PRUEBAS_ACEPTACION_SERVIDOR.md. Configuración ausente rechaza sin anunciar recepción. Faltan SMTP/configuración/retención, bloqueo/moderación efectiva, Android/políticas/consolas/despliegue coordinado. No cumplimiento completo ni correo real. |
| FINO-50 | Interruptores y botones de solo icono sin rol, estado ni etiqueta para lectores de pantalla | PARCIAL: controles comunes y resto de iconos pulsables/catálogo etiquetados en tres idiomas; funciones/acciones/JSX originales, inventario AST y regresiones comprobados. Guías PRUEBAS_ACCESIBILIDAD_CONTROLES y PRUEBAS_ACCESIBILIDAD_PANTALLAS. Catálogo conserva memorización y no anuncia URI/foto. Faltan foco/agrupación/contraste/tamaño/gestos, Android/TalkBack y entrega; no accesibilidad completa. |
| FINO-51 | Cambiar la moneda o el país reetiqueta todo el historial sin convertir ni pedir confirmación, y cambia qué funciones aparecen | Preparado según decisión: moneda fija al configurar cuenta; país/idioma independientes; copias discrepantes no se unen ni suben. Manejadores/guardados originales con IO adaptado y SDK/reglas locales roja-verde. Guía PRUEBAS_MONEDA_FIJA.md. Falta Android, dos dispositivos y reglas/app publicadas; no conversión automática ni cambios en tarjetas. |
| FINO-52 | Dos teléfonos de la misma cuenta pueden generar el mismo id de movimiento y uno se pierde al fusionar | ABIERTO GLOBALMENTE; punto 1 de preparación/código/pruebas locales terminado. Origen y generaciones de borrado/recuperación, lote local antes de memoria, conciliación y Admin transaccional; revisiones desconocidas/antiguos ambiguos se detienen conservando fuentes. Guía PRUEBAS_CICLO_BORRADO_RESTAURACION: originales/regresiones y SDK integral final 229/229; siete diagnósticos se bloquean sin perder fuentes. Revisión 2/sellos frescos no certifican APK ni bloquean todas las lecturas antiguas. Faltan Android/dos equipos, revisión humana de antiguos ambiguos y activación coordinada autorizada; no renumerar, migrar ni quitar identidades para forzar éxito. Telegram en pausa, integración no acreditada. |
| FINO-53 | El aviso del calendario no dice cuándo vence el pago | Fecha completa en aviso; ecc9aa9. Falta aviso real. |
| FINO-54 | Importar, revisar duplicados, escanear boleta y aportar a una meta no impiden el doble toque | Manejadores de las cuatro pantallas protegidos y ejecutados en prueba, incluido reintento ante errores. Falta doble toque físico en Android. |
| FINO-55 | Si el elemento ya no existe, varias pantallas quedan en blanco o actúan mientras se dibujan | Corregido y probado con componentes/manejadores originales: mensaje/Volver y edición con origen vigente; falta recorrido visual Android. |
| FINO-56 | Editar la meta de ahorro no recalcula si está cumplida | Recalcular meta al editar; 634ec94. Falta recorrido Android. |
| FINO-57 | El CSV usa siempre 2 decimales y no neutraliza tabulador ni retorno al inicio de una celda | CSV moneda/texto corregido; 180d73a. Falta Excel/LibreOffice y Android. |
| FINO-58 | El candado falla abierto si no se puede leer SecureStore y hay una ventana inicial sin candado | Candado falla cerrado; 276cf53. Falta SecureStore/Android. |
| FINO-59 | Herramientas locales con efectos sobre producción o sobre el propio código | Herramientas protegidas; 49f8d2c. Sentry apartado por decisión del propietario: envío apagado en la versión preparada. Reactivación/verificación externa excluidas hasta nueva autorización. |
| FINO-60 | El cifrado local depende de crypto-js, librería que su autor declara sin mantenimiento | Cifrado sustituido compatible; 9067a37. Falta actualizar instalación Android con datos antiguos. |
| FINO-61 | 14 pruebas no ejecutan el código de la app: 5 prueban gráficos que ya no existen y 9 usan una copia de la lógica | Pruebas falsas retiradas/reemplazadas; ec0923e. Cuatro recorridos de navegación aún pendientes. |
| FINO-62 | Dos aportes independientes a la misma meta desde dos equipos sustituyen uno de los importes al fusionar | NUEVO; preparación/código/pruebas locales del punto 1 terminados. Diagnóstico original reproduce 10+20 conservando solo un aporte en c6959c6; operaciones independientes suman 30, reintentos no duplican y retiros incompatibles/cifras antiguas dudosas detienen la unión con fuentes intactas. verificar-aportes-metas-real ejecuta manejadores/fusión originales; SDK local integral final 229/229. Faltan Android/dos equipos, compatibilidad de copias antiguas y entrega/activación autorizadas. No cerrado globalmente ni recuperación de aportes ya perdidos. |
| FINO-63 | Dueño local activo con perfil ausente puede borrar bloques existentes o sustituirlos por una copia anterior al abrir la cuenta | NUEVO; guardia preparada conserva los originales y detiene apertura dudosa. Tres regresiones del módulo/almacén/cifrado originales rojas en 741ed40 por borrar/sustituir movimientos/presupuestos; actual verde, incluida primera cuenta legítima vacía. PRUEBAS_ACCESO_INICIAL_VIDEO, 11/10 12:24:29. Falta Android y recuperación segura del perfil; no acredita causa del rechazo Google del propietario ni recupera datos ya borrados. |

## Criterio de finalización

Cada ID debe quedar corregido y comprobado, descartado con evidencia o excluido
por decisión explícita. Los trámites/cuentas externas deben acreditarse y las
pruebas Android ejecutarse. La publicación es un paso separado que requiere
coordinación/autorización; un commit en GitHub no actualiza la app instalada.

**Qué sigue:** completar punto 2, retomado por orden posterior del propietario:
diagnóstico de su misma Google y demás Android; después punto 3.
**Qué falta:** Android/dos equipos/cuentas reales, antiguos ambiguos,
checkpoint/cupos/App Check/métricas, SMTP/bloqueo/moderación, Billing, web legal,
Privacidad/Play/trámites y autorización coordinada de entrega/activación.
Este archivo debe actualizarse al cerrar cada punto; no omitir pendientes de
gravedad baja ni declarar cerradas pruebas excluidas de Telegram/tarjetas/Sentry.
