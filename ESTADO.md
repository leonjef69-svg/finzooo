# Estado actual de Fino

Actualizado: **22 de agosto de 2026**.

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

La prueba cerrada tiene actualmente el AAB **1.0.0**, `versionCode 1`.
Ese AAB es anterior a varias mejoras recientes.

La siguiente entrega ya está preparada en el código:

- Versión: **1.0.1**.
- `versionCode`: **2**.
- Marca visible: **22ago-02**.
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

La corrección todavía no está en el AAB 1.0.0 de Play. Llegará con el AAB 1.0.1.

## Cambios recientes ya incluidos en 1.0.1

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
- Existe diagnóstico separado para avisos de aplicaciones de dinero.
- Falta probar en un teléfono real si los avisos de Yape llegan al servicio en
  todos los modelos y configuraciones de batería.
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
- Generar y subir el AAB 1.0.1.
- Actualizar la app de los testers desde Google Play.
- Añadir datos de ejemplo a la cuenta preparada para la revisión, sin publicar
  sus credenciales en GitHub.
- Enviar la versión cuando Play Console habilite el siguiente paso.

Agregar un correo a la lista no cuenta como aceptación. Cada tester debe abrir el
enlace de invitación, aceptar y descargar la app con la misma cuenta de Google.

## Estado de calidad

Última comprobación completa:

- TypeScript: aprobado.
- ESLint: sin errores; quedan advertencias antiguas no bloqueantes.
- Pruebas: **71 aprobadas**.
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

Subir estos cambios al repositorio oficial, actualizar la copia local autorizada,
generar el AAB firmado 1.0.1 y subirlo a la prueba cerrada. Después, los testers
solo tendrán que pulsar **Actualizar** en Google Play.
