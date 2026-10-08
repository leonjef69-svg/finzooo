import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** No animar hasta conocer la preferencia; también respeta cambios en vivo. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !changed) setReduced(value);
    }).catch(() => { /* Ante la duda se conserva la opción sin movimiento. */ });
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}
