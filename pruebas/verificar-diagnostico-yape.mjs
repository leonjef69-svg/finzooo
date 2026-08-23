// El contador especial de Yape tiene que estar unido al mismo filtro que captura avisos.
// En 1.0.1 las claves y la pantalla existían, pero nadie las escribía: siempre decía
// "ninguno" aunque el servicio hubiera recibido el aviso.
import fs from "fs";
import path from "path";

const raiz = process.cwd();
const dir = path.join(
  raiz,
  "modules/notification-reader/android/src/main/java/com/finzo/notificationreader"
);
const listener = fs.readFileSync(path.join(dir, "FinzoNotificationListener.kt"), "utf8");
const store = fs.readFileSync(path.join(dir, "NotificationStore.kt"), "utf8");

let fallos = 0;
function ok(condicion, mensaje) {
  console.log(`  ${condicion ? "OK   " : "FALLA"} ${mensaje}`);
  if (!condicion) fallos++;
}

ok(
  listener.includes("val esAppDeDinero = isMoneyApp(pkg)"),
  "el filtro se calcula una sola vez"
);
ok(
  listener.includes("NotificationStore.noteSeen(applicationContext, pkg, esAppDeDinero)"),
  "el diagnóstico recibe el resultado del mismo filtro"
);
ok(
  listener.indexOf("NotificationStore.noteSeen(") < listener.indexOf("if (!esAppDeDinero) return"),
  "se anota el paquete antes de descartarlo"
);
ok(
  /fun noteSeen\(context: Context, pkg: String, esAppDeDinero: Boolean\)/.test(store),
  "el buzón recibe la marca de app de dinero"
);
ok(store.includes("putString(KEY_ULTIMAS, ultimas)"), "guarda las últimas apps observadas");
ok(store.includes("if (esAppDeDinero)"), "solo una app aceptada aumenta el contador especial");
ok(store.includes("putInt(KEY_MONEY_SEEN"), "aumenta el contador de Yape");
ok(store.includes("putString(KEY_LAST_MONEY_PKG"), "guarda el paquete de Yape");
ok(store.includes("putLong(KEY_LAST_MONEY_AT"), "guarda cuándo llegó el Yape");

if (fallos) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log("\nDiagnóstico de Yape conectado correctamente.");
