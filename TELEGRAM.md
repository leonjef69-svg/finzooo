# Telegram en Fino

La integración no usa inteligencia artificial. Interpreta órdenes explícitas,
muestra un resumen y exige tocar **Confirmar** antes de escribir en Firebase.

## Probar localmente (sin Blaze)

1. Instalar las dependencias dentro de `functions` con `npm install`.
2. Autenticar credenciales de aplicación de Google en esta computadora o definir
   `GOOGLE_APPLICATION_CREDENTIALS` apuntando a una cuenta de servicio local no versionada.
3. Definir `TELEGRAM_BOT_TOKEN` solamente en el entorno de la terminal.
4. Ejecutar `npm run serve:telegram` dentro de `functions` y mantener la terminal abierta.

En Windows, `configurar-local.ps1` pide el token oculto e inicia el bot sin
guardarlo ni copiarlo al proyecto. El token desaparece al cerrar la ventana.

## Producción (requiere Blaze)

Guardar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET` mediante Firebase Secrets,
desplegar `telegramWebhook` y registrar su URL con `setWebhook`, incluyendo el mismo
secret como `secret_token`. Nunca se copia el token al repositorio ni a Expo.

La pantalla de Fino crea un código de seis caracteres válido durante diez minutos
y abre `@dotero2bot` con ese código dentro del enlace. La persona solo pulsa
**Iniciar**; `/vincular CODIGO` queda como alternativa manual. Desconectar desde
Fino invalida la conexión.
