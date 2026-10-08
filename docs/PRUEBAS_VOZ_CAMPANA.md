# FINO-25/26 — dictado y movimiento de la campana

07/10/2026. Preparado, no instalado ni publicado. Tarjetas/Sentry excluidos.

## Voz: explicación que coincide con el código

VoiceEntry no activa `requiresOnDeviceRecognition`. La dependencia instalada
elige SpeechRecognizer normal, salvo que se exija explícitamente el motor local.
No se activa persistencia de grabación, pero eso NO prueba que el proveedor no
envíe ni conserve audio. Android documenta el posible envío a servidores.
No se cambia el motor ni la compatibilidad ni se fuerza offline sin modelos.

Política interna, HTML preparado, ayuda de tres idiomas y borrador de Play
advierten esa posibilidad. Se elimina también «mientras lo tienes apretado»:
la escucha empieza al abrir la pantalla y termina con Listo/silencio/salida.
No se inventa proveedor obligatorio Google, consentimiento registrado ni cifrado/
retención de terceros. Una transcripción convertida en movimiento se trata como
dato financiero. La fila de audio en PLAYSTORE queda por verificar, no «No recoge».

Fuentes oficiales consultadas el 07/10/2026:
- https://developer.android.com/reference/android/speech/SpeechRecognizer
- https://support.google.com/googleplay/android-developer/answer/10787469?hl=es

`verificar-voz-privacidad.mjs` ejecuta la política exportada real y contrasta
ayuda/HTML/Play/dependencia instalada. Prueba de textos/configuración, NO tráfico,
retención del proveedor ni revisión jurídica. Rojo contra `cb7f1e2`; verde actual.
No se publicó la política web ni se cambió Play Console. Tampoco esta nota sustituye
el consentimiento de datos sensibles o la revisión de FINO-47/48.

## Campana: avisos nuevos, no una animación al entrar

- Espera la primera lectura de avisos vistos y resultado de exportación, sin
  presentar datos históricos tardíos como llegada. Primera fotografía no anima.
- Compara IDs, no solo cantidades: un aviso nuevo sí anima aunque se lea otro
  al mismo tiempo y el contador total quede igual. Leer/quitar no hace vibrar.
- Mantiene los pulsos breves por llegada con tope de cinco para una ráfaga.
  No agrega vibración del hardware ni notificaciones/lecturas de nube adicionales.
- `useReduceMotion` empieza sin movimiento hasta conocer la preferencia, atiende
  cambios en vivo, ignora respuestas iniciales atrasadas y cancela movimiento
  en curso. Los pasos de Reanimated llevan también ReduceMotion.System.
- La dependencia Reanimated instalada YA usa por defecto la preferencia del
  sistema. Por eso la parte «no respeta reducir movimiento» del informe no se
  toma literalmente: se refuerza el control explícito y sus cambios en vivo.
- Se traducen las etiquetas de envío de transferencias de Inicio. El módulo de
  tarjetas y sus textos permanecen fuera; no se declara toda accesibilidad
  resuelta (FINO-50 sigue abierto).

`verificar-campana-movimiento-real.mjs` extrae/ejecuta efecto y referencia
ORIGINALES, y ejecuta el hook original con IO adaptado. Carga tardía, primera
fotografía, llegada, contador igual, lectura, ráfaga, preferencia, cancelación,
error y respuesta atrasada comprobados. Catálogo real de etiquetas ejecutado.
Rojo contra `cb7f1e2`; verde actual. NO animación renderizada/TalkBack/Android.
La prueba histórica transferencias-visuales se actualiza para aceptar claves
traducibles en vez de exigir una etiqueta literal española; conserva sus guardias.

## Pruebas físicas y externas pendientes

1. Android: entrar a Inicio con pagos/exportación antiguos sin sacudida, recibir
   un aviso nuevo, abrir/leer y volver, dos llegadas con un aviso leído al mismo
   tiempo, ráfaga, inicio con lector local lento y error de lectura de resultado.
2. Activar/desactivar «quitar/reducir animaciones» mientras está abierta: no
   iniciar ni mantener sacudidas, dejar la campana quieta, contador intacto.
3. TalkBack/inglés/portugués: campana y etiquetas de transferencias correctas,
   tamaño de letra/temas sin recortes; datos/fechas/estado de pago intactos.
4. Voz en la APK final: proveedor normal/alternativo, con/sin internet y modelos
   locales, permiso denegado, Listo/silencio/salida/candado. No grabar datos reales
   ni compartir capturas con importes privados. Revisar solicitudes del proveedor
   y documentos de retención, luego completar Seguridad de los datos.
5. Publicar política/ficha únicamente con entrega autorizada. No presentar
   el borrador ni los tests de código como declaración legal verificada.

**Qué sigue:** FINO-24 y los demás IDs aún para revalidar. **Qué falta:** esas
correcciones, teléfono/servicio de voz real, consolas, trámites, firma y entrega.
