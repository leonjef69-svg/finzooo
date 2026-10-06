// Textos legales de Fino. Es un borrador redactado en lenguaje simple
// para cumplir con lo que pide Google Play — no reemplaza la revisión de
// un abogado si más adelante la app crece o cambia su forma de ganar dinero.
import { anunciosActivos } from "@/constants/anuncios";
export const LEGAL_CONTACT_EMAIL = "dinero123xc@gmail.com";
export const LEGAL_LAST_UPDATED = "6 de octubre de 2026";

/**
 * LO QUE SE DICE DE LOS ANUNCIOS, Y SOLO CUANDO LOS HAY.
 *
 * Esto no es un detalle de estilo: una política de privacidad tiene que describir lo que la
 * app HACE, no lo que hará algún día. Decir "compartimos con empresas de publicidad" sin tener
 * anuncios asusta para nada; y al revés —tenerlos y seguir diciendo que no— es exactamente el
 * fallo que se acaba de arreglar el 08/08/2026, cuando la política juraba que no se recogían
 * fotos y la app llevaba semanas guardándolas.
 *
 * Atado a `anunciosActivos()`, las dos cosas cambian a la vez y no hay forma de que una se
 * quede atrás. Hay una prueba que lo comprueba en los dos sentidos.
 */
const PARRAFO_ANUNCIOS = anunciosActivos()
  ? `- La versión gratuita muestra anuncios de Google (AdMob). Para elegir qué anuncio enseñarte, Google puede usar datos de tu dispositivo, como un identificador de publicidad. Eso lo gestiona Google, no Fino: nosotros no le mandamos tus movimientos, ni tus montos, ni nada de lo que anotas en la app.
- Puedes limitar esa personalización desde los ajustes de tu propio celular (Ajustes de Android → Google → Anuncios).
- Si contratas Premium, no se muestran anuncios.
- Aparte de eso, no vendemos ni compartimos tu información con empresas de publicidad.`
  : `- No vendemos ni compartimos tu información con empresas de publicidad. Fino no muestra anuncios.`;

export const PRIVACY_POLICY = `Última actualización: ${LEGAL_LAST_UPDATED}

Esta Política de Privacidad explica qué información recoge Fino, para qué la usa y qué derechos tienes sobre ella.

1. Qué información recogemos
- Datos de tu cuenta: tu nombre y tu correo electrónico, cuando te registras. Si eliges una foto de perfil, esa foto.
- Lo que tú anotas: tus movimientos (ingresos y gastos), presupuestos, metas de ahorro y, si usas el Modo Negocio, tus negocios, productos, ventas y movimientos del negocio. Fino no se conecta a ningún banco ni tarjeta.
- Si usas Familia o Cajas compartidas: el nombre con el que participas, los movimientos del espacio y su método de pago. Solo sus miembros autorizados pueden verlos.
- Contactos de envío que tú guardas: los nombres, correos y números de teléfono a los que decidas mandar tus reportes. Los escribes tú; Fino no lee la agenda de tu celular.
- Fotos que tú eliges: las imágenes que pongas a tus categorías propias, y las fotos de boletas si usas el escáner.
- Lo que dices al micrófono, solo mientras lo tienes apretado, para entender la orden.
- Si conectas Telegram, el texto que envías al bot, tu identificador de chat y el movimiento que confirmas.
- Información técnica de errores y rendimiento (como versión de la app, modelo del dispositivo y lugar del fallo) mediante Sentry. Fino configura estos reportes sin tu identidad, solicitudes de red ni datos adicionales de la aplicación.
- No recogemos tu ubicación ni leemos la agenda de contactos de tu celular.

2. La lectura de notificaciones (registro automático)
Esta es la parte más delicada y por eso va aparte.
- Es OPCIONAL y viene apagada. Solo funciona si tú la enciendes y le das el permiso a Android.
- Android no permite dar acceso a los avisos de una sola aplicación: el permiso es para todos. Por eso Fino filtra ANTES de guardar nada y solo mira los avisos de Yape.
- De un aviso de Yape se guarda el monto, quién lo envía o recibe, la fecha y la hora, para crear el movimiento.
- Todo eso se queda en TU celular y en la copia de tu propia cuenta. No se envía a ningún otro sitio ni lo vemos nosotros.
- La pantalla de diagnóstico guarda el texto de los últimos avisos para poder explicarte por qué uno no se registró. De los avisos de claves y códigos de verificación NO se guarda el texto.
- Puedes apagarlo cuando quieras desde Ajustes, y borrar ese registro con un botón.

3. Cómo se guarda tu información
- En tu celular, la información principal de tu cuenta se guarda cifrada. La cola temporal del registro automático se mantiene dentro del almacenamiento privado de Fino protegido por Android y no se incluye en copias de seguridad del sistema.
- Fino guarda cifrado en el celular cuáles avisos ya revisaste, solo para controlar el indicador de la campana. Ese estado no se envía a la nube.
- Al cerrar sesión, se conserva una copia cifrada en ese teléfono, separada por cuenta. Solo se recupera al entrar con la misma cuenta en ese teléfono; otras cuentas no la ven. Los avisos, el PIN y las conexiones de exportación se desactivan. Si pierdes el teléfono o desinstalas Fino, la información que no tenga respaldo en la nube podría perderse.
- El respaldo personal en la nube usando Firebase (un servicio de Google) requiere Pro, incluida una prueba o acceso autorizado. Las copias antiguas se conservan al pasar a Gratis. Tus datos personales solo son visibles para tu cuenta; lo que anotes en Familia o una Caja compartida también es visible para sus miembros.
- El servidor conserva el identificador de tu cuenta y la fecha de uso de la prueba para gestionar Pro y evitar reiniciarla al borrar una copia. Ese registro no contiene movimientos ni fotos y se elimina al completar el borrado de tu cuenta.
- Cuando devuelves un aporte de Familia o Caja a Personal, el servidor conserva una confirmación con tu identificador, el espacio, el importe, la fecha, la descripción y los aportes relacionados. Sirve para evitar duplicados y recuperar una devolución interrumpida, también sin Pro o después de salir del espacio. No es un respaldo completo de Personal. La confirmación privada se elimina al completar el borrado de tu cuenta; el movimiento compartido sigue el tratamiento del espacio. La orden pendiente se guarda cifrada en tu teléfono, separada por cuenta.
- Si deshaces esa devolución, la confirmación conserva una marca y la fecha de anulación para no registrarla otra vez como vigente. Esta información también se elimina al completar el borrado de tu cuenta.
- Las copias de tus Cajas privadas incluyen la fecha de última edición y un marcador técnico de formato para evitar reemplazar cambios recientes por copias antiguas. La copia en la nube sigue requiriendo Pro y solo es visible para tu cuenta.
- Si eliges entre dos nombres distintos de una Caja, guardamos ambos nombres, tu elección, los identificadores, la fecha y si falta confirmarla. Esta copia queda cifrada solo en ese teléfono y separada por cuenta; no se envía a Firebase. Se conserva al cerrar sesión y se retira al eliminar los datos locales de tu cuenta. Se guardan hasta 50 revisiones; al llegar al límite no se borra una anterior para guardar otra.
- La próxima corrección de importes de Caja prepara un archivo local con los cuatro movimientos originales de Personal/Caja (celular y nube), tu elección, moneda, identificadores, fecha y confirmación pendiente. Conserva los datos y notas que esos movimientos ya contengan, cifrados y separados por cuenta en el mismo archivo de Cajas. Sus copias no forman parte del respaldo ordinario de Firebase; confirmar la corrección con Pro enviará los originales y la elección al servidor para comprobarlos. Se conservan al cerrar sesión y se retiran al eliminar los datos locales de tu cuenta. Se limita a 50 revisiones y 400 KB en total, sin borrar anteriores para hacer espacio. El botón de corrección todavía no está habilitado ni esta preparación publicada.
- Al convertir una Caja privada en compartida, conservamos una confirmación privada con los identificadores de origen/destino, nombre, moneda, fecha y huella técnica de la copia y los enlaces a Personal. Evita repetir la conversión si se pierde la respuesta. No guarda otra copia de los montos y se elimina al completar el borrado de tu cuenta. Recuperar esa confirmación propia no exige renovar Pro ni da acceso al historial privado en la nube.
- Para cancelar una conversión pendiente conservamos el identificador del intento, su huella, moneda y fechas, una señal que impide reactivarlo y un contador diario contra intentos excesivos. La barrera y los intentos se conservan hasta completar el borrado de la cuenta; los clones incompletos se limpian sin borrar el origen privado. Cancelar o recuperar un resultado propio no exige renovar Pro.
- Al eliminar la cuenta se comprueban también las conversiones incompletas. La comprobación previa no borra datos; las copias verificadas se cierran y se limpian sus clones e índices durante el borrado. Se mantiene una señal técnica hasta eliminar la identidad de Firebase para impedir reactivaciones atrasadas. Una copia inconsistente o ya publicada no se elimina como si fuera un clon. Este proceso no genera una devolución de dinero ni exige Pro.

4. Con quién compartimos tu información
${PARRAFO_ANUNCIOS}
- Usamos Firebase (Google) para la cuenta y la copia segura, y Sentry para recibir diagnósticos técnicos de fallos.
- Si TÚ conectas Google Drive, Dropbox o eliges una carpeta de tu celular, se suben ahí los archivos de reporte que tú pidas, y nada más. Fino solo puede entrar a su propia carpeta.
- Si TÚ eliges enviar un reporte por correo o WhatsApp, ese archivo va a quien tú indiques, a través de la aplicación que elijas.
- Si TÚ conectas Telegram, Telegram recibe los mensajes que escribes y las confirmaciones que Fino te responde. La conexión es opcional y puedes desconectarla desde Ajustes.
- El micrófono usa el servicio de reconocimiento de voz de tu propio celular, que en Android es de Google.

5. Tus derechos
- Puedes revisar y corregir tus datos en cualquier momento dentro de la app.
- Puedes eliminar tu cuenta y todos tus datos (los de tu celular y los de la nube) desde Ajustes → Eliminar cuenta. Esta acción no se puede deshacer.
- También puedes pedir que borremos tu cuenta sin instalar la app, escribiéndonos a ${LEGAL_CONTACT_EMAIL} desde el correo con el que te registraste.
- Puedes escribirnos a ${LEGAL_CONTACT_EMAIL} si tienes dudas sobre tu información.

6. Menores de edad
Fino no está dirigida específicamente a niños ni recoge intencionalmente información de menores de edad.

7. Cambios a esta política
Si esta política cambia, actualizaremos la fecha al inicio de este documento.`;

export const TERMS_AND_CONDITIONS = `Última actualización: ${LEGAL_LAST_UPDATED}

Al usar Fino, aceptas estos términos.

1. Qué es Fino
Fino es una herramienta personal para organizar tus ingresos, gastos, presupuestos y metas de ahorro. Es un cuaderno digital: no es un banco, no mueve dinero real, no está conectada a cuentas bancarias ni ofrece asesoría financiera o de inversión.

2. Tu responsabilidad
Tú eres responsable de la exactitud de la información que ingresas. Fino únicamente organiza y calcula en base a lo que tú escribes.

3. Cuentas
Debes dar información verdadera al crear tu cuenta (nombre y correo real) para poder verificarla y para que puedas recuperar tus datos si cambias de celular.

4. Funciones gratuitas y Premium
Fino ofrece funciones gratuitas y puede ofrecer funciones adicionales de pago (Premium) de forma opcional. Nos reservamos el derecho de modificar qué funciones son gratuitas o de pago, avisando dentro de la app.

5. Sin garantías
Fino se ofrece "tal cual". Hacemos lo posible para que funcione correctamente y tus datos estén seguros, pero no podemos garantizar que la app esté libre de errores en todo momento.

6. Cambios
Podemos actualizar estos términos con el tiempo. Si sigues usando la app después de un cambio, se entiende que lo aceptas.

7. Contacto
Si tienes preguntas sobre estos términos, escríbenos a ${LEGAL_CONTACT_EMAIL}.`;
