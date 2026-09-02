// Sustituto de expo-notifications para poder probar con Node. Solo hace
// falta que exista: las funciones que se prueban son las de calendario, que
// no tocan avisos.
export const SchedulableTriggerInputTypes = { DATE: "date", DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export async function getAllScheduledNotificationsAsync() { return []; }
export async function cancelScheduledNotificationAsync() {}
export async function requestPermissionsAsync() { return { status: "granted" }; }
export async function getPermissionsAsync() { return { status: "granted", granted: true }; }
export async function setNotificationChannelAsync() {}
export async function scheduleNotificationAsync() {}
