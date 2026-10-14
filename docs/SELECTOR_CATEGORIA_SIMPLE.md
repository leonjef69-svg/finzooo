# Selector de categoría — 14/10/2026

Marca 14oct-selector-simple. Se retira únicamente el acceso
«Personalizar categorías» señalado por el propietario en el selector del
movimiento de Inicio. Nueva categoría permanece y ocupa todo el ancho;
elección de categorías, iconos, creación con foto opcional y cierre se
conservan. Se elimina el callback/import/icono que solo servían a ese
botón. No se borran categorías, personalizaciones, movimientos ni rutas
de compatibilidad; no se modifica Ajustes ni se activa Telegram.

La suite verificar-selector-categoria-simple-real ejecuta el componente
y su JSX original con React/Android/datos adaptados: no aparece Personalizar,
seleccionar conserva el ID, cerrar funciona y Nueva abre/guarda en la
misma hoja con gasto/ingreso. No crea categorías reales.
Regresión a6fa7a6 roja porque el botón todavía se dibujaba; actual verde.
Dos contratos históricos de acceso se ajustan al camino actual dentro de
la hoja; no se retiran comprobaciones de categoría/icono/duplicados/fotos.
TypeScript/ESLint y 217 pruebas/8 auditores verdes sin tarjetas (una suite
local ajena no versionada, 216 previstas Git limpio; no otro checkout).
La primera pasada detectó el contrato antiguo de acceso desde el movimiento;
se ajustó al selector actual y la repetición completa aprobó.

No cambia datos recogidos, permisos, servicios ni componentes nativos.
No requiere cambios de declaración en PLAYSTORE ni APK nuevo por este
cambio JavaScript. No se publica APK/AAB/OTA/Play ni Firebase.
Android se desconectó durante la recarga. Se reconectó el puente y se
volvió a abrir el cliente sin borrar datos. Confirmación visual final:
selector sin Personalizar, Nueva categoría a todo el ancho y su formulario
se abre/regresa correctamente. No se guardó una categoría ni movimiento.
Qué sigue/falta: teléfono físico, letra grande y TalkBack; respaldo remoto
pendiente por separado. No es cierre de la auditoría global.
