import Premium from "@/screens/Premium";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function PremiumRoute() {
  const { isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  // AQUÍ ESTABA EL "onUpgrade" QUE REGALABA PREMIUM, Y SE QUITÓ (07/08/2026).
  //
  // Hacía `setIsPremium(true)`: un botón de compra, sobre un precio, sin cobro detrás.
  // Google lo trata como afirmación engañosa y era el bloqueo número uno para publicar.
  //
  // No se ha puesto un cobro de verdad porque no se puede terminar todavía: hace falta la
  // cuenta de Play Console, la app subida a una prueba y los productos creados allí. Hasta
  // entonces ni una línea de ese cobro se podría probar.
  //
  // Lo que sí queda es la prueba de 24 horas, que es la forma honesta de que alguien vea las
  // funciones. Decisión del usuario el 07/08/2026: *"al app de premium tendrá una prueba de
  // 24 horas que finaliza luego de eso para que puedan probar las funciones que tiene"*.
  return <Premium onBack={safeBack} isPremium={isPremium} />;
}
