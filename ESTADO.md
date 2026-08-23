# Estado actual de Fino

Actualizado: **23 de agosto de 2026**.

Este archivo es el resumen público para retomar el proyecto sin empezar de cero.
No contiene correos, identificadores de usuarios, credenciales, huellas completas,
rutas privadas ni datos de testers.

## Qué es Fino

Fino es una aplicación Android de presupuesto personal, gastos e ingresos.
Está pensada para Perú, pero admite distintas monedas y países.

Tecnología principal:

- React Native con Expo SDK 54.
- Expo Router.
- TypeScript estricto.
- NativeWind.
- Firebase Authentication y Firestore.
- Módulos Android propios para notificaciones, voz, exportación y lectura de archivos.

Paquete de Android: `com.finoapp.gastos`.

## Versión que está en Google Play

La prueba cerrada tiene actualmente el AAB **1.0.1**, `versionCode 2`.
Fue publicado para testers el 22 de agosto de 2026.

La siguiente corrección está preparada en el código:

- Versión: **1.0.2**.
- `versionCode`: **3**.
- Marca visible: **23ago-01**.
- Estado: pendiente de generar el AAB firmado y subirlo a la misma prueba cerrada.

La llave privada de firma no vive en el repositorio. El AAB debe generarse en la
computadora autorizada del propietario.

## Último problema: acceso con Google

Un tester nuevo eligió “Continuar con Google”, pero su cuenta no se creó. Fino
mostró el mensaje genérico debajo de Contraseña, aunque Google no usa ese campo.

La configuración fue revisada:

- El proveedor Google está habilitado.
- La aplicación OAuth acepta usuarios externos.
- Las firmas necesarias de Android están registradas.
- No existe una lista que limite quién puede crear una cuenta.

El código quedó corregido:

- El error de Google aparece debajo del botón de Google.
- Ya no culpa a la contraseña.
- Distingue instalación, Internet, Servicios de Google Play, intentos simultáneos
  y errores de Firebase.
- Cancelar el selector no muestra un error falso.
- La operación espera a que el acceso termine correctamente.
- Existe la prueba `verificar-acceso-google` para evitar que regrese el problema.

La corrección está incluida en el AAB 1.0.1 disponible para testers.

## Cambios recientes incluidos en 1.0.1

- Copia de seguridad de Firestore corregida para todos los campos actuales.
- Respaldo del Modo Negocio corregido.
- Estado visible cuando la copia de seguridad falla.
- Modo oscuro carbón: fondo y tarjetas vuelven a distinguirse.
- Método de pago visible en Inicio e Historial.
- Exportación con nombre automático o personalizado.
- Calendario con ingresos, colores por tipo y varios pagos por día.
- Menos redibujados innecesarios y lista virtualizada en Historial.
- Voz elegida por calidad y motor reutilizado para probarla sin demora.
- Navegación protegida contra dobles toques.
- Diseño preparado para giro, pantalla dividida y pantallas grandes.
- Vista de borde a borde de Android actualizada.
- Teclado horizontal configurado para no cubrir toda la aplicación.

## Registro automático

Fino puede detectar avisos de Yape mediante el acceso de notificaciones de
Android y registrar movimientos sin abrir la app.

Estado actual:

- El servicio puede conectarse y contar avisos.
- La prueba real confirmó que el servicio recibe otros avisos, pero el contador
  especial de Yape de 1.0.1 siempre mostraba “ninguno” porque no estaba conectado
  al lector nativo.
- La versión 1.0.2 conecta ese contador al mismo filtro que usa la captura y guarda
  las últimas aplicaciones observadas, sin guardar el contenido de sus avisos.
- Existe una prueba automática que comprueba esa unión para que no vuelva a quedar
  una pantalla de diagnóstico desconectada.
- Solo deben guardarse pagos reales; publicidad y otros avisos se descartan.

Los correos y avisos de bancos diferentes no deben incorporarse sin diseñar
primero permisos, privacidad, compatibilidad y prevención de duplicados.

## Funciones principales

Plan gratuito:

- Gastos e ingresos ilimitados.
- Presupuesto mensual y saldo anterior.
- Inicio, historial, búsqueda y reportes básicos.
- Sincronización de cuenta.
- Tema claro y oscuro.

Funciones Premium preparadas:

- Consejos y panorama financiero.
- Presupuestos por categoría.
- Importación y exportación.
- Exportación automática.
- Modo Negocio.
- Registro automático.
- Dictado por voz.
- Bloqueo biométrico o PIN.
- Metas de ahorro.

El cobro de Premium todavía no está habilitado. La app ofrece una prueba local
de 24 horas para comprobar las funciones.

## Google Play: qué falta

- Conseguir al menos 12 testers que acepten la prueba cerrada.
- Mantenerlos en la prueba durante el periodo exigido por Google.
- Generar y subir el AAB 1.0.2 para terminar el diagnóstico real de Yape.
- Actualizar la app de los testers desde Google Play cuando se publique.
- Añadir datos de ejemplo a la cuenta preparada para la revisión, sin publicar
  sus credenciales en GitHub.
- Enviar la versión cuando Play Console habilite el siguiente paso.

Agregar un correo a la lista no cuenta como aceptación. Cada tester debe abrir el
enlace de invitación, aceptar y descargar la app con la misma cuenta de Google.

## Estado de calidad

Última comprobación completa:

- TypeScript: aprobado.
- ESLint: sin errores; quedan advertencias antiguas no bloqueantes.
- Pruebas: **72 aprobadas**.
- Auditores: **7 aprobados**.

Comando principal:

```bash
node pruebas/correr.mjs
```

Antes de publicar también se ejecutan TypeScript y ESLint, como indica
`AGENTS.md`.

## Reglas para continuar

1. Leer primero `AGENTS.md`, este archivo y `ENTREGAS.md`.
2. No publicar credenciales, correos, UID, llaves ni rutas privadas.
3. No cambiar el paquete `com.finoapp.gastos`.
4. Aumentar `versionCode` en cada AAB nuevo.
5. Aumentar `CODE_MARKER` en cada entrega para reconocer qué código está abierto.
6. Ejecutar todas las pruebas antes de publicar.
7. Crear commit y push después de cada cambio terminado.
8. Entregar un solo archivo instalable a la vez para evitar confusiones.

## Próximo paso exacto

Publicar la corrección 1.0.2 y repetir un Yape real. La pantalla deberá indicar
si Android entregó el aviso de Yape; con ese dato se sabrá si falta reconocer el
texto o si el aviso nunca llegó al lector.
