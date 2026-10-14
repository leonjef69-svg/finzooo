# Ajustes agrupados — 14/10/2026

Marca: `14oct-ajustes-ordenados`. Cambio de presentación aprobado por el
propietario; no modifica movimientos, cuentas, permisos ni servicios remotos.

## Diseño y recorrido

El encabezado ahora dice Ajustes, no Perfil. Pro permanece visible arriba,
con título de 21 y toda la tarjeta como acceso a la pantalla existente de
beneficios, tanto con Pro como sin Pro. No se añade una etiqueta Gratis.
El aviso real del respaldo conserva su condición Pro y su motivo de fallo;
no se oculta ni se transforma en una confirmación falsa de guardado.

Una tarjeta por sección, filas separadas y destinos directos:

1. Personaliza Fino: idioma, moneda, claro/oscuro y estilo visual.
2. Tus finanzas: presupuestos por categoría, metas, calendario y negocios.
3. Datos y respaldo: exportar, importar y exportación automática.
4. Registro y atajos: captura disponible por país, widget y ayuda de voz.
5. Cuenta y seguridad: correo discreto, bloqueo, contraseña si corresponde,
   cerrar sesión y eliminar cuenta como última acción diferenciada.
6. Información: datos de la app y legal.

Se retiran de Ajustes la tarjeta de foto/nombre y sus editores. Los valores
guardados no se borran. No se monta la pantalla vieja encima de la nueva.
Los destinos y las confirmaciones de cierre/eliminación no se cambian.
Telegram continúa en pausa; no se reactivan tarjetas de crédito.

Los iconos vectoriales son de 26, con fondo suave y detalle cálido; sin
imágenes nuevas, animaciones continuas ni dependencias nuevas. Los colores
usan la apariencia existente, con variantes clásicas y melocotón/oliva en
claro y oscuro. Filas de altura mínima 64, texto que puede crecer, márgenes
laterales de 16 y ancho máximo de 560; no se promete compatibilidad física
por comprobar únicamente estas reglas de diseño.

## Comprobaciones y límites

`verificar-ajustes-agrupados-real.mjs` ejecuta la pantalla y los componentes
originales con React/Android/callbacks adaptados. Comprueba grupos, título,
Pro legible, ausencia de editores, destinos, condiciones de moneda/widget,
contraseña de Google, etiquetas Pro y cuatro apariencias. No concede Pro,
no coloca widgets, no inicia sesión ni cambia datos reales.
Regresión contra `7276cdd`: falla por la lista anterior sin grupos, no por
una API inexistente. La versión actual aprueba.

TypeScript y ESLint completos aprobados; `node pruebas/correr.mjs
--sin-tarjetas` aprueba 214 pruebas y 8 auditores. Una suite local ajena no
versionada participa en ese conteo: 213 previstas en Git limpio; no se
ejecutó otro checkout.
En Android se comprobaron las secciones, el encabezado nuevo, la entrada
a Premium, idioma y moneda con regreso sin selección, y las cuatro
combinaciones de claro/oscuro y clásico/melocotón-oliva. Al terminar se
restableció la apariencia original clara de melocotón y oliva.
Cuenta de Google no muestra cambio de contraseña; no se pulsaron cerrar
sesión, eliminar cuenta, activar prueba ni instalar el widget.

Qué sigue/falta: comprobar pantalla pequeña, letra grande, TalkBack y un
teléfono físico. El rechazo remoto del respaldo sigue separado y pendiente
de autorización/decisión sobre los servicios de Firebase; este rediseño no
lo arregla. No hay APK/AAB/OTA/Play, publicación de reglas ni cambios nativos.
