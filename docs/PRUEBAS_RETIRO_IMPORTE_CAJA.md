# Cerrar una elección monetaria pendiente — 07/10/2026

## Alcance

Una persona, incluso Gratis, puede tocar «Cerrar elección pendiente». La app
solo cambia la marca local a `retirado` cuando Personal y Caja del teléfono ya
coinciden y la función `retirePrivateBoxMoney` confirma que ambas copias del
servidor coinciden también. Los cuatro originales y la elección siguen en el
archivo cifrado por cuenta. No se mueve dinero ni se elige otro monto.

El servidor conserva una huella SHA-256 por UID/ID en
`moneyReviewRetirements/{uid}/operations/{id}`. La transacción que registra esa
huella lee las mismas fuentes y el escritor anterior consulta la huella en su
propia transacción: una petición retrasada no puede aplicar la elección después
del cierre. La huella permanece hasta borrar la cuenta. Si el escritor ganó
antes, el servicio responde `applied`: el cliente debe recuperar el acuse real
y confirmar esa corrección, no marcar falsamente `retirado`.

Si falta red, las copias aún difieren, cambia una fuente, falla el disco o la
cuenta deja de ser la misma, la elección permanece pendiente. Un acuse remoto
genuino no equivale a guardado local: se reintenta con el mismo ID. El guardado
local agrupa Personal, borrados y Cajas en una operación indivisible. El
respaldo ordinario solo se reanuda tras ese guardado.

## Comprobado en código y pruebas locales

- Unitarias del servidor: sin Pro; formatos de historial 1 y 2; cambio parcial,
  ID reutilizado y cuenta en borrado; reintento idempotente; elección ya aplicada.
- Prueba con el flujo y SQLite de la app: recibo verdadero, originales, montos
  intactos, fallos de red/almacenamiento, sesión/moneda y resultado aplicado.
- Diario local: una copia atrasada no revive `retirado`; no se retira una pareja
  cuyo Personal/Caja local todavía difiere.
- La integración Firebase SDK/HTTP con emuladores se registra en la ejecución
  de `scripts/verificar-servidor.mjs`; no equivale a producción.

## Validación pendiente antes de entrega

1. Publicar **juntos y en orden** la función actualizada que bloquea solicitudes
   viejas y el nuevo endpoint; solo después distribuir la app. No publicar el
   cliente contra una función antigua que ignore la huella.
2. En teléfono con cuenta de prueba y conexión real, crear una elección
   pendiente con copias ya convergidas; cerrar sin Pro; salir y volver; verificar
   que las cifras no cambian y que los cuatro originales siguen consultables.
3. Repetir con copias aún distintas, red cortada, cierre de la app y dos
   dispositivos. Nunca debe desaparecer un pendiente ni reaparecer después del
   cierre. Comprobar también la eliminación de cuenta y de la huella.
4. Revisar reglas realmente publicadas, consola Firebase, política pública y
   Seguridad de los datos en Play Console. El código local no prueba esas
   configuraciones externas.

Tarjetas de crédito fuera del alcance por decisión del propietario.
