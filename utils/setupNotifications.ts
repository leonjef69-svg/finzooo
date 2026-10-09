import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { auth } from "@/utils/firebase";

type NotificationErrorKey = "setup.notificationsFailed" | "settings.noActiveSession" | null;
type SetupNotificationState = {
  notificationsEnabled: boolean;
  notificationBusy: boolean;
  notificationErrorKey: NotificationErrorKey;
};
const initialState: SetupNotificationState = {
  notificationsEnabled: false, notificationBusy: false, notificationErrorKey: null,
};

/** Una sesión conserva su clave: una respuesta atrasada nunca escribe para otra cuenta. */
export function createSetupNotificationController(
  accountUid: string | null,
  onChange: (state: SetupNotificationState) => void,
) {
  const accountUser = auth.currentUser;
  const key = accountUid ? `@fino/setup-notifications-enabled:${accountUid}` : null;
  let active = true;
  let revision = 0;
  let busy = false;
  let state = { ...initialState };

  function current() {
    return active && Boolean(key && accountUser && accountUser.uid === accountUid)
      && auth.currentUser === accountUser;
  }
  function publish(changes: Partial<SetupNotificationState>) {
    if (!current()) return;
    state = { ...state, ...changes };
    onChange(state);
  }
  async function refresh() {
    if (!current() || busy || !key) return;
    const request = ++revision;
    try {
      const [choice, permission] = await Promise.all([
        AsyncStorage.getItem(key), Notifications.getPermissionsAsync(),
      ]);
      if (!current() || request !== revision || busy) return;
      const enabled = (choice === "true" || choice === "pending") && permission.granted;
      if (enabled && choice !== "true") {
        await AsyncStorage.setItem(key, "true");
        if (!current() || request !== revision || busy) return;
      }
      publish({ notificationsEnabled: enabled, notificationErrorKey: null });
    } catch {
      if (current() && request === revision && !busy) {
        publish({ notificationsEnabled: false, notificationErrorKey: "setup.notificationsFailed" });
      }
    }
  }
  async function enableNotifications() {
    if (!current() || busy || !key) return;
    busy = true;
    ++revision;
    publish({ notificationBusy: true, notificationErrorKey: null });
    let opened = false;
    try {
      if (!state.notificationsEnabled) {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Avisos de Fino", importance: Notifications.AndroidImportance.DEFAULT,
          });
          if (!current()) return;
        }
        await AsyncStorage.setItem(key, "pending");
        if (!current()) return;
      }
      await Linking.openSettings();
      if (!current()) return;
      opened = true;
    } catch {
      publish({ notificationErrorKey: "setup.notificationsFailed" });
    } finally {
      busy = false;
      publish({ notificationBusy: false });
      // Android puede devolver "active" antes de resolver openSettings.
      if (opened && current()) void refresh();
    }
  }
  function dispose() { active = false; ++revision; }
  return { accountUid, accountUser, refresh, enableNotifications, dispose };
}

/** Solo consulta permisos o abre Ajustes por toque; no solicita permiso automáticamente. */
export function useSetupNotifications(accountUid: string | null) {
  const accountUser = auth.currentUser;
  const controller = useRef<ReturnType<typeof createSetupNotificationController> | null>(null);
  const [snapshot, setSnapshot] = useState({ accountUid, accountUser, ...initialState });

  useEffect(() => {
    setSnapshot({ accountUid, accountUser, ...initialState });
    const session = createSetupNotificationController(accountUid, (state) => {
      setSnapshot({ accountUid, accountUser, ...state });
    });
    controller.current = session;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void session.refresh();
    });
    void session.refresh();
    return () => {
      session.dispose();
      subscription.remove();
      if (controller.current === session) controller.current = null;
    };
  }, [accountUid, accountUser]);

  const sameAccount = Boolean(accountUid && accountUser?.uid === accountUid
    && snapshot.accountUid === accountUid && snapshot.accountUser === accountUser);
  async function enableNotifications() {
    const session = controller.current;
    if (!session || session.accountUid !== accountUid || session.accountUser !== accountUser) return;
    await session.enableNotifications();
  }
  return {
    notificationsEnabled: sameAccount && snapshot.notificationsEnabled,
    notificationBusy: sameAccount && snapshot.notificationBusy,
    notificationErrorKey: !accountUid || accountUser?.uid !== accountUid
      ? "settings.noActiveSession" as const : sameAccount ? snapshot.notificationErrorKey : null,
    enableNotifications,
  };
}
