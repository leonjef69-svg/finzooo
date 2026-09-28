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
- BAJ-01 a BAJ-11 y BAJ-13: corregidos en código. Un auditor automático revisa
  texto JSX, placeholders, etiquetas accesibles, alertas y mensajes breves en
  Inicio, bienvenida, Familia, Cajas, Caja compartida, calendario, Telegram,
  navegación y pantallas secundarias. Falta la comprobación física con TalkBack.

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
  las traducciones reales. Las pruebas de importación rápida y presupuesto
  exacto también ejecutan ya la lógica real; todavía quedan otras pruebas
  antiguas por reemplazar gradualmente.
- VER-01 y VER-04 a VER-06: verificar consola/producción, correo fuera de la
  app, avisos tras reiniciar y requisitos fiscales de Google Play.
- Pruebas físicas: dos teléfonos/dos cuentas, red intermitente, Drive/Dropbox,
  TalkBack, reinicio de Android e iPhone. Las pruebas automáticas no sustituyen
  estas comprobaciones.

## Siguiente orden

1. Sustituir más pruebas antiguas de texto por pruebas de comportamiento.
2. Revisar los pendientes de rendimiento y pruebas reales que aún puedan
   simularse localmente, sin tocar tarjetas de crédito.
3. Preparar una sola versión de prueba con los cambios nativos acumulados.
4. Con autorización previa: publicar servidor/reglas, instalar la versión en
   prueba cerrada y ejecutar la lista manual en dispositivos.
5. Migrar primero una cuenta de prueba y después decidir el despliegue general.

### Auditoría externa — pruebas reales de importación y presupuesto (28/09/2026)

- La prueba de importación dejó de buscar una frase en el archivo fuente: ahora
  ejecuta el detector y comprueba el límite de 14 días, la exclusión desde el
  día 15 y que una coincidencia no pueda reutilizarse.
- La prueba del presupuesto también ejecuta la función usada por Inicio:
  confirma que 1.359 llega completo al formateador y que un monto oculto no se
  procesa ni se muestra.
- Los métodos de pago ahora se filtran mediante una función probada: Yape solo
  aparece en Perú/Bolivia, Plin solo en Perú, los métodos universales siguen en
  todos los países y una edición conserva métodos antiguos.
- La importación ya no recorre todo el historial por cada fila. Construye una
  sola vez un índice por fecha y consulta únicamente la ventana de 14 días; una
  prueba local indexa y busca entre 10.001 movimientos, incluido un cambio de
  mes.
- El catálogo mundial dejó de comprobarse leyendo su código como texto. La
  prueba carga los 250 países y 155 monedas reales, valida símbolos, decimales,
  asignaciones, orden y búsquedas por nombre, código, moneda y símbolo. Cambiar
  moneda conserva el país local y el país continúa fuera del respaldo en nube.
- La categoría de cada fila importada se decide ahora en una función probada:
  lo escrito en el archivo tiene prioridad, los sinónimos reales se reconocen,
  lo aprendido por la persona se conserva y una categoría de ingreso no puede
  entrar en un gasto. La confirmación de borrado mensual permanece vigilada en
  una prueba independiente.
- Una prueba sintética procesa 10.000 filas CSV, comprueba que ninguna se pierda
  ni cambie de tipo y limita el tiempo local a 3 segundos; en esta revisión
  terminó en menos de 100 ms. Esto no reemplaza la medición física de PDF.
- La carga de archivos usa ahora un límite de 15 MB con fronteras probadas. Un
  XLSX real de 10.000 filas se abre, convierte y analiza sin pérdidas; preparar
  el HTML de un PDF con 10.000 movimientos conserva la primera y última fila,
  escapa el texto y queda bajo el límite temporal local. La impresión nativa
  del PDF todavía necesita medirse en un teléfono de gama baja.
- Los avisos del calendario dejaron de comprobarse leyendo el efecto como
  texto. La prueba programa tres meses reales, cambia de PEN a USD, confirma
  que no se dupliquen, omite el mes pagado y cancela únicamente avisos del
  calendario sin retirar el aviso independiente de exportación.
- La misma prueba cubre permiso denegado, error nativo al programar y dos
  reprogramaciones simultáneas. Los fallos conservan su etapa y motivo, y la
  última moneda queda activa con tres avisos, no seis.
- El botón de prueba del calendario también se ejecuta: programa un aviso a
  tres segundos con título, texto, sonido y marca correctos; distingue permiso
  denegado de un error del servicio.
- La recuperación de exportaciones al abrir la app ya conserva el destino real
  (Drive, Dropbox, OneDrive o carpeta), el espacio Personal/Familia/Caja y la
  opción de gráficos. Solo confirma la ejecución después de guardar bien; si
  falla la red, permite reintentar en el próximo arranque sin entrar en bucle
  durante la misma sesión. Un mes sin movimientos termina limpiamente y no
  deja una pantalla invisible abierta.
- TypeScript, ESLint, 117 pruebas y 8 auditores están aprobados para esta
  tanda. No se modificaron tarjetas de crédito ni se publicó ningún cambio.
