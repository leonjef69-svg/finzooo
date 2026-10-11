# Bitácora de continuidad de Fino

Fechas y horas en America/Lima (UTC-05:00). No inventar horas históricas.
Proyecto activo y único lugar de trabajo: `C:\finzo`.

## Documentación existente: leer sin volver a copiarla

1. `AGENTS.md`, `ESTADO.md`, `ENTREGAS.md` y `PLAYSTORE.md`.
2. `docs/AUDITORIA_CIERRE_61.md`: seguimiento de los hallazgos originales y FINO-62.
3. `docs/PRUEBAS_CICLO_BORRADO_RESTAURACION.md`: evidencia del punto 1 y límites.

Punto 1 local terminado y subido en `7c6c324`. Resultados y decisiones están
en esos archivos; no se repiten aquí. No está acreditado como instalado/publicado.

## 10/10/2026 — 23:01:18 — cierre parcial del punto 2 (información nueva)

El propietario autorizó punto 2 hasta las 23:00 y revisar el vídeo
`C:\Users\User\Videos\2026-10-10 01-18-59.mkv`. La última lectura fue 23:01:18;
se comunicó el resultado y se detuvo, sin terminar el punto 2.

- Revisado completo: 63,654 segundos, 1909 fotogramas, 1656 imágenes RGB distintas
  y 253 duplicados exactos. Las 104 hojas se revisaron en tres tramos solapados.
- Negro breve al abrir Crear cuenta: 22,654–22,788 s.
- Destellos blancos de «Comprobando el bloqueo de Fino…»; entre otros, a
  54,554–54,821; 58,988–59,254 y 61,488–61,754 s.
- Intentos de Google/correo vuelven con aviso de datos de otra cuenta. Puede ser
  protección correcta: no se demostró rechazo indebido ni acceso exitoso. No
  quitar la protección ni borrar datos para forzar la entrada.
- La hoja del gestor de contraseñas observada no es el selector de acceso Google.
  El vídeo está estirado horizontalmente; no atribuir esa distorsión a la app.
- Emulador abierto por el usuario y detectado; no se completó acceso real ni se
  operó la elección de cuenta. Ningún cambio nuevo de código por esta revisión.
- Evidencia ya existente: `.tmp/auditoria-video-20261010/` (manifiestos, hojas,
  PNG y `revision-primera-mitad.md`). No generar otra copia ni renumerar hallazgos.

## 10/10/2026 — 23:20:12 y 23:47:02 — conservación y aclaración

El propietario pidió guardar los avances y después aclaró: NO quiere otra
carpeta/copia del proyecto, solo información faltante dentro de C:\finzo.
Se detuvo el script de respaldo y su Robocopy, identificados por comando exacto.
Se solicitó enviar a la papelera únicamente la copia parcial creada por el
agente; no borrar fuentes externas, archivos originales ni C:\finzo.
La bitácora queda como referencia breve, sin duplicar la auditoría ya escrita.

## 11/10/2026 — 06:16:51 — punto 2 retomado, antes del apagado solicitado

- El propietario confirma que Google rechaza exactamente la misma cuenta
  que usaba antes. No atribuirlo a una cuenta equivocada: causa aún pendiente.
  No se borraron datos ni se retiró la protección de propietario.
- Preparados: botones de Bienvenida se liberan si el viaje rápido es descartado;
  respuestas tardías de acceso/registro no continúan ni navegan por una ruta
  abandonada. Hook y callbacks originales conservan identidad/enfoque y reintento.
  No cancela la llamada Auth ya enviada ni todos sus eventos globales.
- Cubierta de datos sigue opaca, sin fundido; distingue cargar datos de comprobar
  candado. No acredita desaparición del negro/destellos en Android instalado.
- Pruebas nuevas originales: viaje descartado y acceso abandonado verdes;
  ambas contra ed0cb18 rojas por los fallos reales, no por API ausente.
  Privacidad ampliada verde y baseline ed0cb18 rojo por fundido.
- Verificación final registrada 06:18:56: TypeScript/ESLint exit0, app final
  196 pruebas/8 auditores sin tarjetas (una ajena no versionada: 195 previstas
  Git limpio; no otro checkout). Primera batería falló el adaptador nuevo;
  corregido y repetido sin retirar aserciones. Auth SDK aislado Node 22: 5/5,
  sin fallos/omisiones; primer CLI bloqueado por config externa, repetición
  sin sesión/configuración real aprobada. No servidor integral repetido.
  Detalle nuevo en PRUEBAS_ACCESO_INICIAL_VIDEO, sección 11/10.
- Emulador detectado: com.finoapp.gastos 1.0.8/code10, último APK 02/10;
  eso no identifica el JS cargado. Autorización Computer Use caducó sin obtener
  captura/operar acceso; usuario elige Google. No prueba Android completada.
- Solicitado apagado único 11/10 a las 07:05 Lima. Tarjeta sugerida con fecha
  exacta, todavía sin confirmación observada. Guardar antes; sin cierre forzado.
  Tres minutos solo tras pregunta imprescindible pendiente, no silencio normal.
- Bloque guardado en commit `860530ed` (06:20:53 Lima) y push a origin/master
  confirmado. No incluye pendientes preexistentes de Telegram ni prueba ajena;
  esos archivos permanecen conservados en C:\finzo. No despliegue/entrega.
- **Qué sigue/falta:** diagnóstico legítimo de propietario y pruebas Android (2); servicios,
  consolas/publicación (3) después. Tarjetas fuera, Telegram en pausa,
  Sentry externo excluido, rediseño diferido. Sin APK/AAB/OTA/despliegue nuevos.

## 11/10/2026 — 10:24:27 — aviso de dueño y limitación visual

Distinción de aviso preparada sin aflojar protección ni leer/borrar historiales
reales. Bóveda/rutas originales verdes; a982dc3 rojo por aviso que afirmaba otra
cuenta sin demostrarlo. Detalle único en PRUEBAS_ACCESO_INICIAL_VIDEO, sección
10:24:27. Final 10:26:12: TypeScript/ESLint exit0, app 196/8 sin tarjetas
(una ajena no versionada: 195 previstas Git limpio, no otro checkout).
Emulador original reabierto, datos conservados; dos capturas Computer Use fallaron.
Se pidió captura humana del aviso actual. APK sigue 1.0.8/code10 del 02/10;
JS cargado desconocido. No entrega/instalación/despliegue ni acceso real resuelto.
**Qué sigue/falta:** captura/diagnóstico legítimo y resto Android (2), servicios/
consolas/publicación (3). Exclusiones anteriores intactas. El apagado sugerido
07:05 ya está en el pasado; no se observó confirmación ni se ejecuta ahora por esa
hora antigua. El guardado permanece en C:\finzo, sin otra copia del proyecto.

### Instrucciones vigentes para continuar

- Completar punto 2: comprobar versión instalada y acceso con propietario
  legítimo/cuenta de prueba; la selección de Google la hace el usuario. Después
  corregir lo confirmado y repetir pruebas Android sin tocar datos reales.
- Punto 3 sigue pendiente: servicios/consolas, App Check/costos, SMTP/moderación,
  Play/Billing, web/legal/trámites y activación coordinada autorizada.
- Tarjetas excluidas; Telegram en pausa; Sentry externo fuera; rediseño diferido.
- Dos archivos de Telegram modificados y la prueba local
  `pruebas/verificar-resumen-gasto-ingreso-ui.mjs` son pendientes preexistentes:
  conservarlos, no adjudicarse su autoría ni declararlos publicados/verificados.
- No APK/AAB/OTA/EAS/Firebase/Play ni migración por este registro documental.
- Esta bitácora registra lo nuevo; no afirma una exportación literal del chat.
- **Qué sigue/falta:** terminar punto 2 y luego punto 3; no cerrar toda la auditoría.
