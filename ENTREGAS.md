# Entregas de Fino

Resumen público de versiones. Los enlaces de artefactos, credenciales,
identificadores privados y datos de firma no se guardan en GitHub.

## Versión disponible en Google Play

| Fecha | Versión | Estado |
|---|---|---|
| 22/08/2026 | 1.0.1 | Disponible en la prueba cerrada |

## Próxima versión

| Fecha preparada | Versión | Marca visible | Estado |
|---|---|---|---|
| 23/08/2026 | 1.0.2 | `23ago-01` | Corrige el diagnóstico de avisos de Yape |

La versión disponible 1.0.1 incluye:

- Diagnóstico correcto del acceso con Google.
- Copia de seguridad y Modo Negocio corregidos.
- Mejoras de rendimiento, calendario, exportación y voz.
- Modo oscuro carbón.
- Compatibilidad con giro, pantallas grandes y borde a borde.
- Todos los cambios acumulados después del AAB 1.0.0.

La corrección 1.0.2 conecta el contador de avisos de Yape al lector nativo y
guarda los últimos nombres de paquetes observados. No guarda el contenido de
avisos ajenos.

Calidad comprobada:

- TypeScript aprobado.
- ESLint sin errores.
- 72 pruebas aprobadas.
- 7 auditores aprobados.

## Cómo reconocer una entrega

La marca de código se muestra dentro de Fino en:

**Ajustes → Acerca de**

La versión 1.0.2 debe mostrar `23ago-01`.

## Reglas de publicación

- Cada AAB nuevo debe aumentar su número interno de versión.
- El archivo firmado se genera únicamente en el entorno privado autorizado.
- Las llaves y contraseñas nunca se suben al repositorio.
- Los testers reciben la nueva versión como una actualización normal de Google Play.
- No es necesario desinstalar la aplicación para actualizarla.
- No compartir dos archivos instalables distintos al mismo tiempo.

## Próximo paso

Generar el AAB firmado 1.0.2, subirlo a la prueba cerrada y repetir una prueba
real de Yape.

El detalle funcional y los asuntos pendientes están en `ESTADO.md`.
