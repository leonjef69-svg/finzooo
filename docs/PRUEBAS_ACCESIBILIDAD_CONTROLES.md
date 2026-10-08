# FINO-50 — controles comunes, parcial

08/10/2026. Código preparado, sin publicación ni recorrido Android/TalkBack.

## Cambios

- `Toggle` exige un nombre en TypeScript; anuncia interruptor, encendido/
  apagado y deshabilitado. Los diez usos actuales reciben su rótulo traducido,
  incluido el nombre del producto. Mantiene tamaño visual; amplía área de
  toque con hitSlop, limitada por el contenedor como en React Native.
- Teclado PIN: cada número y borrar tienen nombre/rol de tecla; huella/cara
  son botón con nombre. No etiqueta el PIN acumulado, no añade registro de
  teclas ni cambia autenticación, cifrado o reintentos.
- Selector de mes: acción traducida, expandido/seleccionado y Cerrar.
- Selector de categoría: Volver/Cerrar identificados y área de toque ampliada.
- Gráfico diario: cada día anuncia su fecha/monto mediante el formateador ya
  utilizado; selección y Mostrar/Ocultar montos tienen rol/estado. Detalle
  usa aviso de cambio discreto. No altera montos ni cuentas.

No se modifica Home/ojos/campana en este paso (comprobados en otros puntos),
tarjetas, Firebase, permisos o datos almacenados. No hace todas las pantallas
accesibles por sí solo. Sigue la revisión de otros botones, agrupaciones,
contraste, tamaños de texto, foco y reducir movimiento; no cerrar FINO-50.

## Comprobaciones automáticas y límites

`node pruebas/verificar-accesibilidad-controles-real.mjs` compila componentes
originales TypeScript/JSX con IO/React Native/árbol sustituidos. Comprueba:

- Nombre/estado/acción del interruptor y rechazo estando deshabilitado.
- PIN: diez números/borrar/biometría, etiquetas y acciones reales de añadir/
  borrar una cifra; no anunciar la cadena acumulada como etiqueta.
- Barras: seleccionar/desmarcar día y alternar montos, acciones y estados.
- Mes/categorías: contratos estáticos de traducción/rol/estado/enlace, NO
  prueba de navegación nativa ni de foco.

Regresiones contra `53fbf38`: `FINO_ACCESSIBILITY_BASELINE=53fbf38`, opcional
`FINO_ACCESSIBILITY_CASE=toggle|pin|daily|contracts`. Cada caso falla por su
problema anterior y el caso completo actual pasa. No se mantiene una copia
de la lógica visual en los tests. TypeScript además exige nombres en todos
los usos actuales. Aun así, un árbol adaptado no reproduce TalkBack, NativeWind
ni accesibilidad nativa, y no demuestra que un área no se solape en teléfono.

## Prueba pendiente en Android

1. Activar TalkBack y recorrer los diez interruptores: nombre y estado
   correcto, doble toque mantiene guardados/planes originales.
2. Probar PIN/huella/cara/borrar y errores sin leer el PIN acumulado.
3. Abrir/cerrar selector de mes, seleccionar otro, volver y comprobar foco.
4. Abrir categoría y creación, Volver/Cerrar sin perder el movimiento.
5. Seleccionar días y alternar montos en Reportes; cantidades reales, foco
   y anuncios sin duplicación, 31 días y desplazamiento horizontal.
6. Repetir en tres idiomas, letra grande, pantalla pequeña y oscuro.

Referencia:
[Accesibilidad de React Native 0.81](https://reactnative.dev/docs/0.81/accessibility).
**Qué sigue:** restantes controles/IDs y aceptación/bloqueo. **Qué falta:**
TalkBack/Android, SMTP, consolas/trámites/cobros y publicación autorizada.
