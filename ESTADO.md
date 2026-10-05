# Estado actual de Fino

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
