# Migración segura del respaldo Personal

Estado: preparación local. **Nada de este formato está activado en Firebase ni en la app.**

## Por qué no basta con mover la lista

Hoy `users/{uid}` guarda todos los movimientos. La app, Telegram y los teléfonos
antiguos leen y escriben esa misma lista. Quitarla antes de actualizar los tres
haría que una versión anterior mostrara un historial incompleto o sobrescribiera
el nuevo. Las subcolecciones tampoco se eliminan al borrar su documento padre.

## Invariantes antes de activar

1. El documento antiguo conserva todo el historial hasta comprobar que la copia
   nueva contiene cada movimiento y cada borrado. Un fallo a mitad de camino se
   reintenta; nunca se interpreta como una cuenta vacía.
2. Los identificadores permanecen iguales. El borrado gana frente a una copia
   vieja del movimiento; entre dos ediciones gana la más reciente y un empate
   con distinto contenido exige revisión, no un corte silencioso.
3. Los teléfonos con versión antigua no pueden sobrescribir el formato nuevo.
   Antes del corte habrá que exigirles actualizar, con un aviso comprensible;
   dejarlos escribir un respaldo parcial sería peor que mostrar un error.
4. La app y Telegram deben leer/escribir el mismo formato desde el momento del
   corte, incluidos transferencias, correcciones, deshacer y resúmenes.
5. Borrar la cuenta también borra todos los documentos del historial nuevo.

## Orden de entrega

1. Completar el lector y escritor del historial separado, reglas de acceso,
   funciones de Telegram y borrado de cuenta. Probarlos en un emulador de
   Firebase con dos cuentas y dos teléfonos simulados.
2. Publicar primero el servidor compatible con ambos formatos, pero sin iniciar
   migraciones. Esto requiere aviso y aprobación del propietario.
3. Entregar la app nueva y comprobar respaldo/restauración sin cambiar todavía
   el formato de las cuentas existentes.
4. Migrar una cuenta de prueba: copiar en lotes, verificar el contenido, bloquear
   escrituras antiguas y solo entonces cambiar el marcador de formato y retirar
   la lista del documento principal. Si el proceso se interrumpe, reanudar desde
   los documentos ya copiados; no borrar el origen prematuramente.
5. Repetir con volúmenes de 10.000 o más movimientos y observar lecturas, tiempo
   de apertura y costos antes de habilitarlo a todos.

## Pruebas obligatorias para darlo por terminado

- Alta, edición y borrado simultáneos en dos teléfonos; una eliminación no revive.
- Migración interrumpida después de cualquier lote y reinicio sin pérdida.
- Teléfono antiguo intentando escribir tras el corte: rechazo claro, no borrado.
- Telegram: alta, corrección, transferencia, deshacer y resúmenes tras el corte.
- Inicio de sesión en teléfono nuevo, exportación, cierre de sesión y borrado de
  cuenta con 10.000 movimientos.
- Error de reglas, falta de red y documento individual demasiado grande.

`utils/cloudHistoryMigration.ts` prepara y verifica lotes sin tocar Firebase.
También prueba una copia sombra reanudable: si falla un lote, el documento viejo
queda intacto; si otro teléfono lo cambia durante la copia, no se permite el
corte y se repite con la versión nueva. El futuro adaptador de Firestore deberá
fusionar cada lote de manera atómica, no sobrescribirlo a ciegas.
La verificación entrega la revisión del documento original; el corte final
deberá comprobar esa misma revisión dentro de una transacción. Sin esa última
comparación, otro teléfono podría escribir entre la verificación y el corte.
No debe conectarse al respaldo real hasta completar los pasos anteriores.

## Protección previa añadida

La app actual rechaza leer o guardar un documento `users/{uid}` que indique
`historyFormat` distinto de 1. Las reglas locales también rechazan que una
versión antigua escriba sobre una cuenta ya marcada con el formato nuevo.
Esto **no activa** el formato nuevo: faltan el lector/escritor, Telegram y el
borrado completo de la subcolección. El cambio de reglas tampoco está
publicado. Al activar v2, la regla de escritura tendrá que permitir el nuevo
protocolo sin abrir de nuevo la posibilidad de sobrescribirlo con v1.
