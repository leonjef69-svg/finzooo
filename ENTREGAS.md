# Entregas de Fino

Resumen público. No guarda enlaces privados, credenciales ni datos de firma.

## Versión disponible en Google Play

| Fecha | Versión | Estado |
|---|---|---|
| 23/08/2026 | 1.0.4 | Disponible en la prueba cerrada |

## Próxima versión

| Fecha preparada | Versión | Marca visible | Estado |
|---|---|---|---|
| 23/08/2026 | 1.0.5 | `23ago-09` | Inicio exacto de tres pantallas aprobado |
| 08/09/2026 | 1.0.6 | `08sep-auditoria-pre-play` | Auditoría integral previa a Play Store |
| 09/09/2026 | 1.0.6 | `09sep-telegram-seguro` | Integración segura de Telegram preparada para prueba local |

La versión 1.0.3 contiene el acceso Google con diagnóstico, copia de seguridad,
Modo Negocio, registro automático, voz, rendimiento, calendario, exportación,
modo oscuro carbón y compatibilidad con pantallas modernas.

La versión 1.0.4 añade:

- Bienvenida con identidad de Fino.
- País y moneda detectados, editables y conservados durante el registro.
- Búsqueda entre 250 países o territorios y 154 monedas.
- Perfiles antiguos y copias de Firestore compatibles con la ampliación.
- Permiso de avisos antes del registro.
- Verificación de correo sin carga infinita y aviso de Spam.
- Inicio, reportes y gráficos adaptados para monedas grandes.
- Saludo sin mostrar el correo completo.
- Dictado más natural, preguntas cuando falta el monto y correcciones por voz.
- Métodos de pago reconocidos y guardados desde el dictado.
- La voz del Yape dice «un pago de un sol» sin tocar el registro automático.

La versión 1.0.5 añade:

- Exactamente tres pantallas iniciales, creadas a partir de los tres paneles
  del diseño aprobado, sin aproximaciones visuales.
- Eliminación del recorrido anterior de cinco pantallas.
- Botones reales sobre el diseño para país, moneda, avisos, Google, crear
  cuenta e iniciar sesión.
- País y moneda siguen siendo editables y los avisos solicitan el permiso real
  de Android sin bloquear el acceso si el usuario lo rechaza.

La firma real de Google Play ya está registrada en Firebase y el acceso con
Google fue comprobado en un teléfono.

La versión 1.0.6 añade la auditoría previa a Play Store: operaciones atómicas
en espacios compartidos, borrado completo de cuentas y espacios propios,
reautenticación de Google, reglas estrictas, permisos mínimos y dependencias
compatibles con Expo SDK 54.

También deja preparada la primera integración de Telegram: vínculo Premium por
código temporal, confirmación obligatoria, desconexión desde Fino, intérprete
determinista y ejecución local o mediante una función protegida por secretos.
El bot local añade un menú compacto de Personal, Familia y Cajas, lee los totales
reales de Fino y permite registrar desde una sola línea. Recuerda el último
espacio y método, ofrece corrección y deshacer, y transfiere de Personal a
Familia o Cajas mediante una operación enlazada y confirmada. Los totales se
muestran separados y el texto rápido acepta sus datos en cualquier orden.
El formulario breve y la confirmación de Telegram muestran monto, descripción y
método de pago verticalmente, evitando que textos o cifras largas queden apretados.
Las transferencias de Personal hacia Familia o Cajas se confirman con monto,
origen, saldo posterior y destino en líneas independientes.
El presupuesto no puede borrarse mientras conserve dinero transferido en Familia
o Cajas; Fino pide devolverlo primero para mantener los saldos coherentes.

Calidad comprobada:

- TypeScript aprobado.
- ESLint sin errores.
- Más de 100 pruebas aprobadas.
- 7 auditores aprobados.

## Cómo reconocer la entrega

En **Ajustes → Acerca de**, la versión 1.0.6 muestra `08sep-auditoria-pre-play`.

## Publicación

- Cada AAB aumenta su número interno.
- El AAB firmado se genera únicamente en el equipo autorizado.
- Los testers actualizan desde Google Play sin desinstalar.
- No se comparten dos instalables diferentes al mismo tiempo.

## Próximo paso

Publicar las reglas auditadas, probar Familia/Cajas con dos cuentas y después
generar `Fino-1.0.6.aab` para la prueba cerrada.
