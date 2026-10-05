# Aportes consumidos: decisión, protección de saldos y límites

05/10/2026. Preparación local, no publicada. El propietario respondió:
"Considerarlos consumidos, sin exigir devolución".
Comprobación posterior de Node 22 y borrado real con SDK/HTTP/emuladores en
`PRUEBAS_NODE22_BORRADO_CUENTA.md`; la comprobación Android sigue pendiente.

## Regla aplicada

- Aporte S/100, gasto S/100: saldo S/0; permite cerrar/preparar borrado de
  espacio y no exige inventar una devolución. Personal conserva la salida S/100.
- Aporte S/100, gasto S/60 y devolución S/40: cierre con saldo S/0; Personal
  conserva salida S/100 e ingreso S/40. Consumido S/60; no queda una deuda S/60.
- Aporte S/100, gasto S/60: saldo S/40; no permite cerrar hasta resolverlo.
- Aporte individual gastado no se puede borrar ni reducir por debajo de la
  parte usada. "Cerrar consumido" no es "deshacer el gasto".
- No permite compensar un aporte de A mediante una devolución indebida a B.
  Los registros heredados sin responsable usan comprobación agregada compatible;
  datos no finitos, devoluciones inconsistentes o saldo negativo requieren revisión.

## Cómo se conserva el dinero

Los registros Personal mantienen ID, monto, salida, retorno y vínculos. Al
cerrar se añaden `internalTransferSettled` e `internalTransferConsumedAmount`:
no se crea ningún ingreso. Inicio e Historial distinguen consumido de devuelto.
El importe consumido se fija usando todas las devoluciones de ese destino,
no solo las del mes mostrado. La agrupación y validación evitan recorridos
cuadráticos para grandes listas de movimientos.

La conciliación de Familia y Caja privada solo retira una contraparte ausente
cuando pertenece a un espacio aún activo y hay una consulta confirmada o un
borrado explícito. Desaparecer de la lista por cierre no autoriza borrar su
salida/retorno de Personal, aunque los datos de destino lleguen antes que el
marcador Personal. Registros antiguos sin identificador de espacio se conservan
sin adivinar su dueño/destino; su conciliación manual sigue siendo posible.

Familia conserva índices de espacios cerrados, ocultos en la lista activa,
para permitir su eliminación/anónimización posterior con el flujo de cuenta.
Los índices que una versión anterior ya borró no se reconstruyeron aquí.

## Pruebas y alcance

Resultado: TypeScript y ESLint sin errores/advertencias, 128 pruebas locales y
8 auditores; 42 pruebas de Functions y 31 comprobaciones en Firestore emulado.
El conteo local incluye una prueba preexistente ajena que sigue sin registrar
en Git. Node instalado: 24.18; la comprobación específica con Node 22 sigue pendiente.

- `pruebas/verificar-aportes-consumidos.mjs` ejecuta módulos financieros reales,
  métodos de borrado/cierre de Caja privada y filtros reales de conciliación.
  Comprueba identidad de destino, saldos, gasto total/parcial, devolución en
  otro mes, par completo, no duplicación y cierre con 20.000 registros.
- Regresión: `FINO_TEST_BASELINE=1` falla contra la regla anterior que exigía
  devolver lo consumido. `FINO_TEST_BASELINE=local-delete` carga solo la pantalla
  anterior de Caja y falla porque todavía llamaba al servidor compartido.
- Functions: compara política de teléfono/servidor y verifica saldo disponible,
  devolución ajena, registros heredados y datos inválidos.
- Emulador Firestore: ejecuta las envolturas propias de `manageLinkedSpace` y
  `leaveLinkedSpace`, transacciones/SDK Admin reales en proyectos demo, cierre
  sin Pro y exclusión de extraños. El contexto de autenticación se sustituye;
  no son llamadas HTTP desplegadas ni verificación real de tokens de Auth.
- El SDK requiere promesas de su propio contexto JS; el banco de pruebas convierte
  la promesa del contexto aislado sin sustituir las transacciones de Firestore.
- No se montó toda la interfaz ni se ejecutó eliminación completa de una cuenta
  real. La conservación de índices está preparada, no es una migración de índices
  antiguos. No se modificó el modelo de deuda externa, cobros o tarjetas de crédito.

## Lo que sigue y falta

La excepción de devolución tras vencer Pro quedó preparada posteriormente en
`PRUEBAS_DEVOLUCION_SIN_PRO.md`, con validación administrativa e identificador
persistente. No abre movimientos comunes a Gratis. FINO-02 sigue sin declararse
resuelto en producción; las cuentas con saldo disponible no pueden cerrarse
hasta devolverlo y el recorrido físico completo sigue pendiente.

En el teléfono que cierra se guarda el marcador inmediatamente. En otro dispositivo
su presentación depende de recibir esa copia Personal; las protecciones de ausencia
evitan borrar el dinero mientras tanto, pero el rótulo puede seguir pendiente.
Falta comprobar reconexión, cambios de cuenta, retorno fuera del mes, cierre desde
otro dispositivo y eliminación completa en Android. No se migraron cierres antiguos.

Antes de una entrega: comprobar Node 22, funciones reales en entorno autorizado,
compatibilidad/transición de apps antiguas y publicar Functions/app coordinadamente.
La versión antigua conserva su preflight estricto; entregar solo Functions no cambia
su pantalla. No se compiló ni publicó APK/AAB, OTA, Firebase o política web.
