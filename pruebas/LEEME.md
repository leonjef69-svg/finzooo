# Pruebas y auditores

```bash
node pruebas/correr.mjs
```

Desde la raíz del proyecto. Descubre las pruebas nuevas y muestra el número
actual de pruebas y auditores. Si algo falla, dice cuál y en qué.

Antes de publicar cualquier cosa, además:

```bash
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

Las funciones del servidor tienen pruebas separadas. Desde `functions`,
`npm test` ejecuta sus pruebas unitarias. `npm run test:server` exige Node 22
real y ejecuta reglas, SDK, HTTP y eventos de Auth/Firestore en emuladores
locales con cuentas ficticias. No despliega ni necesita datos de producción.
Requisitos, regresión y límites: `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`.

La base de corrección remota Personal/Caja tiene diez pruebas unitarias y una
suite SDK/HTTP separada. No está habilitada en la app; falta integrar selección,
conservación y guardado local. Alcance, comandos y regresión:
`docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`.

---

## Qué comprueba cada cosa

`verificar-cliente-importe-caja.mjs` ejecuta cliente/coordinador/validadores
originales: fuentes frescas dentro de revisión, originales pendientes en disco,
confirmación genuina ligada a cuenta/sesión/cola, respuesta perdida/copiada,
fallos y cambios sin confirmar dinero local. La suite SDK/HTTP del cliente está
en `functions/integration-tests/private-box-money.test.js`. No hay integración
en pantalla/contexto ni lote final monetario; guía, regresión y límites:
`docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`.

`verificar-recuperacion-incompleta-cajas.mjs` ejecuta el plan, aviso, manejador
de entrada y guardado originales con SQLite real: Caja cerrada/convertida,
fechas/montos/repartos dañados, filas ilegibles, identidad disponible y no
mezclar datos compartidos. No reconstruye ni escribe un plan antiguo inseguro;
las recuperaciones positivas se mantienen. SDK emulado lee también fuentes
dañadas/cerradas sin modificarlas. Regresión y límites:
`docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`.

`verificar-nombres-caja-nube.mjs` ejecuta auxiliares, transacción, elección,
reintento y guardados originales; confirma ambos nombres antes de la red,
rechaza fuentes/sesiones/planes obsoletos y no toca dinero. Incluye rollback
y respuesta perdida con el contexto/almacén originales sobre SQLite real,
no Android. La prueba de copia por cuenta cubre conservar revisiones A→B→A.
`private-boxes.test.js` prueba también dos SDK concurrentes y reglas reales
emuladas. Regresión contra 482f2fd y límites:
`docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`.

`verificar-enlace-heredado-explicito.mjs` ejecuta la elección/confirmación
originales y sus condiciones: iguales importes/fechas, IDs únicos, no borrados,
cancelación, cambios de fuente/cuenta/plan. La matriz SQLite original también
comprueba el guardado de ese enlace. Guía, regresión y límites:
`docs/PRUEBAS_ENLACE_HEREDADO.md`.

`verificar-reparacion-pares-cajas.mjs` comprueba recuperaciones con IDs,
conservación ante diferencias/borrados/consumo, elección explícita y el guardado
original sobre SQLite real (no Android físico). Incluye pantalla/contexto
originales, rollback, respuesta perdida y fuente/sesión remota. Regresión contra
0f0588f y límites: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`.

`verificar-cajas-sincronizacion.mjs` cubre versiones, conflictos, datos inválidos,
cache/sesión, respuesta encolada, conversión con vista vieja y marcas de consumo
con los auxiliares/manejadores propios reales. La prueba SDK está en
`functions/integration-tests/private-boxes.test.js`. Guía y límites:
`docs/PRUEBAS_CAJAS_PRIVADAS.md`.

`verificar-consultas-espacios.mjs` ejecuta manejadores originales de Familia y
Cajas con respuestas diferidas: cuenta/sesión, consulta superada, borrado,
caché, miembros y cierres. La prueba de fuentes reales está en
`functions/integration-tests/shared-sources.test.js` (SDK/Auth/Firestore local).
Regresión, comandos y límites: `docs/PRUEBAS_CONSULTAS_ESPACIOS.md`.

### Pruebas (`verificar-*`)

| | |
|---|---|
| `voz-exportar` | Que "exportar julio pdf whatsapp a mamá" se entienda entera: mes, formato, destino, tipo, gráficos y a quién |
| `orden-voz` | Que **el orden no importe**: las 720 formas de decir la misma orden, más las 120 sin nombre |
| `contactos` | Los números de teléfono como los quiere WhatsApp, y a quién va el archivo en el momento de mandarlo |
| `categorias` | Las categorías personalizadas y el recorte de la imagen |
| `pdf` / `pdf-mixto` | El documento: rosquilla, gráficos, escapado, la lista completa, y si se aprieta para caber en una hoja |
| `excel` / `excel-export` | Leer y escribir .xlsx, con las fechas sin correrse un día |
| `exportar` / `programado` | Cuándo toca la exportación automática y qué mes lleva |
| `panorama` | Las cuentas de Reportes: que el disponible sea el mismo que en Inicio |
| `paises-monedas` | Catálogo mundial completo, sin monedas ausentes ni cambios peligrosos en Firestore |
| `bloqueo` | El PIN, la huella y el bloqueo progresivo |
| `archivo-entrante` | Compartir un estado de cuenta a Fino |
| El resto | Gráficos, etiquetas que no se pisan, resúmenes por día |

### Auditores (`auditar-*`)

| | |
|---|---|
| `textos` | Que las 718 claves estén en los tres idiomas y ninguna falte |
| `redaccion` | Cómo están escritos esos textos |
| `codigo` | Lo que quedó sin usar |
| `pantallas-externas` | Que salir a otra app y volver no rompa nada |
| `fondo` | Claves repetidas, erratas de puntuación, ceros escritos como O, `console.log` olvidados, funciones con el mismo nombre en dos sitios |

---

## Cómo escribir una prueba nueva

**Tiene que fallar contra la versión anterior.** Una prueba que pasa siempre
no está probando nada: da tranquilidad sin dar información. La forma de
comprobarlo es escribirla ANTES del arreglo y ver que falla.

Y que el mensaje diga qué se rompería si fallara, no cómo funciona por dentro:

```
ok(normalizePhone("999888777") === "51999888777",
   "un numero peruano suelto recibe su codigo de pais");
```

Si es un `.mjs` suelto, con dejarlo en esta carpeta ya entra: el lanzador los
busca solos. Si es un `.ts` que carga código de la app, hay que apuntarlo en
`correr.mjs` con los sustitutos que necesite.

## Los sustitutos (`stubs/`)

Estos archivos cargan código de la app, y la app habla con Android. Aquí no
hay Android: se cambia `react-native` y algún módulo de Expo por versiones que
no hacen nada. Lo que se comprueba son las **cuentas** y el **texto** que sale,
no el dibujado.

Había dos sustitutos de react-native, cada uno con piezas distintas, y cada
prueba usaba el suyo. Así es como dos pruebas se quedaron paradas meses sin
que nadie se enterara. Ahora es **uno solo**: si a alguna le falta algo, se
añade ahí y lo tienen todas.

## Preparación del archivo de originales monetarios

`verificar-originales-importe-caja.mjs` ejecuta Cajas y plan monetario puros,
cuatro fuentes, validación/metadata/versiones, límites y cifrado/bóveda reales
con sustitutos de Android. La regresión b48e703 pierde el campo al normalizar.
No es pantalla/envío/guardado monetario conectados ni Android físico. Ver
`docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md` para alcance y siguientes pasos.

## Coordinación de respaldo y alcance sin tarjetas

`verificar-barrera-personal-caja.mjs` ejecuta la cola/nube/historial/contexto
originales con red y almacenamiento aislados. La regresión c24eff0 reproduce
un respaldo de Personal pese a la revisión Caja pendiente. No es Android ni
la corrección monetaria de pantalla, que todavía falta conectar. Guía:
`docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`.

Por la exclusión del propietario, ejecutar `node pruebas/correr.mjs --sin-tarjetas`
omite sus dos suites específicas y no las cuenta como aprobadas. Sin esa opción
se conserva la ejecución completa; con un filtro el total muestra solo lo que
se ejecutó. La compilación/lint generales no equivalen a auditar ese módulo.
