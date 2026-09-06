import { columnasFrecuenciaExportacion } from "@/utils/responsiveLayout";

let fallos = 0;
function ok(cumple: boolean, mensaje: string) {
  console.log(`  ${cumple ? "OK   " : "FALLA"} ${mensaje}`);
  if (!cumple) fallos++;
}

ok(columnasFrecuenciaExportacion(320, 1) === 2, "un celular pequeño usa 2 x 2");
ok(columnasFrecuenciaExportacion(390, 1) === 2, "un celular mediano no deja una opción sola");
ok(columnasFrecuenciaExportacion(600, 1) === 4, "una pantalla ancha aprovecha una sola fila");
ok(columnasFrecuenciaExportacion(600, 1.5) === 2, "la letra ampliada recupera espacio con 2 x 2");

console.log(fallos ? `\n${fallos} fallos\n` : "\nTodo bien: frecuencias ordenadas en cualquier pantalla\n");
process.exit(fallos ? 1 : 0);
