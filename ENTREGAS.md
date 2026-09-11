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
| 10/09/2026 | 1.0.6 | `10sep-responsive-android-ios` | Correcciones responsive para Android y iPhone listas en código |
| 10/09/2026 | 1.0.6 | `10sep-exportes-por-espacio` | PDF profesional y exportación separada para Personal, Familia y Cajas |

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
El presupuesto no puede borrarse ni reducirse por debajo del dinero que conserva
transferido en Familia o Cajas; Fino pide devolverlo primero para mantener los
saldos coherentes. Inicio descuenta esas transferencias de Personal y las vuelve
a sumar cuando se devuelven. Los miembros invitados no pueden enlazar su saldo
Personal ni borrar movimientos ajenos; el propietario administra los movimientos
comunes y Telegram respeta las mismas restricciones.

La auditoría responsive corrige áreas seguras, scroll, teclado, textos y montos
largos, modales, listas extensas, barra inferior, recorte de imágenes y pantallas
de primera apertura. También deja configurado el identificador de iOS, limita
la primera entrega de Apple a iPhone y evita cargar funciones nativas de Android
en plataformas o entornos que no las incluyen. La revisión automática pasó; la
validación física de cámara, permisos y teclado de iPhone queda pendiente hasta
contar con un iPhone o una compilación generada desde macOS.

Calidad comprobada:

- TypeScript aprobado.
- ESLint sin errores.
- Más de 100 pruebas aprobadas.
- 7 auditores aprobados.

## Cómo reconocer la entrega

En **Ajustes → Acerca de**, la versión 1.0.6 muestra `10sep-responsive-android-ios`.

## Publicación

- Cada AAB aumenta su número interno.
- El AAB firmado se genera únicamente en el equipo autorizado.
- Los testers actualizan desde Google Play sin desinstalar.
- No se comparten dos instalables diferentes al mismo tiempo.

## Próximo paso

Probar Familia/Cajas con dos cuentas, generar la siguiente actualización Android
y, cuando haya acceso a macOS/Apple Developer, crear y probar la compilación iOS.
