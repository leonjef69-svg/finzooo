# FINO-50 — resto de controles, refuerzo de código

09/10/2026. Preparado; no cambia diseño, estilos de pantalla, planes, dinero,
datos, permisos ni integraciones. Se amplía PRUEBAS_ACCESIBILIDAD_CONTROLES.md.

Botones de volver/cerrar/cancelar/guardar/borrar, meses, búsqueda, productos,
contactos, favoritos, zoom y colores reciben nombres y roles correctos.
Las acciones originales se mantienen; selección/deshabilitación se anuncia.
Solo se amplía prudentemente el área de ciertos iconos, sin cambiar su tamaño.

El catálogo tiene nombres del dibujo real en español/inglés/portugués y nombres
de marcas. Una foto propia no anuncia URI/base64, ni un identificador desconocido
expone su contenido. Las casillas siguen memorizadas; el selector de categoría
pasa una función que cambia únicamente con el idioma, no una suscripción al
contexto por cada casilla. Color/gris/gestos conservan su mecanismo anterior.

## Pruebas y límites

`node pruebas/verificar-accesibilidad-pantallas-real.mjs`:
- Extrae propiedades y acciones originales por AST; distingue editar/borrar
  contacto y producto, guardar presupuesto, favorito y pestañas.
- Ejecuta casilla original de icono/color con JSX/React Native adaptados.
- Comprueba cada nombre contra el catálogo original, idiomas y fotos privadas.
- Inventario AST de app/screens/components, excluidas tarjetas: ningún
  TouchableOpacity/Pressable de solo icono con onPress queda sin rótulo.
  Controles con texto hijo o accesibilidad desactivada no son prueba de rótulo
  correcto ni se consideran una auditoría completa de todo control nativo.
- Sin atributos JSX duplicados; TypeScript exige nuevos rótulos en todos los
  usos de recorte y casillas. Las tres pantallas de recorte pasan zoom traducido.

Regresión FINO_TEST_BASELINE=b6cccc0: roja por botón Guardar sin rótulo;
actual verde. No copia la lógica de las acciones. Inventario/nombres son
contratos estáticos; no prueban que Android anuncie foco, agrupación o glifos
correctamente, ni velocidad nativa, contraste o tamaños.

## Qué sigue y qué falta

Probar TalkBack/foco al abrir y cerrar hojas, letra grande, claro/oscuro,
orientación y pantallas pequeñas, botones próximos sin solapamiento, gestos
del catálogo y fotos favoritas distinguibles. Evaluar descripción humana de
fotos (no inferir su contenido ni enviarlas a un servicio sin autorización).
FINO-50 continúa parcial hasta esos recorridos. Tarjetas/Sentry externo fuera.
[Referencia RN 0.81](https://reactnative.dev/docs/0.81/accessibility).
