# FINO-32 — permisos de calendario en el momento adecuado

Revisión: 08/10/2026. Preparado en código, no entregado a Android.

## Cambio y alcance

El programador original solicitaba permiso al recibir cualquier lista no vacía.
El contexto lo llama también al recuperar la cuenta/iniciar o cambiar moneda;
no era cierto que siempre fuese después de guardar un recibo.

Ahora reprogramar sin opciones nunca abre la petición de Android. Guardar desde
el formulario registra una intención, consumida una sola vez por el efecto de
pagos; recuperar pagos desde disco/nube no la registra. Activar el interruptor
y Probar aviso son acciones explícitas que sí pueden pedir permiso. Negarlo no
impide guardar el pago ni dispara otro diálogo al siguiente arranque. Cuando
Android informa canAskAgain=false no se insiste por código.

El canal se prepara antes del diálogo de Android 13. Apagar/quitar pagos limpia
solo avisos marcados como calendario, sin solicitar permisos ni borrar los de
exportación. Se conserva la fila de reprogramaciones, moneda/fecha y tres meses.
El interruptor espera saveJSONNow antes de reprogramar: saveJSON agrupaba la
escritura y el programador podía leer el valor antiguo. Doble toque no duplica
la escritura; fallos conservan el interruptor y muestran el aviso de guardado.

No se cambian datos financieros, Firebase, planes ni tarjetas. Se reinicia la
intención local al limpiar la cuenta. No añade código/permisos nativos.

## Pruebas y límites

`node pruebas/verificar-permiso-calendario-real.mjs` ejecuta funciones originales
del programador, Guardar/reprogramar y efecto original del contexto, y manejador
original del interruptor con IO sustituido. No copia la lógica ni monta React.
Regresión: `FINO_TEST_PAYMENT_PERMISSION_BASELINE=450f29d` falla porque solicita
permiso durante una carga automática. Versión preparada en verde.

Cubre carga/repetición sin diálogo, concesión/negación/no volver a preguntar,
canal antes de pedir, apagado/vacío, retiro propio conservando exportación,
error/reintento, prueba explícita, consumo único de intención, guardado del
interruptor antes de reprogramar, doble toque y fallo/excepción de escritura.
Las pruebas existentes ejecutan calendario/moneda/prueba con sus adaptadores.
Los límites de Android, canales silenciados y entrega real no se prueban en Node.

## Android pendiente

1. Instalación con permiso no concedido y pagos existentes: iniciar, volver,
   sincronizar y cambiar moneda no muestran el diálogo.
2. Guardar un nuevo pago: pedir permiso contextual; concederlo programa sus
   avisos con moneda/fecha. Negarlo conserva el pago; reiniciar no insiste.
3. Activar/Probar con permiso denegado: comportamiento canAskAgain de Android;
   si está bloqueado, configuración del sistema disponible, no diálogo fingido.
4. Apagar/encender rápidamente: el último toque aceptado corresponde al guardado;
   se retiran solo avisos propios, exportación sigue programada. Disco lleno:
   aviso comprensible y sin mostrar éxito falso.
5. Cuenta de prueba, cerrar sesión/cambiar cuenta, restaurar y Android 13+ con
   canales nuevos/antiguos; verificar sonido/entrega reales, no solo contador.

Referencia SDK 54 contrastada antes de cambiar código:
[Expo Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).
No hubo APK/AAB/OTA/despliegue. **Qué sigue:** restantes IDs. **Qué falta:**
Android, consolas/firma/trámites y entrega acumulada. Tarjetas y comprobación
externa de Sentry excluidas; la auditoría integral no está terminada.
