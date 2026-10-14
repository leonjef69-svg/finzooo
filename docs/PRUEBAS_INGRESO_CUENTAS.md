# Ingreso real correo/Google — 13–14/10/2026

Marca `14oct-ingreso-cuentas`. Cambio de JavaScript servido por Metro 8081,
no APK/AAB/OTA/Play ni cambios de Firebase. No se limpiaron datos ni reinstaló
Fino. Tarjetas fuera de la auditoría; Telegram sigue en pausa.

## Causa y corrección

El intento real por correo autenticaba, pero `prepareLocalAccount` rechazaba
la apertura: `archive-missing`. Una cuenta activa cuya configuración se
abandonó podía tener dueño local, pero ningún perfil ni datos significativos.
Al cambiar a otra cuenta, el código solo archivaba al dueño anterior si había
perfil. Después exigía su archivo, que nunca se había creado. Esto afectaba
al paso compartido por correo y Google, no a las credenciales.

Ahora un dueño activo distinto se archiva también cuando esa cuenta está
vacía. Primero se mantiene la comprobación existente de bloques sin perfil;
si contiene datos significativos, se detiene sin cambiarlos. Para el caso
vacío se genera, cifra, guarda y relee su inventario mediante `saveSnapshot`,
igual que en una cuenta completa. Solo después se archiva el dueño anterior
y se abre la copia propia de la cuenta solicitante. No se inventa un perfil,
se asignan datos ambiguos ni se permite continuar tras un archivo fallido.

Una cuenta ya archivada sin su copia sigue bloqueada: no es evidencia de
que estuviera vacía. Las copias corruptas, formatos desconocidos, sesiones
cambiadas y bloques sin dueño/perfil siguen protegidos.

## Diagnóstico seguro

Las excepciones de lectura tienen códigos cerrados de etapa (dueño, perfil,
manifiesto, formato/bloque de copia, archivo ausente, etc.). Solo desarrollo
los añade al aviso; producción conserva el aviso
sin código. No se incluye UID, correo, nombre, claves de almacenamiento,
historial ni credenciales. No se guarda ni envía un diagnóstico nuevo ni
se deja un registro en consola en la versión final de este cambio.

Durante la comprobación apareció además un aviso SDK Firestore con la petición
financiera completa. No se vuelve a imprimir ni se incorpora a este documento.
`utils/firebase.ts` configura `setLogLevel("silent")` antes de abrir Firestore:
evita estos registros del SDK, no cambia solicitudes, reglas, datos ni rechazos.
Los mensajes propios de Fino y la clasificación del error de respaldo siguen.
La [referencia oficial](https://firebase.google.com/docs/reference/js/firestore#setloglevel)
y el módulo RN instalado confirman ese control. La regresión nueva ejecuta el
logger RN real con contenido ficticio y la configuración original: `919f9c5`
imprime el contenido sintético, la versión actual no, conservando Auth cifrado.
No se cambió configuración remota ni se publicaron reglas para ese rechazo.

## Pruebas

Se ejecutan bóveda, almacén y AES/HMAC originales con IO/Auth sintéticos.
La suite de sesión/restauración pasa de 15 a 18 casos:

- A sin terminar/vacía → B → A, conservando un archivo comprobado de A.
- Fallo al confirmar el archivo vacío: dueño intacto, acceso bloqueado,
  reintento permitido y sin sustitución por B.
- Archivo perdido de una cuenta cerrada: sigue bloqueado, todos los bytes
  originales y restantes archivos conservados.

El primer caso falla contra `919f9c5` con `local-account-read`; no por un API
nuevo ausente. Las pruebas previas siguen comprobando datos financieros sin
perfil, cambios de sesión/UID, interrupciones, mezcla de cuentas y copias.
La apertura del contexto agrega un caso de código preciso solo en desarrollo
y aviso limpio en producción, sin aplicar perfil ni recargar tras un fallo.
Las suites Google siguen verificando una aceptación vigente sin repetirla,
resultado SDK exacto y formulario común; no sustituyen el selector real.

TypeScript y ESLint generales aprobados. Pasada final: 213 pruebas y 8
auditores sin tarjetas, exit 0; incluye una suite local ajena no versionada,
que no se incorpora al commit. Primer pase falló por el registro temporal
console.warn del diagnóstico: se retiró, no se exceptuó el auditor. El
segundo pase dio 212/8 en verde; tras agregar la protección del logger SDK,
se repitió todo y dio 213/8. Regresiones de ingreso y diagnóstico precisos
rojas por comportamiento contra 919f9c5; logger RN también rojo por imprimir
la petición sintética, no por un API ausente.

## Emulador y límites

Medium_Phone, emulator-5554. El menú de desarrollo confirmó conexión a
`http://127.0.0.1:8081`. Se recargó directamente sin borrar almacenamiento.
La prueba humana inicial y la lectura de UI Android confirmaron el aviso de
lectura; una recarga con el diagnóstico mostró `archive-missing`.
Tras la corrección y nueva recarga, el propietario confirmó ingreso con el
mismo correo. La inspección Android encontró Inicio y Ajustes, sin imprimir
campos de credenciales ni importes. El agente no escribió contraseñas ni
operó gestores/selectores de autenticación.

Después el propietario cerró sesión y eligió personalmente su cuenta Google;
confirmó entrada correcta. Una inspección Android posterior encontró Inicio
y Ajustes. Por tanto correo y Google reales ya no están pendientes para este
caso del emulador; esto no equivale a comprobar todas las cuentas/proveedores.

Se envió Fino al fondo para escribir lo pendiente; después se detuvo su proceso
y reabrió el mismo MainActivity. El development client abre su selector, no
la app comercial: se reconectó el servidor reciente 127.0.0.1:8081. Fino volvió
a Inicio sin elegir Google ni escribir credenciales de nuevo. Captura local
generada `.tmp/fino-reentry-check.png`; no incorporada a Git ni usada para
certificar importes. No se borró almacenamiento ni se cerró Auth en esta prueba.

Qué sigue/falta: repetir salida/reingreso y aceptación vigente en más
cuentas; teléfono físico,
otros casos de copia antigua/dos equipos y publicación autorizada. La
auditoría global y los pendientes de servidor no quedan cerrados por este
arreglo ni por las pruebas de código.
