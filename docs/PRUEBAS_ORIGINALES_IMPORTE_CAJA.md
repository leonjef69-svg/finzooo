# Originales de importe de Caja — archivo local preparado (06/10/2026)

**Avance limitado. No hay botón nuevo ni envío monetario desde la app. No
publicar todavía; punto 1 y auditoría abiertos.**

## Qué se prepara

- `revisionesImporte` conserva cuatro registros completos, moneda, UID/IDs,
  fechas, elección explícita y estado pendiente/confirmado. El normalizador,
  validador y fusión de Cajas ya no descartan esa información. Se usa el
  contenedor cifrado y el archivo por cuenta existentes, sin otra clave local.
- Misma validación pura que el servidor, sin importar Firebase Admin ni Node
  a la app. No selecciona dinero automáticamente ni aproxima parejas por monto.
- Guarda copias independientes de las referencias del formulario. NaN/Infinity,
  fechas imposibles, enlaces/metadata distintos y fuentes duplicadas se rechazan
  antes de convertir a JSON. Una revisión por ID no puede cambiar sus originales
  o elección; confirmado no vuelve a pendiente por una copia atrasada.
- Una cuenta por archivo, hasta 50 revisiones/400.000 bytes UTF-8 totales;
  cada revisión hasta 150.000 bytes. Alcanzar el límite rechaza la nueva sin
  eliminar anteriores. Eso no demuestra que todo el historial de Cajas quepa
  en cualquier Android ni autoriza limpiar copias para hacer espacio.
  El límite reserva el tamaño de confirmar las pendientes: no exige borrar
  otra revisión para poder cambiar su marca de confirmación.
- La fusión ordinaria rechaza modificar o borrar la mitad Caja afectada por una
  decisión pendiente; la recuperación heredada no la ajusta automáticamente.
  Subir Cajas tampoco envía una revisión pendiente. Una confirmada conserva
  sus originales localmente, pero se excluye del respaldo ordinario remoto.
  Un documento remoto con estas revisiones locales se rechaza, no se importa.
- `prepararRevisionImporte` y `confirmarRevisionImporteLocal` son auxiliares
  puros: comparan originales, IDs, moneda, cuenta, respuesta exacta, versiones,
  borrados y saldo. El resultado propuesto lleva el mismo importe/fecha/versión
  en ambas mitades y conserva otros registros. **No ejecutan ni confirman el
  guardado financiero.** Personal recibido entre pasos solo puede ser una de
  las copias originales conocidas o el resultado exacto, no una edición nueva.

## Pruebas

`node pruebas/verificar-originales-importe-caja.mjs` ejecuta esos módulos
originales, no una copia de su lógica. Cubre cuatro elecciones, metadata/fotos,
versiones, reintento sin nuevos IDs, duplicados, cierre/borrado/consumido,
respuesta/UID/moneda inválidos, gasto superior al aporte elegido, 0/2/3 decimales,
límite por cantidad y bytes UTF-8 (emojis y frontera exacta), conservación de
referencias y rechazo de una fusión/subida ordinaria incompatible.

Para el archivo por cuenta ejecuta también cifrado, almacenamiento y bóveda
originales con sustitutos de AsyncStorage, SecureStore y Crypto de Android:
guardar/leer cifrado, fallo de disco, salida rechazada hasta un reintento
confirmado, A → salir → B → salir → A y eliminación de la copia B sin tocar A.
**No es Android físico, ni prueba de muerte de proceso en el teléfono, ni prueba
de pantalla, ni envío/confirmación real del cliente monetario.**

Regresión:

```powershell
$env:FINO_TEST_MONEY_LOCAL_BASELINE='b48e703'
node pruebas/verificar-originales-importe-caja.mjs
```

Falla como se esperaba en la primera aserción: el normalizador anterior elimina
el campo de revisiones. Es un caso sintético del nuevo archivo, no una afirmación
de pérdida observada en cuentas publicadas. No modifica el checkout. Quitar la
variable para la prueba normal y `node pruebas/correr.mjs` completo.

Los lectores VM de pruebas existentes ahora cargan la escala/validación común
y UTF-8 originales; la prueba directa de Cajas empaqueta su módulo como la app.
No se quitaron ni debilitaron sus aserciones.

## Qué sigue y qué falta

1. Conectar una selección visible con fuentes frescas comprobadas y guardado de
   los originales/elección antes de la red. Todavía no se crea esta revisión
   desde la pantalla ni se llama al servicio preparado en la tanda anterior.
2. Bloquear/coordinar también el respaldo y recepción de Personal, las subidas
   en vuelo, otras pantallas y acciones incompatibles. La barrera de Cajas sola
   **no basta**; no activar el botón hasta completar ese contrato.
3. Guardar el resultado financiero y la confirmación local con el lote Android
   real, proteger sesión/Pro/fuentes y recuperar tras respuesta perdida, reinicio,
   falta de disco, plan vencido y decisiones obsoletas. El plan puro no sustituye
   esas comprobaciones ni da atomicidad servidor/celular.
4. Android/visual/dos dispositivos, tamaño/rendimiento reales, consolas/índices,
   restantes conflictos y publicación coordinada autorizada. No volver a una
   app antigua que elimine estas revisiones al normalizar sin comprobar que se
   preservan. Tarjetas, código nativo y CODE_MARKER no se modifican.

## Resultado

- TypeScript y ESLint: aprobados tras los cambios finales.
- Suite local completa: 141 pruebas y 8 auditores aprobados; una prueba ajena
  preexistente sigue sin registrar en Git, de modo que hay 140 en copia limpia.
- 73 unitarias de Functions y 110 SDK/reglas/HTTP/eventos con Node 22 real:
  aprobados, sin omisiones ni cancelaciones. Se repitió la suite completa, no
  solo la nueva preparación. No se desplegó ni consultó producción.
- Regresión b48e703: falla como se esperaba por `revisionesImporte` ausente
  tras normalizar. Prueba actual aprueba, incluyendo fronteras de bytes y
  reserva de espacio de confirmación.
- Las primeras pasadas detectaron lectores de pruebas que no resolvían los
  nuevos módulos puros/UTF-8 y una extensión de import no admitida por el
  compilador. Se corrigieron resolución y código, sin retirar aserciones.
  La inyección de fallo usa la operación real del sustituto y comprueba tanto
  el cierre rechazado como el reintento antes de archivar.
- ADB no encontró dispositivos; Android físico/emulador/visual/tamaño siguen
  pendientes. No hubo nuevo botón, petición financiera de pantalla, guardado
  de resultados monetarios habilitado, instalable, OTA ni cambio nativo.
