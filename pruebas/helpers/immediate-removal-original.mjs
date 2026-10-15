import { handlerOriginal } from "./handler-original.mjs";

// Solo presentación; las pruebas siguen ejecutando el manejador de la pantalla.
export const withImmediateRemoval = handlerOriginal("utils/immediateRemoval.ts", "withImmediateRemoval", {});
