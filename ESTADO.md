# Estado actual de Fino

Actualizado: **10 de septiembre de 2026**.

Este archivo permite retomar el proyecto sin empezar de cero. No contiene
credenciales, correos, UID, huellas completas ni datos privados de testers.

## Qué es Fino

Fino es una aplicación Android de presupuesto personal, gastos e ingresos.
Usa React Native, Expo SDK 54, Expo Router, TypeScript estricto, NativeWind,
Firebase Authentication, Firestore y módulos Android propios.

Paquete Android: `com.finoapp.gastos`.

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

- Disponible en prueba cerrada: **1.0.4**, `versionCode 5`.
- Próxima corrección: **1.0.6**, `versionCode 7`.
- Marca visible de 1.0.6: **10sep-responsive-android-ios**.
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

- Publicar las reglas de Firestore auditadas y probar Familia/Cajas con dos cuentas.
- Generar y subir el AAB 1.0.6 a la misma prueba cerrada.
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

Después de publicar y probar las reglas auditadas, generar el AAB 1.0.6 con
`generar-aab.bat`, subirlo a prueba cerrada y probar una instalación nueva.
