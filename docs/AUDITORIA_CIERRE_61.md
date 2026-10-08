# Control de cierre de los 61 hallazgos

Revisión: 07/10/2026. Este índice conserva todos los IDs del informe de Claude.
No es un porcentaje de correcciones ni declara la auditoría terminada.
Las notas de código preparado remiten al seguimiento y a Git; no equivalen a
pruebas físicas ni a publicación. «Revalidar» significa que falta contrastar
el hallazgo con el código actual y dejar una prueba vinculada; no presupone que
siga fallando ni que ya esté corregido.

No hay teléfono conectado ni AVD disponible en la comprobación de esta sesión.
Las tarjetas de crédito permanecen excluidas por decisión del propietario.

| Hallazgo | Tema original | Situación y condición de cierre |
|---|---|---|
| FINO-01 | Cerrar sesión en el plan Gratis borra todos los datos del teléfono sin copia ni salida segura | Copia local por cuenta; 26c0e51. Falta recorrido Android A → B → A. |
| FINO-02 | Dinero aportado desde Personal queda atrapado y el borrado de cuenta se bloquea cuando vence el Premium del dueño de Familia/Caja | Varias correcciones de aportes y conciliación. Faltan dos dispositivos, fallos de red y despliegue. |
| FINO-03 | La fusión por bloques reemplaza enteros los presupuestos, categorías y calendario de la nube con la copia más reciente del teléfono | Fusión por elemento; 481220d. Falta actualización y dos dispositivos. |
| FINO-04 | La regla 'la nube personal es solo Pro' existe solo en la app nueva y está incompleta: el servidor permite leer/escribir a cualquier cuenta verificada | Reglas Pro preparadas; ab1fbe2. Falta comprobar/publicar reglas y funciones juntas. |
| FINO-05 | Las Cloud Functions usan Node.js 20: desde el 30/10/2026 no se podrán desplegar ni corregir y podrían deshabilitarse | Node 22 preparado y probado según seguimiento. Falta verificar el runtime desplegado. |
| FINO-06 | La prueba Premium de 24 h puede repetirse indefinidamente borrando el propio documento de la cuenta | Revalidado: registro privado/transacción del servidor independiente del respaldo; pruebas premium-trial y nube-pro-servidor aprobadas. Guía PRUEBAS_INVITACIONES_UNICAS.md distingue adaptadores de pruebas reales. Falta recorrido Android y comprobar funciones/reglas publicadas. |
| FINO-07 | Para las funciones locales, Premium se decide en el teléfono (bandera guardada y reloj del dispositivo) | Decisión comercial e integración futura de cobros. No declarar suscripciones/anuncios existentes; requiere configuración de Play y pruebas de compra. |
| FINO-08 | La exportación automática se apaga sola para quienes tienen Premium de tester | Programación de tester corregida; 8c4883b. Falta Android cerrado/reinicio. |
| FINO-09 | La hora exacta prometida para la exportación automática no está garantizada (alarma exacta sin permiso) | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-10 | Tocar un aviso de pago del calendario en el teléfono no abre el pago correspondiente | Toque del aviso preparado; cc385ae. Falta Android con candado y arranque en frío. |
| FINO-11 | El movimiento creado al confirmar un pago del calendario no guarda hora, método ni origen propio | Fecha/hora real preparada; d5909e6. Falta recorrido visual. |
| FINO-12 | En el calendario, un monto escrito como '1,500' se guarda como 1,5 | Lectura del monto corregida; bef0601. Falta formulario Android. |
| FINO-13 | Un fallo al descifrar se trata como 'no hay datos' y termina sobrescribiendo el historial | Lecturas dañadas no se sobrescriben; prueba error-guardado-local. Falta Android. |
| FINO-14 | Con el registro automático activo, la app descifra todo el historial cada 8 segundos aunque no haya avisos nuevos | Lecturas repetidas reducidas; a74afb5. Falta medir batería/rendimiento físico. |
| FINO-15 | Sincronización y funciones con lecturas/escrituras que crecen con el historial, sin App Check ni límites | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-16 | Política, página de borrado y Seguridad de los datos no coinciden con lo que hace el código, y la web publicada está desfasada | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-17 | Tras vencer Premium, los yapes siguen yendo a la caja del negocio y el acceso a Negocio es inconsistente | Vencimiento y destino corregidos; 446ba3d. Falta captura real Android. |
| FINO-18 | Los planes del código no coinciden con los propuestos: no hay plan 'sin anuncios', ni anuncios, ni cobro; periodicidad en conflicto | Decisión comercial e integración futura de cobros. No declarar suscripciones/anuncios existentes; requiere configuración de Play y pruebas de compra. |
| FINO-19 | El script de AAB toma el google-services*.json más reciente de Descargas | Selección y validación explícitas; 89820a1. Falta compilación limpia. |
| FINO-20 | Las reglas no obligan a consumir el código de invitación al unirse | Corregido en reglas preparadas: consumo y membresía juntos, revocación propia y rechazo de cuenta en eliminación. Regresión real de Firestore roja/verde y métodos originales; 142 pruebas de servidor local aprobadas. Guía PRUEBAS_INVITACIONES_UNICAS.md. Falta Android/dos cuentas, desplegar reglas y comprobar sesión antigua después de terminar el borrado Auth (no se declara cubierta). |
| FINO-21 | El receptor de exportación es público y acepta la acción de exportar desde cualquier app | Preparado: trabajo privado y entrada de arranque separada. Regresión estática/Kotlin JVM roja-verde; Gradle debug y manifiesto fusionado real aprobados. Guía PRUEBAS_RECEPTOR_EXPORTACION.md. Falta Android, release/firma y nueva instalación; no llega por OTA. |
| FINO-22 | Sin protección de capturas ni de la miniatura de 'recientes' cuando el candado está activo | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-23 | El ojo de privacidad de Inicio oculta solo el disponible y el presupuesto, sin etiqueta accesible | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-24 | El lector de avisos guarda en claro el texto de los últimos 300 avisos de Yape y los nombres de las apps que notifican | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-25 | La afirmación 'la voz se procesa en el celular' no está asegurada en código | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-26 | Animaciones y textos accesibles: la campana se sacude en cada apertura, sin 'reducir movimiento'; textos fijos en español | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-27 | La ruta /import acepta cualquier archivo desde un enlace finzo:// y lo borra al terminar, incluidos archivos internos de la app | Canal externo restringido según seguimiento de seguridad. Falta probar enlace en Android. |
| FINO-28 | El manifiesto release combinado (02/10) incluye componentes exportados de librerías, uno de depuración | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-29 | La configuración de firma release vive solo en la carpeta android/ generada e ignorada por Git | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-30 | La exportación manual por WhatsApp/correo/compartir se marca como hecha al abrir la otra app | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-31 | Para decidir 'solo Pro', la app descarga primero el documento completo (con el historial v1) | Revalidado: permiso por llamada/máscara de campos; loadCloudData Gratis no lee el documento financiero. Prueba del método original nube-pro-servidor y reglas cloud-pro; guía PRUEBAS_INVITACIONES_UNICAS.md. Falta verificar versión desplegada y Android. |
| FINO-32 | El permiso de notificaciones se pide al arrancar, fuera de contexto, si hay pagos en el calendario | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-33 | Las pruebas automáticas validan mucho texto del código y una de ellas consolida la pérdida de datos al cerrar sesión | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-34 | Documentos del proyecto y de la ficha contradicen el código | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-35 | La lectura de PDF descomprime sin límite | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-36 | Módulo de tarjetas de crédito oculto pero accesible por enlace/aviso y sincronizado sin plan | Excluido: tarjetas de crédito. No modificar ni dar por corregido. |
| FINO-37 | Código aparentemente sin uso | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-38 | Crear una Familia con aporte valida contra el disponible del mes que se esté mirando, no del mes actual | Saldo del mes correspondiente; 6d4a211. Falta recorrido Android. |
| FINO-39 | La fecha de creación de una meta se calcula en hora UTC | Fecha local; 634ec94. Falta dispositivo con cambio de fecha. |
| FINO-40 | Eliminar la cuenta no hace la limpieza del teléfono que sí hace cerrar sesión | Limpieza y cierre preparados según seguimiento. Falta eliminación real con cuenta de prueba; tarjetas excluidas. |
| FINO-41 | Los paneles nativos (campana, selector de mes, confirmaciones, hojas de espacios) quedan por encima del candado | Candado sobre paneles preparado; 276cf53. Falta guía Android. |
| FINO-42 | Un enlace finzo://export-pdf puede generar y enviar a otra app o a la nube el reporte, sin pasar por el candado | Enlace de exportación restringido; 276cf53. Falta guía Android. |
| FINO-43 | La copia en la nube del Modo Negocio no recuerda lo borrado: ventas, productos y negocios borrados reaparecen | Preparado: versiones/marcas, lote cifrado, copia por cuenta v3 compatible v1/v2 y reglas verificadas en Firestore local; regresión roja/verde. Guía PRUEBAS_NEGOCIO_BORRADOS.md. Falta Android/dos dispositivos y entrega coordinada con reglas. |
| FINO-44 | Al importar fusionando con un movimiento existente no se marca la edición, y otro teléfono puede revertirla | Corregido con prueba del manejador original y fusión entre clientes: edición fechada, conflictos rechazados y lote sin duplicados. Falta recorrido Android/dos teléfonos. |
| FINO-45 | Al exportar la Familia se usa la moneda del usuario y todos sus movimientos salen como 'Otros' | Corregido y probado con carga real de espacios: moneda Familia, categoría y notas conservadas. Falta abrir PDF/Excel/CSV reales en Android. |
| FINO-46 | Al importar un archivo con una sola columna de monto, los abonos positivos se guardan como gastos | Signos al importar corregidos; bf321b4. Falta importación visual. |
| FINO-47 | Entrar con Google crea la cuenta sin mostrar ni aceptar Términos y Privacidad; con correo la aceptación es implícita | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-48 | Ley peruana de datos personales: los ingresos son 'dato sensible' y no hay evidencia de consentimiento por escrito, registro del banco de datos ni comunicación de transferencias | Comprobación jurídica y trámites externos pendientes; no pueden acreditarse desde el código. |
| FINO-49 | Familia y Cajas compartidas tienen contenido entre usuarios sin términos aceptados, ni denuncia ni bloqueo | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-50 | Interruptores y botones de solo icono sin rol, estado ni etiqueta para lectores de pantalla | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-51 | Cambiar la moneda o el país reetiqueta todo el historial sin convertir ni pedir confirmación, y cambia qué funciones aparecen | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-52 | Dos teléfonos de la misma cuenta pueden generar el mismo id de movimiento y uno se pierde al fusionar | Revalidar código actual, corrección si procede y prueba vinculada antes de cerrar. |
| FINO-53 | El aviso del calendario no dice cuándo vence el pago | Fecha completa en aviso; ecc9aa9. Falta aviso real. |
| FINO-54 | Importar, revisar duplicados, escanear boleta y aportar a una meta no impiden el doble toque | Manejadores de las cuatro pantallas protegidos y ejecutados en prueba, incluido reintento ante errores. Falta doble toque físico en Android. |
| FINO-55 | Si el elemento ya no existe, varias pantallas quedan en blanco o actúan mientras se dibujan | Corregido y probado con componentes/manejadores originales: mensaje/Volver y edición con origen vigente; falta recorrido visual Android. |
| FINO-56 | Editar la meta de ahorro no recalcula si está cumplida | Recalcular meta al editar; 634ec94. Falta recorrido Android. |
| FINO-57 | El CSV usa siempre 2 decimales y no neutraliza tabulador ni retorno al inicio de una celda | CSV moneda/texto corregido; 180d73a. Falta Excel/LibreOffice y Android. |
| FINO-58 | El candado falla abierto si no se puede leer SecureStore y hay una ventana inicial sin candado | Candado falla cerrado; 276cf53. Falta SecureStore/Android. |
| FINO-59 | Herramientas locales con efectos sobre producción o sobre el propio código | Herramientas protegidas; 49f8d2c. Sentry apartado por decisión del propietario: envío apagado en la versión preparada. Reactivación/verificación externa excluidas hasta nueva autorización. |
| FINO-60 | El cifrado local depende de crypto-js, librería que su autor declara sin mantenimiento | Cifrado sustituido compatible; 9067a37. Falta actualizar instalación Android con datos antiguos. |
| FINO-61 | 14 pruebas no ejecutan el código de la app: 5 prueban gráficos que ya no existen y 9 usan una copia de la lógica | Pruebas falsas retiradas/reemplazadas; ec0923e. Cuatro recorridos de navegación aún pendientes. |

## Criterio de finalización

Cada ID debe quedar corregido y comprobado, descartado con evidencia o excluido
por decisión explícita. Los trámites/cuentas externas deben acreditarse y las
pruebas Android ejecutarse. La publicación es un paso separado que requiere
coordinación/autorización; un commit en GitHub no actualiza la app instalada.

**Qué sigue:** los IDs marcados para revalidación. **Qué falta:** ese
contraste completo, Android, consolas, trámites y entrega. Este archivo debe
actualizarse al cerrar cada punto; no omitir los pendientes por ser de gravedad baja.
