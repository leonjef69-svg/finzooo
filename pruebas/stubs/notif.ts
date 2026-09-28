// Sustituto de expo-notifications para poder probar con Node. Solo hace
// falta que exista: las funciones que se prueban son las de calendario, que
// no tocan avisos.
export const SchedulableTriggerInputTypes = { DATE: "date", TIME_INTERVAL: "timeInterval", DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export const scheduledNotifications: any[] = [];
export const cancelledNotificationIds: string[] = [];
let nextIdentifier = 1;
let permissionGranted = true;
let requestedPermissionGranted = true;
let scheduleFailure: string | null = null;
let scheduleDelayMs = 0;

export function resetNotificationStub() {
  scheduledNotifications.splice(0);
  cancelledNotificationIds.splice(0);
  nextIdentifier = 1;
  permissionGranted = true;
  requestedPermissionGranted = true;
  scheduleFailure = null;
  scheduleDelayMs = 0;
}

export function setNotificationPermissions(current: boolean, requested = current) {
  permissionGranted = current;
  requestedPermissionGranted = requested;
}

export function setScheduleFailure(message: string | null) {
  scheduleFailure = message;
}

export function setScheduleDelay(milliseconds: number) {
  scheduleDelayMs = Math.max(0, milliseconds);
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
export async function requestPermissionsAsync() {
  permissionGranted = requestedPermissionGranted;
  return { status: permissionGranted ? "granted" : "denied", granted: permissionGranted };
}
export async function getPermissionsAsync() {
  return { status: permissionGranted ? "granted" : "denied", granted: permissionGranted };
}
export async function setNotificationChannelAsync() {}
export async function scheduleNotificationAsync(notification: any) {
  if (scheduleDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, scheduleDelayMs));
  if (scheduleFailure) throw new Error(scheduleFailure);
  const identifier = `notification-${nextIdentifier++}`;
  scheduledNotifications.push({ identifier, ...notification });
  return identifier;
}
