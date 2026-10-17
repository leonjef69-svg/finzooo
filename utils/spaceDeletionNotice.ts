import { isLinkedSpaceReturn, isLinkedSpaceTransfer, type LinkedSpaceMovement } from "@/utils/linkedTransfers";

/** Quitar un recibo de Personal no es anular dinero en el espacio compartido. */
export function spaceDeletionNotice(items: LinkedSpaceMovement[], t: (key: string, values?: Record<string, string | number>) => string, format: (amount: number) => string) {
  const linked = items.some(isLinkedSpaceTransfer);
  const onlyReturns = items.length > 0 && items.every(isLinkedSpaceReturn);
  return {
    title: t(linked ? "spaces.cancelTransferTitle" : "spaces.deleteMovementsTitle"),
    action: t(linked ? "spaces.cancelTransfer" : "common.delete"),
    message: onlyReturns ? t("spaces.cancelReturnBody", { amount: format(items.reduce((sum, item) => sum + item.monto, 0)) })
      : t(linked ? "spaces.cancelLinkedBody" : "spaces.deleteMovementsMessage", { count: items.length }),
  };
}
