# Seguimiento de la auditoría de Claude

Última revisión: 28/09/2026. Este archivo separa tres cosas distintas: código
corregido, pruebas locales aprobadas y acciones que realmente están publicadas.

## Corregido y probado localmente

- CRI-01 a CRI-04: acceso a Familia/Caja, separación entre cuentas, borrado de
  cajas y protección de cuentas sin verificar/cierre de sesión.
- ALT-02 a ALT-05, ALT-07, ALT-09 a ALT-11 y ALT-13: montos, sincronización,
  errores de nube, importación, Cajas, Negocio y Telegram.
- ALT-08: historial Personal separado, compatible con el formato anterior,
  probado con dos clientes y 10.000 movimientos. Aún no está activado fuera
  del emulador.
- MED-01 a MED-17 y MED-21/MED-22: correcciones preparadas en código. La prueba
  Premium ahora se concede una sola vez desde una función del servidor.
- BAJ-02 a BAJ-11 y BAJ-13: corregidos en código. BAJ-01 (traducciones y
  accesibilidad) continúa por tandas; ya se limpiaron Inicio, bienvenida,
  Familia, Cajas, Caja compartida, calendario, Telegram, navegación y selectores
  comunes principales.

## Pendiente por decisión o trabajo externo

- ALT-01 y BAJ-12, tarjetas de crédito: excluidos por indicación del usuario.
- ALT-06: publicar de forma coordinada reglas y Cloud Functions.
- ALT-08: crear la nueva versión, probarla físicamente y migrar cuentas reales
  solo después de confirmar que ya no escriben versiones antiguas.
- ALT-12: rotar la clave de firma desde Google Play Console. Las contraseñas ya
  fueron retiradas del proyecto, pero la rotación no puede hacerse solo en código.
- MED-19, App Check: Firebase JS en React Native exige un proveedor de
  atestación nativo personalizado. Requiere código nativo, consola Firebase y
  un AAB nuevo; no se debe activar la exigencia antes de que la app entregue
  tokens válidos porque bloquearía a todos los usuarios.
- MED-18: el límite de 15 MB ya existe; falta medir en un teléfono de gama baja
  que el procesamiento de PDF no bloquee la interfaz.
- MED-20: la limpieza y menor captura del lector nativo están en código, pero
  requieren un AAB y prueba física para considerarlas terminadas.
- MED-23: ya existen pruebas reales del emulador de reglas y dos clientes. La
  prueba de la campana ya valida comportamiento y la del flujo inicial ejecuta
  las traducciones reales; todavía quedan otras pruebas antiguas por reemplazar
  gradualmente.
- VER-01 y VER-04 a VER-06: verificar consola/producción, correo fuera de la
  app, avisos tras reiniciar y requisitos fiscales de Google Play.
- Pruebas físicas: dos teléfonos/dos cuentas, red intermitente, Drive/Dropbox,
  TalkBack, reinicio de Android e iPhone. Las pruebas automáticas no sustituyen
  estas comprobaciones.

## Siguiente orden

1. Terminar BAJ-01 en pantallas secundarias y comprobar el recorrido con lector
   de pantalla en un dispositivo real.
2. Revisar los pendientes de rendimiento y pruebas reales que aún puedan
   simularse localmente, sin tocar tarjetas de crédito.
3. Preparar una sola versión de prueba con los cambios nativos acumulados.
4. Con autorización previa: publicar servidor/reglas, instalar la versión en
   prueba cerrada y ejecutar la lista manual en dispositivos.
5. Migrar primero una cuenta de prueba y después decidir el despliegue general.
