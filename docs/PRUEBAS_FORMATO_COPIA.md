# Copias desconocidas y lotes ambiguos — 09/10/2026

Preparado, no publicado. No cambia IDs, montos ni referencias; no ejecuta
migraciones de usuarios. Tarjetas de crédito y Sentry externo excluidos.

## Decisión del propietario

Aceptó que una versión antigua tenga que actualizarse antes de sincronizar.
Los datos locales se conservan y el uso personal local no se bloquea.
Esta decisión NO es autorización de despliegue ni de lectura de copias reales.

## Bloqueos implementados en este paso

- `loadCloudData` valida recordIdentityFormat antes de descargar historial o
  construir el resultado. Ausencia/revisión 1 siguen admitidas. Una revisión
  entera superior requiere actualizar; tipo inválido requiere revisar la copia.
- `saveCloudData` valida la entrada antes de limpiarla/cambiarle el marcador,
  la consulta inicial y la lectura transaccional. La escritura de metadatos v2
  y cada fila v2 revalidan la raíz; no anuncian éxito por rebajar otro formato.
- Recepción al abrir/regresar comunica esos motivos, solo para la misma sesión
  viva. Un error atrasado no muestra un aviso ni cambia listas de otra cuenta.
  Ajustes tiene mensaje de actualización en los tres idiomas, sin rediseño.
- Importación y stageLegacyHistory rechazan un lote donde un registro vivo
  identificado comparte número con una marca sin origen. No devuelven cero
  ni descartan el alta. El lote queda intacto y sin importación parcial.
- Admin rechaza esa contradicción al preparar/elegir/acreditar copia. No trata
  la marca como prueba suficiente para retirar la fuente de un alta identificada.
  Tampoco anuncia «ya migrada» para un formato de identidad desconocido.
- Telegram no interpreta/corrige/borra un historial con revisión desconocida.
  Los formatos históricos siguen utilizables; no añade campos ni UUID a antiguos.

## Comprobación y regresiones

- verificar-formatos-copia-real ejecuta módulos originales por TypeScript/VM;
  IO, cola nativa y red adaptados. Lectura/entrada/fila/metadatos y cambio entre
  consulta/transacción, revisión futura/datos inválidos, copias intactas y altas/
  ediciones normales. Contra 07dfaf0: rechazo ausente, no API inexistente.
- verificar-consultas-estables-real ejecuta ambos efectos originales: avisos
  correctos al abrir/regresar, listas intactas y error atrasado ignorado.
  Contra 07dfaf0: el aviso faltaba; no se copia la lógica del contexto.
- SDK Firestore local, personal-history-client: cinco casos más el padre.
  Lee/guarda v1/v2 y fila v2 con código original, SDK y reglas reales locales;
  usa cuentas ficticias. Regresión 07dfaf0: seis fallos por aceptar lectura,
  guardar encima y escribir fila; código actual seis aprobados.
- Admin original: tres pruebas nuevas rojas contra 07dfaf0 y verdes actuales;
  Telegram original: una nueva roja/verde. 92 unitarias Node 22 aprobadas.
- 188 pruebas y 8 auditores de app sin tarjetas; una prueba ajena no versionada
  está en esa cifra (187 previstas en Git limpio; no otro checkout ejecutado).
  Batería integral del servidor: 208 aprobadas. TypeScript/ESLint aprobados.
  La clasificación final de error inválido y recepción se recomprobó aparte.

## Límites que NO se dan por terminados

El marcador actual y estos bloqueos no certifican una versión de APK ni
restringen todos los lectores/escritores anteriores. Las reglas existentes
impiden retirar el marcador 1, no verificar cualquier programa que lo conserve.
No se cambió el formato activo ni se publicó una política mínima global.
Preparar esa activación requiere un contrato común y una entrega coordinada.

Cuatro de los siete casos diagnósticos ya se detienen conservando fuentes:
stageLegacyHistory/importación/Admin elección/Admin cobertura. Los siete casos
se conservan y el diagnóstico conjunto sigue ROJO: todavía fallan la unión de
historial con lápida numérica, la planificación contra esa lápida y dos copias
antiguas sin origen. No son «tres hallazgos restantes de toda la auditoría».

Un Admin no puede convertir una contradicción identificada en migración válida
por saltarse el bloqueo. Incluso un borrado legítimo sin origen suficiente
puede detener esa migración; necesita el protocolo siguiente/revisión humana,
no quitar UUID, elegir por fecha o retirar fuentes para forzar una prueba verde.
No se asegura restauración remota intencional, dos teléfonos ni recuperación
de una marca/dato ya perdido. Ni SDK local ni contratos estáticos prueban UI
Android, producción, factura o cumplimiento jurídico.

**Qué sigue:** protocolo compatible de origen/versiones/borrado/restauración
y mínimo de sincronización aprobado por el propietario. **Qué falta:** esos
tres casos, revisión de antiguos ambiguos sin sobrescribir, Android/dos equipos,
consolas/SMTP/moderación/políticas/trámites/cobros y activación autorizada.
