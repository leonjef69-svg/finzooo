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

Referencias técnicas primarias consultadas: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/),
[correo y contraseña](https://firebase.google.com/docs/auth/web/password-auth),
[usuarios y verificación](https://firebase.google.com/docs/auth/web/manage-users) y
[Auth local y credenciales simuladas](https://firebase.google.com/docs/emulator-suite/connect_auth).
