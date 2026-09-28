import assert from "node:assert/strict";

import { probarAviso } from "@/utils/avisosDePagos";
import {
  resetNotificationStub,
  scheduledNotifications,
  setNotificationPermissions,
  setScheduleFailure,
} from "./stubs/notif";

const translate = (key: string) => ({
  "calendario.pruebaTitulo": "Aviso de prueba",
  "calendario.pruebaTexto": "Tus avisos están funcionando",
}[key] ?? key);

resetNotificationStub();
assert.equal(await probarAviso(translate), "listo");
assert.equal(scheduledNotifications.length, 1);
assert.equal(scheduledNotifications[0].content.title, "Aviso de prueba");
assert.equal(scheduledNotifications[0].content.body, "Tus avisos están funcionando");
assert.equal(scheduledNotifications[0].content.sound, "default");
assert.equal(scheduledNotifications[0].content.data.calendarioPagos, true);
assert.equal(scheduledNotifications[0].content.data.prueba, true);
assert.equal(scheduledNotifications[0].trigger.seconds, 3);

resetNotificationStub();
setNotificationPermissions(false, false);
assert.equal(await probarAviso(translate), "sin-permiso");
assert.equal(scheduledNotifications.length, 0);

resetNotificationStub();
setScheduleFailure("servicio detenido");
assert.equal(await probarAviso(translate), "error");
assert.equal(scheduledNotifications.length, 0);

console.log("Probar aviso: éxito a 3 segundos, permiso denegado y error verificados.");
