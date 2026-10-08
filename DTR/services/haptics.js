import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const native = Capacitor.isNativePlatform();

async function safe(fn, fallbackMs) {
  try {
    if (native) await fn();
    else if (navigator.vibrate) navigator.vibrate(fallbackMs);
  } catch (e) {
    console.warn("Haptics failed:", e);
  }
}

export const hapticTick = () =>
  safe(() => Haptics.impact({ style: ImpactStyle.Medium }), 20);

export const hapticSuccess = () =>
  safe(
    () => Haptics.notification({ type: NotificationType.Success }),
    [30, 40, 30],
  );

export const hapticError = () =>
  safe(
    () => Haptics.notification({ type: NotificationType.Error }),
    [60, 40, 60],
  );
