# Estado actual de Fino

## Formatos y fuentes ambiguas — 09/10/2026, preparado

- Propietario aceptó exigir actualización para sincronizar, conservando datos
  locales. No autorizó despliegue/migraciones ni acceso a historiales reales.
- Nube valida revisión antes de reconstruir/limpiar y dentro de transacciones;
  formato futuro pide actualizar, datos inválidos piden revisar. Avisos al abrir/
  regresar respetan la sesión; importación/TS/Admin no descartan un alta
  identificada por una marca numérica dudosa. Telegram rechaza revisión desconocida.
- Guía PRUEBAS_FORMATO_COPIA: 188 pruebas/8 auditores sin tarjetas (una ajena
  no versionada), 92 unitarias Node 22 y 208 SDK/reglas/HTTP locales aprobadas.
  Seis casos SDK de formato recomprobados contra el código final; TypeScript/
  ESLint aprobados. Regresiones 07dfaf0 rojas por el fallo, no ausencia de API.
- El diagnóstico conserva siete casos: cuatro ahora se bloquean preservando
  fuentes, TRES siguen rojos. No es que toda la auditoría tenga solo tres pendientes.
  La migración ambigua se detiene; no renumerar/quitar identidades para eludirla.
- **Qué sigue:** contrato de origen/versiones/restauración y mínimo de escritores.
  **Qué falta:** tres casos, antiguos ambiguos, Android/dos equipos, SMTP/moderación,
  consolas/políticas/trámites/cobros y activación coordinada autorizada.
  Aún no hay mínimo global publicado ni cierre FINO-52; no cambió formato activo.
  Sin APK/AAB/OTA/despliegue; tarjetas/Sentry externo fuera, diseño diferido.

## Consultas, borrados, accesibilidad y ficha — 09/10/2026, preparado

- Se eliminó el bucle de descargas repetidas. Servidor comprueba permisos antes
  del libro completo; salidas repetidas se acotan y Pro se lee dentro de la
  transacción con máscara, sin historial/fotos/perfil del dueño.
- No se olvidan borrados por superar 5000 movimientos o 1000 metas, incluido
  Telegram; filtros de apertura/recepción por Set. Telegram no reutiliza un
  ID borrado. No se cambian montos, IDs ni formatos; no reconstruye datos perdidos.
- Rótulos/roles/selección del resto de iconos y catálogo en tres idiomas,
  manteniendo memorización/estilos y sin anunciar URI/base64 de fotos.
- Seis archivos sin consumidores retirados, recuperables desde Git. Ficha
  local de Play diferencia Gratis/Pro/dictado y no promete cobros/anuncios.
  La web pública sí respondió con Términos/borrado contradictorios; no se
  editaron HTML ni textos/huellas aceptados por app/servidor.
- TypeScript/ESLint aprobados; 187 pruebas/8 auditores sin tarjetas (una ajena
  no versionada: 186 previstas en Git limpio, no otro checkout). 88 unitarias
  Node 22 y 202 SDK/reglas/HTTP locales aprobadas, sin omisiones. Cinco
  contratos mixtos de tarjetas también excluidos, no cuentan como aprobados.
- FINO-52 conserva siete casos ROJOS fuera del corredor, explícitos en
  PRUEBAS_COMPATIBILIDAD_PENDIENTE: marcas sin origen y antiguos ambiguos.
  No equivale a cerrar pérdida de datos ni autoriza una migración real.
- CLI solo lectura: success/0 funciones en dotero-2d430, no runtime publicado
  observable; no se leyeron historiales ni cambiaron configuraciones.
- **Qué sigue:** contrato compatible de borrados/identidades y política mínima
  de actualización para que escritores antiguos no retiren protecciones.
  **Qué falta:** esa decisión, Android/Google/correo reales, App Check/métricas,
  SMTP/bloqueo/moderación, consolas/trámites/Billing, web y entrega coordinadas.
  Sin APK/AAB/OTA/despliegue. Tarjetas/Sentry externo fuera; diseño diferido.
  Seguimiento completo: docs/AUDITORIA_CIERRE_61.md; auditoría no terminada.

## Configuración segura e Idioma separado — 09/10/2026, preparado

- Decisión nueva: País pasa a Idioma en configuración/Ajustes; tres idiomas,
  moneda aparte y banderas solo decorativas. Enlaces antiguos mantienen alias;
  datos/catálogo/país histórico intactos, sin convertir ni reetiquetar importes.
- Perfil/presupuesto/marcas se confirman juntos antes de entrar. Doble toque,
  error/reintento y sesión/perfil/moneda cambiados comprobados. Idioma inicial
  no completa el registro. Avisos por cuenta/consulta y selectores reforzados.
- Historial antiguo sin dueño exige correo real confirmado y misma sesión;
  registro/arranque/verificación no lo sobrescriben. Salir sin abrir no borra,
  archiva ni asigna; Auth fallido no reabre datos ni reactiva lector antiguo.
- Guía PRUEBAS_CONFIGURACION_INICIAL.md: ocho suites originales con regresiones,
  180 pruebas/8 auditores aprobados sin tarjetas; una ajena no versionada
  (179 previstas Git limpio, no otro checkout). Android/cuentas reales pendientes.
- **Qué sigue:** restantes IDs, consultas/costes y compatibilidad.
  **Qué falta:** Android/Google/correo real, SMTP/moderación, consolas/trámites/
  cobros/migración y entrega autorizada. Nada publicado; tarjetas/Sentry fuera.
  Rediseño general diferido; banderas/rótulo son la petición puntual actual.

## Prioridad: acceso inicial estable, no rediseño (08/10/2026)

- Video decodificado completo: 1.870 fotogramas, 1.706 imágenes distintas
  revisadas; duplicados exactos conservan tiempos. Guía
  `docs/PRUEBAS_ACCESO_INICIAL_VIDEO.md` separa observación, causa y límites.
- Tercer Google protegido; error de datos no se disfraza de fallo Google.
  Registro parcial continúa sin recrear cuenta; verificación/reset únicos,
  mensajes precisos y desplazamiento/fondo funcional corregidos. UI nueva
  retirada por decisión del propietario; diseño queda para después.
- Firma Debug instalada comprobada en Firebase real SOLO LECTURA: sí está
  registrada; JSON local no reflejaba todas. Ninguna configuración cambiada.
- TypeScript/ESLint y 172 pruebas/8 auditores aprobados sin tarjetas, una
  prueba ajena no versionada (171 previstas Git limpio; no otro checkout).
  Integral final SDK/HTTP: 189/189 aprobados, sin omitir casos. Primera pasada
  falló por espera 25 s/evento ~26 s; aislada 14/14 y repetición integral
  aprobadas sin alterar esa aserción ni ampliar la espera. Acceso nuevo usa
  Firebase 12.16 de la app y manejadores originales contra Auth local.
- **Qué sigue:** recorrido de acceso/configuración y continuidad entre cuentas.
  **Qué falta:** cuentas/Google/correo Android real, resto de IDs, SMTP,
  consolas/trámites/cobros/migración y entrega autorizada. Nada desplegado;
  tarjetas/Sentry externo fuera. Auditoría no terminada.

## FINO-47/49 — aceptación en servidor preparada (08/10/2026)

- Callable verificado y recibo privado por UID/versionado; reglas preparadas
  exigen aceptación en altas/nombres compartidos. Edición de aportes e inicio
  de conversión protegidos en transacción; salidas/recuperación preservadas.
- Confirmación cliente tras elección local, exacta/por sesión, agrupada y
  limitada a cinco minutos; sin copiar historial ni conceder Pro. Evento Auth
  retira recibo; barrera existente impide recreación atrasada. Políticas en archivos.
- Guía `docs/PRUEBAS_ACEPTACION_SERVIDOR.md`: evidencia y límites, no jurídica.
  Batería integral: 184 SDK/HTTP locales y 86 unitarias Node 22, sin omisiones;
  app 169 pruebas/8 auditores sin tarjetas (168 previstas Git limpio, una ajena
  no versionada). Huella final de Privacidad/servidor/reglas igual; no publicación.
- **Qué sigue:** bloqueo/moderación/restantes IDs. **Qué falta:** Android,
  SMTP, revisión jurídica/trámites/consolas/cobros, compatibilidad/huellas y
  entrega coordinada autorizada. Nada desplegado; no distribuir app/reglas
  por separado. FINO-47/49 parciales; tarjetas/Sentry externo fuera.

## FINO-47/49 — aceptación local por cuenta, parcial (08/10/2026)

- Recibo local cifrado por UID y SHA-256 de ambos documentos tras elección
  explícita; se conserva al salir, se retira al borrar la cuenta. No Firebase
  nuevo ni respaldo financiero. Cuenta existente puede aceptar en Legal sin Pro.
- Diez altas/ediciones compartidas y conversión nueva requieren recibo vigente;
  pedirlo no deja Caja pendiente. Leer/devolver/salir/cerrar/borrar siguen posibles.
- Originales de recibo/cifrado/bóveda y manejadores con IO adaptado aprobados;
  TypeScript/ESLint sin avisos; 168 pruebas/8 auditores aprobados sin tarjetas.
  Una prueba local ajena no versionada: 167 previstas en Git limpio, no otro
  checkout ejecutado. Último refuerzo v2/HMAC comprobado en su suite original.
  dos regresiones `1292a78` rojas/actual verde. Guía
  `docs/PRUEBAS_ACEPTACION_POR_CUENTA.md` enumera límites. Políticas preparadas.
- **Qué sigue:** servidor/compatibilidad y bloqueo/restantes IDs.
  **Qué falta:** Android/TalkBack, SMTP, consolas/revisión jurídica/trámites,
  cobros y entrega autorizada. No cumplimiento jurídico acreditado ni cierre
  FINO-47/48/49. Sin APK/AAB/OTA/despliegue; tarjetas/Sentry fuera.

## FINO-50 — controles comunes accesibles, parcial (08/10/2026)

- Diez interruptores con nombre obligatorio, rol/estado y área de toque;
  PIN/biometría, mes/categoría y barras identificados, sin alterar dinero.
- JSX/acciones originales con adaptadores aprobados; cuatro regresiones
  rojas contra `53fbf38`. Mes/categoría son contratos estáticos, no Android.
  Guía `docs/PRUEBAS_ACCESIBILIDAD_CONTROLES.md`. No datos/permisos nuevos.
- TypeScript/ESLint sin avisos y 167 pruebas/8 auditores aprobados sin
  tarjetas. Una prueba ajena no versionada: 166 previstas en Git limpio,
  no otro checkout ejecutado. Corrección de rótulo inglés/portugués: PIN no
  requiere huella, por eso el interruptor no promete solo huella.
- **Qué sigue:** resto de controles/IDs, aceptación/bloqueo. **Qué falta:**
  TalkBack/Android, SMTP, consolas/trámites/cobros y entrega autorizada.
  Tarjetas/Sentry fuera; FINO-50 y auditoría no terminados.

## FINO-47 — elección previa a las altas, parcial (08/10/2026)

- Registro correo y ambos accesos Google requieren casilla explícita, sin
  marcar por defecto, antes de Auth. Documentos/fecha accesibles; elección
  bloqueada durante el acceso. Se retira la frase de aceptación automática.
- Manejadores/JSX originales con IO adaptado aprobados, regresión `a80a09b`
  roja/actual verde. Guía `docs/PRUEBAS_ACEPTACION_PREVIA_AUTH.md`.
- TypeScript/ESLint y 166 pruebas/8 auditores aprobados sin tarjetas; una
  prueba ajena no versionada (165 previstas en Git limpio, no otro checkout).
- NO acredita consentimiento sensible ni recibo por cuenta/versionado; sesiones
  existentes/correo y acceso previo a compartir aún pendientes. FINO-47/48/49
  no cerrados. No cambios financieros, Firebase/nativos ni publicación.
- **Qué sigue:** aceptación existente y bloqueo/restantes IDs. **Qué falta:**
  Android, SMTP, consolas/trámites/cobros y entrega autorizada. Tarjetas/Sentry fuera.

## FINO-49 — denuncias preparadas, envío aún pendiente (08/10/2026)

- Propietario confirmó que recibirá/revisará avisos de contenido inapropiado.
  Bandera/ficha en Familia y Cajas compartidas, con texto/motivo/aclaración;
  permiso Gratis, cuenta verificada y pertenencia comprobados en servidor.
- Texto/autor obsoleto rechazados; reintento del mismo ID no repite correo/cupo.
  Colecciones privadas sin permisos SDK; máscaras evitan leer dinero/historial.
  Denunciar no modifica movimientos ni saldos. Acuse NO confirma recepción.
- Configuración ausente falla sin guardar: proveedor SMTP/extensión todavía no
  instalados. No se enviaron correos ni se habilitó soporte en producción.
  Limpieza programada desde 30 días; borrado de cuenta cierra primero el cupo
  para bloquear solicitudes atrasadas. Correos ya recibidos requieren otra gestión.
- 11 comprobaciones SDK/Admin/reglas Firestore locales Node 22 aprobadas;
  captura previa a barrera roja, actual verde. Manejadores/tarea de sesión
  originales con IO adaptado y extractor TS con regresión Git roja/verde.
  Guía `docs/PRUEBAS_DENUNCIAS_CONTENIDO.md` detalla límites, no Android/SMTP.
- Políticas internas/HTML/Play preparadas, no publicadas; CGU no equivale a
  declarar todo No. FINO-49 parcial: faltan términos/bloqueo/atención efectiva.
- TypeScript/ESLint sin avisos; 165 pruebas/8 auditores, 83 unitarias de servidor
  y 80 comprobaciones SDK/reglas locales aprobados. Incluye una prueba local
  ajena no versionada: 164 previstas en Git limpio, no otro checkout ejecutado.
- **Qué sigue:** aceptación FINO-47 y restantes 15/16/34/37/49/50/52.
  **Qué falta:** configuración privada de correo, Android/dos cuentas,
  consolas/trámites/cobros y publicación autorizada. Tarjetas/Sentry fuera.


## FINO-52 — generador y origen de altas nuevas (08/10/2026)

- Máximo restaurado común ya no fuerza `máximo + 1`: salto nativo de 24 bits
  y control de entero seguro. UUID independiente distingue manuales/metas
  nuevos aun con colisión numérica forzada. No renumera ni etiqueta antiguos.
- Creación/edición/importación conservan origen; Yape lo guarda y recepción
  comprueba metas antes de aplicar metadatos. Parejas remotas siguen con sus
  referencias existentes; no se agrega identidad solo a la mitad local.
- Reglas preparadas conservan UUID v2 y marcador raíz `recordIdentityFormat`
  frente a apps antiguas que lo retiren. Migrador Admin comprueba orígenes.
- Regresiones contra `72e816b` rojas y actuales verdes; 100.000 altas,
  colisión forzada, edición y agotamiento. 83 pruebas del servidor Node 22 y
  40 comprobaciones SDK/reglas Firestore local aprobadas. Guía
  `docs/PRUEBAS_IDENTIDAD_CREACION.md` enumera cobertura y límites.
- TypeScript/ESLint sin avisos y 163 pruebas/8 auditores aprobados, sin tarjetas.
  Una prueba local ajena no versionada fuera del commit (162 previstas en Git
  limpio; no se ejecutó otro checkout). Política interna/web preparadas, no publicadas.
- FINO-52 aún abierto para antiguos ambiguos, lápidas por número, escrituras
  directas v1/otras entradas, migración y Android. Diagnóstico del máximo
  común ahora verde; NO usarlo como cierre del hallazgo completo.
- **Qué sigue:** compatibilidad restante y 15/16/34/37/47/49/50.
  **Qué falta:** Android/dos teléfonos, consolas/trámites/cobros y entrega
  autorizada. Sin publicación; tarjetas/Sentry externo fuera.

## FINO-52 — refuerzo parcial de avisos/aportes (08/10/2026)

- Orígenes conocidos diferentes bajo el mismo número detienen la unión:
  disco/memoria, importación, respaldo v1/v2 y recepción/restauración antes
  de cambiar perfil/presupuestos. Mensaje explica conservar ambas copias.
- Reglas preparadas del historial por documentos impiden cambiar/quitar
  referencias de Yape/aportes; edición del mismo origen y borrado admitidos.
- Código original/IO adaptado y SDK/reglas locales aprobados; regresiones
  contra `0a6b9a9` rojas. 38 comprobaciones Firestore actuales, incluidos
  10.000 movimientos, Pro, moneda e historial. Guía
  `docs/PRUEBAS_ORIGEN_MOVIMIENTOS.md` detalla qué NO queda protegido.
- TypeScript/ESLint sin avisos; 162 pruebas y 8 auditores aprobados sin
  tarjetas. Incluyen una prueba local ajena no versionada (161 previstas en
  Git limpio; no se ejecutó otro checkout). Diagnóstico FINO-52 rojo separado.
- FINO-52 sigue ABIERTO: generador/manuales/metas, referencias ausentes,
  lápidas por número, clientes v1 antiguos, Admin/migrador JS y todos los
  caminos de captura/creación necesitan trabajo. No se renumeraron datos.
- **Qué sigue:** identidad compatible de creación y restantes
  15/16/34/37/47/49/50. **Qué falta:** Android/dos teléfonos,
  consolas/trámites/cobros y entrega acumulada autorizada. Sin publicación;
  tarjetas/Sentry externo fuera. Auditoría no terminada.

## FINO-33 comprobaciones fiables / FINO-52 confirmado (08/10/2026)

- Tres lectores de regresión respetan el hash indicado, no HEAD; auxiliares
  de fusión de la misma revisión. Prueba de lectores roja contra `d7cdbe8`,
  actual verde; salidas separan IO adaptado de contratos estáticos/Android.
- Logout original conectado a bóveda/cifrado/almacén originales conserva
  Gratis A→B→A y último cambio, Pro y errores. Regresión del logout anterior
  `276cf53` roja por no confirmar copia. Limpieza de servicios/Auth adaptadas.
- Prueba falsa de IDs retirada: diagnóstico original confirma mismo ID con
  azar distinto/máximo común y pierde uno de dos movimientos/metas. FINO-52
  sigue ABIERTO, no arreglado; no se cambió el generador ni datos/tarjetas.
  Guía `docs/PRUEBAS_CALIDAD_REGRESIONES.md` documenta evidencia y límites.
- TypeScript/ESLint y 161 pruebas/8 auditores aprobados sin tarjetas. El total
  incluye una prueba local preexistente no versionada (160 previstas en una
  copia limpia; no se ejecutó otro checkout). Diagnóstico FINO-52 rojo separado.
- **Qué sigue:** protección compatible de IDs; revalidar 15/16/34/37/47/49/50.
  **Qué falta:** Android/dos celulares, consolas/políticas/trámites, cobros y
  entrega acumulada autorizada. No APK/AAB/OTA/despliegue; Sentry externo y
  tarjetas siguen fuera. Auditoría no terminada.

## FINO-51 — moneda fija por cuenta (08/10/2026)

- Decisión del propietario aplicada: elegir moneda en una cuenta nueva, fija
  al terminar su configuración aunque no tenga movimientos. Cambiar de país
  conserva moneda; perfil por cuenta conserva el bloqueo al volver a entrar.
- Unión/restauración/subida rechazan monedas discrepantes sin cambiar datos.
  Historial separado comprueba antes de subir y por fila; reglas preparadas
  impiden reetiquetar desde apps antiguas y reabrir configuración.
- Manejadores/fusión/guardado originales con IO adaptado y seis comprobaciones
  SDK/reglas Firestore locales aprobadas; ambas regresiones rojas contra
  `5cd7e09`. Guía `docs/PRUEBAS_MONEDA_FIJA.md`. No hay conversión automática.
- Repetición SDK junto a Pro/campos/historial: 25 comprobaciones verdes con
  Node 22. TypeScript/ESLint; 160 pruebas/8 auditores (159 en Git limpio).
- **Qué sigue:** restantes IDs. **Qué falta:** recorrido Android/dos teléfonos,
  revisión explícita de copias ya discrepantes, publicación coordinada de
  reglas/app y comprobación en consola. No se entregó ni desplegó. Tarjetas
  y Sentry externo fuera; auditoría no terminada.

## FINO-28/29 — configuración Android reproducible (08/10/2026)

- Plugin en app.json retira PreviewActivity y mantiene recortador privado,
  sin romper arranque/enlaces/receptores. ClipboardFileProvider permanece
  público: su implementación exige eso; restringido a cache/.clipboard/.
- Firma release por variables privadas regenerada también desde plantilla
  SDK limpia, idempotente y sin valores en Git; no queda debug como firma
  final. Faltan claves/huella real; no se crearon/sustituyeron credenciales.
- Plugin/mods originales en plantilla SDK real y Groovy original con DSL/
  grafo adaptados aprobados. Prebuild local sin --clean y merger Android debug
  real aprobado; configuración de comandos de package.json preservada.
  Guía `docs/PRUEBAS_ANDROID_CONFIGURACION.md`. Release firmado pendiente.
- TypeScript/ESLint y 159 pruebas/8 auditores verdes (158 en Git limpio).
- **Qué sigue:** restantes IDs. **Qué falta:** Android visual, manifiesto y
  firma release/Play/consentimientos/trámites y entrega acumulada. Nativo
  requiere APK nuevo posterior; ninguno generado/publicado ahora. Tarjetas
  y Sentry externo fuera; auditoría no terminada.

## FINO-32 — permisos de avisos contextuales (08/10/2026)

- Reprogramar al iniciar/recuperar/cambiar moneda no pide permiso. Guardar un
  pago consume intención una vez; activar o Probar sí son acciones explícitas.
  Negarlo conserva el pago, no se insiste en canAskAgain=false; canal antes
  del diálogo Android 13. Apagar limpia solo calendario, conserva exportación.
- Interruptor espera escritura confirmada y bloquea doble toque; fallo no
  cambia su posición ni programa sobre un valor anterior, muestra error.
- Programador, efecto/manejadores originales ejecutados con IO adaptado;
  roja contra `450f29d`, actual verde. Guía
  `docs/PRUEBAS_PERMISOS_CALENDARIO.md`. No prueba Android/sonido real.
- TypeScript/ESLint sin avisos; 158 pruebas/8 auditores aprobados (157 en
  Git limpio, más una prueba local preexistente del usuario).
- **Qué sigue:** restantes IDs de la matriz. **Qué falta:** Android, firma,
  consolas/políticas/trámites y entrega autorizada. Sin cambio nativo ni
  APK/AAB/OTA/despliegue. Tarjetas/Sentry fuera; auditoría no terminada.

## FINO-35 — lectura PDF con límites (07/10/2026)

- Entrada 15 MiB también dentro del lector; descomprime por partes antes de
  concatenar: 8 MiB/stream, 32 MiB acumulados, 4096 streams, 100.000 fragmentos
  y 128 KiB sin salida. Errores de límite no se ocultan ni importan páginas parciales.
- Mensaje traducido de menos páginas/CSV/Excel; carga liberada. Se evita bucle
  del tokenizador y búsqueda repetida sin cierre; se mantienen signos/columnas.
- Extractor/fflate reales y manejador con IO adaptado verdes; bomba 9 MiB,
  formatos, límites y 10.000 filas; regresión roja contra `595cf99`. Guía
  `docs/PRUEBAS_LIMITES_PDF.md`. No se asegura límite exacto de RAM Android.
- TypeScript/ESLint sin avisos y batería 157 pruebas/8 auditores aprobada
  (156 en Git limpio). No hay dispositivo en ADB, no se probó interfaz física.
- **Qué sigue:** permisos de avisos/restantes IDs. **Qué falta:** Android,
  firma/manifiesto, consolas/políticas/trámites y entrega autorizada.
  Sin APK/AAB/OTA/despliegue; tarjetas/Sentry fuera; auditoría no terminada.

## FINO-30 — exportar no confirma recepción (07/10/2026)

- WhatsApp/Gmail/correo/selector solo muestran archivo preparado, sin marcar
  envío/ejecución programada como terminada; ausencia de apps se explica.
  Carpeta/nubes conservan confirmación tras guardado correcto, no ante error.
- Bloqueo inmediato contra doble toque y reintento liberado. No cambian archivo,
  formatos, destinatario, nube/permisos/planes ni se inventan recibos de terceros.
- Manejadores/catálogo originales con IO adaptado aprobados, regresión roja
  contra `ac8ebd7`. Guía `docs/PRUEBAS_ENTREGA_EXPORTACION.md`. Android pendiente.
- TypeScript/ESLint sin avisos y 156 pruebas/8 auditores aprobados (155 en Git
  limpio; una prueba propia local se mantiene fuera del versionado).
- **Qué sigue:** restantes IDs, incluidos IDs de movimientos, firma/manifiesto,
  costos, políticas y accesibilidad. **Qué falta:** pruebas físicas, consolas,
  trámites y entrega autorizada. No APK/AAB/OTA/despliegue; tarjetas/Sentry fuera.

## FINO-24 — buzón de Yape cifrado (07/10/2026)

- Hasta 200 pendientes/lote 200 y 300 marcas contra duplicados cifrados con
  Android Keystore/AES-GCM. Diagnóstico JS ya cifrado hasta 40; no eran 300
  entradas de esa pantalla. Se retiran nombres de otras apps, no sus contadores.
- Migración al recoger/consultar valida todas las listas antiguas y conserva
  datos; error no equivale a vacío. Confirmaciones comprueban disco y restauran
  memoria ante fallo; no generar otra clave si queda un lote cifrado.
- Pruebas Kotlin/JSON/JCE originales con adaptadores aprobadas; regresiones
  contra `257813c` rojas. Guía `docs/PRUEBAS_BUZON_YAPE_CIFRADO.md`. TypeScript,
  ESLint y 155 pruebas/8 auditores aprobados (154 en Git limpio). Compilación
  Android debug inicial aprobó módulo/app; no es un servicio/Keystore físico.
- Sin nuevos permisos, nube o planes; políticas/Play preparados, no publicados.
  Requiere nueva instalación Android acumulada; OTA/APK anterior no lo contiene.
- **Qué sigue:** FINO-30/restantes IDs. **Qué falta:** Android/migración física,
  verificación release/firma, consolas/trámites y entrega autorizada.
  Tarjetas/Sentry siguen fuera; no se declara terminada toda la auditoría.

## FINO-25/26 — voz honesta y campana por llegada (07/10/2026)

- Política interna/HTML preparado/ayuda de tres idiomas explican que Android
  puede usar internet/proveedor para dictado. No se promete audio local por no
  guardarlo en Firebase; Play deja su declaración por verificar. No se cambia
  motor, compatibilidad, escucha ni datos y no se inventa consentimiento.
- Campana espera lectura inicial, no sacude por avisos históricos y compara
  IDs nuevos incluso con contador igual; cancelación con reducir movimiento en
  vivo, límite de ráfaga y etiquetas de transferencias traducidas. Reanimated
  ya respeta sistema por defecto, no se presenta su ausencia explícita como bug.
- Regresiones contra `cb7f1e2` rojas y actuales verdes: política exportada y
  efecto/hook originales con adaptadores. Guía `docs/PRUEBAS_VOZ_CAMPANA.md`.
- TypeScript/ESLint sin avisos y 154 pruebas/8 auditores (153 en Git limpio)
  aprobados; ADB sigue sin dispositivos. No se ejecutó voz ni animación Android.
- **Qué sigue:** FINO-24/restantes IDs. **Qué falta:** Android/TalkBack/proveedor
  real de voz, retención/tráfico, Play/política publicados, consolas/trámites,
  instalación nativa acumulada, firma y entrega autorizada. Tarjetas/Sentry fuera.

## FINO-22/23 y refuerzo FINO-41 — privacidad (07/10/2026)

- Candado protege ventana Android desde arranque; conserva protección al
  desbloquear y durante el margen. Confirmación nativa/errores/cancelación
  comprobados; paneles financieros no quedan por encima y se recrean con el PIN.
- Ojo de Inicio oculta todos sus importes y barra, con acción/estado accesibles
  en tres idiomas. No cambia datos ni oculta textos/otras pantallas.
- Regresiones rojas contra `6672b08`, verdes actuales. Kotlin original con
  adaptadores JVM aprobado; Gradle debug/SDK real aprobó módulo/app/manifiesto
  y registro automático del Package. No se declara prueba física ni release.
- Guía: `docs/PRUEBAS_PRIVACIDAD_CANDADO_INICIO.md`. Necesita instalación nativa
  nueva acumulada; APK anterior/OTA no contiene el nuevo módulo. Sin nuevos datos,
  permisos, nube o cambios de planes. No se generó APK/AAB ni se gastó EAS.
- TypeScript/ESLint sin avisos, 152 pruebas locales/8 auditores aprobados
  (151 en Git limpio; hay una prueba adicional del propietario sin seguimiento).
  ADB sin dispositivos; no se declara recorrido físico.
- **Qué sigue:** FINO-24 y restantes IDs. **Qué falta:** Android/TalkBack/OEM,
  release/firma, consolas, trámites y entrega autorizada. Sentry/tarjetas fuera.

## FINO-09 — hora prevista y permiso comprobado (07/10/2026)

- Ficha compacta y destinos en tres idiomas advierten retrasos; próximo intento
  previsto y prueba inmediata no prometen entrega puntual.
- Android 12+ consulta acceso existente antes de exacta; sin él usa aproximada.
  Política Kotlin original probada en JVM: revocación cae a fallback, otros
  errores no se ocultan. Sin nuevos permisos ni cambios de fechas/datos/planes.
- Regresión del catálogo roja contra `24f5757`, actual verde. Gradle/SDK real
  debug aprobado. Guía: `docs/PRUEBAS_HORARIO_EXPORTACION.md`.
- TypeScript/ESLint sin avisos y 150 pruebas locales/8 auditores aprobados
  (149 en Git limpio). JVM/Gradle son adicionales y no prueban puntualidad física.
- **Qué sigue:** FINO-22, privacidad de capturas/miniatura con candado.
  **Qué falta:** restantes IDs, servicio/alarmas físicos, nueva instalación
  nativa acumulada, firma release y publicación autorizada. Sentry/tarjetas fuera.

## FINO-21 — exportación privada y arranque separado (07/10/2026)

- Receptor de exportación privado, con el mismo componente/acción de alarma;
  receptor aparte de arranque protegido solo repone. Servicio permanece privado.
- Regresiones estática y ejecución Kotlin JVM rojas contra `de49c06`, verdes
  actuales. Gradle/SDK real aprobó Kotlin debug y el manifiesto recién fusionado.
  Release se detuvo por falta de variables de firma; no se modificó el candado.
  No se generó APK/AAB ni se gastó EAS. Guía: `docs/PRUEBAS_RECEPTOR_EXPORTACION.md`.
- TypeScript/ESLint sin avisos, 149 pruebas locales/8 auditores (148 en Git limpio)
  aprobadas. JVM usa adaptadores de Android, no acredita permisos físicos.
- **Qué sigue:** FINO-09, promesa de hora exacta de exportación. **Qué falta:**
  ese punto/restantes IDs, pruebas Android (ADB vacío), manifiesto release/firma,
  entrega nativa acumulada y publicación autorizada. Tarjetas/Sentry excluidos.

## FINO-20 y revalidación FINO-06/31 (07/10/2026)

- Invitación Familia/Caja se consume con la membresía en el mismo guardado;
  un miembro no revoca otros códigos. Una cuenta en eliminación no vuelve a
  entrar por petición atrasada. No cambian saldos, membresías existentes o planes.
- Métodos originales/SDK y reglas Firestore local comprobados, con regresión
  roja antes del arreglo. FINO-06/31 ya corregidos revalidados: prueba por cuenta
  no reiniciable borrando respaldo y Gratis sin descarga de fotos/movimientos.
  Guía y límites: `docs/PRUEBAS_INVITACIONES_UNICAS.md`.
- TypeScript/ESLint sin avisos, 148 pruebas locales/8 auditores (147 en Git
  limpio), 82 unitarias del servidor y 142 pruebas Firebase local/Node 22
  aprobadas. Regresión `d9c3d01` roja y versión actual verde. ADB sin dispositivos.
- Por comprobar: un token aún vigente después de terminar el borrado Auth;
  las reglas no verifican directamente existencia en Auth. No se afirma que
  esta protección durante el borrado cubra ese caso posterior.
- **Qué sigue:** FINO-21, receptor Android público de exportación; sigue abierto,
  el filtro de acción no protege de otra app. **Qué falta:** esa corrección,
  restantes IDs, Android, consolas y entrega autorizada. No desplegado/publicado.
  Sentry y tarjetas excluidos. No se declara terminada toda la auditoría.

## FINO-43 — Negocio no revive borrados (07/10/2026)

- Borrados/ediciones de las cuatro listas se conservan al fusionar nube,
  guardado conjunto cifrado y copia local por cuenta. Archivos antiguos v1/v2
  siguen legibles; nuevos archivos por cuenta v3. Reglas impiden retirar marcas
  o bajar formato. No se añaden escuchas permanentes de Firebase.
- La regresión de venta resucitada falló antes y pasa después. 148 pruebas
  locales/8 auditores (147 en Git limpio) y 129 pruebas del servidor local Node 22
  aprobadas. Guía y límites: `docs/PRUEBAS_NEGOCIO_BORRADOS.md`.
- **Qué sigue:** revalidar los restantes IDs del índice de 61 hallazgos.
  **Qué falta:** Android/dos dispositivos, reglas publicadas, políticas externas
  y entrega coordinada. No hubo APK/AAB/OTA ni despliegue. Sentry apagado en
  código preparado y apartado; tarjetas excluidas por decisión del propietario.

## FINO-55 — elemento eliminado con salida visible (07/10/2026)

- Detalle, edición de movimiento, meta/aporte/edición, revisión de duplicados
  y cuatro rutas de Negocio muestran un mensaje y «Volver» cuando falta el
  elemento, sin navegar mientras se dibujan ni abrir una creación por accidente.
- Las ediciones de movimiento y meta comprueban también el origen al guardar;
  una respuesta/toque atrasado no vuelve a crear el elemento. Las metas y
  movimientos usan su lista actual en memoria para esa comprobación.
- Prueba roja antes/verde después ejecutando componentes/manejadores originales
  con dependencias sustituidas. TypeScript, ESLint sin avisos y batería de
  cierre de 146 pruebas locales/8 auditores aprobados (145 en Git limpio).
- **Actualización:** FINO-43 corregido en la sección superior, no publicado.
  **Qué sigue y falta:** restantes IDs, Android y publicación.
  Tarjetas y comprobación de Sentry excluidas según decisión del propietario.

## FINO-44/54 — importación editada y guardados únicos (07/10/2026)

- La importación marca la fecha real de edición, evita IDs repetidos y no
  vuelve a crear movimientos borrados. Si un movimiento a fusionar cambió
  mientras se revisaba, rechaza el lote completo y pide cargarlo otra vez.
  Los aportes enlazados a espacios no se ofrecen como duplicados de gastos.
- Importar, revisar duplicados, guardar boleta y apartar/retirar una meta
  tienen bloqueos inmediatos contra toques repetidos. Ante error se liberan
  para reintentar. Las pruebas ejecutan los manejadores originales con
  dependencias sustituidas; ambas fallaron contra el código anterior.
- TypeScript, ESLint, 145 pruebas locales y 8 auditores aprobaron (144 pruebas
  en Git limpio). Empaquetado Android/Hermes aprobado con Sentry apagado.
  **Qué sigue:** FINO-43/55. **Qué falta:** doble toque físico,
  importación y sincronización en dos teléfonos; entrega. Tarjetas excluidas.

## Sentry apartado por decisión del propietario (07/10/2026)

- El propietario no tiene acceso y prefiere dejarlo fuera. `utils/sentry.ts`
  conserva llamadas compatibles para la raíz y tareas de fondo, sin cargar
  ni iniciar el SDK ni enviar diagnósticos. No se consultó ninguna cuenta.
- La prueba de no inicialización/envío falló antes y pasa ahora. Privacidad
  y PLAYSTORE describen la versión preparada; las instaladas no cambian
  hasta entregar una actualización. La integración de mapas anterior queda
  solo como referencia para una reactivación solicitada expresamente.
- **Qué sigue:** auditoría restante. **Qué falta:** entregar este cambio y
  ajustar la declaración de Play para esa versión. La comprobación externa
  de Sentry queda excluida hasta nueva decisión; tarjetas también excluidas.

## FINO-45 — reportes conservan moneda, categorías y notas (07/10/2026)

- Familia exporta con su propia moneda. Familia, Caja privada y Caja compartida
  conservan la categoría y notas guardadas; movimientos antiguos sin ellas
  mantienen «Otros» y notas vacías. No cambia el monto ni el filtro de transferencias.
- La prueba ejecuta `cargarEspaciosExportables` con los servicios sustituidos;
  falló antes del cambio. TypeScript, ESLint, 142 pruebas locales y 8 auditores
  aprobaron (141 pruebas en Git limpio).
- Se creó `docs/AUDITORIA_CIERRE_61.md` con todos los IDs originales y sus
  condiciones de cierre, incluidos los que aún deben revalidarse.
- **Qué sigue:** importación editada/repetida (FINO-44/54).
  **Qué falta:** abrir archivos reales de cada formato en Android y los restantes
  puntos del índice. Sentry: sin token/organización/proyecto configurados en
  esta sesión; comprobación de cuenta pendiente. Tarjetas excluidas.

## FINO-19 — configuración Firebase explícita al generar AAB (07/10/2026)

- `generar-aab.bat` ya no elige automáticamente el JSON más reciente de
  Descargas. Lee `android.googleServicesFile` de `app.json` y comprueba proyecto,
  remitente y paquete contra la configuración de Fino antes del prebuild.
- El auxiliar vuelve a validar antes de copiar y copia el contenido validado.
  La prueba con archivos ficticios rechaza proyecto/remitente/paquete incorrecto,
  duplicados y conserva el destino previo cuando falla. La configuración real
  pasó la comprobación de solo lectura; no se generó AAB.
- La nueva regresión y la prueba de acceso Google aprobaron. La batería completa
  de 140 pruebas y 8 auditores había aprobado en este mismo turno antes de este
  cambio; el nuevo caso eleva el inventario a 141 locales (140 en Git limpio).
- **Qué sigue:** conciliar el resto de IDs con sus pruebas y pendientes.
  **Qué falta:** compilación firmada en entorno limpio y prueba física;
  FINO-29 (firma) es un pendiente separado. Tarjetas excluidas.

## FINO-60 — cifrado mantenido con formato compatible (07/10/2026)

- Se sustituyeron `crypto-js` y sus tipos por `@noble/ciphers`, `@noble/hashes`
  y `@scure/base`, fijados a 2.4.0. Se conserva AES-256-CBC/PKCS7 + HMAC-SHA256,
  la llave de SecureStore, el prefijo v2 y la lectura del formato antiguo.
  No hay conversión masiva de datos ni cambio de llave.
- Se rechazan llaves malformadas sin reemplazarlas y campos sobrantes en el
  texto cifrado. La prueba nueva falló contra el código anterior; compara
  lectura/escritura de 10.000 movimientos con el cifrado independiente de
  Node y comprueba Unicode también con el TextDecoder real de Expo.
- TypeScript, ESLint, 140 pruebas locales y 8 auditores aprobaron (139 pruebas
  en Git limpio). Exportación Android/Hermes con mapas aprobada.
- **Qué sigue:** FINO-19, selección de configuración Firebase al generar AAB.
  **Qué falta:** actualizar sobre una instalación Android de prueba con datos
  antiguos, comprobar cierre/reinicio/sesión y publicar. Sin dispositivo ni
  AVD disponible en esta sesión. Tarjetas excluidas.

## FINO-59 — protección para activar mapas de Sentry (07/10/2026)

- La compilación normal conserva la protección que evita fallar por falta de
  credenciales de Sentry. Si se activa expresamente la subida de mapas, ahora
  conserva `sentry.gradle` y exige token, organización y proyecto en el entorno
  de compilación; no se guardan secretos en Git.
- La prueba nueva falló antes del cambio y pasa después. La guía está en
  `docs/SENTRY_MAPAS.md`.
- El plugin oficial y Metro quedan integrados, conservando NativeWind.
- TypeScript, ESLint, 139 pruebas locales y 8 auditores aprobaron; en una
  copia limpia de Git son 138 pruebas por el archivo local no versionado ya
  indicado abajo. La prueba de Sentry ejecuta la cadena real de mods de Expo.
- Exportación local Android con mapas aprobada: paquete Hermes y mapa
  comparten identificador; 4.172 fuentes. No es una compilación APK/AAB.
- **Qué sigue:** configurar las variables privadas en EAS y comprobar una
  compilación autorizada con un fallo de prueba en Android. **Qué falta:**
  confirmar en Sentry la traza legible y preparar la subida separada para
  actualizaciones OTA; tarjetas excluidas.

## FINO-61 — pruebas que no comprobaban la app (07/10/2026)

- Se retiraron del corredor cinco pruebas de gráficas de líneas/acumulados que
  ya no existen y una copia congelada del exportador. No eran comprobaciones
  de la app actual; `verificar-exportar.ts` sí ejecuta el exportador real.
  Los seis archivos borrados se pueden recuperar desde Git.
- El gráfico diario actual usa una cuenta extraída sin cambiarla a
  `utils/reportDaily.ts`, ahora ejecutada por una prueba nueva que falló antes
  de la extracción. Se retiraron dos simulaciones más, una de ellas del
  gráfico viejo de 31 barras. El ranking y la comparación de meses de Voz
  también usan ahora `utils/voiceMonth.ts`; su prueba real falló antes de
  extraerlos y cubre transferencias, meses vacíos y diferencias pequeñas.
  El resumen por día/mes de Voz usa también una función común con prueba real;
  se retiró otra copia que ignoraba transferencias.
- Cuatro simulaciones históricas de navegación/candado se conservan pero ya no
  cuentan como pruebas automáticas de la app. Pasan 138 pruebas locales y 8
  auditores sin
  tarjetas; una de esas pruebas (`verificar-resumen-gasto-ingreso-ui.mjs`) no
  está versionada, así que una copia limpia tiene 137. Los recuentos locales
  anteriores también la incluían. La reducción es deliberada: no se presenta
  cobertura falsa.
- **Qué sigue:** ejecutar `docs/PRUEBAS_NAVEGACION_CANDADO.md` en Android.
  **Qué falta:** ese recorrido físico, publicación y otros pendientes de la
  auditoría; tarjetas excluidas.

## FINO-58/59 — candado revalidado y herramientas locales protegidas (07/10/2026)

- FINO-58 ya estaba corregido: un error al leer SecureStore mantiene el
  candado cerrado y no enseña la app mientras se comprueba. La prueba que
  simula ese fallo volvió a pasar. Falta verlo en un Android real.
- FINO-59: `functions/local.js` ya no usa el proyecto de producción por
  defecto ni cambia el webhook sin autorización explícita; para producción
  exige una segunda autorización. No se ejecutó el bot ni se tocó producción.
  Se retiraron el comando y script `reset-project` de la plantilla, y su
  invitación en README. `sharp-cli` quedó fijado a una versión concreta.
  La prueba nueva falló antes del arreglo y pasó después; 149 pruebas y 8
  auditores sin tarjetas aprobaron.
- **Qué sigue:** revisar la generación/subida de símbolos de Sentry sin romper
  el AAB. **Qué falta:** esa parte de FINO-59, comprobación física del candado
  y entrega; tarjetas excluidas.

## FINO-57 — CSV según moneda y texto protegido (07/10/2026)

- El CSV manual y automático usan los decimales del espacio: por ejemplo,
  CLP sin decimales y BHD con tres. PEN conserva dos. Excel (.xlsx) no cambia.
- Las descripciones que empiezan con tabulador, retorno, salto de línea,
  espacios antes de una fórmula o signos de ancho completo reciben la misma
  protección de texto que las fórmulas ya cubiertas. La prueba específica
  falló antes del arreglo y pasa ahora. TypeScript, ESLint, 148 pruebas y 8
  auditores sin tarjetas aprobaron.
- **Qué sigue:** abrir un CSV real en Excel/LibreOffice y comprobar sus celdas;
  la interpretación puede variar entre programas. **Qué falta:** Android y
  publicación; tarjetas excluidas.

## FINO-10 — abrir pago desde el aviso del celular (07/10/2026)

- Tocar el aviso abre Inicio con la ficha inferior del pago y mes indicados,
  aun tras un arranque en frío; espera a que el candado se quite. Un aviso
  antiguo explica que el pago ya no está; uno ya marcado no ofrece duplicarlo.
- Prueba local específica, TypeScript, ESLint, 148 pruebas y 8 auditores sin
  tarjetas aprobados. **Qué sigue:** toque real con app abierta/cerrada y
  candado en Android. **Qué falta:**
  publicación; tarjetas excluidas.

## FINO-53 — fecha en el aviso del teléfono (07/10/2026)

- Los avisos del calendario muestran día, mes y año del vencimiento junto al
  monto, también en recordatorios e ingresos. En febrero se muestra la fecha
  realmente programada. La prueba falló antes del arreglo y pasa ahora;
  TypeScript, ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobaron.
- **Qué sigue:** comprobar FINO-10 en Android (abrir la ficha al tocar el
  aviso). **Qué falta:** entrega; tarjetas excluidas.

## FINO-38 — saldo correcto al aportar a Familia/Caja (07/10/2026)

- Crear o ampliar un aporte desde Personal se valida con el saldo del mes al
  que pertenece ese aporte, no con el mes que se quedó abierto en Inicio.
  Aplica a Familia, Cajas privadas y a la ampliación de aportes en Cajas
  compartidas; el formulario muestra la misma cifra.
- La regresión de ambos espacios falló antes y pasa ahora; TypeScript,
  ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobaron.
  **Qué sigue:** prueba visual en Android. **Qué falta:**
  entrega; tarjetas excluidas.

## FINO-11 — «Ya lo pagué» usa la fecha real (07/10/2026)

- Al marcarlo, el gasto o ingreso lleva la fecha y hora locales de ese toque.
  El vencimiento sigue en el calendario; pagar antes o después no altera esa
  fecha. Los movimientos ya existentes se conservan sin reescribir.
- La prueba falló con el comportamiento anterior y pasa ahora. TypeScript,
  ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobaron.
  **Qué sigue:** recorrido visual en Android. **Qué falta:** entrega;
  tarjetas excluidas.

## FINO-08 — la exportación de tester conserva su programación (07/10/2026)

- Si el trabajo con la app cerrada no puede verificar Pro, no hace el archivo
  pero tampoco apaga ni cancela la programación. Registra el motivo sin decir
  que se apagó; la prueba específica falló antes y ahora pasa.
- Esto evita perder la configuración, pero aún no garantiza el archivo para
  testers con la app cerrada: falta verificar su derecho vigente sin dejar un
  permiso duradero que sobreviva a una revocación. TypeScript, ESLint, 148
  pruebas locales y 8 auditores sin tarjetas aprobaron. **Qué sigue:** diseñar
  esa comprobación. **Qué falta:** Android, red/permiso de
  tester, control de avisos repetidos y publicación; tarjetas excluidas.

## FINO-17 — Yapes y negocios cuando vence Pro (07/10/2026)

- Sin Pro, los Yapes nuevos quedan en Personal aunque hubiera un negocio
  elegido como destino. Los anteriores no cambian de lugar y un aviso ya
  registrado en Negocio no se duplica en Personal. Esto funciona también en
  el trabajo de fondo; si allí no se puede verificar un permiso de tester,
  se elige Personal para no encerrar ingresos.
- La lista y los paneles de negocios existentes se pueden consultar sin Pro.
  Crear/cambiar/borrar sigue reservado; apagar el destino antiguo está
  permitido, encenderlo no. Ajustes y diagnóstico muestran el destino real.
  La prueba de 24 horas caduca a la hora exacta y se revisa al regresar.
- TypeScript, ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobados
  (una prueba ajena sin registrar no entra en este cambio). La
  prueba en Android y la entrega siguen pendientes. **Qué sigue:** continuar
  la auditoría. **Qué falta:** app abierta/cerrada,
  compras/permiso de tester y demás hallazgos; tarjetas excluidas.

## FINO-14 — captura sin lecturas completas cada ocho segundos (07/10/2026)

- El lector sigue revisando avisos cada ocho segundos, pero solo descifra el
  registro breve mientras no haya cambios. Relee movimientos y caja al llegar
  un aviso, detectar una escritura del trabajo de fondo, volver al frente o
  al cumplir un minuto de repaso. No espera un minuto para mostrar un yapeo
  que Android ya guardó.
- Si una de las listas no se puede leer, no registra ni confirma un aviso
  sobre datos incompletos. TypeScript, ESLint, 148 pruebas locales y 8 auditores
  sin tarjetas aprobados; una prueba ajena sin registrar no entra en este
  cambio. Falta comprobarlo en Android con muchos movimientos.
  Código no publicado; tarjetas excluidas.
- **Qué sigue:** cerrar verificación y continuar la auditoría. **Qué falta:**
  prueba física de rendimiento y segundo plano, consolas, entrega coordinada
  y demás riesgos no resueltos.

## FINO-39/56 — fecha y estado de metas (07/10/2026)

- Una meta nueva toma el día local del celular, no el día UTC que en Lima
  puede ser mañana cerca de medianoche. Al editar el objetivo, «cumplida»
  se recalcula con el monto realmente ahorrado: bajar el objetivo puede
  cumplirla y subirlo puede dejarla pendiente. El guardado vuelve a comprobar
  ese estado aunque la meta llegue desde otra pantalla.
- Regresión roja antes del cambio; TypeScript/ESLint, 148 pruebas sin tarjetas
  y 8 auditores aprobados. No hay migración automática de fechas antiguas:
  cambiarlas sin evidencia podría inventar el día equivocado. Código aún no
  publicado; falta la prueba visual en Android.
- **Qué sigue:** reducir lecturas periódicas innecesarias y continuar el
  resto de hallazgos. **Qué falta:** Android, consolas, publicación coordinada
  y auditoría restante; tarjetas fuera.

## FINO-46 — signos de una columna Monto al importar (07/10/2026)

- Si un archivo sin columna Tipo/Cargo/Abono usa cargos negativos, sus
  montos positivos se leen como ingresos. Si todos son positivos, siguen
  siendo gastos: no se inventan ingresos en extractos de otro formato.
  La regla excluye totales con fecha inválida y se aplica también a filas
  que esperan que la persona elija fecha. La columna Tipo explícita manda.
- La regresión falló antes del cambio y pasó después. TypeScript/ESLint,
  148 pruebas sin tarjetas y 8 auditores aprobados. Es código preparado, no
  publicado; la vista previa aún no permite cambiar manualmente el tipo de
  cada fila y falta comprobar extractos reales y Android antes de dar el
  hallazgo por cerrado para todos los formatos.
- **Qué sigue:** seguir con pérdida/corrupción de datos y añadir revisión
  manual de tipo en la importación si se confirma necesaria. **Qué falta:**
  pruebas físicas, consolas y publicación; tarjetas fuera.

## FINO-12 — monto del calendario corregido en código (07/10/2026)

- El formulario ya no convierte `1,500` en S/ 1,50: conserva lo escrito y al
  guardar interpreta miles/centavos según la moneda. `1,500.25` y `1.500,25`
  dan S/ 1.500,25; los separadores ambiguos y los montos fuera del límite se
  rechazan sin recortar el número. La prueba nueva falló con el código anterior.
- TypeScript, ESLint, 147 pruebas sin tarjetas y 8 auditores aprobados. Sin
  nuevos datos, permisos ni cambios nativos. Código preparado, no entregado a
  teléfonos; la verificación visual de pegar/escribir en Android sigue pendiente.
- **Qué sigue:** continuar los hallazgos financieros y probar este campo en
  Android. **Qué falta:** pruebas físicas de las correcciones monetarias,
  revisión de consolas/políticas y publicación coordinada; tarjetas fuera.

## Cierre seguro de elección monetaria convergente — preparado (07/10/2026)

- Una elección pendiente se puede cerrar sin Pro solo si Personal y Caja ya
  coinciden tanto en el teléfono como en el servidor. El servidor guarda una
  huella técnica por UID/operación para impedir que una petición antigua vuelva
  a imponer el monto. Si la corrección ganó antes, la app recupera su resultado
  auténtico en lugar de afirmar que se retiró. No se borran los cuatro
  originales, no se mueve dinero y un desacuerdo conserva el pendiente.
- Marca local `retirado` en lote indivisible de Personal/borrados/Cajas, con
  acuse genuino y cola de sincronización. La huella remota se elimina al borrar
  la cuenta. Guía: `docs/PRUEBAS_RETIRO_IMPORTE_CAJA.md`. Política interna/web y
  borrador de Play actualizados solo en archivos.
- TypeScript/ESLint, 147 pruebas locales y 8 auditores sin tarjetas,
  82 unitarias de servidor y 128 pruebas SDK/HTTP/reglas con Firebase local y
  Node 22 aprobados. La prueba local ajena sin registrar se conservó fuera del
  commit. Entrega en Android con cuenta, consolas y políticas publicadas se
  deben comprobar antes de lanzar. En este turno un APK de
  desarrollo sí se instaló **solo en emulador** y abrió la bienvenida; no se
  probó el flujo de dinero con una cuenta real. Tarjetas intactas, sin APK/AAB/
  OTA ni despliegue a usuarios.
- **Qué sigue:** validar el retiro en Android con cuenta de prueba y dos
  dispositivos. **Qué falta:** publicación
  coordinada autorizada de servidor/app, revisión de consolas/Play y los demás
  hallazgos de auditoría. No volver a una función anterior que ignore la huella.

## Nueva revisión de elección monetaria pendiente — preparada (06/10/2026)

- Pro puede revisar fuentes actuales y confirmar otra elección de monto/fecha
  para una pareja exacta. Reconsulta después del Sí; mirar no guarda. Anterior
  queda `sustituido` con originales/elección intactos, nueva `pendiente`, en
  mismo lote Personal/borrados/Caja. No se retira una sin conservar la otra.
- Cadena local mutua por IDs, cuenta/moneda y versión creciente; copia atrasada
  no revive elección, ramas incompatibles se rechazan. Reserva/cuenta/acuse
  genuino siguen protegiendo lote. Límite de espacio no borra originales.
- Respuesta vieja invalidada por nueva cola; servidor mantiene CAS exacto.
  Si una petición anterior ya enviada termina remotamente, no se fuerza la
  decisión nueva: queda pendiente y revisable. Guía vigente:
  `docs/PRUEBAS_SUSTITUCION_IMPORTE_CAJA.md`. Políticas preparadas, no publicadas.
- TypeScript/ESLint completos aprobados; 146 pruebas locales y 8 auditores,
  77 unitarias de servidor y 126 SDK/reglas/HTTP/eventos bajo Node 22 real
  aprobados, sin fallos, omisiones ni cancelaciones en servidor. Regresión
  1084e38 falla antes y pasa ahora. Una prueba local ajena sin registrar cuenta
  en el total, pero no se incorpora al commit; no se probó un checkout limpio.
  Dos suites específicas de tarjetas excluidas, no verificadas.
- **Qué sigue:** retiro sin sucesora/Pro, fuentes totalmente coincidentes y
  demás casos sin prueba. **Qué falta:** Android (ADB vacío)/otros hallazgos,
  consolas y publicación coordinada autorizada. No rollback a cliente que
  desconozca cadena sin migración. Sin tarjetas/nativos/marca/APK/AAB/OTA/
  despliegue. Punto 1/auditoría siguen abiertos.

## Recuperación monetaria ya completada sin Pro — preparada (06/10/2026)

- Respuesta perdida/fallo local y Pro vencido ya no impiden recuperar una
  corrección que siga aplicada exactamente en el servidor. Nuevo endpoint de
  solo lectura comprueba identidad/cuenta/fuentes/versión/saldo y devuelve
  confirmación mínima; no corrige ni descarga historial ni crea recibos.
- Reintento empieza por recuperación. Solo «todavía no aplicada» permite
  solicitar escritura con Pro vigente. Red/edición posterior/acuse falso no
  fuerzan otro arreglo. Diario cifrado y comprobante genuino antes del lote
  local, misma versión y otros registros/originales conservados.
- Botón Gratis «Comprobar resultado pendiente», no respaldo Gratis. Políticas
  internas/web/PLAYSTORE actualizadas solo en archivos. Guía vigente:
  `docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`. Regresión 48e9f95 reproduce el
  bloqueo previo; se refiere al código preparado, no a daño publicado.
- TypeScript/ESLint completos y 145 locales/8 auditores aprobados; una prueba
  ajena sin registrar se conserva fuera del commit. Tarjetas: dos suites
  específicas excluidas. 77 unitarias y 124 SDK/reglas/HTTP/eventos Node 22
  real aprobados, cero fallos/omisiones/cancelaciones. Regresión falla antes
  y pasa ahora; lotes/recuperación/textos legales repetidos con guardias finales.
- **Qué sigue:** revisión obsoleta/resultado nunca aplicado cuando Pro venció:
  retiro o sustitución explícitos sin borrar originales. **Qué falta:** Android
  (ADB vacío)/otros conflictos/hallazgos, consolas/políticas publicadas y entrega
  conjunta autorizada de servidor/reglas/app. Tarjetas intactas; sin nativos,
  marca, APK/AAB/OTA ni despliegue. Punto 1 y auditoría permanecen abiertos.

## Comparación de importes — flujo conectado, sin publicar (06/10/2026)

- Pantalla Cajas: cuatro fuentes con monto/moneda/fecha, confirmación humana,
  reconsulta después del Sí y opciones inseguras desactivadas. Ver el formulario
  no guarda ni decide dinero. Conflicto de nube no oculta el acceso a revisión.
- Originales/elección y fuentes vivas Personal/borrados/Caja se conservan juntos
  antes de HTTP; después, recibo genuino y lote verificado con versión exacta.
  Fallos dejan pendiente visible; reintentar/reiniciar no inventa otro ID ni
  duplica dinero. Pro vencido o elección obsoleta no borran los originales.
- Dos toques bloqueados; modal durante operación. Caché avisa a nueva pantalla;
  lectura/render atrasados no restauran otra copia. Guía vigente:
  `docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md`. Es código preparado, no versión entregada.
- TypeScript/ESLint completos aprobados; 144 locales/8 auditores, 73 unitarias
  servidor y 121 SDK/reglas/HTTP/eventos bajo Node 22 real, sin fallos/omisiones/
  cancelaciones. Total local incluye una prueba ajena sin registrar, no incluida
  en commit; dos suites específicas de tarjetas excluidas. Regresión cbe2b08
  falla por contrato nuevo ausente, no por bug de entrega publicada.
- **Qué sigue:** protocolo para desbloquear una elección obsoleta/Pro vencido
  antes de recuperar respuesta, sin descartar originales; pruebas Android.
  **Qué falta:** dispositivos (ADB vacío), demás conflictos/hallazgos y entrega
  conjunta autorizada de servidor/reglas/app, consolas/políticas publicadas.
  No cambios nativos/tarjetas, marca, APK/AAB/OTA ni despliegue. Punto 1 abierto.

Las secciones siguientes registran fases anteriores, no el estado de la UI
tras esta integración.

## Lote monetario local — contexto preparado, UI pendiente (06/10/2026)

- Confirma Personal/borrados/Caja juntos con respuesta HTTP genuina, misma
  cuenta/generación/cola y originales releídos en la cola de escritura. Misma
  versión del servidor; no inventa otra ni reemplaza otros movimientos.
- Reserva corta durante SQLite/lectura impide mutaciones antes de alterar
  memoria; captura en cola espera. Cifrado permite repreparar con otra edición.
  Escritura fallida mantiene originales/pendiente; verificación fallida congela
  escrituras sin borrar. Reserva siempre liberada. Pantalla cerrada tras iniciar
  SQLite no recibe éxito; cuenta vigente refleja lo realmente comprobado.
- Guía: `docs/PRUEBAS_LOTE_IMPORTE_CAJA.md`. Contexto/setters/cliente/colas/
  almacén originales con SQLite real, no Android físico. 10.001 movimientos/
  1.001 Cajas conservados. Regresión ddde38d falla por API nueva ausente.
- SDK/reglas/HTTP/eventos: 120 aprobadas bajo Node 22 real, ninguna omitida,
  cancelada ni fallida; incluye lote original y expiración después de HTTP.
  73 unitarias del servidor aprobadas. ADB no encontró dispositivos.
- Auditor de código excluye cachés/artefactos que agotaban su tiempo; recorrido
  original probado con regresión ddde38d, sin retirar fuentes propias ni ampliar
  timeout. Tres lectores previos adaptados a las guardias reales, no vacías.
- TypeScript/ESLint y repetición final: 143 locales/8 auditores aprobados (una
  prueba ajena sin registrar, no incluida en commit). Dos suites de tarjetas
  excluidas, no contadas como aprobadas. La pasada que expiró no se cuenta.
- **No habilitado:** contexto importa verificador, pero pantalla no invoca lote
  ni nueva petición. **Qué sigue:** elección, petición/lote en misma cola,
  recuperación visible, decisión obsoleta/Pro vencido y controles concurrentes.
  **Qué falta:** Android/otros conflictos/hallazgos/consolas/publicación conjunta
  autorizada. No nuevas claves/datos/retención, nativos/tarjetas/marca/entrega.
  Punto 1/auditoría abiertos; no atomicidad servidor/teléfono.

## Cliente monetario — confirmación del servidor preparada (06/10/2026)

- Fuentes frescas dentro de cola de revisión auténtica; historial v2 limitado
  al ID/enlace afectado, sin descargar toda la colección. Cache/error/ausencia,
  moneda/formato/borrados/duplicados no se convierten en una copia vacía.
- Petición exige originales/elección idénticos en disco y pareja actual válida,
  antes y después de HTTP. Confirmación genuina ligada al objeto, cuenta,
  generación y cola; copiar/calcular un ack no basta. Reglas/servicio aplican Pro.
- No marca el resultado como guardado local; respuesta perdida/pantalla cerrada
  conserva pendientes. Reintento vigente recupera confirmación sin otra escritura.
  Guía: `docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`. No fuentes globalmente atómicas
  en el formulario: servidor las relee en su transacción final.
- TypeScript/ESLint, 141 locales/8 auditores (una prueba ajena sin registrar: 140 en
  copia limpia), 73 unitarias y 117 SDK/reglas/HTTP/eventos Node 22 reales
  aprobados. Prueba directa repetida tras guardias finales; regresión aee6653
  falla por contrato nuevo ausente, no por fallo de la app publicada. ADB vacío.
- **Sin activar:** ningún botón/import del contexto/petición desde pantalla,
  lote monetario final, nativos/tarjetas/marca/instalable/OTA/despliegue. Mismo
  esquema de datos ya documentado, sin nueva clave/colección/retención.
- **Qué sigue:** lote financiero con respuesta genuina, mutaciones protegidas,
  selección y recuperación explícita (incluye decisión obsoleta y Pro vencido).
  **Qué falta:** otros hallazgos/conflictos, Android/tamaño/dos dispositivos,
  consolas y publicación coordinada autorizada. Punto 1/auditoría abiertos.

## Respaldo Personal/Caja — coordinación preparada (06/10/2026)

- Revisión monetaria pendiente pausa ambas copias ordinarias, también tras
  reinicio. Cola por UID, identidad/generación, lectura Cajas legible y guardia
  antes de escribir/tras esperar. Historial v2 anidado sin candado circular.
- Sello solo en memoria: contexto, hidratación y descarga Caja rechazan respuestas
  anteriores a una revisión o cuenta. No rejuvenece objetos/autorizaciones viejos.
  Ajustes explica la pausa; no muestra respaldo actualizado con confirmación vieja.
- Espera una subida ya enviada, no promete cancelarla/deshacerla. La futura
  elección exige fuentes frescas dentro de esa cola, originales antes de red y
  guardado conjunto confirmado. **No hay botón/petición monetaria conectados aún.**
- Guía: `docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`. Regresión c24eff0 reproduce
  respaldo Personal S/80 mientras Caja sigue S/100 con revisión pendiente.
- TypeScript/ESLint, 140 pruebas del ámbito/8 auditores (una prueba ajena sin
  registrar: 139 en copia limpia), 73 unitarias y 112 SDK/reglas/HTTP/eventos
  bajo Node 22 real aprobados. Regresión c24eff0 falla como se esperaba. ADB
  sin dispositivos; la primera suite SDK detectó adaptadores/error de sesión,
  se corrigieron sin quitar aserciones y la repetición completa aprobó.
  Tarjetas fuera: dos suites específicas
  excluidas y no contadas como aprobadas; compilación/lint generales no auditan
  ese módulo. Sin nuevos datos/claves/retención: políticas/Play no se modifican.
- **Qué sigue:** pantalla/selección, mutaciones locales protegidas, petición,
  lote financiero y recuperación. **Qué falta:** otras discrepancias/hallazgos,
  Android/tamaño/dos dispositivos/consolas/publicación coordinada autorizada.
  Punto 1/auditoría abiertos; sin nativos/tarjetas/marca/instalable/OTA/despliegue.

## Originales monetarios — archivo local preparado, pantalla pendiente (06/10/2026)

- `revisionesImporte` conserva cuatro originales, elección, UID/IDs/moneda,
  fechas y confirmación en Cajas cifrado y bóveda por cuenta existentes.
  Normalizar/fusionar no lo descarta; no depende de referencias del formulario.
- Valida con el módulo puro real del servidor; rechaza NaN/fechas/metadata
  incompatibles, duplicados y respuesta/cuenta/moneda distintas. Hasta 50
  revisiones/400.000 bytes totales, cada una 150.000 bytes, sin borrar anteriores.
- Fusión/recuperación/subida ordinaria de Cajas no corrigen una decisión pendiente.
  Confirmadas no vuelven a pendientes; originales excluidos del respaldo Caja.
  Plan local solo propone ambas mitades con igual versión, sin tocar otros registros.
- **No conectado:** no hay botón, petición ni guardado financiero nuevo en pantalla.
  Sigue integrar selección, barrera de Personal/subidas en vuelo y lote conjunto,
  con recuperación/revisión obsoleta. La barrera Caja sola no permite habilitarlo.
- Guía: `docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md`; regresión sintética b48e703
  pierde la revisión al normalizar. Cifrado/bóveda reales con sustitutos de Android,
  no prueba física. Políticas interna/web/PLAYSTORE preparadas, no publicadas.
- TypeScript/ESLint, 141 locales/8 auditores (una prueba ajena sin registrar:
  140 en copia limpia), 73 unitarias Functions y 110 SDK/reglas/HTTP/eventos
  Node 22 reales aprobados. Regresión b48e703 falla como se esperaba. Los
  lectores de pruebas se adaptaron a módulos originales, sin quitar aserciones.
  ADB sin dispositivos. **Qué falta:** otras discrepancias, Android/
  espacio/tamaño/dos dispositivos, consolas y publicación coordinada autorizada.
  Sin tarjetas/nativos/marca/instalable/OTA/despliegue. Punto 1/auditoría abiertos.

## Diferencias de dinero — base del servidor, sin activar en app (06/10/2026)

- `resolvePrivateBoxMoney` prepara monto/fecha elegidos entre cuatro originales
  de un aporte Personal/Caja privada con ID exacto. UID de Auth, cuenta real
  verificada, Pro transaccional, moneda/saldo y fuentes comprobadas de nuevo.
- Personal y Caja remotos se actualizan juntos; historial antiguo o separado,
  duplicados, borrados/cierre/conversión/devolución y edición posterior protegidos.
  Repetir resultado vigente no escribe. Preserva otros registros/metadata; datos
  no finitos no se confunden con null. Petición limitada a 150.000 bytes.
- Escala monetaria compartida sin SDK/Node; extracción de cálculo de devolución
  sin cambio de reglas. El test sigue el módulo real y conserva la comparación
  del catálogo. No hay nueva colección/recibo ni retención distinta en servidor.
- Guía: `docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`. Regresión SDK contra
  e10b2b6 reproduce Caja S/100 con Personal S/80 al interrumpir el recorrido
  anterior después de subir Caja. No equivale a afirmar afectación de usuarios.
- **No habilitado ni publicado:** falta integrar la pantalla, guardar originales/
  elección cifrados antes de pedir la corrección, guardar ambas mitades localmente,
  bloquear subidas incompatibles y recuperar tras fallos/reinicio/cambio de cuenta.
- **Qué sigue:** esa integración y sus pruebas. **Qué falta:** restantes conflictos,
  Android, índices/consolas, políticas según nuevos datos locales y publicación
  coordinada autorizada. Punto 1/auditoría abiertos; no atomicidad servidor/celular.
- TypeScript/ESLint, 140 pruebas locales/8 auditores (una prueba ajena sin
  registrar: 139 en copia limpia), 73 unitarias de Functions y 110 pruebas
  SDK/reglas/HTTP/eventos aprobadas bajo Node 22 real, sin omisiones ni
  cancelaciones. Regresión e10b2b6 falla como se esperaba (Personal 80 != 100).
  ADB sin dispositivos: Android sigue pendiente. Sin tarjetas, código nativo,
  CODE_MARKER, APK/OTA, despliegue o datos reales consultados/modificados.

## Recuperación incompleta — guardias financieras del punto 1 (06/10/2026)

- Regresiones contra 37ff973 reproducen reconstrucción de Caja cerrada,
  propagación de fecha imposible y excepción al leer reparto no iterable.
  Cierre/conversión residual, monto/fecha inválidos o reparto incompleto no
  reconstruyen dinero. Se conserva el archivo, sin devolución/borrado ficticio.
- Explicación distingue datos inválidos y Caja cerrada/convertida/liquidada;
  no ofrece elegir dinero en esos casos. Devolución sin ID/mitad enlazada pide
  revisión; ID exacto válido mantiene su recuperación. No altera datos de Cajas
  compartidas ajenas al archivo ni pierde la identidad privada disponible.
- Dentro del guardado conjunto original, un plan antiguo inseguro no escribe
  ninguna clave ni publica éxito. Destinos indexados una vez, 10.001 filas/
  1.001 Cajas comprobadas sin ajuste; no equivale a velocidad o prueba Android.
- Guía: `docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`. TypeScript/ESLint,
  140 locales/8 auditores (una prueba ajena sin registrar: 139 en copia limpia),
  63 unitarias y 99 SDK/reglas/HTTP/eventos aprobados bajo Node 22 real. Primera
  pasada detectó validación fuera de ámbito/identidad perdida; código ajustado,
  sin quitar aserciones. Tres regresiones fallan antes y pasan ahora.
- Sin nuevas claves/datos recogidos/retención, reglas/Functions de producción,
  código nativo, tarjetas, marca, APK/OTA o despliegue. Privacidad/Play no cambian
  en esta tanda porque no se guarda ni transmite información nueva.
- **Qué sigue:** desacuerdos financieros entre celular/nube, mitad/reparto sin
  prueba y elecciones obsoletas; conservar no significa resolverlos. **Qué falta:**
  Android/visual/cierres/espacio/tamaño/dos dispositivos y publicación coordinada
  autorizada. ADB sin dispositivos. Punto 1 y auditoría todavía abiertos.

## Nombres distintos de Caja — avance limitado del punto 1 (06/10/2026)

- Igual versión y otros campos iguales permiten elegir celular/nube tras
  confirmación. Conserva primero ambos nombres y elección cifrados localmente;
  no envía nada si ese guardado falla. No cambia dinero ni movimientos.
- Transacción lee otra vez ESA Caja y modifica solo nombre/versión. Rechaza
  una edición/borrado/conversión posterior; conserva otras Cajas, movimientos,
  marcas, recibos y campos raíz desconocidos. Repetir un resultado vigente
  confirma sin otra escritura; disco/red/sesión/plan/ack inválido no dan éxito.
- Revisión local en contenedor/copia por cuenta existentes; no viaja a Firebase.
  Hasta 50 revisiones, sin borrar una antigua al llegar al límite; todas propias
  visibles. Acceso nube sigue Pro. Políticas interna/web/PLAYSTORE preparados.
- Guía: `docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`. No volver a app antigua que elimina
  esa metadata al normalizar sin verificar conservación/compatibilidad.
- TypeScript/ESLint, 139 locales/8 auditores (una prueba ajena sin registrar:
  138 en copia limpia), 63 unitarias y 97 SDK/reglas/HTTP/eventos aprobados
  con Node 22 real. Regresión contra 482f2fd falla como se espera.
- **Qué sigue:** punto 1 abierto para dinero distinto, mitad ausente/reparto
  no demostrable y elecciones pendientes obsoletas. **Qué falta:** Android/
  cierres/espacio/tamaño/dos dispositivos, consolas y publicación autorizada.
  ADB sin dispositivos; no se modificó código nativo, tarjetas o CODE_MARKER,
  no se instaló/publicó nada. No es atomicidad global servidor/celular.

## Enlace heredado elegido — avance del punto 1 (06/10/2026)

- Revisión muestra Caja y alternativas de Personal. El usuario identifica y
  confirma la pareja; no se decide automáticamente por monto/fecha.
- Igual importe/fecha, dirección y IDs únicos; bloquea marcadores de borrado,
  otro espacio/enlace, cierre, conversión pendiente y devoluciones posteriores.
  Guarda IDs de ambas mitades juntos, conservando dinero y campos originales.
- Selección/confirmación obsoleta, fuente distinta o fallo no cierran la revisión.
  Gratis corrige localmente; Pro mantiene la comprobación de IDs del servidor
  y nunca fuerza una edición/borrado remoto no recibido. Lista de 20 en 20.
- Guía: `docs/PRUEBAS_ENLACE_HEREDADO.md`. Regresión contra 410bbb3 reproduce
  el rechazo anterior de la elección. Sin claves/servicios/retención nuevos,
  cambios nativos, tarjetas, entrega o despliegue.
- La diferencia remota tiene aviso visible específico y conserva la revisión;
  no se presenta como fallo genérico de disco ni se fuerza la unión.
- TypeScript/ESLint aprobados; 138 locales/8 auditores (una prueba ajena sin
  registrar: 137 en copia limpia), 63 unitarias y 92 SDK/reglas/HTTP/eventos con
  Node 22 real, sin fallos/omisiones. SQLite/confirmación originales comprobados;
  no equivalen a Android físico. La regresión anterior falla como se espera.
- **Qué sigue:** punto 1 aún abierto para diferencias local/nube concurrentes,
  mitad ausente y reparto no demostrable. **Qué falta:** puntos 2 y 3, Android/
  cierres/espacio/tamaño/dos dispositivos, consolas y publicación autorizada.
  ADB no encontró dispositivos conectados; no se declaró prueba física hecha.

## Pares Personal/Caja heredados — recuperación protegida (06/10/2026)

- Regresión comprobada contra 0f0588f: Caja S/100 imponía ese monto sobre
  Personal S/80. También recuperaba enlaces por monto/fecha y guardados separados.
- Recupera únicamente vínculos comprobados y guarda ambas mitades/marcas
  juntas; no pisa otro movimiento ni borra por ausencia/marca heredada.
  Conserva notas, imágenes, etiquetas y campos existentes. Consumo/borrados/
  duplicados/repartos dudosos se conservan para revisar, sin devolver dinero.
- Diferencia inequívoca de monto/fecha permite elegir Personal o Caja con
  aviso explícito. No permite saldo negativo ni un ajuste parcial cuando hay
  devoluciones posteriores. Espera Personal y Caja; bloquea operaciones/subida
  privada mientras hay revisión y no reintenta en bucle un guardado fallido.
- Pro consulta servidor solo para IDs afectados (y aportes del reparto),
  tanto documento antiguo como historial separado. No usa caché ni toma una
  edición/borrado remoto no recibido como autorización para reconstruir.
  Gratis no consulta nube. Recalcula la propuesta dentro del guardado vivo.
- Guía: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`. Sin claves/retención/servicios
  nuevos, cambios nativos, tarjetas, APK/OTA, CODE_MARKER o despliegue Firebase.
- TypeScript/ESLint aprobados; 137 pruebas locales/8 auditores (una prueba ajena
  sin registrar: 136 en copia limpia), 63 unitarias Functions y 91 SDK/reglas/
  HTTP/eventos con Node 22 real, sin fallos ni pruebas omitidas. Regresión
  contra 0f0588f falla por la sobrescritura S/80 → S/100; código nuevo aprobado.
- **Qué sigue:** legado no demostrable y diferencias local/nube explícitas.
  **Qué falta:** Android/cierres/espacio lleno/datos grandes/dos dispositivos,
  revisión visual, consolas y publicación coordinada. No es atomicidad global
  servidor/celular ni cierre de toda la auditoría.

## Borrado de cuenta con conversiones incompletas — preparado (05/10/2026)

- Una copia pendiente de S/100 se trataba como dinero compartido y bloqueaba
  borrar cuenta. Índices sin destino también fallaban por permisos SDK.
- `prepareIncompleteBoxDeletion`: comprobar no escribe; descartar se llama
  después de validar lo compartido, verifica de nuevo y cierra/limpia únicamente
  clones propios. Sin Pro, correo verificado e identidad reciente; UID sale de
  Auth. No devuelve dinero ficticio ni altera Personal/origen durante esa fase.
- Cubre protocolos 2/3, raíz sin índice, índices sin destino y legado con copia
  exacta/subconjunto comprobado contra el origen privado. Legado sin origen,
  copia diferente, miembros invitados o recibo de publicación se conservan con
  explicación. Una publicación que gana a la limpieza queda fuera del descarte.
- Raíz/membresía se conservan cerradas hasta borrar Auth; SDK no las elimina ni
  recrea su índice. El evento purga esas barreras antes de retirar recibos y
  elimina también pendientes creados durante el recorrido. Una app vieja no
  inicia otro legado sin protocolo después de publicar las reglas nuevas.
- Cursores de 100 raíces, lotes de 200 hijos, tareas ligadas a cuenta/generación
  y respuesta mínima propia. Privacidad interna/web y PLAYSTORE preparados;
  no se publicó nada ni cambió código nativo, tarjetas o CODE_MARKER.
- Guía: `docs/PRUEBAS_BORRADO_CAJAS_INCOMPLETAS.md`.
- TypeScript/ESLint aprobados; 136 pruebas locales/8 auditores (una prueba ajena
  sin registrar: 135 en copia limpia), 63 unitarias Functions y 89 SDK/reglas/
  HTTP/eventos con Node 22. Regresiones local y SDK fallan contra 51a57d0 por
  deuda ficticia del clon. Comprobadas 106 raíces/405 clones y JWT anterior a Auth.
- **Qué sigue:** reparación de pares Personal/Caja heredados y resolución
  explícita de conflictos. **Qué falta:** Android/cierres forzados, dos cuentas/
  teléfonos, disco lleno/tamaño, legado no comprobable, pruebas de índices y
  publicación coordinada de funciones + reglas + app. No es atomicidad global
  de todo el borrado de cuenta ni una auditoría terminada.

## Cancelación segura de compartir Caja — preparada (05/10/2026)

- Una Caja pendiente muestra Reintentar / Cancelar compartir. Cancelar propia
  no exige Pro. Solo se desbloquea después de una barrera confirmada del
  servidor y del guardado local; no cambia montos ni devuelve dinero a Personal.
- Si ya terminó, recupera el recibo y retira/remapea localmente la copia con el
  guardado conjunto, en vez de reabrirla como privada. Red/disco/respuesta dudosa,
  cambio de cuenta/fuente o enlace inválido conservan el bloqueo y originales.
- Intento UUID cifrado antes de enviar, ignorado en huella/edición financiera
  y excluido de Cajas en Firebase. Protocolo 3/registro privado de intentos:
  iniciar/copiar/finalizar un intento cancelado no puede reactivarlo. Otro
  intento válido usa UUID nuevo; no se limpia una copia heredada o con miembros.
- Cancelar congela primero el destino incluso si aún no existe; después limpia
  sus clones en lotes de 200 y retira su índice. La barrera se conserva hasta
  borrar Auth. El evento elimina intentos/barreras/clones propios, no ajenos.
- Máximo 30 intentos nuevos por cuenta/día UTC; recuperar/repetir un resultado
  propio no consume otro cupo. No es un límite global de facturación ni sustituye
  las medidas generales antiabuso. Sin registros vigentes de cuenta/prueba/tester
  no recrea datos por peticiones atrasadas; un tester sin copia Personal sí puede
  cancelar incluso después de vencer su acceso.
- Guía: `docs/PRUEBAS_CANCELACION_CAJA.md`. Políticas interna/web y PLAYSTORE
  reflejan metadata técnica/retención. No hay claves locales nuevas ni cambios
  nativos, tarjetas, APK/OTA o despliegue Firebase.
- TypeScript/ESLint aprobados, 135 pruebas locales/8 auditores (una prueba ajena
  preexistente sin registrar: 134 en copia limpia), 57 unitarias Functions y 80
  SDK/reglas/HTTP/eventos bajo Node 22. La ejecución local inicial de Firebase
  falló por arranque; la repetición completa aprobó sin omitir comprobaciones.
- **Qué sigue:** limpieza de conversiones activas/incompletas al eliminar cuenta
  (esta tanda cubre canceladas). **Qué falta:** pares heredados, conflictos entre
  dispositivos, Android físico/cierres forzados, rendimiento/espacio lleno,
  equivalente iOS/web y publicación coordinada de funciones + reglas + app.

## Personal/Cajas privadas — guardado conjunto preparado (05/10/2026)

- Crear/aportar, editar, devolver, borrar, cerrar y remapear al compartir
  guardan Personal, marcas y Caja juntos en el SQLite Android ya instalado.
  Cifrado y lectura de comprobación antes de actualizar memoria/mostrar éxito.
  Rollback no cierra el formulario; respuesta perdida no repite el aporte.
- Las escrituras se ordenan y una antigua no pisa el lote confirmado. Rechazar
  una fuente cambiada conserva los guardados ordinarios pendientes. Se protege
  cuenta/generación, ID/enlace/monto y consumidos, sin nuevas claves locales.
- Solo las operaciones enlazadas se limitan a Android hasta implementar y
  comprobar un contrato equivalente iOS/web; las de una sola clave continúan.
  Fuente actual en memoria y bloqueo durante guardado; consulta Pro descartada
  se vuelve a pedir. Guía: `docs/PRUEBAS_GUARDADO_PERSONAL_CAJAS.md`.
- Regresión falla contra `4a97b15` por escritura antigua sobre la nueva. Se
  ejecutan acciones/contexto/almacén originales y SQLite real, con un proceso
  que termina entre INSERT o tras COMMIT. No es todavía una prueba física Android.
- Conversión incierta: señal local cifrada `sharingPending` antes de enviar;
  reiniciar no permite usar a la vez copia privada y compartida. No viaja a
  Firebase ni cambia la huella financiera. Compartir nueva Caja fallaba por no
  poder leer la inexistencia de su destino; permiso limitado y SDK nuevo comprobados.
- La cancelación que faltaba se prepara en la sección anterior y su guía.
  Sigue pendiente entregar y probar físicamente el conjunto; Git no actualiza la app.
- TypeScript/ESLint aprobados; 134 pruebas locales y 8 auditores (una prueba
  preexistente ajena no registrada en Git), 57 unitarias de Functions y 73
  SDK/reglas/HTTP/eventos con Node 22. SQLite real y acciones originales comprobadas;
  no equivale a Android físico. No publicar antes de resolver lo pendiente.
- **Qué sigue:** limpiar copias compartidas incompletas e índices al borrar
  cuenta. **Qué falta:** pares heredados, conflictos entre dispositivos,
  Android/cierres forzados, tamaño/rendimiento, equivalente iOS/web y publicación
  coordinada. Sin APK/OTA/despliegue; tarjetas y código nativo sin cambios.

## Conversión de Caja privada a compartida — preparada (05/10/2026)

- `privateBoxMigration` compara origen/huella y toda la copia en transacción:
  solo al coincidir publica destino, retira origen y guarda confirmación propia.
  Respuesta perdida y confirmaciones concurrentes no crean otro movimiento.
- Reintento compara contenido, no solo ID; limpia únicamente clones nuevos
  incompletos sin miembros invitados. Copias heredadas distintas se conservan.
  Las reglas bloquean la finalización SDK y el uso de copias incompletas.
- Formato privado 3 conserva confirmaciones del servidor y bloquea su borrado,
  falsificación y retroceso. Una copia local atrasada no se descarta por
  inferencia. La pantalla comprueba su copia actual, remapea enlaces exactos
  sin sumar dinero y termina el cambio antes de intentar crear la invitación.
- Recuperación/finalización propia sin Pro no abre el historial ni inicia
  una Caja nueva. Limpieza de confirmaciones en borrado Auth y privacidad
  interna/web/PLAYSTORE actualizadas. Guía: `docs/PRUEBAS_CONVERSION_CAJA.md`.
- TypeScript/ESLint aprobados; 133 pruebas locales y 8 auditores (una prueba
  preexistente ajena sin registrar en Git), 57 unitarias de Functions y 72
  reglas/SDK/HTTP/eventos con Node 22. Regresiones local/SDK contra `b502b9a`
  fallan como corresponde; acción real de pantalla y dos lotes de 405 registros
  comprobados. Git no sustituye la publicación coordinada.
- **Qué sigue:** transferencia indivisible Personal/Cajas y limpieza de copias
  incompletas/índices al borrar cuenta. **Qué falta:** Android/cierres forzados,
  dos dispositivos, resolución explícita de conflictos heredados, límites de
  tamaño/costos y publicación coordinada de funciones, reglas y app.
  No se desplegó Firebase ni se entregó APK/OTA; tarjetas excluidas.

## Cajas privadas — versiones y copias comprobadas (05/10/2026)

- Unión por fecha de edición; empates distintos/sobregiro abortan sin elegir
  una copia a ciegas. Conserva borrados y marca `syncFormat: 2`; las reglas
  bloquean quitar ese formato una vez usado. Primera actualización compatible.
- Lectura del servidor y datos comprobados; no toma caché, documento incompleto
  ni ausencia sin marca como un borrado. Subida transaccional limpia `undefined`,
  comprueba cuenta/generación y archivo local legible, y devuelve el resultado
  confirmado a pantalla sin otra consulta ni bucle de envíos.
- Cache/pantalla por cuenta y sesión, cambios pendientes protegidos, avisos
  traducidos y actualización manual. Gratis no consulta la nube. Reconstruir
  Personal conserva campos y no reabre dinero consumido. Al compartir se
  comprueba el origen antes de crear el espacio y se guardan las esperas por sesión.
- Política interna/web y PLAYSTORE.md reflejan fecha de edición/formato de
  Cajas, sin nuevas categorías de datos ni servicios. Guía, regresiones y
  limitaciones: `docs/PRUEBAS_CAJAS_PRIVADAS.md`.
- TypeScript/ESLint aprobados; 132 pruebas locales y 8 auditores (una prueba
  preexistente ajena sin registrar en Git), 54 unitarias de Functions y 61 de
  reglas/SDK/HTTP/eventos con Node 22 real. Regresiones local y SDK fallan
  contra `bcc34d3` por sobrescribir la edición 120 con 100.
- **Qué sigue:** conversión privada/compartida entre dispositivos e interrupciones,
  y transferencia indivisible entre Personal/Cajas. **Qué falta:** Android,
  conflictos heredados, tamaño/costos y publicación coordinada.
  No se publicó ni reparó producción; tarjetas siguen excluidas.

## Consultas antiguas de espacios — protección local (05/10/2026)

- Familia publica una consulta completa, ligada a cuenta/generación/revisión;
  invalida lecturas antes y después de modificar y descarta errores/finalización
  antiguos. Cajas descarta miembros/listas de otra selección y reinicia su
  escucha después de modificar. Las operaciones no aplican resultados ni
  envían el siguiente paso tras cambiar de sesión, incluso A → B → A.
- Solo fuentes del servidor sin escrituras pendientes pueden conciliar
  Personal. Se comprueba que el espacio sigue abierto para no borrar aportes
  consumidos durante la purga. Cajas retira contrapartes borradas remotamente
  únicamente del espacio activo confirmado, sin tocar otros ni ya liquidados.
  La caché continúa siendo información de pantalla, no prueba financiera.
- Guía y límites: `docs/PRUEBAS_CONSULTAS_ESPACIOS.md`. La regresión local falla
  contra `ffca3eb`. Sin nuevas claves/datos locales, formatos, permisos o cambios
  de privacidad; no se modifica PLAYSTORE.md porque no se recopila algo nuevo.
- TypeScript/ESLint aprobados, 131 pruebas locales y 8 auditores (una prueba
  preexistente ajena sigue sin registrar en Git), 54 unitarias de Functions y
  54 de reglas/SDK/HTTP/eventos aprobadas con Node 22 real. La prueba de Telegram
  ahora espera toda la limpieza, sin retirar ninguna comprobación.
- **Qué sigue:** Cajas privadas y conflictos financieros simultáneos.
  **Qué falta:** Android/dos teléfonos y
  publicación coordinada de lo preparado. No se publicó nada; tarjetas fuera.

## Devoluciones deshechas: confirmación invalidada (05/10/2026)

- Continuación de FINO-02: una devolución anulada conservaba una confirmación
  privada vigente. El servidor la devolvía al reintentar y podía recrear su
  ingreso en Personal. La prueba nueva falló antes del arreglo, tanto en el
  registro real del contexto como en Firestore emulado.
- `changePersonalContribution` marca `cancelled`/`cancelledAt` en la misma
  transacción que borra el retorno y actualiza la versión del espacio.
  La misma anulación puede confirmarse otra vez sin escribir ni exigir renovar
  Pro; deshacer por primera vez mantiene sus permisos Pro actuales.
- `returnPersonalContribution` rechaza esa confirmación con `return-cancelled`.
  La app retira su orden pendiente solo después de confirmar el guardado; un
  fallo de red o una respuesta de otra sesión conserva la orden. Muestra un
  aviso traducido, sin registrar ingreso. Una devolución nueva usa otro ID.
- El borrado actualiza su referencia inmediatamente. La recepción comprueba
  la marca antes de encolar y también al aplicar; una respuesta atrasada no
  restaura un ID ya borrado. Retira la confirmación local pendiente de ese ID.
- Sin nuevas claves locales ni cambio de formato de archivos por cuenta.
  La política describe la marca/fecha de anulación; la retención hasta borrar
  Auth no cambia. Guía: `docs/PRUEBAS_DEVOLUCION_ANULADA.md`.
  TypeScript/ESLint aprobados, 130 pruebas locales y 8 auditores, 54 de Functions
  y 50 de reglas/SDK/HTTP/eventos bajo Node 22. Una prueba local sigue siendo
  preexistente ajena sin registrar en Git. Regresiones fallan contra el código anterior.
- **Qué sigue:** revisar consultas atrasadas y conciliación entre dispositivos.
  **Qué falta:** Android, escenarios entre dos teléfonos, producción y entrega
  coordinada. No se publicó nada ni se repararon registros reales; tarjetas fuera.

## Node 22 y borrado de cuenta con grupos — validación local (05/10/2026)

- FINO-05: configuración ya preparada para Node 22; ahora se ejecutaron las
  pruebas con Node 22.23.3 real, descargado del sitio oficial y comprobado por
  SHA-256. Es portátil en `.tmp`, no reemplazó Node 24 del equipo.
- Nueva prueba conecta los SDK reales a Auth, Functions y Firestore locales,
  usa cuentas ficticias y llamadas HTTP autenticadas. Se comprobó devolución
  S/40 con prueba vencida, borrado Personal/historial de 405 documentos y
  grupos propios, y el evento real del emulador Auth que limpia permisos y
  comprobantes. También se disparó la limpieza Firestore de Telegram; otra
  cuenta y sus datos permanecen intactos. No son servicios de producción.
- La prueba descubrió y confirmó una falla adicional de FINO-02: el cliente
  intentaba leer `familyUsers` de otro miembro para limpiar sus índices,
  pero esas lecturas privadas están correctamente prohibidas por las reglas.
  No se abrieron esos permisos: `finalizeLinkedSpaceDeletion` hace la limpieza
  limitada desde el servidor, solo dueño verificado y autenticado recientemente,
  con borrado preparado y sin movimientos restantes. No exige Pro.
- El propietario conserva membresía/índice hasta terminar. Índices de miembros
  se limpian por espacio sin borrar otros vínculos; la confirmación final une
  raíz, membresía e índice propios en una transacción. Interrupción y reintento
  comprobados; las versiones anteriores quedan reproducibles mediante regresión.
- Guía reproducible, alcance y cifras: `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`.
  Nuevo `firebase.pruebas.json` separado de producción y lanzador que exige
  Node 22, localhost/proyecto demo y rechaza configuraciones/secretos locales.
  TypeScript/ESLint aprobados, 129 pruebas locales y 8 auditores, 53 de Functions
  y 48 de SDK/reglas/HTTP/eventos bajo Node 22. Una prueba local es preexistente
  ajena no registrada en Git. La regresión falla con el cliente anterior.
- **Qué sigue:** comprobar el recorrido Android y continuar los riesgos de
  datos restantes. **Qué falta:** teléfono/dos dispositivos, cuentas Google
  reales, consolas y publicación coordinada. Hay que desplegar también la nueva
  función antes de distribuir la app. Tarjetas excluidas; no se publicó nada.

## Devolución a Personal después de vencer Pro (05/10/2026)

- FINO-02, avance posterior: `returnPersonalContribution` permite devolver
  únicamente el saldo recuperable de la cuenta autenticada, sin exigir Pro.
  Aporte S/100 y gasto S/60: devuelve S/40, permite cerrar con S/0 y conserva
  S/60 como consumidos. No concede operaciones normales ni respaldo Gratis.
- El servidor valida membresía, moneda, aportes, devoluciones y saldo dentro
  de una transacción. Dos devoluciones simultáneas no duplican el saldo. El
  mismo identificador recupera la confirmación sin otra escritura de dinero.
- Antes de enviar, el teléfono guarda una orden cifrada por cuenta; conserva
  esa orden si pierde la respuesta y la recupera al reiniciar/volver a entrar.
  Solo la retira después de comprobar el ingreso guardado en disco. Una
  respuesta de la sesión anterior no se aplica aunque vuelva a la misma cuenta.
- Confirmación privada en `personalReturnReceipts/{uid}/operations/*`: permite
  recuperar una operación ya confirmada aun si el espacio se borró o retiró
  al miembro. No devuelve acceso al grupo ni copia Personal. El SDK no puede
  leerla; el servidor entrega solo la operación propia cuyo ID ya conoce el
  teléfono. Se limpia por lotes al completar el borrado de Firebase Auth.
- Las devoluciones nuevas pasan por Functions, tanto Gratis como Pro. La
  conversión de una Caja privada admite únicamente copiar devoluciones
  históricas exactas desde la copia Pro, antes de cerrar su migración; no se
  puede reabrir esa fase. Los archivos locales antiguos se leen sin perder
  datos; los nuevos incluyen la orden pendiente en su formato de archivo 2.
- Verificación y límites: `docs/PRUEBAS_DEVOLUCION_SIN_PRO.md`. No se tocó
  código nativo, cobros ni tarjetas. No se publicó app, reglas o Functions.
  TypeScript y ESLint aprobados; 129 pruebas locales y 8 auditores, 49 pruebas
  de Functions y 40 del emulador Firestore. El conteo local incluye una prueba
  preexistente ajena no registrada en Git; Node 22 aún no se comprobó.
- **Qué sigue:** comprobar Node 22 y el recorrido completo de eliminación.
  **Qué falta:** Android/dos dispositivos, tokens y Functions reales, revisión
  de consolas, transición de apps antiguas y publicación coordinada. Historias
  corruptas se rechazan, no se repararon cuentas reales ni cierres históricos.

## Aportes consumidos y borrado local de Cajas (05/10/2026)

- Decisión explícita del propietario: un aporte ya gastado se considera
  consumido, no deuda que obligue a devolverlo. Esta decisión sustituye la
  obligación histórica de devolver todos los aportes incluso con saldo cero.
- FINO-02, avance parcial: teléfono y Functions permiten cerrar/preparar borrado
  con saldo cero y movimientos válidos aunque parte del aporte se gastase.
  Un miembro puede salir si ya no tiene saldo recuperable. Saldo disponible,
  devolución atribuida a otra persona y datos inválidos siguen protegidos.
  No se permite borrar/reducir por debajo de lo gastado un aporte individual.
- Cerrar no elimina la salida ni devoluciones de Personal: marca sus registros
  como liquidados y guarda el importe consumido. Conserva montos/saldo y separa
  "Consumido" de "Devuelta", incluso al filtrar un mes distinto al del retorno.
  La conciliación automática solo elimina ausencias de espacios que siguen
  activos y fueron leídos; un espacio cerrado/ausente no devuelve dinero ficticio.
- Cajas privadas ya no llaman al servidor compartido al borrar aportes locales.
  El plan local impide borrar lo gastado y retira ambas mitades de un aporte
  intacto o de un par completamente devuelto. Familia conserva sus vínculos
  ocultos al cerrar para permitir su limpieza posterior al borrar una cuenta.
- Las pruebas nuevas ejecutan las funciones y filtros reales, comparan teléfono
  y servidor, comprueban 20.000 registros y fallan contra la versión anterior.
  Verificado: TypeScript, ESLint, 128 pruebas locales y 8 auditores; 42 de
  Functions y 31 en el emulador Firestore. Una prueba local es preexistente,
  ajena y sigue sin registrar en Git. Node 22 aún no se comprobó.
  La validación completa y sus límites figuran en `docs/PRUEBAS_APORTES_CONSUMIDOS.md`.
- **Qué sigue:** devolver el saldo que aún queda en Familia/Caja sin exigir
  renovar Pro; comprobar Node 22 y el recorrido real de eliminación.
  La devolución fue preparada posteriormente en la sección superior.
  **Qué falta:** ese desbloqueo, Android/dos dispositivos, llamadas reales de
  Functions, compatibilidad con apps antiguas y publicación coordinada.
  Los marcadores de cierres hechos desde otro dispositivo dependen de recibir
  su copia Personal; no se migraron cierres históricos ni cuentas reales.
  No se publicó Firebase/app; tarjetas de crédito permanecen excluidas.

## Nube Pro protegida en servidor — preparación local (05/10/2026)

- FINO-04: reglas preparadas para exigir Pro real (pago, prueba vigente o
  tester autorizado) al leer/escribir Personal, su historial, Negocio y Cajas
  privadas. Gratis conserva las Cajas privadas y Personal en el teléfono;
  bajar de plan no elimina ninguna copia antigua de Firebase. Tarjetas de
  crédito permanecen fuera de esta corrección y de su cobertura Pro.
- `getCloudAccess` consulta solo campos de permiso mediante una máscara;
  devuelve permisos y existencia, nunca movimientos, fotos ni perfil. La app
  consulta esos permisos antes de descargar la copia y al volver a primer plano.
  Respuestas de una cuenta anterior se rechazan al cambiar de sesión. Una consulta
  lenta no puede retirar una prueba que acaba de concederse.
- El borrado Personal pasa por `deletePersonalCloudCopy`, con correo verificado
  e identidad confirmada recientemente, sin exigir Pro. Bloquea nuevas escrituras
  antes de borrar el historial por lotes y retira el documento principal al final.
  Una interrupción permite reintentar sin tocar otra cuenta. Un registro privado
  mantiene el bloqueo hasta terminar de eliminar la identidad de Firebase Auth.
- La prueba puede activarse desde una cuenta configurada solo en el teléfono.
  `premiumTrialClaims/{uid}` conserva su primera fecha; borrar solo la copia
  financiera no reinicia las 24 horas. Los clientes no pueden leer/editar ese
  registro. La limpieza reintentable de Auth (evento de primera generación)
  retira Personal/historial, Negocio, Cajas privadas, permiso de tester y registro
  de prueba. No sustituye las validaciones de Familia/Cajas compartidas.
- Cajas no sube ni baja automáticamente para Gratis. Un error al consultar
  una copia Pro no se interpreta como vacío ni borra su contraparte Personal;
  permite seguir guardando localmente y volver a intentar al abrir la pantalla.
- Validación: TypeScript, ESLint, 127 pruebas locales y 8 auditores; 41 pruebas
  de Functions y 26 comprobaciones reales en el emulador Firestore.
  El conteo local incluye una prueba preexistente ajena no registrada
  en Git. Las pruebas nuevas fallan contra el código/reglas anteriores.
- **Qué sigue:** resolver FINO-02 (aportes gastados y borrado de cuenta),
  comprobar Node 22 y preparar publicación coordinada. **Qué falta:** pruebas
  físicas, llamadas reales de Functions/evento Auth y reglas de producción.
  No se desplegó Firebase, no se compiló ni publicó app ni política web.
  FINO-04 no se declara resuelto en producción ni para las tarjetas excluidas.
  Guía, orden de entrega y límites: `docs/PRUEBAS_NUBE_PRO.md`.

## Unión segura de teléfono y nube al entrar a Pro (05/10/2026)

- FINO-03 corregido para la copia Personal: presupuestos por mes, límites,
  categorías propias y personalizadas, calendario, clasificación aprendida,
  saldo anterior, favoritos y perfil se unen por elemento/campo. Una lista
  incompleta no reemplaza los elementos que solo existían en la otra copia.
- Cada edición y borrado conserva su marca dentro de `syncUpdatedAt`. Borrar
  una categoría, un límite o un pago no hace que vuelva al recibir una copia
  antigua; desmarcar un mes conserva el gasto y su enlace. Editar otro campo
  no rejuvenece campos viejos. Los empates nuevos se resuelven igual en ambos
  sentidos y el reloj avanza desde la última marca observada.
- Las mutaciones actualizan una referencia inmediata y encolan datos/marcas
  sin esperar al siguiente dibujado. Subir usa esa referencia para no enviar
  un valor viejo con la fecha de una edición nueva. La recepción utiliza la
  misma unión que la transacción de subida. Restaurar con datos locales
  existentes también une movimientos/metas y sus borrados, sin reemplazarlos.
- Las fotos locales omitidas por tamaño o por la política de pagos/favoritos
  no se borran del teléfono por recibir la copia de Firebase. Una eliminación
  expresa de foto sí se respeta. La reducción de fotos retira `undefined`
  antes de escribir, para que Firestore no rechace el documento completo.
- Google desde Bienvenida también abre primero la copia por UID. La recepción
  de listas inválidas o IDs duplicados aborta sin modificar los campos locales;
  Ajustes explica que la copia no pudo unirse. No es un validador completo de
  todos los campos del documento: ampliar esa validación sigue siendo posible.
- Nuevo `syncFormat: 2`, independiente de `historyFormat`: las reglas admiten
  la migración y, una vez marcada una cuenta, rechazan la sustitución completa
  desde una app antigua que quite ese marcador. **Las reglas deben publicarse
  antes de entregar esta app.** Las reglas antiguas no admiten el campo nuevo;
  entregar solo la app impediría sus respaldos. No se publicó ninguna parte.
- Verificado: TypeScript y ESLint; 126 pruebas locales y 8 auditores; 39
  pruebas de Functions; y 15 comprobaciones reales en el emulador de Firestore,
  incluidos dos clientes, 10.000 movimientos, migración y rechazo a apps
  antiguas. El conteo local incluye una prueba preexistente ajena que permanece
  sin registrar en Git. La prueba nueva falla contra el código anterior por
  perder una categoría; la de reglas también falla contra las reglas anteriores.
- **Qué sigue:** aplicar el requisito Pro en el servidor (FINO-04), no solo
  en la app, y resolver la decisión sobre aportes de Familia/Caja (FINO-02).
  **Qué falta:** Android con dos cuentas/dispositivos, entrega coordinada,
  revisión de reglas realmente publicadas y Node 22. Negocio/Cajas tienen
  documentos y lógica aparte; este cambio no declara corregida su fusión ni
  los pagos del mismo mes confirmados simultáneamente en dos teléfonos.
- Guía y límites: `docs/PRUEBAS_FUSION_PRO.md`. Las marcas de borrado no se
  purgan sin confirmación de dispositivos; también cuentan en el límite de
  1 MB. El exceso se rechaza conservando el último respaldo, no truncando datos.

## Cierre de sesión conserva la copia local por cuenta (05/10/2026)

- FINO-01 corregido en código: cerrar sesión confirma una copia local cifrada
  antes de cerrar Firebase y limpiar los datos activos. Funciona también para
  Gratis y para Pro cuando el usuario elige salir sin actualizar la nube. Si
  falla el guardado, la sesión y los cambios en memoria se conservan.
- El arranque espera a que Firebase confirme la identidad antes de leer datos
  de cuenta. Cada copia se vincula al UID y se recupera solo para esa cuenta.
  Login, Google, registro y verificación restauran primero la copia local;
  no la reemplazan automáticamente por una copia antigua de Firebase.
- El inventario de claves es común al borrado activo y al archivo local.
  Las generaciones se guardan por bloques, se verifican y se confirman al final;
  una restauración parcial mantiene bloqueado el acceso y admite reintento.
  Dueño, punteros y contenido están cifrados y autenticados. Se conserva una
  generación anterior y se retiran fragmentos no confirmados cuando es posible.
- Las tareas de fondo comprueban que la cuenta siga activa y se coordinan con
  el archivo local. Al salir se desactivan avisos, PIN, captura e integraciones.
  Eliminar la cuenta intenta retirar también todas sus generaciones locales,
  sin retirar las copias de otras cuentas del teléfono.
- Migración: si una instalación antigua no tiene dueño identificado, solo se
  vincula al correo que figura en su perfil. Los datos sin dueño o con un correo
  distinto se conservan bloqueados; su recuperación exige resolver la identidad,
  no asignarlos a otra cuenta ni comenzar a guardar encima.
- Pruebas ejecutan el almacenamiento y el archivo reales con sustitutos de
  Android: A → salir → B → salir → A, fotos/categorías, guardados pendientes y
  en vuelo, fallo de confirmación, copia dañada, restauración interrumpida y
  eliminación por UID. La prueba del cierre real falla contra HEAD anterior
  porque ese código cerraba Firebase sin confirmar ninguna copia local.
- Verificación final: TypeScript, ESLint, 125 pruebas locales y 8 auditores en
  verde. El conteo local incluye una prueba preexistente que continúa sin
  registrar en Git; no se incorporó al cambio. También se comprobaron aperturas
  simultáneas y respuestas antiguas de Firebase tras cambiar de sesión.
- No hay teléfono ni emulador conectado en esta sesión. Falta comprobar el
  recorrido con dos cuentas de prueba en Android y entregar/publicar la app.
  La política local y PLAYSTORE.md ya describen la conservación; la web de
  privacidad debe publicarse junto con la entrega. No se desplegó Firebase.

## Riesgos de seguridad y datos (04/10/2026)

- Si Android no puede leer o descifrar una clave local, Fino ya no interpreta
  esos datos como vacíos para después guardarlos encima. Conserva el texto
  original, detiene guardados y respaldos incompletos, y muestra un aviso que
  bloquea el uso hasta reabrir la app o revisar la recuperación. Cuando falta
  la llave de SecureStore pero aún hay datos cifrados, no crea una nueva.
  Pruebas automáticas cubren llave ausente, firma dañada y guardado rechazado.
- La copia de presupuestos ya unía meses distintos. El 05/10 se completó la
  fusión Personal por elemento con marcas de borrado para límites, categorías
  y pagos, incluida la recepción/restauración. Su despliegue coordinado y
  comprobación física siguen pendientes; véase la sección superior.
- Firebase Functions quedó configurado localmente para Node 22 tanto en
  `functions/package.json` como en `firebase.json` (este último tiene
  prioridad al desplegar). Sus 39 pruebas pasan con el Node instalado en el
  equipo; **no** se ha probado todavía en un entorno Node 22 ni se ha
  desplegado. Google fija el retiro de Node 20 para el 30/10/2026.
- Importar archivos compartidos ya no recibe una ruta desde la dirección de la
  pantalla. El archivo llega por el canal interno de Android y un enlace externo
  no puede pedirle a Fino que lea o borre una ruta local arbitraria.
- Exportar tampoco acepta instrucciones automáticas desde la dirección de la
  pantalla. Solo una orden interna, con identificador temporal y opciones
  guardadas en memoria, puede abrir una exportación directa. Órdenes diferentes
  ya no comparten identificador aunque ocurran casi al mismo tiempo. La tarea
  programada espera a que el candado esté abierto.
- El candado cubre también los paneles nativos. Si falla la lectura del estado
  seguro, permanece cerrado y permite reintentar; no aplica el margen de
  regreso ni anuncia activación sin confirmación. Al apagarlo, conserva el PIN
  si no pudo verificar que el interruptor se apagó. El cambio de huella/PIN se
  refleja durante la misma sesión.
- Cerrar sesión y borrar la cuenta usan la misma limpieza de datos activos: retiran
  avisos de pagos, exportación y tarjetas; desconectan Dropbox/OneDrive; apagan
  el PIN y el lector de notificaciones; borran los datos locales y vacían los
  datos de la cuenta que quedan en memoria. Desde el 05/10, cerrar sesión conserva
  primero una copia cifrada por cuenta; eliminar la cuenta retira esa copia.
- Verificado: TypeScript, ESLint, 124 pruebas locales y 8 auditores aprobados,
  incluidos casos de enlace externo, órdenes simultáneas y errores del cajón
  seguro. Una prueba local adicional ajena a este cambio sigue sin registrar
  en Git. No se compiló una APK, no se probó el nuevo flujo en un teléfono y
  no se publicaron cambios en Firebase o Play Console.
- **Pendiente:** probar en Android la conservación local y la fusión Personal;
  revisar las fusiones de Negocio/Cajas; aplicar la protección Pro en Firebase;
  decidir el tratamiento de
  aportes pendientes de Familia/Caja; y probar el nuevo candado y los enlaces
  en un dispositivo. La protección local anterior no recupera una llave de cifrado
  perdida: evita destruir lo que aún quede. El runtime Node 22 también debe
  prepararse antes del 30/10/2026. Ver FINO-01 a FINO-05 y FINO-13, 24, 41,
  42 y 58 del informe. Antes del 30/10 hay que comprobar y publicar las
  Functions con Node 22 en una entrega coordinada.

## Pagos del calendario y sincronización Pro (03/10/2026)

- En Inicio e Historial, cada movimiento muestra fecha y hora bajo el nombre, y
  la categoría bajo el monto. Al confirmar un pago del calendario se registra
  también la hora de confirmación.
- El plan Gratis conserva sus datos en el teléfono y ya no sube ni restaura la
  copia personal, el Modo Negocio ni el historial en segundo plano. Las copias
  antiguas de Firebase no se borran; la app no descarga el historial antes de
  comprobar el acceso Pro. En Ajustes, la nube se presenta como función Pro.
- La regla está implementada en la app nueva, no publicada como regla de
  Firestore. Las versiones antiguas aún podrían sincronizar; la protección
  definitiva del servidor y el cobro de Play deben coordinarse antes de lanzar
  los planes.
- TypeScript, ESLint, 123 pruebas y 8 auditores aprobados. La compilación del
  emulador no terminó: Windows bloqueó la ejecución de `clang` del Android SDK.
  No se instaló una APK nueva ni se borraron datos del emulador.

## Acciones de presupuesto y saldo anterior en Inicio (03/10/2026)

- En la tarjeta de saldo, “Presupuesto del mes” ahora tiene letra un punto mayor.
  La barra de avance engrosó apenas y su riel usa un fondo tenue adaptado al
  tema, para que el indicador se vea definido sin competir con el saldo.
- El presupuesto se muestra como texto y monto, sin parecer un campo editable;
  “Definir presupuesto mensual” es la acción que abre su editor. El rótulo se
  distribuye en dos líneas para conservar el aire del botón.
- En el primer mes, cuando no hay saldo anterior, esa acción se muestra sola,
  a todo el ancho y con menor altura; desde el segundo mes comparte la fila con
  Mostrar/Ocultar saldo del mes anterior.
- Las tarjetas pequeñas de Gastado e Ingresos usan flechas hacia abajo/arriba
  junto a sus rótulos, con el texto algo mayor y altura reducida sin recortar
  los montos.
- “Definir presupuesto” y “Mostrar/Ocultar saldo del mes anterior” aparecen en
  dos botones del mismo ancho. El texto largo se envuelve completo, con altura
  suficiente; el ojo distingue mostrar de ocultar y el índigo evita confundirlo
  con ingreso (verde) o gasto (rojo).
- Ambos controles dan una respuesta breve al toque (encogimiento suave y vuelta
  con resorte), sin animación permanente. La tarjeta del mes anterior aparece
  solo si existe historial y se oculta/muestra con una transición suave; ocultar
  no cambia el saldo ni los movimientos.
- Revisado en el emulador con el servidor de desarrollo: ambos rótulos se leen
  completos, la tarjeta no recorta los botones y el control de ojo oculta y
  restaura la tarjeta sin tocar los montos. No se creó un AAB ni se modificaron
  movimientos o datos financieros.
- TypeScript, ESLint, 123 pruebas y 8 auditores aprobados.

## Ajustes de Familia/Caja, saldo y navegación (02/10/2026)

- Las tarjetas del selector de Familia y Caja quedaron más compactas y parejas.
  Se retiró la etiqueta “En control” de la tarjeta de Inicio; siguen visibles el
  saldo, el presupuesto y su barra de avance.
- La barra inferior ahora anima cada toque y hace más visible el botón +. Una
  indicación breve enseña a usarlo la primera vez y se oculta al tocarlo.
- La invitación de Familia/Caja se muestra en una hoja inferior con código
  copiable; el portapapeles se carga solo al pedir copiar, así no puede tumbar
  la pantalla Familia si el APK antiguo no trae ese módulo nativo.
- “Unirme” en Cajas ya permite escribir el código en la misma pantalla como en
  Familia. Los errores distinguen permisos de conexión/código inválido.
- Simulación comprobada: de S/ 500, enviar S/ 120 a Familia, S/ 80 a Caja y
  devolver S/ 50 deja S/ 350 en Personal. Elegir “Desde Personal” no cambia el
  saldo; solo lo cambia un movimiento guardado, y la devolución lo restaura.
- Familia ahora guarda su creación y el aporte inicial desde Personal en una
  sola transacción: si Firebase rechaza el aporte, no queda una familia vacía
  ni se descuenta el saldo Personal. Las reglas permiten esta operación solo
  al propietario y validan el espacio con `getAfter`, igual que Caja.
- El aporte y la devolución de Personal siguen siendo dos registros enlazados,
  aunque la pantalla los agrupe en una tarjeta. La simulación con el monto de
  la captura confirma que, con devolución completa y saldo cero, se puede
  cerrar; el saldo/presupuesto Personal actual no participa de ese cálculo.
- En el formulario compartido de Familia y Caja, Descripción y Método de pago
  ocupan ahora el mismo ancho; el método dejó de tener un ancho fijo estrecho.
- En Historial, los filtros de Todos/Gastos/Ingresos/Transferencias aparecen
  por encima del panel de filtros avanzados al abrirlo.
- Al abrir el selector del mes en Inicio o Historial, debajo de cada mes aparece
  cuántos movimientos visibles hay; las transferencias agrupadas cuentan como
  una sola tarjeta.
- Los errores de una función Firebase ausente ya no se muestran como “código
  vencido”. Caja privada guarda localmente; Caja compartida y Familia usan las
  mismas Functions para borrar aportes y cerrar, por eso la Caja privada no
  confirma que el servicio compartido esté actualizado.
- TypeScript, ESLint, 122 pruebas y 8 auditores aprobados; además, 39 pruebas
  de Functions. El bundle de Metro incluye los cambios. No se han publicado
  reglas, Functions ni app, y no se pudo comprobar una escritura real contra
  Firebase. Hace falta actualizar reglas y Functions en `dotero-2d430` para
  habilitar las operaciones compartidas en producción.

## Regla de seguimiento y seguridad Premium (28/09/2026)

- Cada avance debe terminar indicando qué sigue y qué falta. El detalle vivo de
  la auditoría está en `docs/AUDITORIA_SEGUIMIENTO.md`.
- La prueba gratuita Premium ya no se concede desde el teléfono: una Cloud
  Function decide la hora y una transacción permite usarla una sola vez. Las
  reglas impiden que el cliente cree o reinicie esa fecha.
- Si el permiso Premium de tester solo está en caché, no concede funciones sin
  verificar, pero Ajustes explica que hace falta conectarse para comprobarlo.
- Se tradujo una primera tanda visible de Inicio, Familia, Cajas y selectores,
  y se añadieron etiquetas a controles de icono principales.
- Todo está preparado localmente. No se publicaron Functions, reglas, AAB ni se
  activó App Check; tarjetas de crédito siguen fuera del trabajo activo.
- Las exportaciones recuperadas al abrir Fino ya no se marcan como exitosas
  antes de subir: conservan destino, espacio y gráficos, y reintentan tras un
  fallo sin repetir dentro de la misma sesión.
- Los totales mensuales de Inicio usan una sola función probada y mantienen
  transferencias internas separadas de gastos e ingresos. Se retiró código de
  gráficas antiguas que ya no tenía consumidores reales.

## Historial Personal separado — preparado localmente (27/09/2026)

- El código nuevo guarda cada movimiento Personal en su propio documento. La
  copia principal conserva perfil, presupuestos y metas, pero ya no la lista
  completa de movimientos en las cuentas migradas.
- Hay lector para cuentas antiguas, migración reanudable y comprobada antes de
  retirar la lista vieja, adaptación de Telegram y borrado de cuenta protegido
  contra interrupciones. Las reglas impiden que una versión vieja sobrescriba
  el formato nuevo.
- Se probaron dos teléfonos simulados, 10.000 movimientos, un respaldo que
  supera 800 KB, ediciones, borrados, acceso ajeno y recuperación tras corte.
- **No se migró ninguna cuenta real ni se publicaron reglas, Functions o app.**
  Para usarlo en producción se requiere una entrega coordinada: reglas y
  Functions, app actualizada y migración de cuentas después de verificar la
  actualización. No ejecutar la migración administrativa en una cuenta real
  mientras existan clientes antiguos escribiendo.
- Las tarjetas de crédito siguen pendientes por indicación del usuario.

## Auditoría externa — bloqueantes corregidos en código (26/09/2026)

- Unirse a una Familia o Caja compartida ya crea primero la membresía validada
  por la invitación y lee el espacio después; no intenta leer datos protegidos
  antes de tener permiso.
- Cerrar sesión pide confirmación y limpia también categorías, calendario,
  Cajas en memoria, PIN, buzón de Yape, avisos, exportación programada y las
  conexiones con Dropbox/OneDrive para que una cuenta nueva no herede nada.
- Una Caja privada no se puede borrar si conserva aportes de Personal sin
  devolver, aunque su saldo total sea cero. La reparación de vínculos espera a
  que termine de llegar la copia de Cajas de la nube.
- Una cuenta con correo pendiente vuelve siempre a Verificar correo al reabrir;
  ya no puede acumular datos sin respaldo entrando directamente a Inicio.
- Validación: TypeScript, ESLint, 110 pruebas y 7 auditores aprobados.
- No se publicaron reglas, Functions, AAB ni actualización de Google Play.

## Rediseño de movimientos Familia/Caja (25/09/2026)

- Preparados los movimientos con barra inferior, formulario aparte, filtros y categorías.
- **Pendiente antes de usar el formulario de Familia:** publicar la versión actual de `firestore.rules` en `dotero-2d430`. Las reglas anteriores rechazan los nuevos campos `category` y `notes`.
- No se generó APK ni AAB para esta entrega.

Actualizado: **22 de septiembre de 2026**.

## Auditoría integral y protección de espacios (22/09/2026)

- La edición, reducción y eliminación de aportes de Personal en Familia y Caja
  pasan por Cloud Functions; las reglas ya no permiten saltarse esa validación
  escribiendo directamente en Firestore.
- Cerrar, borrar, abandonar un espacio o retirar a un miembro también valida en
  servidor que no queden aportes personales pendientes. El borrado de cuenta
  hace esta comprobación completa antes de modificar otros datos.
- Los ajustes ya no pueden abrir por error la primera familia cuando reciben un
  identificador inválido, y Familia/Cajas recargan sus nombres y listas al volver.
- Se eliminó código sin uso, se corrigieron textos de administración en los tres
  idiomas y Expo Doctor vuelve a aprobar sus 18 comprobaciones.
- `npm audit` no encontró vulnerabilidades críticas y las Functions quedaron en
  cero avisos. La app conserva 9 altas y 18 moderadas dentro del toolchain de
  Expo/Metro; npm solo propone resolverlas migrando de SDK 54 a Expo 57, cambio
  mayor que debe hacerse como una entrega separada, no con `audit fix --force`.

## Cambio rápido entre Personal, Familia y Cajas (13/09/2026)

- El selector de espacios también bloquea el doble toque: dos pulsaciones no
  pueden ordenar dos cambios de pantalla mientras Android sigue animando el primero.
- Cajas enseña inmediatamente la copia del teléfono y consulta Firebase después;
  ya no deja la pantalla esperando a internet. Si se anota algo durante esa consulta,
  la respuesta remota se fusiona con lo nuevo en vez de reemplazarlo.
- Familia conserva en memoria, solo mientras Fino está abierto, la última vista ya
  validada. Al volver se muestra de inmediato y se actualiza silenciosamente desde
  Firebase; una respuesta antigua no puede imponerse a una actualización posterior.
- País y Moneda vuelven al lugar real desde el que se abrieron; ya no envían a una
  persona que estaba en Ajustes hacia la configuración inicial.
- Acceso, registro, cierre de sesión, retroceso y las altas locales de Caja ignoran
  pulsaciones repetidas. Volver desde avisos, Google o Telegram conserva el trabajo
  de la pantalla actual en vez de mandar inesperadamente a Inicio.
- El arranque lee perfil, tema y limpieza antigua en paralelo, pero conserva la barrera
  que recupera movimientos y presupuestos antes de mostrar Inicio para no guardar vacíos.

Este archivo permite retomar el proyecto sin empezar de cero. No contiene
credenciales, correos, UID, huellas completas ni datos privados de testers.

## Qué es Fino

Fino es una aplicación Android de presupuesto personal, gastos e ingresos.
Usa React Native, Expo SDK 54, Expo Router, TypeScript estricto, NativeWind,
Firebase Authentication, Firestore y módulos Android propios.

Paquete Android: `com.finoapp.gastos`.

## Exportaciones por espacio y PDF profesional (10/09/2026)

- La exportación manual y automática permite elegir Personal, la Familia activa
  o una Caja concreta. PDF, Excel y CSV usan exactamente el mismo espacio y no
  mezclan movimientos entre ellos.
- El PDF muestra arriba el saldo disponible y, cuando corresponde, presupuesto,
  saldo anterior, ingresos, gastos y resultado del mes. El total inferior sigue
  representando únicamente las filas exportadas.
- Los gráficos usan barras horizontales compactas y abreviación K/M/B/T para que
  números extremos no deformen la página. La tabla ajusta textos largos y repite
  sus encabezados si continúa en otra hoja.
- Si un espacio configurado para exportación automática deja de estar disponible,
  Fino lo informa y no sustituye silenciosamente sus datos por los de Personal.

## Auditoría de Personal, Familia y Cajas (10/09/2026)

- Inicio y el cálculo interno usan una sola cuenta para el saldo de Personal:
  transferir a Familia o Cajas lo reduce y una devolución lo restaura, sin
  presentar la transferencia como gasto o ingreso nuevo.
- El presupuesto del mes ya no puede reducirse por debajo del dinero de ese
  mes que todavía permanece transferido. Por ejemplo, con S/ 100 fuera, S/ 400
  sigue siendo válido pero S/ 50 se rechaza hasta devolver la diferencia.
- Solo el propietario puede enlazar su saldo Personal con Familia o una caja
  compartida. Un invitado puede registrar movimientos comunes, pero no dejar
  dinero propio atrapado en un espacio que no administra.
- Un miembro solo puede borrar sus movimientos comunes; el propietario también
  puede administrarlos. Nadie puede borrar la transferencia Personal de otra
  cuenta.
- Un vínculo antiguo o dañado de una caja ya no impide cargar las demás cajas
  válidas. Telegram aplica las mismas reglas de propiedad.
- Las reglas de Firestore validan que una transferencia enlazada use el método
  Transferencia, la dirección correcta y una devolución por el monto declarado.

## Auditoría responsive Android + iPhone (10/09/2026)

- Primera apertura, acceso, registro, verificación, configuración, bloqueo,
  detalles y formularios largos ahora respetan el área segura, permiten scroll
  y no quedan tapados por el teclado.
- Tarjetas, totales, diálogos y movimientos soportan cantidades y textos largos.
  Las listas extensas se muestran por bloques o virtualizadas para no congelar
  teléfonos con muchos datos.
- La barra inferior, los totales de Familia/Cajas y el recorte de imágenes se
  adaptan al ancho disponible y al tamaño de letra del sistema.
- iOS ya tiene el identificador `com.finoapp.gastos` y está limitado a iPhone
  por ahora. En iOS se ofrece acceso con correo; Google, escáner, captura
  automática y widget de voz se muestran únicamente donde están configurados.
- La carga de Google y del micrófono es diferida: Expo Go puede abrir la app sin
  los módulos nativos que solo existen en el AAB o en una compilación propia.
- La comprobación automática cubre Android e iOS. La prueba final del teclado,
  permisos, cámara y zonas físicas de iPhone sigue pendiente de un iPhone o una
  compilación ejecutada desde macOS.

## Versiones

- Disponible en prueba cerrada: **1.0.8**, `versionCode 10`.
- Marca visible de 1.0.8: **14sep-yape-transferencias-seguras**.
- Las correcciones del 22/09 están en código y requieren desplegar reglas y
  funciones antes de preparar un nuevo AAB.
- El AAB firmado solo se genera en la computadora autorizada.

## Telegram preparado

- Existe una pantalla Premium en Ajustes para vincular la cuenta con un código
  aleatorio de un solo uso que vence en diez minutos.
- El bot abre un menú compacto con Personal, Familia y Cajas. Antes de registrar
  muestra el saldo, los ingresos y los gastos reales del espacio; en Personal
  también muestra el presupuesto o «Sin definir». Ingresos y Gastos ocupan líneas
  separadas para que ninguna cifra larga quede apretada.
- El espacio elegido queda recordado. Gasto o Ingreso pide una sola línea como
  «20 almuerzo Yape» en un aviso breve; monto, descripción y método pueden
  escribirse en cualquier orden. Deduce categoría y método sin IA y guarda inmediatamente.
  El aviso y la confirmación presentan monto, descripción y método de pago en
  líneas separadas para que se entiendan al instante y admitan cifras largas.
  La confirmación de transferencias también usa una línea por dato: monto,
  origen, saldo posterior y destino; ninguna cifra comparte línea con otra.
  Después ofrece Otro gasto, Otro ingreso, Más opciones, Cambiar espacio y
  Deshacer; no obliga a volver al inicio después de cada movimiento.
- También acepta frases directas como «pagué 20 taxi en efectivo». Si se omite
  el método reutiliza el último de ese tipo; Más opciones permite corregirlo y,
  en Personal, también corregir la categoría.
- Familia y Cajas permiten transferir desde Personal. La confirmación muestra
  ambos saldos y la operación enlazada se escribe de forma atómica: nunca se
  descuenta un lado sin acreditar el otro. Los reintentos de Telegram llevan una
  identidad estable para no duplicar movimientos.
- Familia y Cajas se comprueban otra vez contra la membresía activa antes de leer
  o guardar. El servidor no confía únicamente en el botón que pulsó la persona.
- El bot no usa inteligencia artificial ni guarda el token en la app o el repositorio.
- Puede probarse localmente sin Blaze mientras la computadora permanezca
  encendida. Para funcionar permanentemente se desplegará la función cuando se
  active Blaze, después de la aprobación de Google Play.
- Falta hacer la prueba real completa desde el teléfono. Para el
  servicio permanente todavía faltan Blaze, secretos y webhook de producción.

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
- El selector muestra símbolo y código ISO juntos (`S/ · PEN`, `US$ · USD`,
  `€ · EUR`); reduce el texto de símbolos largos sin ocultar el código y lo
  anuncia completo al lector de pantalla.
- Registrar gasto muestra Plin solo en Perú y Yape solo en Perú o Bolivia;
  efectivo, débito, crédito y transferencia siguen disponibles en todos los
  países. Al editar, los movimientos antiguos conservan su método original.
- La tarjeta de saldo anterior se distingue con el color principal de Fino. Sus
  acciones de borrar y restaurar tienen mayor tamaño, contraste, significado
  visual diferente y una descripción para lectores de pantalla.
- Inicio muestra un selector compacto entre Personal, Familia y Cajas. Personal
  conserva el presupuesto actual; Cajas tiene una pantalla propia, totalmente
  separada de Modo negocio, para crear cajas, anotar ingresos y gastos y consultar
  el saldo y el historial de cada una. Se guarda en el teléfono y, con sesión
  iniciada, en un documento propio de Firebase. Familia tiene una pantalla
  real: permite crear un espacio, invitar mediante un código aleatorio de ocho
  caracteres que vence en siete días, entrar como miembro, ver participantes y
  registrar ingresos o gastos compartidos. Sus datos viven separados y Firebase
  exige membresía válida para leerlos; conocer la dirección del espacio no basta.
- La cabecera de Inicio respeta el área segura y añade 6 px de aire para que los
  controles superiores no rocen el borde físico del celular.
- La elección se conserva aunque Android cierre Fino al verificar el correo.
- Solicitud del permiso de avisos antes del formulario de cuenta.
- La bienvenida conserva su paso al volver del permiso de Android.
- Verificar correo tiene tiempo máximo de espera y nunca queda cargando.
- Se indica revisar Spam o correo no deseado.
- CLP, COP y ARS se muestran sin centavos y con separadores locales.
- Inicio y Reportes usan cantidades compactas en espacios pequeños.
- Gráficos, leyendas y ejes reservan espacio para monedas grandes.
- Todos los formularios monetarios comparten un máximo seguro de 13 cifras
  enteras. Las cantidades antiguas mayores se muestran abreviadas, nunca como
  notación científica ni con textos de error dentro de las tarjetas.
- La copia principal de Firebase se guarda dentro de una operación atómica:
  si dos dispositivos intentan subir cambios a la vez, Firestore vuelve a leer
  y fusionar antes de escribir para que el último no pise al primero. El tamaño
  se comprueba otra vez después de esa fusión y se mide en bytes UTF-8 reales,
  incluidos acentos, símbolos y emojis.
- Si Android no puede guardar localmente —por ejemplo, porque el teléfono se
  quedó sin espacio— la app ya no presenta el cambio como un éxito silencioso:
  muestra un aviso traducido y permite volver a intentarlo.
- Las metas eliminadas quedan registradas en el celular y en Firebase. Al usar
  la misma cuenta en dos teléfonos, las metas nuevas se combinan y una meta
  borrada no reaparece por una copia antigua del otro dispositivo.
- Las cuatro frecuencias de exportación se ordenan 2 × 2 en celulares pequeños
  o con letra ampliada, y aprovechan una sola fila únicamente cuando hay espacio.
- Nuevo movimiento permite elegir sin salir entre tres categorías rápidas,
  recorrer horizontalmente sus iconos, marcar cada dibujo con una estrella,
  reutilizar favoritos y abrir Cámara o Galería junto a cada categoría. También
  conserva «Ver todas» para el catálogo completo y el campo de monto tiene una
  altura compacta de 48 px. Al elegir un dibujo su categoría sube primero y se
  abre una paleta horizontal; otro toque lo desmarca y oculta la paleta.
- Las tres categorías rápidas mantienen su posición al elegir dibujos. Cada una
  muestra ⇄ para desplegar ahí mismo todas las opciones (también con pulsación
  larga) y un lápiz para editar el nombre en la misma fila, sin abrir otra
  pantalla; Cámara y Galería permanecen al costado.
- Cada dibujo de la fila Favoritos lleva su estrella naranja: tocarla lo quita
  inmediatamente de Favoritos sin borrarlo del catálogo ni de los movimientos.
- La navegación bloquea durante 1,5 segundos los toques repetidos: botones como
  «Ver todas» no pueden apilar dos copias de la misma pantalla en celulares lentos.
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

- Publicar las reglas y Cloud Functions auditadas y probar Familia/Cajas con dos cuentas.
- Definir la siguiente versión, aumentar su `versionCode` y subir un nuevo AAB a la misma prueba cerrada.
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
- Pruebas: **102 aprobadas** más **7 auditores integrales**.
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
- La moneda de una tarjeta de crédito queda bloqueada cuando ya tiene
  movimientos. Así una deuda en soles nunca puede mostrarse como dólares solo
  por cambiar su etiqueta; para otra moneda se crea otra tarjeta.
- Se retiró de la interfaz el estado de pago «En proceso», que ninguna pantalla
  podía crear. Si aparece en datos antiguos, se conserva internamente sin
  convertirlo en pago: la deuda queda pendiente hasta registrar uno confirmado.
- Las tarjetas distinguen la moneda del límite de la moneda real de cada compra.
  Por ejemplo, una línea de US$ 500 puede guardar y pagar una compra de S/ 120.
  Cuando difieren, Fino pide el monto real que el banco descontó del límite;
  así actualiza el crédito disponible y lo libera proporcionalmente al pagar.
  Las deudas se muestran separadas y nunca se inventa un tipo de cambio.

## Pendientes actuales

### Cajas compartidas (06/09/2026)

- Familia y ambas vistas de Cajas muestran totales táctiles que filtran el historial
  y permiten volver a todos. Los registros nuevos guardan método de pago; los antiguos
  sin método no reciben uno inventado. Yape/Plin siguen las restricciones por país.
- El propietario puede cerrar Familia mediante confirmación: queda inactiva, se
  bloquean nuevos movimientos/invitaciones y se conserva el historial. El cierre se
  observa en otros clientes activos. No equivale a borrar permanentemente los datos.

- Cajas permite un monto inicial de dinero externo; no descuenta Personal.
- Los aportes desde Personal hacia Familia o una Caja quedan enlazados en ambos
  lados. Al borrar ese aporte, el débito correspondiente también se retira de
  Personal; en Familia, ningún otro miembro puede borrar el aporte del dueño.
  Los ingresos posteriores de Familia también permiten elegir entre dinero
  externo y Personal, con la misma comprobación de saldo disponible.
- La ruta `/shared-boxes` permite crear, unirse con código y registrar movimientos
  compartidos. Guarda la moneda de la caja y escucha los movimientos en directo.
- Una caja privada se puede convertir en compartida desde su propia pantalla, sin
  mostrar un segundo botón de creación. La copia conserva historial, métodos,
  moneda y vínculos con Personal, trabaja en lotes seguros para Firebase y solo
  retira la caja privada cuando la copia terminó; una migración interrumpida no
  aparece como una caja compartida vacía.
- Corregido el acceso antes de la membresía y la creación atómica de caja y dueño.
- Familia y Cajas compartidas muestran sus miembros. El propietario puede retirar
  invitados; un invitado puede salir sin borrar el espacio ni afectar a los demás.
- Los espacios calculan cuánto del saldo restante proviene realmente de Personal y
  solo permiten devolver hasta ese importe. La devolución aumenta el disponible,
  pero no se presenta como un ingreso nuevo. Un espacio no puede cerrarse mientras
  conserve saldo, evitando que el dinero desaparezca por error.
- No se puede borrar el presupuesto mensual mientras parte de ese dinero continúe
  transferida a Familia o Cajas. Primero debe devolverse a Personal; así el saldo no
  queda negativo por eliminar la base que respaldaba una transferencia activa.
- Las transferencias enlazadas ya no se pueden editar ni borrar desde Personal,
  tampoco mediante selección múltiple. Se administran desde la Familia o Caja que
  posee el otro lado del movimiento, evitando saldos descuadrados.
- Pendiente: prueba real con dos cuentas. No presentar el flujo
  completo como terminado ni afirmar visibilidad en el emulador sin comprobarla.

Esta lista reemplaza los pendientes antiguos que hablaban de dos carpetas o de
rescatar Excel/Premium: eso ya quedó consolidado en `C:\finzo` y subido a
`master`.

### Selector de iconos compacto (05/09/2026)

- La pestaña `Ícono` de `Elegir categoría` tiene los 18 grupos repartidos en
  tres franjas horizontales, sin rótulos de fila. En un celular se ven cerca de
  cuatro filtros por franja y cada una se desliza para mostrar los restantes.
- Al tocar un filtro se muestran debajo únicamente sus iconos; `Todos` recupera
  el catálogo completo correspondiente. Gasto e Ingreso ya no comparten todos
  los filtros: cada tipo ofrece únicamente grupos adecuados a su uso. La
  cuadrícula continúa desplazándose verticalmente.
- Estrella, cámara y galería quedaron juntas al lado de la vista previa para no
  gastar una sección adicional. Si hay una foto, aparece una acción compacta
  para quitarla. Cámara y galería tienen además una descripción para lectores
  de pantalla, y el encabezado avisa que las franjas se pueden deslizar.
- El editor de nombre dentro de `Nuevo movimiento` mide 42 px y centra el texto
  explícitamente en Android; guardar y cancelar tienen la misma altura.
- Los campos de monto ya no aceptan una última cifra que supere el máximo
  seguro. Antes trece nueves dejaban `Guardar` desactivado hasta borrar; ahora
  esa última cifra simplemente no entra y el monto visible siempre es guardable.
- En `Presupuestos por categoría`, la casilla del límite aumentó de 104 a 152 px
  y usa la misma protección al escribir rápidamente que `Nuevo movimiento`.

### Correcciones y comprobaciones antes del próximo AAB

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
- Ejecutar TypeScript, ESLint, Expo Doctor, las 87 pruebas y los 7 auditores
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

### Transferencias internas

- Personal, Familia y Caja muestran las transferencias como un tercer tipo azul,
  con dirección, fecha y estados Pendiente, Parcial o Devuelta.
- Las devoluciones crean un movimiento nuevo y quedan repartidas y enlazadas a
  los aportes originales de la misma persona.
- Las transferencias afectan el saldo del bolsillo, pero no los totales ni las
  gráficas de ingresos y gastos. El dinero externo continúa como ingreso normal.
- Los movimientos antiguos se reconstruyen al abrir su Familia o Caja; convertir
  una caja privada en compartida conserva sus enlaces.
- En Personal, Familia y Caja, el historial agrupa cada transferencia por espacio:
  enseña el monto enviado/recibido y solo muestra «Devuelto» cuando hubo una
  devolución. Los filtros +/− separan ingresos y gastos; tocar el título
  restaura todos los movimientos. Familia y Caja sitúan sus totales bajo el saldo
  y dejan el botón + como acción inferior principal.
- Inicio integra el presupuesto mensual dentro de la tarjeta de saldo y deja
  Saldo anterior a todo el ancho. La campana abre un panel con pagos del
  calendario, importaciones pendientes y la próxima exportación programada.
  Los botones de movimientos se distinguen de +/− y pulsan al haber un filtro.

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

### Auditoría externa — prioridad alta, primer bloque corregido (26/09/2026)

- Los gastos pagados con tarjeta de crédito vuelven a aparecer y sumar en Inicio.
- La entrada de montos entiende separadores de miles y decimales de Perú y otros
  países (`1,500`, `1.500,25` y `1,500.25`) sin convertirlos en valores erróneos.
- Un fallo de red al leer la nube ya no se confunde con una cuenta vacía ni puede
  provocar que el inicio suba datos vacíos sobre una copia existente.
- El estado Premium y el inicio de la prueba se conservan desde la nube, incluida
  una revocación, para evitar respaldos bloqueados por datos viejos del teléfono.
- Importar omite duplicados de forma predeterminada y muestra cuántos registros
  realmente nuevos se incorporarán.
- Las familias toleran enlaces antiguos dañados y, al borrarse, eliminan también
  los enlaces de todos sus integrantes.
- Presupuestos, calendario, categorías, personalización, perfil y preferencias
  llevan una fecha por bloque. Al sincronizar dos teléfonos gana únicamente el
  bloque más nuevo; registrar un gasto ya no pisa cambios ajenos. Las cuentas
  antiguas migran dando prioridad inicial a la copia compartida de la nube.
- Negocio fusiona registros por identificador dentro de una transacción, muestra
  el fallo de respaldo y avisa antes de acercarse al límite de Firestore.
- Los movimientos llevan fecha de actualización; una edición más nueva gana al
  fusionar teléfono, nube y Telegram. Deshacer desde Telegram registra además la
  eliminación para impedir que el movimiento reaparezca.
- Las credenciales de firma se retiraron del archivo local de Android y ahora se
  exigen mediante variables de entorno. La rotación de la clave en Google Play
  continúa siendo una operación manual pendiente y no se generó ningún AAB.
- Validación superada: TypeScript, ESLint, 111 pruebas, 7 auditores y 29 pruebas
  de las funciones del servidor. No se publicó ni desplegó ningún servicio.

### Auditoría externa — prioridad media, primera tanda corregida (26/09/2026)

- Desmarcar un pago del calendario conserva el movimiento enlazado y una nueva
  confirmación reutiliza su edición, en vez de borrar información financiera.
- Las exportaciones de gastos e ingresos excluyen transferencias internas y el
  Excel aplica filtro, anchos, estilos y formato monetario a sus siete columnas.
- La exportación automática se apaga al terminar Premium o la prueba; el lector
  automático deja de descifrar movimientos cada ocho segundos cuando está
  desactivado o sin permiso.
- Salir unos instantes a Yape, WhatsApp, cámara o archivos ya no cierra el
  formulario actual; el regreso a Inicio ocurre tras treinta minutos fuera.
- El bloqueo ya activado puede deshabilitarse aunque Premium haya vencido, sin
  permitir que se vuelva a activar gratis, y el texto del PIN no promete una
  recuperación que la nube quizá no tenga.
- Familia y Cajas impiden borrados ajenos y operaciones que dejarían saldo
  negativo desde la app; compartir una caja puede reintentarse sin duplicar los
  movimientos ya copiados.
- Se añadió límite de 15 MB antes de procesar una importación y un enlace a la
  política de privacidad al crear la cuenta.
- La pantalla Premium ahora anuncia Familia, Cajas compartidas y Telegram, y no
  presenta el registro automático de Yape como una función Premium.
- Pendiente de una tanda posterior: moneda propia en Familia, refuerzo atómico
  del saldo compartido en servidor, limpieza completa de Telegram al borrar la
  cuenta, App Check, privacidad nativa del lector, prueba Premium gestionada por
  servidor y migración del documento único a datos paginados.
- No se desplegaron reglas, funciones ni una versión de la aplicación.

### Auditoría externa — moneda, seguridad y mejoras de uso (26/09/2026)

- Cada Familia nueva conserva su propia moneda y todos sus integrantes ven el
  mismo formato. Las transferencias o devoluciones entre monedas distintas se
  bloquean para no copiar cifras sin conversión; Cajas compartidas aplica la
  misma protección.
- Telegram queda oculto por defecto hasta compilar con el servicio habilitado.
  El borrado de cuenta retira su estado visible y deja preparado el disparador
  de limpieza del servidor. Esta función no se desplegó.
- Los códigos de Familia y Caja usan aleatoriedad criptográfica y se consumen
  al entrar, en lugar de poder reutilizarse durante siete días.
- Los CSV neutralizan fórmulas y protegen separadores regionales; el borrado
  múltiple exige confirmación y no cuenta transferencias que debe conservar.
- Las transferencias enlazadas no se pueden editar mediante una ruta directa;
  sus cambios autorizados siguen haciéndose desde Familia o Caja.
- Los identificadores nuevos abandonan el cálculo que habría superado el
  entero seguro en 2039. El formato nuevo mantiene orden y separación entre
  dispositivos sin tocar identificadores antiguos.
- Ajustes permite cambiar entre tema claro y oscuro. Historial busca en todos
  los meses e incluye notas y montos cuando se escribe una búsqueda.
- Los avisos del calendario usan la moneda configurada y Netflix/Disney dejan
  de mostrarse con el logotipo incorrecto de YouTube.
- El lector nativo no registra nombres de aplicaciones cuando está apagado y
  limpia su buzón y diagnóstico al desactivarse. La importación nativa corta la
  copia al superar 15 MB. Ambos cambios requieren un futuro instalable para
  comprobarse en Android; no se generó ninguno.
- Tarjetas de crédito permanece pendiente por decisión del propietario y no se
  incluyó en esta tanda.
- Validación superada: TypeScript, ESLint, 111 pruebas de la app, 7 auditores y
  30 pruebas del servidor. No se publicó, compiló ni desplegó nada.

### Auditoría externa — entrada de montos (26/09/2026)

- Los campos de dinero ya no recortan cifras que superan el límite: conservan
  visible lo escrito y rechazan el guardado con una explicación. Antes un monto
  grande podía convertirse silenciosamente en otro diez veces menor.
- La cantidad de decimales se valida según la moneda seleccionada. Los montos
  fraccionarios muy grandes se rechazan para evitar pérdida de precisión.
- Presupuestos y montos iniciales de Familia o Caja no se convierten en cero si
  se escribe un valor inválido.
- Validación superada: TypeScript, 111 pruebas y 7 auditores. ESLint terminó
  sin errores, con avisos preexistentes en Contexto e Importación.
- Sigue pendiente migrar el respaldo personal a varios documentos, junto con
  la compatibilidad de Telegram y la publicación coordinada de reglas.

### Auditoría externa — rendimiento y aviso de respaldo (26/09/2026)

- Familia reutiliza los movimientos de la familia activa que ya había leído
  para calcular saldos, evitando descargarlos una segunda vez al abrirla.
- Si el respaldo alcanza el límite del documento, Ajustes muestra el motivo
  real y advierte que no se debe desinstalar la app antes de exportar los datos
  o resolver el respaldo. Antes prometía un reintento que no podía funcionar.
- La migración del historial a varios documentos sigue pendiente: debe incluir
  restauración, uso en dos teléfonos, Telegram, reglas de acceso y convivencia
  con versiones anteriores. No se ha activado ningún formato nuevo.
- Validación: TypeScript, 111 pruebas y 7 auditores aprobados. Sin despliegue.

### Auditoría externa — campana de Inicio (26/09/2026)

- El punto rojo solo señala un pago urgente o una importación pendiente; una
  exportación futura permanece visible en el panel sin parecer una urgencia.
- La próxima exportación se vuelve a leer al regresar a Inicio, para reflejar
  cambios hechos en su pantalla de ajustes sin reiniciar la aplicación.
- La prueba nueva falló primero contra el comportamiento anterior y luego pasó.
- Validación: TypeScript, 111 pruebas y 7 auditores aprobados; ESLint sin
  errores (12 avisos preexistentes en Contexto e Importación). Sin despliegue.

### Auditoría externa — avisos de calendario y moneda (27/09/2026)

- Cambiar la moneda vuelve a programar los avisos del calendario para que el
  importe no conserve el símbolo anterior. El formato se calcula con la moneda
  actual sin ejecutar la programación en cada redibujado.
- La prueba nueva falló contra el código anterior y pasó con el cambio.
- Validación: TypeScript, 112 pruebas y 7 auditores aprobados; ESLint sin
  errores (11 avisos previos en sincronización e importación). Sin despliegue.

### Auditoría externa — cierre de sesión sin copia (27/09/2026)

- Si falla el respaldo, cerrar sesión conserva la cuenta y los datos locales
  por defecto. El usuario puede optar por salir sin copia mediante dos
  confirmaciones que explican la pérdida irreversible de cambios no guardados.
- El flujo normal sigue exigiendo un respaldo correcto antes de limpiar el
  teléfono; la excepción solo se usa cuando la persona la elige expresamente.
- Las advertencias están traducidas al español, inglés y portugués. La prueba
  de seguridad falla con el código anterior y comprueba ambos caminos.
- No se migró todavía el documento principal a una subcolección: activar un
  formato parcial rompería la convivencia con versiones antiguas y Telegram.
- Validación: TypeScript, 112 pruebas y 7 auditores aprobados; ESLint sin
  errores (11 avisos previos). Sin APK ni despliegue.

### Auditoría externa — base del historial separado (27/09/2026)

- Preparados el modelo de documentos, la fusión de ediciones/borrados, lotes
  acotados por tamaño, una copia sombra reanudable y una comprobación previa
  al corte del formato antiguo. Se prueban un corte de red y una edición de
  otro teléfono durante la copia: ninguno permite borrar el origen.
- La prueba nueva simula 10.000 movimientos y falló antes de añadir el módulo.
  No hay escrituras nuevas en Firebase ni cambio del respaldo activo.
- La secuencia de activación y los casos que faltan están en
  `docs/MIGRACION_RESPALDO_PERSONAL.md`.
- Validación: TypeScript, 113 pruebas y 7 auditores aprobados; ESLint sin
  errores (11 avisos anteriores). No se publicó ni activó el nuevo formato.

### Auditoría externa — protección del futuro cambio de historial (27/09/2026)

- La app ahora rechaza cargar y sobrescribir una cuenta marcada con un formato
  de historial que no entiende. Las reglas locales bloquearán a clientes viejos
  cuando una cuenta migre, una vez publicadas junto con la solución completa.
- Los accesos por correo y Google y la verificación de correo muestran un aviso
  de actualización cuando detectan ese formato, en vez de un error genérico.
- El límite de 1 MB sigue sin resolverse para la app instalada. Todavía faltan
  lector/escritor, Telegram, borrado de cuenta, pruebas en emulador y despliegue
  coordinado. No se ha activado ni publicado la migración.

## Reglas para continuar

1. Leer `AGENTS.md`, este archivo y `ENTREGAS.md`.
2. No publicar secretos ni datos privados.
3. No cambiar el paquete `com.finoapp.gastos`.
4. Aumentar `versionCode` y `CODE_MARKER` por cada entrega.
5. Ejecutar TypeScript, ESLint, pruebas y auditores antes de publicar.
6. Crear commit y push al terminar.
7. Entregar un solo instalable a la vez.
8. En cada avance indicar qué sigue y qué falta; no declarar terminada toda la
   auditoría mientras queden tareas locales, pruebas físicas o acciones externas.
9. Tarjetas de crédito siguen pendientes y no se modifican sin autorización.

## Próximo paso exacto

Continuar la revisión local de traducciones y accesibilidad en pantallas
secundarias y reemplazar las pruebas antiguas basadas solo en texto. Después,
con autorización previa, publicar y probar reglas y funciones, definir la
siguiente versión, generar su AAB, subirlo a prueba cerrada y probar una
instalación nueva.

### Auditoría externa — traducciones, accesibilidad y prueba de campana (28/09/2026)

- La bienvenida, Caja compartida y las etiquetas accesibles principales de
  Inicio, Familia, Cajas y navegación usan ahora los tres idiomas configurados.
- Las transferencias de Familia y Caja muestran «recibido» y «devuelto» con
  textos traducibles, sin alterar montos, vínculos ni tarjetas de crédito.
- La prueba de la campana dejó de buscar fragmentos exactos del componente y
  ahora ejecuta la decisión real: pagos urgentes e importaciones encienden el
  punto; una exportación futura se muestra sin marcarse como urgencia.
- Las pruebas estáticas afectadas se ajustaron para exigir las claves traducidas
  en los tres idiomas, sin retirar sus verificaciones de seguridad y flujo.
- No se publicó, compiló ni desplegó nada. Tarjetas de crédito sigue excluido.

### Auditoría externa — segunda tanda de textos y moneda (28/09/2026)

- Los avisos de fecha inválida y borrado de Familia/Cajas, incluido el saldo
  cero exigido, ya respetan español, inglés, portugués y la moneda configurada.
- Telegram traduce el error al generar el código. El calendario dejó de mostrar
  `S/` fijo y usa el símbolo real de la cuenta.
- La prueba del flujo inicial ahora carga las traducciones ejecutables de los
  tres idiomas; ya no se limita a contar frases dentro del archivo fuente.
- Los auditores confirman 1.527 claves por idioma, sin claves repetidas,
  faltantes, variables desiguales ni problemas de redacción.
- No se modificaron tarjetas de crédito ni se publicó ningún cambio.

### Auditoría externa — cierre local de traducciones visibles (28/09/2026)

- Se tradujeron el bloqueo por intentos y el diagnóstico de partes nativas de
  Información, que todavía mezclaban español al elegir inglés o portugués.
- Se añadió un auditor de interfaz que analiza las pantallas con el compilador
  de TypeScript y falla si encuentra texto JSX, placeholder, etiqueta accesible,
  alerta o mensaje breve sin pasar por traducciones.
- El auditor excluye expresamente el módulo de tarjetas de crédito por decisión
  del propietario y permite solo marcas, formatos de archivo y separadores.
- BAJ-01 queda corregido en código. Sigue pendiente comprobar el recorrido real
  con TalkBack, letra al 200 %, modo horizontal y un dispositivo físico.

### Auditoría externa — pruebas reales de importación y presupuesto (28/09/2026)

- La importación rápida ahora se comprueba ejecutando su ventana real: admite
  hasta 14 días, descarta desde 15 y no enlaza dos filas con el mismo movimiento.
- Esa ventana usa ahora un índice por fecha: importar varias filas dejó de
  recorrer los 10.000 movimientos completos una vez por cada fila.
- El presupuesto exacto se comprueba mediante la misma función de Inicio: no
  redondea el monto y evita formatearlo cuando el saldo está oculto.
- Los métodos de pago ya se prueban ejecutando su filtro real por país y la
  compatibilidad al editar movimientos antiguos.
- Países y monedas se prueban ahora usando el catálogo real: 250 países, 155
  monedas, búsquedas, orden, símbolos, decimales y separación entre perfil
  local y respaldo en nube.
- La categoría escrita en un archivo importado tiene una prueba directa y
  separada de la protección para borrar un mes completo.
- Un CSV sintético de 10.000 movimientos se procesa completo en menos de 100 ms
  en el entorno local; la medición física de PDF sigue pendiente.
- Un Excel real de 10.000 filas y la preparación de un PDF con 10.000
  movimientos también pasan pruebas locales de carga. El límite de 15 MB se
  comprueba en su byte exacto; aún falta medir la impresión nativa en teléfono.
- Los avisos del calendario se prueban ahora mediante programación real
  simulada: cambio de moneda, tres meses, meses pagados, ausencia de duplicados
  y cancelación selectiva sin borrar avisos de exportación.
- También se verifican permiso denegado, fallo del sistema y dos cambios
  simultáneos; la cola conserva únicamente la configuración más reciente.
- La acción «Probar aviso» tiene casos ejecutables de éxito a tres segundos,
  permiso denegado y error nativo.
- Se mantienen 113 pruebas totales porque tres pruebas de comportamiento
  reemplazan tres pruebas estáticas anteriores; no se tocaron tarjetas de
  crédito ni se publicó nada.

### Avisos del calendario y resultado de exportación en Inicio (03/10/2026)

- La campana deja de anunciar una exportación futura como si ya se hubiera
  recibido. Muestra únicamente el resultado del último intento automático,
  con fecha/hora y estado; «Probar ahora» no se presenta como envío programado.
- Los avisos de calendario muestran el monto, la fecha completa y su estado.
  Al tocarlos, abren una ficha inferior con acciones para editar o marcar el
  pago/ingreso/recordatorio como realizado.
- La configuración de exportación automática conserva una sola explicación
  breve y el interruptor de «Incluir gráficos» queda como rótulo e interruptor.
  El selector manual Todos/Gastos/Ingresos permanece sin cambios.
- Verificado: TypeScript, ESLint, `node pruebas/correr.mjs` (123 pruebas y 8
  auditores), y revisión visual de Inicio y el flujo del aviso en el emulador.
  La exportación automática estaba desactivada, por lo que no se activó para
  inspeccionar opciones ocultas; esa parte se validó con pruebas y código.
- No se cambiaron movimientos ni saldos y no se generó APK/AAB. Pendiente:
  probar la configuración de exportación con la función activada por el usuario
  y validar en el emulador la campana cuando exista un resultado automático.

### Campana con contador y hoja inferior (03/10/2026)

- La campana cuenta los avisos nuevos y se sacude brevemente al llegar avisos.
  Al abrirla, sube una hoja inferior con fondo atenuado; abrirla marca los avisos
  como vistos, pero no marca pagos como hechos. Los pagos siguen visibles hasta
  usar su acción correspondiente.
- La ficha del calendario ahora ocupa la misma hoja, con regreso a la lista; el
  cuadro de importación conserva su acción para abrir el archivo.
- En los dispositivos que exportan con la app cerrada ya no se muestra un aviso
  adelantado a la hora programada: se envía al teléfono el resultado real (éxito,
  falta de movimientos o error). Los dispositivos que necesitan que la persona
  toque el aviso a esa hora conservan ese recordatorio de acción. Al iniciar la
  app se retira el recordatorio antiguo de los dispositivos que ya pueden
  exportar en segundo plano; no se cancela la alarma nativa de ejecución.
- El resultado del teléfono abre el estado de exportación. Los avisos leídos se
  guardan cifrados solo en el dispositivo y se eliminan al cerrar sesión; se
  documentó en la política local y en PLAYSTORE.md.
- Verificado: 123 pruebas, 8 auditores, TypeScript y ESLint. En el emulador se
  comprobó visualmente la hoja inferior y su estado vacío. No había un aviso de
  calendario ni un resultado automático real para probar la ficha completa o
  la notificación de exportación sin crear datos/pruebas artificiales.
- No se cambiaron movimientos, se dejó la exportación automática como estaba y
  no se generó APK/AAB. Sigue pendiente probar el aviso real cuando ocurra una
  exportación programada con permiso de notificaciones activo.

### Equilibrio de porciones y líneas en la rosquilla (03/10/2026)

- Las categorías muy pequeñas reciben un tamaño visual mínimo, pero el ajuste
  comparte un presupuesto global: no amplía la cola pequeña por encima del 18%
  de la dona final. Si los montos reales ya ocupan más espacio, no se reducen.
- Los porcentajes y montos mostrados siguen calculándose con los datos reales.
- Las líneas curvas ahora usan 1.8 dp, opacidad completa y exactamente el color
  de su segmento. Las etiquetas se conservan distribuidas alrededor de la dona.
- Pruebas nuevas cubren la geometría real con seis y nueve categorías pequeñas,
  el máximo común, la separación de sus orígenes y el color/grosor de líneas.
- Verificado: TypeScript, ESLint, 123 pruebas y 8 auditores. El emulador estaba
  abierto pero sin servidor de desarrollo activo; falta revisar el dibujo
  actualizado en pantalla. No se tocaron movimientos ni saldos y no se generó
  APK/AAB.
