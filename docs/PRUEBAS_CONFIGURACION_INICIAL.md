# Configuración, idioma y protección de datos antiguos — 09/10/2026

Preparado, no publicado. Este bloque continúa el acceso inicial de
`PRUEBAS_ACCESO_INICIAL_VIDEO.md`; no cierra toda la auditoría. Tarjetas de
crédito y Sentry externo permanecen fuera. No APK/AAB/OTA/EAS/despliegue.

## Decisiones y recorrido

- El propietario sustituyó País por **Idioma**, independiente de Moneda, en
  configuración y Ajustes. Se reutilizan los tres idiomas existentes:
  Español, English y Português. Elegir idioma no cambia país ni moneda.
- Banderas decorativas en ambas opciones y selectores, excluidas de su nombre
  accesible. La de español no elige España ni euros. Las monedas compartidas
  tienen representante visual (euro: Unión Europea); no indica residencia ni
  uso exclusivo. Catálogos, símbolos, decimales e importes permanecen iguales.
- `/country` y `CountryPicker` son alias puros de Idioma para enlaces/imports
  antiguos. El auditor comprueba destino local real con componente por defecto;
  no admite destinos vacíos/ausentes, escapes, ciclos ni lógica adicional.
  No se borran metadatos históricos de país ni se reasignan por una bandera.
- Elegir un idioma antes del presupuesto ya no guarda «cuenta configurada».
  País y moneda históricos, perfil y presupuesto se conservan.
- Guardar configuración espera un lote cifrado de perfil, presupuestos y
  marcas de sincronización confirmado antes de habilitar Inicio. Conserva
  otros meses, bloquea doble toque y muestra error/reintento si falla.
  No reconfigura una cuenta terminada ni acepta importes inválidos.
- Cambio de sesión, moneda o perfil durante el guardado cancela la respuesta
  antigua. La ruta comprueba la misma instancia de cuenta después de esperar.
  Esta operación exige Android, donde el módulo actual de AsyncStorage dispone
  de escritura por lote transaccional. No acredita la misma garantía en web/iOS.
- Avisos de configuración mantienen la clave de la cuenta inicial, descartan
  consultas atrasadas y desmontadas y capturan fallos/doble toque al abrir
  Ajustes. Una consulta válida posterior retira el error antiguo sin inventar
  permiso. No solicitan permiso automáticamente ni prometen avisos entregados.

## Historial antiguo sin dueño registrado

Problema adicional reproducido: sin el marcador de dueño, un perfil terminado
se vinculaba a una UID solo por coincidir el correo escrito, incluso sin
confirmarlo. No era un acceso remoto indiscriminado: requería esa instalación
antigua y una sesión con el mismo correo. Los dueños modernos por UID no
dependían de esta condición.

La adopción ahora exige la sesión real, su UID/correo coincidentes, correo
confirmado y la misma instancia durante lectura/cifrado/confirmación. Rechazar
conserva los bytes cifrados y mantiene las lecturas cerradas. El historial activo
antiguo no se reemplaza por una copia archivada durante esa adjudicación.

Login con correo pendiente va primero a Verificar. Registro que encuentra esa
barrera no escribe otro perfil ni presupuesto sobre los originales. El arranque
conserva Auth para poder verificar. Salir antes de abrir los datos no los archiva,
borra, sube, asigna ni elimina integraciones ajenas; vacía solo memoria. Un fallo
de Auth no reabre el historial ni reactiva un lector antiguo. Cuenta nueva vacía
puede seguir su configuración y cuentas modernas conservan archivo A→B→A.

Límite: la adjudicación de dueño no es una transacción del sistema de archivos.
Si cambia la sesión y además falla retirar el marcador recién confirmado,
se informa fallo de escritura y se bloquea acceso; pueden quedar el marcador
del UID que sí había confirmado el correo y los originales intactos. No se
acredita quién usaba un correo históricamente reutilizado ni validez jurídica.

## Evidencia y límites de las pruebas

Originales, no copias del algoritmo; Auth/React/Android tienen adaptadores.
AES/HMAC, almacén, cola y marcas son originales; guardado usa SQLite real local.

| Suite nueva | Evidencia principal / fallo anterior |
|---|---|
| verificar-propietario-legacy-real | Correo no confirmado adopta historial en 19e5dde; actual rechaza sin borrar. |
| verificar-acceso-legacy-rutas | Login anterior abre antes de verificar; rutas/arranque/salida actual preservan. |
| verificar-setup-guardado-real | Anterior anuncia configuración antes del disco; actual espera ACK y conserva ante rollback. |
| verificar-setup-avisos-real | Anterior escribe preferencia B después de consultar A; clave y sesión actuales acotadas. |
| verificar-selectores-iniciales-real | Idioma/Moneda anteriores seleccionan y retroceden dos veces; actual una vez. |
| verificar-banderas-decorativas | JSX anterior sin bandera monetaria; 155 adornos actuales y tres idiomas sin mutar catálogo. |
| verificar-idioma-independiente-real | Elegir idioma marcaba configuración terminada; ahora respeta etapa y moneda. |
| verificar-alias-compatibilidad | Auditor anterior clasifica alias reales como rutas/pantallas abandonadas; actual exige destino válido. |

Regresiones rojas contra **19e5dde**, actuales verdes. La de banderas conserva
la utilidad actual y ejecuta JSX histórico; la de alias ejecuta el auditor
histórico sobre el árbol actual. No se presentan como una APK histórica.
El refuerzo adicional de perfil durante cifrado y el del lector tras fallo Auth
también fallaron antes del parche y pasaron después, sin retirar aserciones.

La primera batería conjunta detectó tres adaptadores/contratos de limpieza
desactualizados y la ruta antigua ahora sin entrada normal. Se siguió la función
común extraída y se comprobó su enlace; no se quitaron garantías de Negocio/Pro.
Repetición: **180 pruebas y 8 auditores aprobados**, tarjetas excluidas. Incluye
una prueba preexistente ajena no versionada: 179 previstas en Git limpio, no se
ejecutó otro checkout. Último refuerzo de salida repetido en sus suites originales.
La integral SDK/HTTP 189/189 del bloque previo sigue documentada por separado;
no se ejecutó de nuevo para dar por probado este bloque ni se tocó producción.

## Qué sigue y qué falta

- Sigue revalidar los restantes IDs de la auditoría, costes/consultas y
  compatibilidad/migración; no anunciar toda la app como comprobada.
- Falta Android con React montado: guardar, teclado, salir/reabrir, volver
  desde Idioma/Moneda/Ajustes, letra grande, TalkBack y representación de emoji.
- Falta cuenta original/correo real y Google nativo; no se borró la instalación,
  sus datos ni sus protecciones para aparentar un acceso correcto.
- Fuera de este bloque siguen SMTP/moderación/bloqueo, consolas/trámites/cobros,
  revisión jurídica, publicación coordinada y todos los pendientes del índice
  `AUDITORIA_CIERRE_61.md`. Git no actualiza una instalación de producción.

Referencia de versión revisada antes de modificar:
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
