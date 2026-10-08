# FINO-24 — buzón cifrado y diagnóstico mínimo

Revisión: 07/10/2026. Preparación de código, no versión entregada.

## Qué se confirmó y qué no

El buzón nativo tenía hasta 200 avisos pendientes, un lote reclamado hasta 200
y 300 marcas de duplicados que podían contener texto completo. SharedPreferences
los guardaba en claro. El diagnóstico nativo conservaba nombres de otras apps.
No confundir esas 300 marcas con el diagnóstico de la pantalla: este ya guardaba
solo 40 avisos con el cifrado JS común. FINO-24 se precisa con esa distinción.

## Preparación

- AES-256-GCM con clave de Android Keystore, IV nuevo y autenticación del nombre
  del campo. No se exporta la clave a JS ni se requiere huella para capturar en
  segundo plano. No se asegura respaldo por hardware en todos los teléfonos.
- Protege queue/inFlight/seen, incluso editores encadenados; los arrays vacíos
  no contienen datos financieros y pueden seguir como `[]`.
- Lectura de formato antiguo valida JSON y convierte sin cambiar los datos.
  Una lista dañada, clave inaccesible o guardado fallido produce error; no se
  sustituye por una lista vacía ni se confirma un lote ilegible.
- Si queda cualquier lista cifrada, no se crea otra clave para añadir/migrar
  una lista distinta. Se conserva el lote para una recuperación posible.
- Reclamar, confirmar, limpiar y apagar requieren confirmación de guardado.
  Apagar es una acción explícita que limpia el buzón, como antes; se comprueba
  también dentro de add/noteSeen para impedir una captura atrasada.
- No almacena nombres de otras aplicaciones y retira los antiguos. Contadores,
  fechas, diagnóstico de voz y contador/paquete aceptado de Yape se conservan.
  La pantalla no muestra la lista antigua aunque se use con un APK anterior.
- No cambian montos, fechas, deduplicación, planes, permisos o destinatarios.
  App tiene allowBackup=false. Políticas/Play preparados, no publicados.

## Evidencia local

`node pruebas/verificar-privacidad-buzon-yape.mjs` ejecuta la política original
y comprueba contratos de código. NO traduce ni simula el algoritmo Kotlin.
Contra `FINO_TEST_NOTIFICATION_PRIVACY_BASELINE=257813c` falla; actual pasa.

Con JAVA_HOME de Android Studio y los JAR ya presentes en `.gradle-cache`:

```text
node scripts/probar-receptores-kotlin.mjs --notification-privacy
```

Compila y ejecuta NotificationStore/NotificationPreferences/NotificationCipher
originales con JSON y cifrado JCE reales. Solo Android Context/SharedPreferences,
Base64 y proveedor Keystore se adaptan. Comprueba migración, duplicados, reinicio,
IV/AAD/alteraciones, pérdida/fallo de clave sin inventarla, datos dañados, fallo
de disco al migrar/reclamar/confirmar, editores encadenados, retiro de nombres
antiguos y captura posterior al apagado. Contra 257813c falla porque persiste
texto financiero visible. NO acredita Android Keystore físico, disco real ni voz.

## Recorrido Android pendiente

1. Actualizar una instalación de prueba que tenga avisos pendientes antiguos.
   Deben conservar textos/montos/fechas y registrar una sola vez cada aviso.
2. Con datos ficticios, comprobar queue/inFlight/seen cifrados en las preferencias
   de una versión de prueba. No copiar avisos ni claves reales al informe.
3. Recibir Yape con app cerrada; abrir, interrumpir tras reclamar y reabrir.
   Un mismo captureId no debe crear dos movimientos; lote solo desaparece al
   guardar el movimiento. Probar con candado y teléfono bloqueado/reiniciado.
4. Denegar simulado acceso a la clave o corromper una copia de prueba: debe
   fallar la lectura sin borrar/reemplazarla. Restaurar y recuperar el lote.
5. Recibir avisos de otras apps: sube contador general sin conservar sus nombres
   ni su texto. Yape sigue teniendo su contador propio.
6. Apagar lector, salir/eliminar cuenta y probar una captura atrasada: no se
   añade al buzón. Revisar que el resultado fallido no se presente como éxito.
7. Probar fabricantes/API mínimos y recientes, arranque/voz/consumo y permiso
   concedido/revocado. Confirmar allowBackup/manifiesto release.

Necesita una nueva instalación Android acumulada; no llega por OTA. No generar
una entrega por cada corrección nativa ni afirmar actualización del emulador.

**Qué sigue:** restantes IDs, empezando FINO-30. **Qué falta:** recorrido físico,
release/firma, política/Play publicados, consolas, trámites y entrega autorizada.
Tarjetas y comprobación externa de Sentry excluidas por decisión del propietario.
