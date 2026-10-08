# FINO-43 — borrados del Modo Negocio

Preparado el 07/10/2026. No publicado. Tarjetas excluidas.

## Qué cambió

- Las acciones locales recuerdan IDs borrados y fechan las ediciones de negocios,
  productos, ventas y movimientos. La fusión nunca recupera un ID borrado y
  descarta los hijos de un negocio eliminado. Una copia vieja no reemplaza una
  edición más reciente. En empate heredado se conserva la fila local.
- Las cuatro listas y `finzo:businessDeleted` se guardan juntas usando el lote
  cifrado existente. Se incorporan capturas de fondo antes de escribir, sin
  recuperar movimientos borrados. No se usan los cuatro guardados individuales
  desde el contexto. Un fallo o cambio de sesión no confirma el lote.
- La copia privada Pro `negocios/{uid}` usa formato 2. Su transacción fusiona
  versiones/marcas y devuelve la copia confirmada al teléfono. No se añaden
  suscripciones permanentes ni consultas por cada venta. Se conserva el límite
  de 800.000 bytes: rechazar un respaldo grande no trunca el teléfono.
- Reglas: un cliente antiguo no puede quitar marcas ni volver al formato 1.
  El dueño sigue pudiendo borrar su copia sin Pro. No se desplegaron reglas.
- La copia cifrada de cierre de sesión usa formato 3 e incluye las marcas.
  Sigue leyendo formatos 1/2 sin borrar movimientos por faltar la clave nueva.

## Evidencia local

- `verificar-borrados-negocio-nube.mjs`: ejecuta el cargador/subida originales
  con solo las entradas/salidas Firebase sustituidas. Falló antes del arreglo
  porque reaparecía una venta; ahora comprueba las cuatro listas, ediciones y
  cambio de sesión, sin llamar a producción.
- `verificar-negocio-local-real.mjs`: ejecuta acciones originales del contexto,
  guardado/cifrado originales y un adaptador sobre SQLite real de Node. Comprueba
  reinicio, rechazo/rollback, respuesta perdida, fondo, cascada y formato inválido.
  No ejecuta el módulo nativo Android; eso sigue pendiente.
- `verificar-cuenta-local.mjs`: A → B → A con marcas y migración de archivos
  anteriores. `business-sync.test.js`: reglas reales en Firestore local,
  marcas de las cuatro listas, dueño/extraño/Gratis y eliminación propia.
- Cierre: 148 pruebas locales y 8 auditores (147 pruebas en Git limpio: hay
  una prueba local ajena sin seguimiento); 129 pruebas del servidor local con
  Auth/Functions/Firestore bajo Node 22 aprobadas. TypeScript y ESLint sin
  errores ni avisos aprobados. Ninguna prueba acredita la consola ni el teléfono.

## Pruebas Android pendientes

1. Cuenta Pro de prueba en dos dispositivos A/B: crear negocio, producto y venta;
   respaldar ambos. En A borrar la venta; en B subir la copia atrasada. Descargar
   y reiniciar ambos: la venta y su ingreso asociado no reaparecen.
2. Repetir para producto, movimiento automático/manual y negocio completo.
   Al borrar el negocio tampoco reaparecen sus hijos.
3. Editar precio/nombre en A; subir copia antigua en B. La última edición sigue
   intacta. Capturar un Yape mientras se guarda: no debe perderse ni revivir uno
   eliminado. La lectura pasiva no promete sincronización instantánea.
4. Sin red, borrar; cerrar/reabrir; volver a red. Cortar respuesta, cambiar de
   cuenta y A → B → A: B nunca recibe el negocio ni las marcas de A.
5. Actualizar instalación anterior y leer la copia local v1/v2. Verificar
   persistencia de datos, captura de fondo y borrado de cuenta sin Pro.
6. Superar tamaño de copia: aviso de respaldo fallido, datos locales intactos.

## Qué sigue y qué falta

Coordinar reglas y versión nueva antes de distribuir; no hacer rollback a una
versión que no lee la copia local v3. Verificar las reglas publicadas con cuenta
de prueba. Los borrados anteriores a esta corrección no tienen marcas y no se
pueden deducir automáticamente; no se purga el respaldo por adivinación.
Las marcas no se podan: una futura limpieza necesita protocolo que impida
resurrecciones. Continúan pendientes escala/costos de FINO-15, pruebas físicas,
restantes IDs, revisión externa de políticas y publicación autorizada.
