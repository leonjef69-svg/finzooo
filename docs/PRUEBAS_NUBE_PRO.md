# Nube Pro: comprobación, publicación pendiente y límites

Preparado el 05/10/2026. Todo lo descrito como corregido corresponde al código
local; no se desplegó Firebase, no se usaron cuentas reales y no se publicó app.
Actualización posterior: Node 22, llamadas HTTP y eventos Auth/Firestore se
comprobaron localmente en `PRUEBAS_NODE22_BORRADO_CUENTA.md`; también se corrigió
la limpieza de índices privados durante el borrado de Familia/Caja.

## Qué se protege

- Personal: `users/{uid}` y `users/{uid}/history/*`.
- Negocio: `negocios/{uid}`. Cajas privadas: `cajas/{uid}`.
- Permiso real del servidor: pago registrado, prueba vigente según hora del
  servidor o tester activo con fecha válida. No puede autoconcederse desde la app.
- Gratis puede seguir usando sus datos locales. Pasar a Gratis no borra la nube.
  Las tarjetas de crédito siguen excluidas; no se declara protegida toda su nube.
- Familia/Cajas compartidas mantienen su modelo de dueño y miembros: no se
  impone Pro a cada invitado. Sus reglas de aportes no se modifican aquí.

## Consulta sin descargar la copia

`getCloudAccess` obtiene de Auth el UID, exige correo verificado y selecciona
solo campos de permisos de tres documentos. No envía ni descarga al servidor
los campos financieros, fotos o perfil en esa consulta. La app comparte solo
consultas simultáneas; no guarda una autorización permanente ni acepta una
respuesta después de cambiar a otra cuenta. Cada comprobación sigue consumiendo
invocación y lecturas de metadatos, aunque no descargue la copia financiera.

La prueba de 24 horas puede activarse tras configurar la cuenta localmente.
El servidor crea únicamente metadatos, no una copia financiera vacía, y conserva
la fecha privada en `premiumTrialClaims/{uid}`. Los clientes no pueden modificar
ese registro para reiniciar la prueba. Una concesión pagada sigue siendo un
campo administrativo: no se implementó cobro ni verificación de recibos de Play.

## Eliminar no exige Pro

El flujo existente vuelve a confirmar la identidad y valida espacios compartidos.
Después, `deletePersonalCloudCopy` exige autenticación reciente, pero no Pro:

1. Marca la eliminación y bloquea escrituras, también si la cuenta era tester.
2. Borra el historial Personal en lotes de 200 y la raíz al final.
3. Conserva un marcador privado hasta eliminar la identidad de Auth.
4. El evento reintentable de Auth limpia las copias Personal, Negocio y Cajas
   privadas, la concesión de tester y el registro de prueba de ese UID.

La operación soporta reintento tras una interrupción. No deja leer a Gratis
todo el historial para borrarlo ni borra otra cuenta. El borrado directo de la
raíz desde un SDK se rechaza; una app antigua no dispone de la nueva función.
El evento de Auth comprueba primero que no exista una cuenta activa con el mismo
UID administrativo. Su plataforma es primera generación, con reintento y límite
de 540 segundos; el SDK instalado admite esa declaración, pero falta probar su
ejecución real en Node 22 y un entorno autorizado.

**FINO-02 tiene un avance posterior:** el propietario decidió que un aporte
gastado es consumido. El cierre con saldo cero y la conservación de Personal
se prepararon en `PRUEBAS_APORTES_CONSUMIDOS.md`. La devolución del saldo aún
disponible tras vencer Pro se preparó después en `PRUEBAS_DEVOLUCION_SIN_PRO.md`.
Se conserva solo una confirmación de esa operación, no se abre la copia Personal
a Gratis. El evento Auth limpia también esas confirmaciones privadas por lotes.
No se declara completado el recorrido físico ni publicado ese flujo.
La función Personal no elude los pasos del flujo compartido. Tampoco sustituye la limpieza
existente de Telegram/tarjetas ni declara cubiertas colecciones desconocidas.

## Qué se comprobó y qué no

- TypeScript, ESLint y `node pruebas/correr.mjs`: 127 pruebas y 8 auditores
  en esta carpeta; una prueba preexistente ajena no está registrada en Git.
- Functions: 41 pruebas, con Node 24.18 instalado, no Node 22.
- Nueva prueba local ejecuta los módulos propios de permisos, prueba y borrado,
  las envolturas reales de Functions y el cliente de permisos con SDK sustituidos.
  Cubre identidad, consulta compartida, respuesta antigua, límites de tiempo,
  metadatos, permisos, interrupción/reintento y no reiniciar la prueba. Ejecuta
  también la activación/refresco reales del contexto: una respuesta lenta no
  retira la prueba recién concedida ni modifica otra cuenta después de cambiar
  de sesión. No se montó toda la interfaz de React en un dispositivo.
- El emulador Firestore aprobó 26 comprobaciones y ejecuta reglas reales,
  SDK cliente y Admin con proyectos
  `demo-*`. Comprueba Gratis, Pro, prueba vigente/vencida/futura, testers, primer
  respaldo, consulta con máscara y eliminación por UID. La regresión falla contra
  las reglas anteriores porque admitían la lectura financiera de Gratis.
- No se llamaron Functions desplegadas ni se ejecutó el evento real de Auth.
  Las comprobaciones del cliente de Cajas para proteger ausencias son parciales;
  no sustituyen la revisión de toda su unión ni su recorrido físico.
- En Cajas, una consulta fallida conserva lo local y detiene esa subida. Se vuelve
  a intentar al abrir la pantalla. Un borrado local explícito sí retira su
  contraparte Personal, también en Gratis; una simple ausencia sin consulta
  confirmada no. Los filtros reales están probados. Falta comprobar avisos,
  reconexión y el recorrido completo en Android. El borrado de aportes de Caja
  privada se corrigió posteriormente: ya no llama al servidor compartido.
- La revocación real, los errores de red, cambios de cuenta, eliminación y prueba
  en Android, reglas publicadas y política web continúan pendientes.

## Orden de entrega — no ejecutar sin autorización

1. Comprobar las Functions con Node 22; ensayar en un proyecto de prueba
   autorizado la prueba, metadatos, reautenticación y evento de Auth completo.
2. Planificar la transición de versiones antiguas antes de bloquearlas: al
   publicar estas reglas pierden lectura Gratis y borrado directo de raíz.
   Asegurar un camino de actualización/borrado de cuenta; no asumir que una
   actualización por internet llega a todos los teléfonos.
3. Publicar primero las Functions nuevas/compatibles (`getCloudAccess`,
   `deletePersonalCloudCopy`, `activatePremiumTrial`, `returnPersonalContribution`,
   `finalizeLinkedSpaceDeletion` y `cleanupDeletedCloudAccount`)
   y verificar que respondan. Preparar las reglas compatibles con `syncFormat: 2`
   y una versión de app que use esas funciones. Coordinar la activación: entregar
   solo la app con reglas viejas impediría sus respaldos; publicar solo reglas
   nuevas impediría a las apps antiguas borrarse/restaurar mediante su flujo viejo.
4. Publicar la política de privacidad coherente, probar una cuenta Gratis, Pro,
   tester y prueba vencida, y ejecutar la guía de fusión con dos dispositivos.
5. Solo después decidir el despliegue general y la migración de historial. No
   se ha activado `historyFormat: 2` en ninguna cuenta real desde esta tanda.

**Qué sigue:** Node 22, recorrido completo de FINO-02 y transición coordinada.
**Qué falta:** pruebas físicas/Functions reales,
consolas y publicación autorizada. FINO-04 queda preparado en las rutas indicadas,
no declarado resuelto en producción ni para tarjetas de crédito.
