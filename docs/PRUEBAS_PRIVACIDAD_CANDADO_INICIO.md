# FINO-22/23 y refuerzo FINO-41 — privacidad preparada

07/10/2026. Código preparado, NO instalado ni publicado. Tarjetas de crédito
quedan fuera: sus dos paneles propios no se cambiaron ni se dan por verificados.

## Qué cambia

- Android protege la ventana principal con FLAG_SECURE desde onCreate, mientras
  todavía se desconoce el candado. La lectura confirmada de SecureStore permite
  capturas solo cuando el candado está apagado. Encendido o lectura fallida
  conservan la protección, incluso con sesión desbloqueada o margen de regreso.
- El puente confirma el cambio en el hilo de la pantalla. Un fallo mantiene la
  cubierta y ofrece reintentar; una lectura cancelada no manda otra configuración.
  El módulo es opcional para no romper APK anteriores: «unsupported» no equivale
  a protegido. ESTE arreglo necesita una instalación nativa nueva, no OTA.
- Campana, selector de mes, confirmaciones y hojas de Familia/Caja no conservan
  su ventana por encima del candado. Se recrean al desbloquear. React Native
  0.81 copia FLAG_SECURE al crear el diálogo, no al actualizar uno que ya existe;
  por eso también se recrea el modal del PIN tras confirmar la protección.
- El ojo de Inicio usa un formato privado compartido: disponible, presupuesto,
  saldo anterior, ingresos/gastos, filas (también movimientos del calendario),
  aportes/devoluciones/consumidos y avisos. Oculta también la barra de progreso.
  Tiene etiqueta y estado accesibles en español/inglés/portugués. No cambia
  importes guardados, exportaciones ni privacidad de otras pantallas. Editar
  expresamente un presupuesto abre su importe real; no es modo de anonimato
  de descripciones, fechas, nombres o categorías, ni protección contra cámaras.
- No agrega permisos, recogida de capturas, envío de datos, servicios de nube
  o claves persistentes. La única decisión persistente sigue siendo el candado
  existente en SecureStore. Capturas de una APK antigua no se borran.

## Evidencia local y límites

- `verificar-privacidad-candado.mjs`: puente y efectos originales del Gate,
  espera de confirmación, errores, lectura cancelada, cambio de configuración,
  recreación del PIN y PrivateModal original. IO/hooks adaptados, NO React
  ejecutándose en Android. Regresión contra `6672b08` falla; actual pasa.
- `verificar-privacidad-inicio.mjs`: extrae/ejecuta formato y fila originales,
  incluyendo SpaceTransferAmounts original. Ocultar/mostrar conserva fecha,
  hora/descripción y recupera importes, y se verifica conexión de barra/etiqueta.
  JSX adaptado, NO medida de distribución visual/TalkBack. Rojo contra
  `6672b08`; verde actual.
- `node scripts/probar-receptores-kotlin.mjs --screen-privacy`: compila/ejecuta
  ScreenPrivacy y Package ORIGINALES en JVM con Window/Activity observables.
  Arranque/pausa/regreso/recreación, estado apagado, otras banderas, confirmación
  no aplicada y errores. No es un servicio Android ni una captura real.
- Gradle offline aprobó `:screen-privacy:compileDebugKotlin`,
  `:app:compileDebugKotlin` y `:app:processDebugMainManifest`. La lista generada
  de Expo incluye Package y Module. Se repitió sin reutilizar el daemon
  restringido tras AccessDenied del SDK. Hay avisos de deprecación de librerías,
  no se declara release comprobado. No se genera APK/AAB ni se usa EAS.
- Protección soportada por Android, no garantía contra root, cámaras externas,
  ventanas del reconocedor de voz/selector de otra aplicación ni todos los OEM.
  Fuente: https://developer.android.com/security/fraud-prevention/activities

## Recorrido pendiente en una instalación nueva

Usar solo cuenta/movimientos ficticios y conservar datos existentes. No borrar
la app para probar: la copia Gratis depende de ese teléfono.

1. Candado apagado: abrir y volver desde recientes; la captura normal funciona.
2. Activar PIN, abrir Inicio, capturar saldo/filas/avisos: Android debe rechazar
   o dejar negro el contenido. Desbloquear NO debe permitir capturar esos datos.
3. Salir y volver antes/después de los dos minutos, matar/reabrir el proceso y
   girar/recrear Activity: miniatura sin saldos, margen/PIN/huella conservados.
4. Repetir con campana, mes, confirmación de borrado, hojas de movimientos,
   invitación/miembros, espera de Caja y panel que ya estaba abierto. No poder
   operar por encima del candado. Datos no guardados y estado del formulario
   deben conservarse; se suspende la ventana, no se ejecuta la confirmación.
5. Apagar candado validando PIN: recuperar capturas sin cambiar datos. Simular
   lectura SecureStore fallida solo en entorno de prueba: no abrir el saldo.
6. Ojo de Inicio: ocultar/mostrar todos los importes, desplazar la lista, abrir
   campana y cambiar de mes, comprobar también aportes y movimientos pagados.
   TalkBack debe anunciar acción/estado del ojo, nunca el importe oculto.
7. Probar Android 11/12/14+ y el Honor del propietario; comprobar grabación de
   pantalla, tamaño de letra y temas. Registrar resultado/OEM/versión instalados.

**Qué sigue:** FINO-24 (retención/cifrado del diagnóstico Yape) y demás IDs
marcados para revalidación. **Qué falta:** recorrido físico, release firmado,
entrega nativa acumulada, consolas y otros hallazgos. Sentry/tarjetas excluidos.
