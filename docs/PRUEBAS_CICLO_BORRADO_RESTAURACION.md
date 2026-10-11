# Borrado, recuperación y aportes entre copias — 10/10/2026

Punto 1 de preparación, código y pruebas locales TERMINADO; no entrega ni
cierre integral. FINO-52 sigue abierto
por compatibilidad, copias antiguas ambiguas, Android y activación. FINO-62
añade la pérdida de aportes simultáneos a una meta. Los 61 IDs originales
permanecen en AUDITORIA_CIERRE_61.md. Telegram está en pausa; tarjetas
excluidas, Sentry externo apartado y rediseño diferido.
Nueva orden del propietario: terminar SOLO el punto 1 y parar. Las pruebas
Android (2) y servicios/consolas/activación (3) se conservan como pendientes,
sin iniciarlos ni declarar terminada toda la auditoría.

## Qué protege el código preparado

- El número de un movimiento no prueba su origen. Quitar una referencia de
  captura/aporte tampoco permite reemplazarlo. La edición intencional conserva
  esas referencias aunque el formulario no las vuelva a enviar.
- Registros antiguos distintos sin prueba de edición no se eligen por fecha.
  La huella de su original se añade al editar expresamente, no al abrir la
  copia ni al unir automáticamente dos historiales.
- Cada borrado y recuperación conocidos conservan el origen y la generación
  anterior. Un borrado viejo, incluso con reloj adelantado, no borra una
  recuperación posterior. Las ramas incompatibles y las marcas numéricas
  ambiguas detienen la unión conservando las fuentes; no se renumeran saldos.
- Movimientos, marcas y metadatos se guardan conjuntamente antes de anunciar
  un borrado. También se reservan las metas y las parejas de dinero de Cajas;
  un fallo de disco o cambio de cuenta no debe publicar solo la mitad.
- Detalle de movimiento/meta y cierre de Familia/Caja esperan el ACK local
  antes de salir/ocultar ficha/anunciar éxito. Un fallo local conserva la ficha;
  reintentar no repite un cierre RPC ya confirmado. Un rechazo remoto anterior
  al ACK retira su pendiente para permitir lectura fresca y observar después
  un cierre externo real; no pierde una confirmación genuina previa del lote.
- El migrador administrativo vuelve a leer cada fila dentro de su transacción
  y comprueba la cobertura final antes de retirar la lista antigua. No se
  ejecutó una migración real; los ensayos usan datos inventados locales.
- Aportes distintos a una meta se suman por operación y los reenvíos no se
  cuentan dos veces. Dos retiros que dejarían saldo negativo provocan conflicto,
  no saldo inventado ni elección silenciosa de un retiro.
- El cambio de referencia de una Caja privada a compartida requiere el recibo
  administrativo, dueño, moneda y pareja exactos; no una autorización general
  para cambiar enlaces. El exceso de expresiones que rechazaba una conversión
  válida se corrigió en la comprobación enfocada; siguen comprobándose SHA,
  recibo/tuplas y escape de referencias. Comprobación enfocada 7/7 y repetición
  integral final 229/229 aprobadas; no se extrapola cobertura Android/producción.

## Evidencia y límites

Fuentes originales: recordOrigin, recordMerge, goalFunding, manejadores del
contexto, importador, codec y planificador del historial, migrador Node,
almacenamiento/cola/reserva y reglas. Los adaptadores sustituyen React, sesión,
puente Android y servicios; no duplican sus algoritmos.

- verificar-lote-borrado-real usa almacenamiento/cifrado originales y SQLite
  real local: rollback, confirmación perdida, reinicio, cambio A→B→A,
  edición tardía y fallo de comprobación. No es Keystore ni un proceso Android.
- verificar-ciclo-borrado-restauracion-real, verificar-borrados-ambiguos-real y
  verificar-origen-legado-real comprueban cadena, referencias ausentes,
  edición explícita y conservación de fuentes.
- verificar-aportes-metas-real ejecuta los manejadores originales de aportar,
  retirar y editar; no acredita una pantalla renderizada.
- verificar-espera-borrados-cierres-real ejecuta callbacks de cuatro pantallas,
  listeners y acciones originales con IO/React adaptados: false/error/ACK
  pendiente, reintento, rechazo remoto anterior al cierre, lotes parcialmente
  confirmados, cambio de sesión/desmontaje y doble toque. No renderiza Android.
- Diagnóstico FINO-52: siete casos conservados, ahora se detienen por conflicto
  con fuentes intactas. Esto no recupera información perdida anteriormente.
- Diagnóstico FINO-62: dos copias aportan 10 y 20; ambas órdenes producen 30.
- SDK Firestore local comprueba borrado→recuperación→borrado→recuperación,
  aportes y carreras administrativas con el protocolo de la app y reglas.
  Auth/HTTP también son emulados; no se conectan a las cuentas reales.

Regresiones c6959c6: aporte final 10 o 20 en lugar de 30; borrado publicado
en memoria cuando falla el disco; reparación que restaura una marca numérica
sin prueba; carrera administrativa que termina en 10 en lugar de 30; quitar
captureId no provoca conflicto y permite sustituir el original. Son fallos
de comportamiento, no comprobaciones de que una función nueva no existía.
verificar-espera-borrados-cierres-real también es verde actual/roja c6959c6:
antes podía anunciar/salir del cierre o borrado sin confirmación local.
Los comandos de regresión devuelven error intencionalmente.

Resultados finales contra el código final, exit0:

- .tmp/auditoria-punto1-app-final3.log: 194 pruebas y 8 auditores sin tarjetas.
  Incluye UNA prueba del usuario no seguida: 193 previstas en Git limpio,
  sin haber ejecutado otro checkout. No se acredita integración Telegram.
- .tmp/auditoria-punto1-sdk-final.log: 229/229 SDK/HTTP/reglas locales,
  sin fallos, omisiones ni cancelaciones. Incluye escritor formato 2 con sello
  fresco obligatorio sobre raíz antigua; no solo el candidato de conversión.
- .tmp/auditoria-punto1-unit-final.log: 64/64 Node 22 seleccionadas fuera de
  Telegram/tarjetas. TypeScript/ESLint generales finales aprobados; también
  lint de las cuatro fuentes de pruebas revisadas, sin avisos.
- Comprobación enfocada: 7/7 de conversión válida/inválida, ciclos y null,
  sin retirar SHA, recibo, tuplas ni comprobantes para evitar el límite.

Antecedentes fallidos conservados: el primer SDK candidato acabó 223/225;
el siguiente, 226/227, rechazaba una conversión legítima por exceso de
expresiones de reglas. La app final2 todavía fallaba verificar-historial-separado.
Se corrigió y repitió contra el código final, sin quitar esos casos para
mostrar verde. Las pasadas de 193 pruebas app y unitarias anteriores son
históricas, no se suman al resultado final.

Límite adicional: algunos casos negativos de Caja esperan permission-denied;
el rechazo en L878 no acredita por sí solo su motivo concreto de cuota u otro
control. No es un fallo de la conversión positiva final ni cambia el 229/229,
pero falta aislar esos motivos/amplitud de antiabuso/costos en el punto 3.

## Privacidad y compatibilidad antes de activar

Las claves del diario contienen huellas de referencias, pero recordIdentity
de filas borradas retiene referencias originales para validar recuperación.
El captureId histórico de respaldo puede incluir título/texto del aviso:
no afirmar que todas esas filas guardan únicamente hashes o datos técnicos.
Hay que comprobar minimización, acceso, finalidad y conservación junto a la
política y eliminación de cuenta antes de publicar.

recordIdentityFormat=2 y los sellos nuevos bloquean ciertos reemplazos
antiguos; no certifican una APK ni impiden todos los lectores viejos.
El escritor de Telegram permanece pendiente y en pausa; no activar un
protocolo incompatible con él. Las copias antiguas ambiguas no tienen
información suficiente para reparación automática. No migrarlas adivinando.
El diario y las operaciones crecen; falta medir tamaño/lecturas y planificar
compactación con confirmación de todos los escritores, no recorte arbitrario.

## Qué sigue y qué falta

1. Preparación/código/pruebas locales del punto 1 TERMINADOS. Trabajo detenido
   conforme a la nueva orden, esperando instrucción para retomar. Guardar en
   Git solo el trabajo verificado, sin activar nada; no equivale a
   cierre global de FINO-52/62 ni de los 61 hallazgos originales.
2. Android con datos de prueba y dos equipos: interrupciones, retorno entre
   cuentas, guardado/cifrado nativo, recuperación, avisos, acceso y resto de
   recorridos del índice. El 10/10 ADB no tenía dispositivo conectado.
3. Activación coordinada y comprobación de reglas/funciones publicadas,
   versiones antiguas, límites/App Check, SMTP/moderación, cobros, web y Play.
   Requieren autoridad/acceso del propietario; no se ejecutaron por Git.
   Los puntos 2/3 quedan pendientes por la orden de parar después del 1.
