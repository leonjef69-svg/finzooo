# Acceso inicial y video — 08/10/2026, parcial

Prioridad vigente del propietario: estabilidad y funcionamiento; rediseño de
UI, tipografía y animaciones diferido. Las tarjetas y Sentry externo siguen
fuera. No se creó ni entregó APK/AAB/OTA, ni se desplegó servidor/reglas.

## Video: cobertura y límites

- Video recibido: 62,454 s; 1280 × 720, 30 fps declarados. Se decodificaron
  **1.870 fotogramas**, de 0,021 a 62,421 s. Las 1.706 imágenes RGB distintas
  se inspeccionaron en 43 láminas cronológicas; las otras 164 son duplicados
  exactos SHA-256, conservando índices y tiempos en el manifiesto privado.
- Láminas normalizadas a retrato solo para lectura; los fotogramas extraídos
  completos permanecen intactos. El video está estirado horizontalmente: no
  atribuir esa deformación al diseño real de Fino. No se analizó el audio.
- 2,75–3,19 s y 9,38–9,85 s: dos rutas visibles durante el deslizamiento.
  Navegar entre pantallas es esperado, no prueba duplicación de cuentas.
- Desde aproximadamente 4,15 s se observa una franja inferior oscura y un
  formulario cuyo contenido obliga a grandes desplazamientos; se repite
  alrededor de 34–38 s. Las alturas mínimas de 600/610, el margen exterior
  inferior oscuro y la foto trasladada explican riesgos que también existen
  en el código. Se quitaron esas restricciones, no se rediseñó la pantalla.
- 20–22 s: panel del administrador de contraseñas de Google; no es una
  pantalla propia de Fino. No se automatizó ese panel ni se copiaron datos.
- 45–54 s: aviso de protección de datos de otra cuenta y comprobación del
  candado; no suprimirlos para forzar acceso o hacer desaparecer el aviso.
- Desde 54,42 s: aviso Google GSIN. El video por sí solo no identifica su
  causa. El manejador anterior convertía también fallos de carga local/nube
  a ese aviso: ahora distingue acceso conseguido de carga de datos fallida.

Las capturas, fotogramas, APK temporal y manifiesto están en `.tmp`, fuera
de Git. No se subió el video ni se publicó información de cuentas.

## Correcciones funcionales preparadas

- El tercer Google, en Bienvenida, requiere elección explícita previa,
  registra el recibo propio y bloquea doble toque/cambio simultáneo de ruta.
  Se conserva el error de protección local; fallo posterior a entrar no se
  presenta como credenciales rechazadas por Google.
- Registro por correo recorta espacios. Si Firebase ya creó la cuenta,
  perfil/apertura local fallidos permiten continuar esa misma cuenta. No se
  vuelve a crear ni se repite un correo cuyo envío ya fue confirmado. Correo
  y contraseña quedan fijos en ese registro parcial; una sesión distinta,
  incluso otra instancia con la misma UID, detiene la continuación.
- Si no se confirma el envío de verificación se avisa y se permite seguir
  hacia configuración/verificación para reenviar; no se asegura recepción.
  Verificar correo ya no afirma que el enlace fue enviado siempre.
- Verificar, reenviar y salir comparten bloqueo inmediato. Fallos dejan
  reintentar; pérdida/cambio de sesión no anuncia correo reenviado. Los
  errores de acceso a los datos se conservan y salir fallido se informa.
- Recuperación de contraseña recorta espacios, evita solicitudes simultáneas
  y limita la espera sin cerrar la cuenta. Cambiar Login/Registro oculta
  primero el teclado y reutiliza la protección existente de navegación.
- Desplazamiento siempre disponible en Registro; se retiran alturas mínimas
  forzadas, traslación vertical de foto y margen oscuro bajo ambos paneles.
  Tipografía, fotos, colores, estructura y animación originales conservados.

## Pruebas y evidencia

- Tres suites nuevas ejecutan manejadores/JSX originales con IO adaptado:
  `verificar-bienvenida-acceso-real.mjs`, `verificar-registro-reintento-real.mjs`
  y `verificar-acceso-inicial-operativo.mjs`. No mantienen copia del algoritmo.
  Regresiones contra `a1000a5` rojas: Google sin elección, registro parcial
  descartado y verificación duplicada. Actual verde. La primera regresión
  de verificación reveló una espera indefinida del adaptador; se corrigió
  para afirmar el doble toque antes de esperar, no se quitó la aserción.
- La prueba existente de aceptación solo adapta Auth/usuario/ref a la nueva
  continuación; conserva sus aserciones y validaciones.
- TypeScript/ESLint aprobados y batería app **172 pruebas/8 auditores**, sin
  tarjetas. Hay una prueba ajena preexistente no versionada: 171 previstas
  en un checkout Git limpio; no se ejecutó otro checkout.
- `functions/integration-tests/initial-auth.test.js` usa Firebase 12.16 de la
  app, los manejadores originales de Registro/Login y las funciones originales
  de acceso Google y espera. Auth se conecta solo a `127.0.0.1:9099` y
  `demo-fino-node22`. Cuentas sintéticas Hotmail y Outlook: crear, verificar
  enlace simulado y entrar de nuevo; recuperación de contraseña; Google con
  selector nativo adaptado y credencial literal exclusiva del emulador.
  No envía emails ni usa credenciales reales o identidad Microsoft OAuth.
- Primera batería integral SDK/HTTP: **189 casos, 187 aprobados/2 fallidos**
  (un caso de limpieza Auth y su padre). El evento terminó en ~26 s pero
  la comprobación esperaba 25 s. No se alteraron aserciones ni se amplió la
  espera para declararla aprobada. Repetición aislada de limpieza/acceso:
  **14/14 aprobados**. Repetición integral final: **189/189 aprobados**, sin
  omitir, cancelar ni marcar pendientes. Estos resultados no eliminan el
  antecedente de demora ni garantizan latencias en producción.
- Inspección Android: dispositivo 1080 × 2400, ajuste nativo del teclado
  `adjustResize`; observación de formularios/aviso de protección y consulta
  de firma APK instalada. El rediseño transitorio se retiró tras la nueva
  instrucción; sus capturas NO prueban el aspecto del arreglo funcional final.
  No se creó ninguna cuenta real. No se acredita teclado/Google final por
  capturas anteriores o porque una prueba de código esté verde.

## Comprobación Firebase real, solo lectura

La APK instalada usa firma Debug SHA-1
`5e8f16062ea3cd2c4a0d547876baa6f38cabf625`. No aparece en el JSON local,
pero la consulta `apps:android:sha:list` del proyecto `dotero-2d430`, app
`1:133168544890:android:b46d3d84d5f5e1fbf4cfc3`, confirmó **seis firmas y
sí incluye esa firma**. No añadirla otra vez ni atribuirle el fallo GSIN.
No se cambiaron registros/configuración/proveedores ni se desplegó nada.
Esto no prueba la selección nativa, tokens, correo real ni la consola de Play.

## Qué sigue y qué falta

1. Comprobar estabilidad del recorrido completo al cambiar de pantalla durante
   operaciones lentas y continuidad/protección de datos entre cuentas.
2. Prueba humana con la cuenta original de los datos del emulador: Google,
   correo Hotmail/Outlook, verificación/Spam y recuperación. No borrar la app,
   sus datos ni la protección de propietario para aparentar éxito.
3. Configuración, regreso desde país/moneda/avisos, entrada/salida y resto de
   pantallas/IDs pendientes. Fuera del flujo: SMTP, moderación/bloqueo,
   compatibilidad/migración, consolas/trámites/cobros y entrega autorizada.

FINO-47/49, pruebas físicas y auditoría integral continúan abiertos. No se
garantiza ausencia total de problemas ni cumplimiento jurídico completo.

## Continuación punto 2 — 11/10/2026, 06:18:56 Lima

El vídeo NUEVO del 10/10, 1909 fotogramas, está registrado en BITACORA_AVANCE;
no confundirlo con los 1870 anteriores ni volver a copiar su evidencia.
Se preparan tres correcciones adicionales, sin rediseñar ni entregar:

1. `irUnaVez` informa si descartó el viaje; Bienvenida libera su bloqueo si no
   cambió de pantalla. Conserva los 1500 ms, doble toque, otros destinos y
   callbacks antiguos void. Una excepción libera el botón sin ocultarse.
2. `entryOperation` invalida la continuación cuando la ruta pierde enfoque o
   se desmonta, no por el estado inactive de Android al abrir Google. Login,
   Registro y Bienvenida pasan la comprobación hasta sus callbacks de ruta.
   Tras SDK/perfil/correo/apertura/nube se vuelve a comprobar ruta y sesión.
   Un finally antiguo no desbloquea una petición nueva; errores antiguos no
   aparecen sobre otra ruta. NO cancela llamadas SDK ya enviadas, escrituras
   ya iniciadas ni todos los eventos globales de Auth/AppDataContext.
3. AppLockGate conserva Modal opaco/Back bloqueado y protección nativa.
   Sin fundido al cubrir datos; cuando candado ya fue comprobado pero aún se
   cargan los datos dice cargar, no comprobar candado. Esto no demuestra que
   desapareció todo negro/destello ni cambia FLAG_SECURE/privacidad existentes.

### Evidencia nueva, sin usar datos reales

- `verificar-bienvenida-viaje-descartado-real.mjs`: pantalla/ruta/helper reales,
  JSX/reloj/enfoque adaptados. ed0cb18 falla por bloqueo tras viaje descartado;
  actual verde. No ausencia de API usada como prueba.
- `verificar-acceso-abandonado-real.mjs`: manejadores/callbacks/hook originales,
  IO/foco adaptados. SDK atrasado, perfil/correo, apertura/nube, recuperación de
  contraseña, instancia distinta de misma UID, regreso con nueva petición y
  error viejo. ed0cb18 falla porque continúa Login abandonado; actual verde.
  La protección nueva se inyecta también al baseline: fallo conductual, no
  módulo que no existía. Adaptador inicial tenía dos nombres erróneos, corregidos.
- `verificar-privacidad-candado.mjs` ampliada, conservando casos previos: carga
  diferente del candado, pantalla cubierta, sin fundido y retiro solo cuando
  corresponde. ed0cb18 falla fade/none; actual verde.
- TypeScript y ESLint generales exit0. App final: **196 pruebas y 8 auditores**,
  tarjetas excluidas, exit0 (.tmp/auditoria-punto2-app-final-20261011.log).
  Incluye UNA prueba preexistente del usuario no versionada: 195 previstas en
  Git limpio, sin ejecutar otro checkout. Primera batería tuvo una fallida por
  nombre del adaptador; se conserva en .tmp/auditoria-punto2-app-20261011.log.
  La suite abandonada se amplió después y volvió a pasar individualmente.
- Auth SDK de la app, Node **22.23.3**, SOLO emulador Auth demo-fino-node22 en
  127.0.0.1:9099: **5/5** (cuatro casos y padre), cero fallos/cancelados/omitidos.
  Crear/verificar/reentrar Hotmail y Outlook, reset y Google con credencial
  simulada. .tmp/auditoria-punto2-auth-aislado-20261011.log. Adaptadores de rutas
  enfocadas actualizados, sin eliminar aserciones. No email/Google nativo reales.
  Primer CLI bloqueado por lectura de config externa; repetición con directorio
  de configuración aislado, sin usar sesión real, aprobada. NO repetir como
  nuevas las 229 comprobaciones integrales históricas del punto 1.

### Bloqueos y siguiente paso

El propietario confirma que es EXACTAMENTE la misma cuenta Google y el aviso
la rechaza. El motivo concreto no se identificó; la prueba de legado sintético
no demuestra que su instalación cumple esos mismos datos/versión/identidad.
No borrar instalación, claves, datos, propietario ni adjudicar por aproximación.
Emulator-5554 detectado, paquete com.finoapp.gastos 1.0.8/code10 y último APK
02/10/2026; la fecha APK no prueba versión JavaScript si recibe OTA/Metro.
Computer Use no obtuvo captura/entrada: permiso de app caducó. No automatizar
selector de Google ni acceder a credenciales; esa elección es del propietario.
Sin compilación/instalación/OTA/despliegue. Lo físico sigue sin acreditarse.
**Qué sigue/falta:** identificar dueño/versión en el emulador sin exponer ni
borrar datos, repetir acceso y restantes recorridos Android (2); servicios,
consolas/Billing/legal/publicación (3) después. Tarjetas excluidas, Telegram
en pausa, Sentry externo fuera, diseño diferido. Auditoría integral NO terminada.

Referencias técnicas primarias consultadas: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/),
[correo y contraseña](https://firebase.google.com/docs/auth/web/password-auth),
[usuarios y verificación](https://firebase.google.com/docs/auth/web/manage-users) y
[Auth local y credenciales simuladas](https://firebase.google.com/docs/emulator-suite/connect_auth).

### 11/10/2026 — 10:24:27 Lima — motivo del aviso, NO acceso resuelto

Confirmado en código: reason=owner agrupaba correos distintos, perfil antiguo
sin correo, datos sin perfil terminado y sesión cambiada durante la lectura.
Todos anunciaban «datos de otra cuenta», incluso cuando esa afirmación no estaba
demostrada. No significa que se identificó la causa del rechazo del propietario.

Preparado: detalle efímero unidentified/session en LocalAccountVaultError y
messageKey común para apertura/arranque. Correo diferente conserva el aviso
anterior; dueño no identificado pide conservar instalación y contactar soporte;
sesión cambiada pide volver a entrar. Traducciones es/en/pt, sin PII ni diagnósticos
persistidos/enviados. NO altera adjudicación, correo verificado, UID/instancia,
cifrado, copia, limpieza o protección. Ningún dato nuevo recogido/permiso/SDK.

Suites existentes ampliadas, no copia del algoritmo: bóveda/almacén/AES-HMAC
originales rechazan tres casos y conservan exactamente sus bytes y dueño ausente.
El manejador original muestra el motivo correspondiente. Regresión de rutas
contra a982dc3 roja por mensaje ownerMismatch en vez de ownerUnidentified;
actual verde. Se conserva primero la regresión antigua 19e5dde sobre verificación,
para no sustituirla por un fallo de API ausente. Final 10:26:12: TypeScript y ESLint
generales exit0; app **196 pruebas/8 auditores** sin tarjetas, exit0 en
.tmp/auditoria-punto2-motivo-20261011.log. Incluye una prueba preexistente ajena
no versionada: 195 previstas Git limpio, no otro checkout ejecutado. No nueva
batería integral SDK/servidor: no presentar los resultados históricos como nuevos.

Emulador original Medium_Phone reabierto con sus datos; primer intento restringido
falló «snapshot operation pending», reapertura normal autorizada funcionó. Sin
borrar bloqueos/snapshot, wipe, cold boot ni instalación. ADB detectó device y
proceso Fino; APK sigue 1.0.8/code10, último cambio 02/10. No identifica JS cargado.
Computer Use: FrameArrived timed out y único reintento window capture timed out.
No se obtuvo imagen ni se automatizó Google/contraseñas. No eludir el fallo de
captura con otra automatización UI. Se pidió al propietario abrir Fino, elegir
su cuenta y enviar captura del aviso; no recibida aún en este registro.

**Qué sigue/falta:** comprobar motivo/versión reales antes de modificar acceso,
recorridos Android del punto 2 y servicios/consolas/publicación del 3. Tarjetas
fuera, Telegram en pausa, Sentry externo excluido, diseño diferido. No nueva
entrega ni causa del rechazo/acceso exitoso acreditados; no publicar separado
del resto de preparación pendiente ni dar la auditoría por completa.
