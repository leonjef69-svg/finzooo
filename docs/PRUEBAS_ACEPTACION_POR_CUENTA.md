# FINO-47/49: aceptación por cuenta, parcial (08/10/2026)

Ampliación posterior: PRUEBAS_ACEPTACION_SERVIDOR.md describe el recibo remoto
y las reglas preparados. Este documento conserva el alcance histórico local;
la afirmación de «sin documentos Firebase nuevos» no describe la ampliación.

## Preparado, no publicado

- Registro por correo y ambos botones Google conservan la casilla explícita
  previa. Tras Auth intentan guardar la elección; un fallo local informa pero
  no repite la creación ni impide abrir la cuenta válida. Login correo existente
  NO genera una aceptación automática.
- Términos/Privacidad permiten aceptar a una cuenta local activa, sin Pro.
  Familia/Cajas compartidas muestran un aviso desplazable con enlace si falta.
  Casilla sin marcar; botones bloqueados mientras se comprueba/guarda.
- Recibo separado por UID, cifrado con AES/HMAC originales: formato, UID,
  SHA-256 de ambos textos completos, elección y fecha del reloj del teléfono.
  No añade documentos Firebase, servicios ni permisos. No viaja en el respaldo
  financiero; permanece tras logout y se elimina con deleteLocalAccountVault.
  Otra instalación/teléfono requiere elección nueva. No acredita por sí solo
  consentimiento para datos sensibles, hora certificada ni aceptación remota.
- Comprobación local en creación/unión/invitación/nombre/movimiento Familia y
  Cajas, y edición de texto de aportes. Una conversión nueva comprueba antes de
  guardar sharingPending y antes de subir/copiar. Recuperar resultados previos,
  salir/cerrar/borrar/devolver dinero no exige casilla. No altera saldos.
- Cola por UID, límite de lectura, comprobación de identidad de Auth/generación
  local tras esperas, barrera al eliminar cuenta y observadores aislados. Una
  petición explícita que escribió antes del cambio de sesión puede permanecer
  en SU UID; su respuesta obsoleta se rechaza, nunca se registra en otra cuenta.
  Una operación que ya llegó al SDK remoto no se cancela por este módulo.

## Comprobado localmente

`node pruebas/verificar-aceptacion-cuenta-real.mjs` ejecuta los módulos originales
de recibo/cifrado/almacén/bóveda, SHA-256/AES/HMAC reales con IO Auth/Android
adaptado. Comprueba ausencia, validez, cambio de ambas versiones, daños/límite,
fallos de disco/lectura posterior, observador fallido, logout A→B→A,
solo recibos autenticados v2 (formato heredado sin HMAC rechazado), borrado de
solo A y escritura tardía detrás de barrera; cuenta/sesión A→B→A y colas separadas.
Diez funciones compartidas originales no llegan a IO remoto sin aceptar y
alcanzan el flujo original con aceptación. Conversión previa no exige elegir
otra vez; manejador original de Cajas no deja pendiente por falta de elección.
Acciones originales de borrar/cerrar/salir conservan sus llamadas financieras.
Manejador original de aceptación comprueba casilla/doble toque/fallo.

`node pruebas/verificar-aceptacion-antes-auth.mjs` comprueba los tres manejadores
originales, recibo tras Auth, aviso ante fallo sin repetir altas, validación,
cancelación/doble toque y árbol JSX de casilla/enlace. Persistencia NO sustituida
por esa suite; está ejecutada por la primera. Aviso dentro de ScrollView es un
contrato estático, no comprobación visual Android/TalkBack.

Regresiones contra `1292a78`: FINO_LEGAL_AUTH_BASELINE detecta recibo ausente;
FINO_LEGAL_ACCOUNT_BASELINE detecta crearFamilia llegando al servidor sin
aceptación. Fallo esperado en la revisión anterior y aprobación en la actual.
Los módulos de persistencia nuevos se ejecutan actuales en ambas pasadas;
la comparación histórica corresponde a los manejadores de alta/contenido,
NO se presenta como una versión antigua del recibo que nunca existió.

Las pruebas financieras anteriores adaptan Firebase local para no cargar
cuentas reales; cierre/sincronización presuponen aceptación válida explícita.
La nueva suite verifica por separado la barrera real; no se retiraron sus
comprobaciones financieras. Pruebas de tarjetas siguen excluidas.

## Qué sigue y qué falta

- FINO-47/49 NO cerrados: falta recibo/protección real del servidor/reglas y
  compatibilidad con apps antiguas, cobertura de todos los otros caminos de
  contenido (incluida creación de perfil), bloqueo y moderación efectiva.
- FINO-48: revisión jurídica de datos sensibles, responsable, textos y trámites.
  Leer Privacidad/marcar Términos no sustituye esa revisión. Los documentos
  completos siguen en español aunque controles ES/EN/PT estén traducidos.
- Android: registro por correo/Google, cuenta existente, dos usuarios, texto
  cambiado, error de disco, modo oscuro, letra grande, scroll, foco/TalkBack,
  proceso interrumpido, borrado y recuperación sin aceptación.
- Consolas, SMTP/correo/retención, publicación web/app/reglas coordinadas y
  validación posterior siguen pendientes; nada se desplegó ni se generó APK.
- Restantes hallazgos de la matriz; tarjetas y Sentry externo excluidos.
