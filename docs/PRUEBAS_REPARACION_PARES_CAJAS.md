# Recuperación de pares Personal/Caja — 06/10/2026

Preparado en código, sin publicar la app ni Firebase. Tarjetas y código nativo
no se modificaron. No declara terminada la auditoría de 61 hallazgos.

## Fallas comprobadas

- La recuperación antigua imponía el monto de Caja sobre una contraparte de
  Personal distinta, incluso sin una elección del usuario.
- Enlazaba registros sin ID cruzado por monto y fecha; un ingreso externo del
  mismo día podía confundirse con una transferencia.
- Recuperar el vínculo de Caja y escribir Personal eran guardados separados.
- Un marcador de borrado antiguo podía retirar Personal por inferencia. Ahora
  se conserva para revisión: no devuelve dinero ni elimina un aporte consumido.

## Qué cambia

- Planificación de solo lectura con IDs comprobados, control de duplicados,
  dirección, Caja, monto, fecha, borrados, cierre y reparto de devoluciones.
- Recupera el ID ausente cuando la otra mitad ya identifica inequívocamente
  ese movimiento, o reconstruye Personal desde un ID de Caja conocido, sin
  marca de borrado ni choque con un registro existente.
- Conserva notas, categoría, imagen, etiquetas, hora y demás campos de un
  movimiento existente. No lo reemplaza por una plantilla vacía.
- Guarda ambas mitades y marcas juntas mediante el contrato SQLite Android
  existente. La validación se recalcula desde los datos vivos dentro del
  guardado; rechaza una pantalla atrasada o un cambio de cuenta.
- Una diferencia de monto/fecha con IDs exactos muestra ambos valores y ofrece
  elegir Personal o Caja. Solo corrige registros, no mueve dinero bancario.
  Cancelar no modifica nada. Una elección que dejaría saldo negativo se rechaza.
- No ofrece esa elección parcial si hay devoluciones posteriores: requiere
  revisar su reparto completo. Datos sin prueba, duplicados, ID ajeno, borrados
  o aportes ya consumidos se conservan sin escoger un ganador.
- Mientras haya recuperación o revisión pendiente, se bloquean nuevas
  operaciones privadas y su subida automática. Se puede consultar la lista.
  Cancelar una conversión pendiente mantiene su recorrido independiente.
- Se espera también a que Personal termine de cargar. Un fallo no genera un
  bucle de reintentos: se permite volver a comprobar con Actualizar.
- Pro comprueba primero el servidor para los IDs afectados y los aportes de
  sus devoluciones. Formato 1: documento de Personal; formato 2: lecturas directas
  de esos IDs, de 20 en 20. Sin caché ni descarga del historial completo. Una
  edición o borrado remoto todavía no recibido impide la reparación. Gratis
  no realiza esta consulta ni obtiene acceso a la nube.
- Confirmaciones de conversión se remapean por UID/enlace exactos mediante el
  mismo guardado, conservando montos y lo consumido.
- No añade claves locales, metadata persistida, categorías de datos, servicios,
  permisos ni retención. La elección se aplica a los mismos registros cifrados.

## Pruebas

`node pruebas/verificar-reparacion-pares-cajas.mjs` ejecuta el plan y la
validación originales, el aviso/acciones originales, el contexto original y
el almacén original sobre SQLite real. Sustituye Auth, React, cifrado nativo y
adaptador Android; no es una prueba física de Android ni del cifrado.

Comprueba diferencias, IDs duplicados/ajenos, coincidencias débiles, campo
ausente, marcas de borrado, consumo, reparto, conservación de campos,
cancelación, elección de ambos lados, aviso antiguo/cuenta/plan, rollback,
respuesta perdida, cambio de sesión y edición/borrado remoto.

La regresión carga el efecto original desde Git, sin sustituir archivos:

```powershell
$env:FINO_TEST_PAIR_BASELINE='0f0588f'
node pruebas/verificar-reparacion-pares-cajas.mjs
```

Debe fallar porque Caja S/100 reemplaza automáticamente Personal S/80.
La ejecución normal del código nuevo debe pasar. La variable se usa solo
en ese proceso de PowerShell de regresión; no dejarla activa para la suite.

`functions/integration-tests/private-boxes.test.js` usa SDK y reglas reales
en emuladores locales: Personal confirmado, diferencias, conexión perdida,
historial separado y marcas remotas. No toca Firebase de producción.

Las pruebas anteriores que extraían el efecto/filtro retirado ahora siguen
el recorrido nuevo. Se conservan las comprobaciones de dinero consumido y
se refuerza la conservación ante marcadores heredados; no se omiten casos.

## Qué sigue y qué falta

- **Sigue:** casos heredados no demostrables y resolución de diferencias entre
  copias locales/remotas, sin elegir automáticamente un ganador financiero.
- **Falta:** Android con cierre forzado, reinicio, espacio lleno, datos grandes,
  dos cuentas/dispositivos y revisión visual/accesibilidad del aviso.
- Una consulta previa no es una transacción global con Firebase: otro teléfono
  puede escribir después. No se promete atomicidad entre servidor y celular,
  ni resolver gastos simultáneos offline en esta tanda.
- No se resuelven por aproximación ID desconocido, mitad desaparecida,
  devolución con reparto distinto o aporte cerrado. El usuario no debe
  desinstalar ni borrar la copia para salir del bloqueo.
- Los conflictos de Caja con iguales versiones en dos dispositivos mantienen
  su protección anterior; este aviso no autoriza sobrescribirlos.
- iOS/web mantienen bloqueadas las operaciones enlazadas hasta comprobar un
  contrato de guardado equivalente. No se cambió ese acuerdo.
- **Publicación pendiente:** pruebas físicas, consolas, políticas/declaraciones
  reales y entrega coordinada del conjunto de app, reglas y funciones ya
  preparado. Git no actualiza la app instalada ni publica Firebase.

Resultados de esta tanda: TypeScript y ESLint aprobados, 137 pruebas locales
y 8 auditores (una prueba ajena sin registrar, 136 en copia limpia), 63
unitarias Functions y 91 pruebas de SDK/reglas/HTTP/eventos con Node 22 real.
Sin fallos, canceladas ni omitidas en la ejecución final. La primera pasada
local señaló extractores/expectativas del efecto retirado y una clave de texto
inexistente; se corrigieron y la repetición completa aprobó, sin quitar casos.
La regresión anterior falla como se espera. Emuladores apagados al terminar;
no se consultaron ni modificaron cuentas reales.
