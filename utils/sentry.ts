// Sentry queda fuera de uso por decisión del propietario (07/10/2026).
// Conservamos estas dos llamadas para las tareas de fondo y la raíz de la
// app, sin cargar el SDK, iniciar diagnósticos ni enviar errores a esa cuenta.
// Una futura reactivación requiere recuperar acceso y volver a comprobarla.
export const Sentry = {
  captureException(_error: unknown): void {},
  wrap<T>(component: T): T {
    return component;
  },
};
