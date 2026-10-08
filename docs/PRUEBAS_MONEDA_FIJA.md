# FINO-51 — moneda fija por cuenta

08/10/2026. Decisión del propietario: otra moneda solo en una cuenta nueva.
No se convierten cifras, no se cambia la moneda de cuentas antiguas y no se
modifican tarjetas de crédito, sus modelos ni sus pantallas.

## Comportamiento preparado

- La moneda se elige antes de finalizar la configuración inicial. Finalizar
  fija la moneda incluso con presupuesto cero o sin movimientos. Esto evita
  que borrar el último registro vuelva a permitir reetiquetar dinero.
- El indicador de cuenta configurada se actualiza inmediatamente y se restaura
  con el perfil de esa cuenta. Cerrar sesión archiva el perfil como antes;
  otra cuenta puede hacer su propia elección. No se añade una clave nueva.
- Ajustes muestra la moneda actual y explica por qué no puede cambiarse.
  Cambiar de país puede cambiar idioma y métodos locales, pero conserva la
  moneda y avisa de ello. Restaurar la nube no revierte el país local elegido
  solo porque la moneda de ese país sea diferente.
- La unión de dos copias configuradas con monedas distintas se rechaza antes
  de escribir presupuestos, perfil o historial. No se interpreta S/100 como
  US$100 ni se mezclan importes sin una tasa de conversión. Se informa que las
  copias necesitan revisión; no se borra ni escoge una silenciosamente.
- El historial separado comprueba la moneda antes de empezar y de nuevo en
  cada transacción de fila. Las reglas preparadas impiden cambiar moneda o
  quitar `hasOnboarded` en una cuenta configurada, incluidas versiones viejas.
  Las copias antiguas sin moneda explícita mantienen la interpretación PEN
  que ya utilizaba el lector; no se supone que una cuenta antigua era USD.

## Evidencia local

`pruebas/verificar-moneda-cuenta-real.mjs` ejecuta los manejadores originales,
el setter inmediato, la unión, la recepción, la restauración, los guardados
v1/v2 y el control por fila. Sustituye IO/React/Firestore donde se indica;
no copia estos algoritmos ni monta la app. Comprueba que los conflictos no
escriben, la misma moneda sí guarda y una preferencia previa al registro no
gana a la moneda de un respaldo configurado. Los contratos de pantalla y
de conexión con la restauración se comprueban estáticamente, no visualmente.

Regresión con `FINO_TEST_CURRENCY_BASELINE=5cd7e09`: falla en el cambio real
PEN → USD. Versión corregida aprobada. La prueba histórica del catálogo se
actualizó a la decisión nueva; la prueba de fusión mantiene sus comprobaciones
y adapta únicamente el indicador del registro en su entorno simulado.

`functions/emulator-tests/account-currency.test.js` usa el SDK auténtico y
reglas completas contra Firestore local, cuentas `demo-*`, bajo Node 22.
Cinco casos más el grupo, seis comprobaciones: cambio directo rechazado,
reinicio rechazado, edición normal permitida, cuenta nueva USD permitida y
copia antigua sin moneda protegida. Regresión de reglas contra `5cd7e09`
falló porque la escritura peligrosa sí se permitía; reglas corregidas verdes.
Esto no prueba las reglas que estén publicadas en Firebase.

Repetición junto a `cloud-pro`, `personal-fields` y `personal-history-client`:
25 comprobaciones SDK/Firestore verdes bajo Node 22. Incluye restauración de
10.000 movimientos, cambios por documento y dos clientes simulados con SDK
auténtico; no equivale a dos teléfonos. TypeScript/ESLint aprobados y 160
pruebas locales/8 auditores verdes (159 en Git limpio: una prueba preexistente
del propietario sigue fuera de Git). Se mantiene la exclusión de tarjetas.

El primer intento local se interrumpió por una excepción del emulador al
cargar mensajes de validación con locale es_PE. Se repitió con la misma
versión y reglas usando `-Duser.language=en -Duser.country=US` en Java.
No se relajaron reglas ni se alteró el idioma de la app/Windows. El proceso
atascado y el emulador inicial se detuvieron por PID y objetivo comprobados.

## Qué sigue y qué falta

- Android: cuenta nueva en USD; cuenta configurada con S/100; intentar cambiar
  moneda directamente y por país; eliminar todos los movimientos; reiniciar;
  cerrar sesión A → B → A; comprobar cifras, explicación y país conservados.
- Dos dispositivos: copia antigua con otra moneda debe conservarse y pedir
  revisión, sin subida parcial. No está autorizada una conversión/migración
  automática de copias ya discrepantes: necesitan revisar su procedencia.
- Publicar app y reglas coordinadas y comprobar reglas efectivas; todavía
  no se desplegaron ni se generó otra entrega. Lo publicado no se certifica.
- Siguen los demás IDs de la matriz, consolas y trámites externos. La auditoría
  no está terminada; tarjetas y Sentry externo permanecen fuera.
