# Entregas de Fino

Resumen público de versiones. Los enlaces de artefactos, credenciales,
identificadores privados y datos de firma no se guardan en GitHub.

## Versión disponible en Google Play

| Fecha | Versión | Estado |
|---|---|---|
| 13/08/2026 | 1.0.0 | Disponible en la prueba cerrada |

Esta versión es anterior a varios cambios recientes.

## Próxima versión

| Fecha preparada | Versión | Marca visible | Estado |
|---|---|---|---|
| 22/08/2026 | 1.0.1 | `22ago-02` | Código aprobado; falta generar y subir el AAB firmado |

Incluye:

- Diagnóstico correcto del acceso con Google.
- Copia de seguridad y Modo Negocio corregidos.
- Mejoras de rendimiento, calendario, exportación y voz.
- Modo oscuro carbón.
- Compatibilidad con giro, pantallas grandes y borde a borde.
- Todos los cambios acumulados después del AAB 1.0.0.

Calidad comprobada:

- TypeScript aprobado.
- ESLint sin errores.
- 71 pruebas aprobadas.
- 7 auditores aprobados.

## Cómo reconocer una entrega

La marca de código se muestra dentro de Fino en:

**Ajustes → Acerca de**

La versión 1.0.1 debe mostrar `22ago-02`.

## Reglas de publicación

- Cada AAB nuevo debe aumentar su número interno de versión.
- El archivo firmado se genera únicamente en el entorno privado autorizado.
- Las llaves y contraseñas nunca se suben al repositorio.
- Los testers reciben la nueva versión como una actualización normal de Google Play.
- No es necesario desinstalar la aplicación para actualizarla.
- No compartir dos archivos instalables distintos al mismo tiempo.

## Próximo paso

Generar el AAB firmado 1.0.1, subirlo a la prueba cerrada y pedir a los testers
que pulsen **Actualizar** en Google Play.

El detalle funcional y los asuntos pendientes están en `ESTADO.md`.
