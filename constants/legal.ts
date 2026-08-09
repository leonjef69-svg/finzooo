// Textos legales de Finzo. Es un borrador redactado en lenguaje simple
// para cumplir con lo que pide Google Play — no reemplaza la revisión de
// un abogado si más adelante la app crece o cambia su forma de ganar dinero.
export const LEGAL_CONTACT_EMAIL = "dinero123xc@gmail.com";
export const LEGAL_LAST_UPDATED = "8 de agosto de 2026";

export const PRIVACY_POLICY = `Última actualización: ${LEGAL_LAST_UPDATED}

Esta Política de Privacidad explica qué información recoge Finzo, para qué la usa y qué derechos tienes sobre ella.

1. Qué información recogemos
- Datos de tu cuenta: tu nombre y tu correo electrónico, cuando te registras. Si eliges una foto de perfil, esa foto.
- Lo que tú anotas: tus movimientos (ingresos y gastos), presupuestos, metas de ahorro y, si usas el Modo Negocio, tus negocios, productos, ventas y movimientos del negocio. Finzo no se conecta a ningún banco ni tarjeta.
- Contactos de envío que tú guardas: los nombres, correos y números de teléfono a los que decidas mandar tus reportes. Los escribes tú; Finzo no lee la agenda de tu celular.
- Fotos que tú eliges: las imágenes que pongas a tus categorías propias, y las fotos de boletas si usas el escáner.
- Lo que dices al micrófono, solo mientras lo tienes apretado, para entender la orden.
- No recogemos tu ubicación ni leemos la agenda de contactos de tu celular.

2. La lectura de notificaciones (registro automático)
Esta es la parte más delicada y por eso va aparte.
- Es OPCIONAL y viene apagada. Solo funciona si tú la enciendes y le das el permiso a Android.
- Android no permite dar acceso a los avisos de una sola aplicación: el permiso es para todos. Por eso Finzo filtra ANTES de guardar nada y solo mira los avisos de Yape.
- De un aviso de Yape se guarda el monto, quién lo envía o recibe, la fecha y la hora, para crear el movimiento.
- Todo eso se queda en TU celular y en la copia de tu propia cuenta. No se envía a ningún otro sitio ni lo vemos nosotros.
- La pantalla de diagnóstico guarda el texto de los últimos avisos para poder explicarte por qué uno no se registró. De los avisos de claves y códigos de verificación NO se guarda el texto.
- Puedes apagarlo cuando quieras desde Ajustes, y borrar ese registro con un botón.

3. Cómo se guarda tu información
- En tu celular, tus datos se guardan cifrados: protegidos con una clave, para que no se puedan leer aunque alguien acceda al almacenamiento del teléfono.
- Si inicias sesión, también se guarda una copia en la nube usando Firebase (un servicio de Google), para que puedas recuperar tu información si cambias de celular. Esa copia solo es visible para tu propia cuenta.

4. Con quién compartimos tu información
- No vendemos ni compartimos tu información con empresas de publicidad.
- Usamos Firebase (Google) únicamente como proveedor técnico para guardar los datos de forma segura, no como un tercero que use tu información con otros fines.
- Si TÚ conectas Google Drive, Dropbox o eliges una carpeta de tu celular, se suben ahí los archivos de reporte que tú pidas, y nada más. Finzo solo puede entrar a su propia carpeta.
- Si TÚ eliges enviar un reporte por correo o WhatsApp, ese archivo va a quien tú indiques, a través de la aplicación que elijas.
- El micrófono usa el servicio de reconocimiento de voz de tu propio celular, que en Android es de Google.

5. Tus derechos
- Puedes revisar y corregir tus datos en cualquier momento dentro de la app.
- Puedes eliminar tu cuenta y todos tus datos (los de tu celular y los de la nube) desde Ajustes → Eliminar cuenta. Esta acción no se puede deshacer.
- También puedes pedir que borremos tu cuenta sin instalar la app, escribiéndonos a ${LEGAL_CONTACT_EMAIL} desde el correo con el que te registraste.
- Puedes escribirnos a ${LEGAL_CONTACT_EMAIL} si tienes dudas sobre tu información.

6. Menores de edad
Finzo no está dirigida específicamente a niños ni recoge intencionalmente información de menores de edad.

7. Cambios a esta política
Si esta política cambia, actualizaremos la fecha al inicio de este documento.`;

export const TERMS_AND_CONDITIONS = `Última actualización: ${LEGAL_LAST_UPDATED}

Al usar Finzo, aceptas estos términos.

1. Qué es Finzo
Finzo es una herramienta personal para organizar tus ingresos, gastos, presupuestos y metas de ahorro. Es un cuaderno digital: no es un banco, no mueve dinero real, no está conectada a cuentas bancarias ni ofrece asesoría financiera o de inversión.

2. Tu responsabilidad
Tú eres responsable de la exactitud de la información que ingresas. Finzo únicamente organiza y calcula en base a lo que tú escribes.

3. Cuentas
Debes dar información verdadera al crear tu cuenta (nombre y correo real) para poder verificarla y para que puedas recuperar tus datos si cambias de celular.

4. Funciones gratuitas y Premium
Finzo ofrece funciones gratuitas y puede ofrecer funciones adicionales de pago (Premium) de forma opcional. Nos reservamos el derecho de modificar qué funciones son gratuitas o de pago, avisando dentro de la app.

5. Sin garantías
Finzo se ofrece "tal cual". Hacemos lo posible para que funcione correctamente y tus datos estén seguros, pero no podemos garantizar que la app esté libre de errores en todo momento.

6. Cambios
Podemos actualizar estos términos con el tiempo. Si sigues usando la app después de un cambio, se entiende que lo aceptas.

7. Contacto
Si tienes preguntas sobre estos términos, escríbenos a ${LEGAL_CONTACT_EMAIL}.`;
