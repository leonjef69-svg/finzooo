# Acceso unificado — 13/10/2026

Marca `13oct-acceso-unificado`. Preparación de desarrollo, no APK/OTA/Play.

## Interfaz y rutas

Una pantalla real `app/login.tsx`, con modos Iniciar sesión / Crear cuenta.
Bienvenida abre `/login` o `/login?mode=register`. El enlace histórico
`app/register.tsx` es un alias puro a Login; se reconoce su pathname y abre
el modo registro. Se retiró `screens/Register.tsx` después de trasladar su
registro por correo al manejador `registerSubmit` del formulario común.
No quedan dos formularios montados/ocultos ni otra pantalla encima.

El cambio de modo es local: no navega, conserva correo/contraseña/nombre en
memoria de esa pantalla y limpia errores/aceptación/petición Google pendiente.
Correo y contraseña tienen claves estables; solo Nombre y Términos aparecen
en registro. Encabezado y botón se adaptan. Recuperación sigue dentro del
mismo formulario; no se añadió una ruta. No se guardan credenciales en disco.

Transición de posición/altura 180 ms, entrada 160 y salida 120, con Reanimated
ya instalado; respeta ReduceMotion.System. Sin rebotes, retardos ni animación
continua. Fondo/ Nunito Sans / iconos junto al título conservados. Superficie
común desplazable, zonas seguras y ancho máximo 460. No se centra verticalmente
todo el formulario al alternar, para mantener arriba el selector y encabezado.

## Cuenta, consentimiento y reintentos

Un bloqueo inmediato compartido impide alternar o enviar otra operación durante
correo, Google o recuperación, incluso antes del próximo dibujado. Una cuenta
parcialmente creada conserva su referencia, campos de identidad bloqueados y
botón Terminar cuenta; no se pierde al alternar ni se repite el alta.
Las protecciones de abandono, UID/instancia de sesión y errores locales siguen.

Google usa un manejador para ambos modos: primero elige la cuenta, comprueba
su recibo legal y no vuelve a fechar uno vigente. Si falta, ofrece una sola
casilla y continúa la misma cuenta sin abrir Google otra vez. Fallos de
lectura/guardado no abren datos. El recibo del registro por correo también
debe guardarse: si falla, el reintento termina la cuenta creada, no crea otra.
No cambia documentos/versiones legales ni la declaración de datos recogidos.

## Flujo

- Correo nuevo: Bienvenida → formulario en registro → Verificar correo →
  Configuración → Inicio. No abre una copia antes de verificar.
- Cuenta existente: formulario en ingreso → copia propia → Inicio; solo un
  correo pendiente pasa por Verificar, y una cuenta sin configuración la retoma.
- Google: Bienvenida o formulario → cuenta elegida → aceptación solo si falta →
  Inicio si recupera su configuración, o Configuración si es nueva.
- Configuración mantiene idioma/moneda en paneles, avisos y presupuesto opcionales.

Al volver de verificar, una cuenta nueva lleva nombre/correo de Auth a
Configuración. No se sustituyen perfiles locales/remotos existentes y se
comprueba la misma instancia de sesión después de leer copia/nube.

## Comprobaciones y límites

TypeScript/ESLint y batería final: 212 pruebas y 8 auditores aprobados, sin
tarjetas; incluye la suite local ajena no versionada, fuera del commit.
La suite nueva ejecuta JSX/manejadores/ruta originales con React/SDK adaptados:
alternancia rápida, campos únicos, correo conservado, recuperación, Google en
ambos modos, recibo único, envío pendiente, registro parcial y verificación
con cambio de sesión/nombre. Regresión roja contra `cafc2ec`: la versión
anterior navega a Registro; la actual agrega campos sin navegar. No falla
por una API nueva ausente. Suites previas migradas al manejador único real,
sin conservar pruebas de una pantalla retirada ni repetir Google ficticiamente.

El primer paso de desarrollo mostró caché antigua tras retirar el archivo:
el servidor confirmado de C:/finzo/Node22/8081 se renovó con --clear; no se
limpiaron datos, reinstaló la app ni se modificó Android/Firebase.
QA final Android normal 1080x2400/densidad420: Bienvenida abre directamente
el modo crear del formulario común; se alternó a ingresar y de vuelta sin
otra pantalla ni avisos rojos. Tres campos en crear y dos en ingreso,
confirmados en árboles Android; botones/encabezado/selector completos.
Capturas: .tmp/fino-unified-new-login.png y .tmp/fino-unified-final-register.png.
No se enviaron formularios, correos ni aceptaciones reales. La reconstrucción
fría del servidor de desarrollo tomó 250 s (3952 módulos); no es una medida
de arranque de una APK ni del tiempo para alternar entre modos. No mide FPS.

Qué sigue/falta: Google/correo reales requieren elección/verificación personal;
el diagnóstico previo de copia local protegida no se da por resuelto ni se
desactiva su barrera. Físico, teclado/letra grande, FPS/TalkBack y publicación
siguen pendientes. No pruebas financieras con datos reales, cambios nativos,
Firebase/Telegram/tarjetas ni APK/AAB/OTA/Play.
