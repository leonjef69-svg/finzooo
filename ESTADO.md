# Estado actual de Fino

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
