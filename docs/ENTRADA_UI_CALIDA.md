# Entrada cálida — 13/10/2026

## Ajuste posterior: proporciones de Bienvenida

Marca `13oct-bienvenida-equilibrada`: se quitó el centrado vertical solo en
Bienvenida para reducir el hueco bajo Fino. Persona hasta 262 (antes 220), escena
hasta 430 (antes 390), tarjetas hasta 132/145 con límites por ancho e inset lateral
14, nombres 13,5 y montos 13 (antes 11); subtítulo 16/24 (antes 14/21).
No cambia el título ni las acciones, navegación, sesión o datos.
TypeScript/ESLint y batería final: 211 pruebas/8 auditores aprobados, sin
tarjetas; el conteo incluye una suite local ajena no versionada.
Último ajuste visto completo en Android normal. La primera ampliación también
se vio completa en 360×640; el último intento pequeño agotó la conexión con
Metro y NO se cuenta como aprobado. Se restauró el tamaño habitual, se comprobó
HTTP200 del servidor y se renovó adb reverse: Android abrió el ajuste final.
No se borraron datos. Prueba nueva ejecuta JSX original en cinco tamaños y valida
proporciones, márgenes e inclinaciones: verde actual/roja en 3f5d5b4 por el
hueco superior, no por una API ausente. No mide FPS ni certifica todas las marcas.
Qué sigue/falta: última versión visual pequeña, prueba física de letra
grande/transiciones y el recorrido
pendiente de acceso/copia local registrado abajo. Sin APK/OTA/publicación.

Implementación en las rutas reales existentes, no en otro navegador ni en una
capa encima del recorrido anterior. Marca: `13oct-entrada-calida`.

## Qué cambia

- Bienvenida: persona con teléfono, cuatro tarjetas decorativas, frase acordada
  y Crear cuenta / Google / Ya tengo cuenta. Sin icono junto a Fino.
- Registro y acceso: iconos junto al título, campos y botones compactos.
  Recuperar contraseña reutiliza Login, sin una ruta duplicada.
- Configuración: idioma, moneda y avisos; sin Apariencia. Presupuesto opcional.
  Omitirlo termina el perfil en el mismo lote confirmado, sin crear un presupuesto
  cero, borrar meses ni marcar un cambio financiero.
- Idioma y moneda: paneles inferiores en las mismas rutas. Moneda conserva 155
  códigos, búsqueda, banderas, bloqueo de cuenta configurada y la reserva de
  dibujo ya confirmada por el propietario.
- Correo y textos legales: contenido/acciones reales conservados, sin fotos
  de fondo. `country` sigue como alias puro de `language` para enlaces antiguos.
- Nunito Sans local (tres archivos, licencia incluida) y persona WebP de 37 KB.
  No hay peticiones de fuentes en cada apertura ni animaciones decorativas
  continuas. Transiciones del navegador nativo, sin demoras artificiales.
- Superficie común desplazable, zonas seguras y ancho máximo 460. Ilustración
  ajustada al alto; botones cerca de la frase, no separados por margen automático.
- Google en Bienvenida comprueba el recibo de la cuenta elegida antes de pedir
  aceptación. No vuelve a fechar un recibo vigente ni abre datos si falla guardarlo.

## Comprobaciones y límites

TypeScript, ESLint y batería final de 210 pruebas/8 auditores aprobados (tarjetas
excluidas; una suite local ajena no versionada incluida en el conteo, no en este
commit). Suites originales adaptadas al nuevo componente
visual compartido; conservan dobles toques, abandono, errores, copias y moneda.
Regresiones contra `c509dabe`: Bienvenida exige innecesariamente aceptación antes
de elegir Google; configuración rechaza omitir presupuesto. Ambas fallan por
comportamiento en esa revisión y aprueban en las fuentes actuales.

Android: Bienvenida completa en 1080×2400/densidad420 y arranque limpio en
720×1280/densidad320 (360×640 lógicos). Registro y Login se visualizaron; no se
enviaron formularios, correos, aceptaciones ni compras. Restauradas las medidas
originales del emulador. No certifica otras marcas, TalkBack ni todo el recorrido.

La captura parcial durante cambio de densidad EN CALIENTE no fue un resultado
aprobado: al recrearse la vista de desarrollo se perdió contenido y apareció una
advertencia de múltiples manejadores de enlaces. Se cerró solo el proceso de la
app, se cambió el tamaño antes de abrirla y el arranque limpio mostró todo.

Pantalla roja de compilación: había dos servidores del mismo proyecto. Se
reiniciaron esos procesos con un único Metro Node22 en 8081, caché reconstruida
y adb reverse. Android volvió a abrir. Esto acredita recuperación, no determina
la línea exacta de aquel código de prueba que ya no se reprodujo.

Durante la recarga apareció también la protección existente por lectura fallida
de la copia local. NO se anuló ni se borraron datos para ocultarla. Su causa y la
entrada real con esa cuenta siguen pendientes; no declarar resuelto todo el acceso
por aprobar estas pruebas.

## Qué sigue y falta

Cerrar el recorrido físico de configuración/selectores/correo/recuperación,
teclado y letra grande; Google requiere elección personal de cuenta. Diagnosticar
la copia local protegida sin alterar originales. Medir transiciones/FPS en
teléfono físico. Sin APK/AAB/OTA/Play ni cambios nativos, Firebase o Telegram.
Tarjetas de crédito continúan fuera del alcance.
