import Premium from "@/screens/Premium";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function PremiumRoute() {
  const { isPremium, setIsPremium, showToast, t } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return (
    <Premium
      onBack={safeBack}
      isPremium={isPremium}
      // MIENTRAS NO HAYA COBRO, esto es lo que hace "adquirir": activarlo. No se
      // finge un pago ni se pide una tarjeta, y la pantalla avisa con letra pequeña
      // de que el pago todavía no está disponible (premium.sinCobro).
      //
      // Es uno de los puntos que hay que resolver antes de publicar en Play Store:
      // vender algo que no se cobra es motivo de rechazo. Está en ESTADO.md.
      onUpgrade={() => {
        setIsPremium(true);
        // El aviso estaba escrito en español aquí a mano, así que en inglés y en
        // portugués salía en español.
        showToast(t("premium.activado"));
        safeBack();
      }}
    />
  );
}
