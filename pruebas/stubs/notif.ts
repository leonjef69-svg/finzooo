// Sustituto de expo-notifications para poder probar con Node. Solo hace
// falta que exista: las funciones que se prueban son las de calendario, que
// no tocan avisos.
export const SchedulableTriggerInputTypes = { DATE: "date", TIME_INTERVAL: "timeInterval", DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export const scheduledNotifications: any[] = [];
export const cancelledNotificationIds: string[] = [];
let nextIdentifier = 1;

export function resetNotificationStub() {
  scheduledNotifications.splice(0);
  cancelledNotificationIds.splice(0);
  nextIdentifier = 1;
}

export function seedScheduledNotification(notification: any) {
  scheduledNotifications.push(notification);
}

export async function getAllScheduledNotificationsAsync() { return [...scheduledNotifications]; }
export async function cancelScheduledNotificationAsync(identifier: string) {
  cancelledNotificationIds.push(identifier);
  const index = scheduledNotifications.findIndex((notification) => notification.identifier === identifier);
  if (index >= 0) scheduledNotifications.splice(index, 1);
}
export async function requestPermissionsAsync() { return { status: "granted" }; }
export async function getPermissionsAsync() { return { status: "granted", granted: true }; }
export async function setNotificationChannelAsync() {}
export async function scheduleNotificationAsync(notification: any) {
  const identifier = `notification-${nextIdentifier++}`;
  scheduledNotifications.push({ identifier, ...notification });
  return identifier;
}
