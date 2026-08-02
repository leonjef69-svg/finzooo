# Pruebas y auditores

```bash
node pruebas/correr.mjs
```

Desde la raíz del proyecto. Tarda unos segundos y sale **26 pruebas y 5
auditores**. Si algo falla, dice cuál y en qué.

Antes de publicar cualquier cosa, además:

```bash
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

---

## Qué comprueba cada cosa

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
| `bloqueo` / `senuelo` | El PIN, la huella y el modo señuelo |
| `archivo-entrante` | Compartir un estado de cuenta a Finzo |
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
