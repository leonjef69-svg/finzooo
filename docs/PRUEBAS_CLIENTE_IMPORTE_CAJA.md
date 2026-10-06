# Cliente de revisión monetaria preparado — 06/10/2026

**Avance limitado del punto 1. No hay nuevo botón, lote financiero ni petición
desde una pantalla. No se activa ni publica todavía. Tarjetas fuera del ámbito.**

## Qué se prepara

- `cloudPrivateBoxMoney.ts` conecta el servicio monetario existente con un
  cliente específico, sin reutilizar descargas ordinarias pausadas. Exige una
  autorización de revisión auténtica y activa de la misma cuenta; no acepta un
  objeto fabricado, una autorización ordinaria ni una cola ya cerrada.
- Fuentes para el formulario: lecturas exclusivamente de servidor de Personal
  y Cajas propias. En historial v2 solo consulta el ID afectado y hasta dos
  documentos con su enlace, para detectar duplicados. No descarga toda la
  colección. En formato antiguo lee el documento raíz existente y retorna solo
  la transacción afectada, no los demás movimientos del perfil.
- Error de red, caché, escrituras pendientes, documento ausente, duplicados,
  borrados, cuenta eliminándose, moneda o formato distintos no son una copia
  vacía. No permite importar revisiones locales desde un documento remoto.
- Esas lecturas no son una foto indivisible entre documentos: sirven para
  mostrar fuentes, **no** para autorizar sobrescritura. El plan puro valida
  después los cuatro originales y el servidor vuelve a leerlos en la
  transacción final. Falta el formulario que los relea y compare antes de
  guardar una elección humana; una descarga antigua no basta.
- Antes del envío lee el archivo local cifrado original. Debe contener la
  misma revisión pendiente, originales, elección, UID y moneda. Comprueba la
  pareja Personal actual, borrados, saldo y versión con el plan puro existente.
  Falta de archivo, guardado fallido o referencia de pantalla sola no autorizan
  la solicitud. Después de HTTP repite esos controles de disco y memoria.
- Envía únicamente el esquema `MoneyReview` existente, con las cuatro fuentes
  completas y sin el campo local `estado`. No usa el Premium local como permiso
  del servidor: reglas y servicio aplican la concesión real. Un Pro revocado
  no permite descargar/corregir por estas APIs.
- Solo una respuesta exacta de `resolvePrivateBoxMoney`, en la misma cuenta,
  generación y cola, recibe una prueba de procedencia en memoria. Copiar,
  calcular o inventar los mismos campos del comprobante no genera esa prueba;
  cerrar la cola/cambiar sesión la invalida. No nueva clave/colección/retención.
- **HTTP no confirma el guardado local:** no modifica transacciones, Cajas ni
  la marca pendiente. Si el servidor confirmó pero la respuesta se pierde o
  cambió la pantalla, conserva los originales y no anuncia éxito local. El
  reintento idéntico puede recuperar la confirmación vigente sin otra escritura.
  Eso no resuelve una elección obsoleta ni una prueba Pro vencida: siguen
  pendientes la revisión explícita, el lote final y su recuperación.

## Pruebas

`node pruebas/verificar-cliente-importe-caja.mjs` ejecuta cliente, coordinador,
validadores y plan puros originales; sustituye únicamente SDK/red/configuración
y las lecturas nativas de disco/sesión. Comprueba formatos 1/2, originales y
metadata, consulta limitada, autorización genuina, rechazo de comprobante
fabricado/copiado, cola cerrada, sesión A→B/nueva A, pantalla cerrada, dinero
nuevo, borrados, moneda, caché/offline/archivo ilegible, respuesta HTTP perdida
o inválida y espera de una subida anterior. No escribe ni simula un lote local.

`functions/integration-tests/private-box-money.test.js` añade recorridos del
**cliente original** con SDK Auth/Firestore/Functions y HTTP del emulador real:
ausencia de originales sin escritura, fuentes exactas en ambos formatos,
confirmación/reintento sin duplicar ni renovar la escritura, respuesta de
pantalla cerrada, Pro revocado y edición posterior. Sustituye solo el archivo
y la sesión nativos; no ejecuta React ni Android, ni demuestra atomicidad
servidor/teléfono. Todas las cuentas son ficticias, proyecto demo y localhost.

Regresión sintética del contrato nuevo:

```powershell
$env:FINO_TEST_MONEY_CLIENT_BASELINE='aee6653'
node pruebas/verificar-cliente-importe-caja.mjs
```

La revisión anterior no tenía cliente/verificador de confirmación genuina y
falla en esa aserción. **No es una falla observada en la app publicada ni una
acusación de que el plan puro anterior guardaba dinero:** ese plan nunca
confirmaba almacenamiento. No cambia el checkout; quitar la variable para
la ejecución normal. La suite nueva forma parte de `correr.mjs` automáticamente.

## Resultado de esta tanda

- TypeScript y ESLint aprobados tras las guardias finales.
- 141 pruebas locales y 8 auditores del ámbito aprobados con
  `node pruebas/correr.mjs --sin-tarjetas`. Una prueba ajena ya estaba sin
  registrar en Git: 140 en una copia limpia. Dos suites específicas de tarjetas
  excluidas por decisión del propietario y no contadas como aprobadas.
- Prueba directa del cliente repetida tras las guardias finales: aprobada.
- 73 unitarias de Functions y **117 SDK/reglas/HTTP/eventos** aprobadas bajo
  Node 22 real, sin omisiones/cancelaciones. Los cinco nuevos recorridos usan
  el cliente original y Firebase demo, no una copia de la lógica del cliente.
- Regresión aee6653: falla como se esperaba por el verificador ausente.
- ADB no encontró dispositivos. No prueba Android, lote final ni pantalla.

## Qué sigue y qué falta

1. Guardado conjunto de resultado y confirmación en el contexto/SQLite,
   aceptando únicamente la respuesta genuina mientras sigue abierta su cola;
   comprobar fuentes vivas antes y durante el cifrado/escritura y conservar
   cualquier edición ajena. La comprobación de HTTP no sustituye ese contrato.
2. Pantalla con las alternativas, confirmación humana, originales antes de red,
   bloqueo de mutaciones incompatibles y caminos explícitos para reintento,
   decisión obsoleta, falta de espacio y Pro vencido. No activar una selección
   que pueda dejar el respaldo bloqueado permanentemente.
3. Android/visual/cierre de proceso/tamaño/dos dispositivos, consolas/índices,
   restantes conflictos/hallazgos y publicación coordinada autorizada. No
   consultar ni modificar cuentas de producción ni desplegar para probar.

El esquema de datos ya figuraba en políticas interna/web y PLAYSTORE como
preparación pendiente. Este paso no añade información guardada/transmitida,
retención o servicios a ese esquema y no se importa desde pantalla/contexto;
no altera esos formularios ni los publica. Sin cambios nativos, tarjetas,
CODE_MARKER, APK/AAB, OTA o despliegue. Punto 1 y auditoría siguen abiertos.
