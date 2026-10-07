# Recuperar corrección monetaria completada sin Pro — 06/10/2026

## Problema comprobado

En `48e9f95`, reintentar una elección pendiente exigía Pro antes de consultar
el servidor. Si la corrección remota había terminado y se perdía HTTP o fallaba
el guardado local, vencer Pro impedía recuperar ese resultado. No se borraban
los originales, pero la revisión y ambos respaldos quedaban bloqueados.

`FINO_TEST_MONEY_RECOVERY_BASELINE=48e9f95` ejecuta el flujo anterior real con
el mismo contexto/cliente/almacén de prueba: el caso falla por
`cajas-money-needs-pro`; el flujo nuevo lo completa. Es una regresión de código
preparado, **no una afirmación de daño a usuarios de la versión publicada**.

## Cambio preparado

- `recoverPrivateBoxMoney` exige Auth/cuenta real, correo verificado y no
  deshabilitada. Valida propietario, petición de hasta 150 kB, cuatro fuentes,
  cuenta/moneda/enlaces, versión exacta, borrados/cierre/conversión/devoluciones,
  duplicados/saldo y los dos formatos de historial en una transacción.
  También comprueba la barrera de borrado de `premiumTrialClaims`, aun si el
  marcador de la copia Personal no está presente; no reactiva una cuenta al borrarse.
- Devuelve únicamente una confirmación si Personal y Caja contienen exactamente
  el resultado esperado, incluidos sus campos y versión. No devuelve fuentes
  remotas ni otro historial; no crea documento/recibo adicional.
- **Solo lectura:** la función no inicia ni reintenta una escritura, tampoco
  con Pro. Un resultado sin aplicar responde `money-not-confirmed`; fuentes
  diferentes o posteriores no se imponen. El modo no se acepta desde la petición.
- El endpoint de escritura conserva Pro en el servidor. Enviar `readOnly` o
  `action` al otro endpoint no cambia su autorización. Las reglas Firestore
  continúan rechazando descargar Personal/historial/Cajas a Gratis.
- El reintento prueba primero recuperación, cualquiera sea el plan. Solo un
  rechazo definitivo `money-not-confirmed` permite pasar a corrección, y
  únicamente si Pro sigue activo. Fallo/red/error/copia distinta/acuse falso
  no provocan escritura alternativa.
- El SDK exige elección/originales cifrados y fuente local válida antes y
  después de HTTP, y entrega un comprobante genuino ligado a cuenta/generación/
  cola/elección. Calcular o copiar un ack no autoriza completar el lote.
- El contexto confirma Personal/borrados/Caja juntos con versión exacta,
  originales intactos y lectura de comprobación. Fallo local deja pendiente y
  permite repetir recuperación sin escribir nuevamente en la nube.
- Gratis ve «Comprobar resultado pendiente». Una corrección nueva o comparar
  fuentes actuales sigue limitada a Pro; los originales locales siguen visibles.
  Dos toques, pantalla cerrada/cuenta cambiada y almacenamiento ilegible siguen
  bloqueados. El respaldo Gratis no se habilita por recuperar una operación.

## Verificación

- Nuevo recorrido local: flujo, SDK/coordinador, contexto/setters/almacén y
  botón de pantalla originales; SQLite real. Puente nativo/cifrado/HTTP/React
  sustituidos, no Android físico. Recuperación/Pro antes/después de respuesta,
  reinicio, errores/acuse falso, metadata/cuenta/elección/moneda distintas,
  rollback/cifrado/acuse nativo perdido y protección de otras filas comprobados.
- Unitarias del módulo de servidor original cubren ambos formatos, permisos,
  cero escrituras, resultado incompleto y versiones/notas/borrados/duplicados/
  cuenta/moneda/devoluciones distintos y límite de petición. No se copia la
  lógica del servidor en una prueba que solo compruebe su propia imitación.
- SDK/HTTP Auth/Functions/Firestore demo y contexto/SQLite originales verifican
  la recuperación sin Pro tras fallo local, reglas de descarga denegadas,
  ambos formatos y conservación exacta de contenido/fechas de escritura remotas.
  Se comprueba además resultado no aplicado, fuente posterior, cuenta en borrado,
  UID ajena y usuario deshabilitado/no verificado.

Resultado: TypeScript y ESLint completos aprobados; 145 pruebas locales y
8 auditores aprobados (dos suites específicas de tarjetas excluidas, no
contadas como verificadas). El total local incluye una prueba ajena sin
registrar que se conserva fuera del commit; no se ejecutó una copia limpia
para atribuirle ese total. 77 unitarias del servidor y 124 SDK/reglas/HTTP/
eventos bajo Node 22 real aprobados, con cero fallos, omisiones o cancelaciones.
Los tres subtests nuevos unen funciones/SDK/HTTP reales con contexto/SQLite
originales, sin producción. La prueba negativa de usuario Auth borrado del
recorrido anterior genera el rechazo esperado y pasa; no es un nuevo fallo.
Regresión 48e9f95 falla como se esperaba y código nuevo vuelve a pasar.
Los casos locales de recuperación y del lote se repitieron después de las
guardias finales; la prueba de textos legales también volvió a pasar.

Políticas interna/web y PLAYSTORE actualizadas solo en archivos para describir
esta excepción limitada, los originales enviados y ausencia de nuevo recibo/
colección/retención. **No se ha publicado ninguna política, función, regla,
APK/AAB/OTA ni se cambió CODE_MARKER.** Tarjetas/código nativo intactos.

## Qué sigue y qué falta

- Elección obsoleta: si la copia ya cambió o falta una mitad, no se fuerza el
  resultado. Falta sustituir/desbloquear esa revisión de forma explícita y
  recuperable, conservando originales; no basta borrar su diario pendiente.
- Si el resultado nunca se aplicó y Pro venció, la recuperación no lo inicia:
  queda pendiente hasta Pro o un futuro protocolo de retiro/revisión seguro.
- Android visual/lector de pantalla, interrupciones/espacio/tamaño/captura y
  dos dispositivos reales. ADB no encontró dispositivos en esta sesión.
- Demás conflictos/hallazgos, consolas/políticas reales y publicación conjunta
  autorizada de servidor/reglas/app. La nueva función debe estar desplegada
  antes de distribuir esta pantalla. Punto 1 y auditoría no están cerrados.
- No existe atomicidad global teléfono/Firebase ni protección global de costes
  por estos límites. El control general antiabuso/facturación sigue siendo un
  asunto separado; no se amplió el acceso Gratis al respaldo.
