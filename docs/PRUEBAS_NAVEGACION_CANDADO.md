# Comprobación real de navegación y candado

Estos casos sustituyen cuatro simulaciones antiguas que no ejecutaban la app.
Hacerlos en una instalación de prueba de Android, con una cuenta y un archivo
de prueba sin datos personales. Anotar modelo, versión de Android, versión de
Fino y resultado de cada caso. No usar Firebase de producción.

1. **Arranque con candado.** Activar PIN, cerrar por completo Fino y abrirla.
   No debe verse saldo, historial ni otra pantalla privada antes del PIN.
   Introducir un PIN incorrecto y luego el correcto: el primero no abre la app;
   el segundo sí.
2. **Volver cuando ya está bloqueada.** Dejar Fino en la pantalla del PIN,
   mandarla al fondo y volver en menos de dos minutos. Debe seguir pidiendo
   PIN; el margen de regreso no puede desbloquear una app que ya estaba
   bloqueada.
3. **Abrir un archivo con Fino cerrada.** Desde otra app, compartir un CSV o
   estado de cuenta de prueba hacia Fino. Si hay PIN, desbloquear. Debe abrir
   Importar con ese mismo archivo una sola vez, sin llevar a Inicio antes de
   tiempo ni perder el archivo.
4. **Abrir un archivo con Fino en segundo plano.** Dejar Fino abierta, cambiar
   a otra app y compartir un segundo archivo de prueba. Al volver, debe abrir
   Importar con el archivo nuevo. Repetir con el candado activo y tardar más
   de dos minutos en poner el PIN: el archivo debe seguir disponible.
5. **Dos acciones cercanas.** Compartir un archivo y volver a tocar Fino varias
   veces mientras abre. Debe quedar una sola pantalla de Importar; no dos
   copias del movimiento ni rutas que se anulen entre sí.
6. **Archivo antiguo o ausente.** Si el archivo compartido ya no existe al
   intentar importarlo, mostrar un error claro. No abrir otro archivo ni borrar
   datos internos de Fino.

Estos pasos no sustituyen la prueba automática de que una lectura fallida de
SecureStore deja el candado cerrado. Esa regresión está en
`pruebas/verificar-exportacion-segura.mjs`; la falla nativa real requiere un
dispositivo preparado para provocarla de forma segura.
