import notifee, {AndroidImportance, AuthorizationStatus, EventType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {INITIAL_MONITOR, sanitize, type MonitorState, type Side} from './monitor';

export const CHANNEL_ID = 'soundbar-battery';
const STATE_KEY = 'jbl-bar-access/battery-monitor/v1';

export async function ensureChannel() {
  await notifee.createChannel({id: CHANNEL_ID, name: 'Soundbar battery', importance: AndroidImportance.DEFAULT});
}

export type PermissionStatus = 'granted' | 'denied' | 'not-asked';

export async function permissionStatus(): Promise<PermissionStatus> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ? 'granted' : settings.authorizationStatus === AuthorizationStatus.DENIED ? 'denied' : 'not-asked';
}

// Android 13+ runtime permission (POST_NOTIFICATIONS).
export async function requestPermission(): Promise<PermissionStatus> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ? 'granted' : 'denied';
}

export async function showLowBattery(side: Side, percent: number, test = false) {
  await ensureChannel();
  const name = side === 'left' ? 'Left' : 'Right';
  await notifee.displayNotification({
    id: test ? 'battery-test' : 'battery-' + side,
    title: test ? 'Test: rear speaker battery low' : name + ' rear speaker battery low',
    body: name + ' rear speaker is at ' + percent + '%. Dock the rear speakers on the bar to charge them.',
    data: {target: 'sound'},
    android: {channelId: CHANNEL_ID, smallIcon: 'ic_notification', pressAction: {id: 'default', launchActivity: 'default'}},
  });
}

export async function loadMonitor(): Promise<MonitorState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : INITIAL_MONITOR;
  } catch {
    return INITIAL_MONITOR;
  }
}

export async function saveMonitor(state: MonitorState) {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Losing the arm state can only cause one repeated alert.
  }
}

export async function batteryOptimizationIgnored(): Promise<boolean | null> {
  try {
    return !(await notifee.isBatteryOptimizationEnabled());
  } catch {
    return null;
  }
}

export async function openBatteryOptimizationSettings() {
  await notifee.openBatteryOptimizationSettings();
}

export async function openNotificationSettings() {
  await notifee.openNotificationSettings(CHANNEL_ID);
}

// Tap → open the app on the Sound panel.
type Listener = (target: string) => void;
const listeners = new Set<Listener>();
let pendingTarget: string | null = null;

export function onOpenTarget(listener: Listener) {
  listeners.add(listener);
  if (pendingTarget) {
    listener(pendingTarget);
    pendingTarget = null;
  }
  return () => {
    listeners.delete(listener);
  };
}

function open(target: string) {
  if (listeners.size === 0) pendingTarget = target;
  for (const l of listeners) l(target);
}

export function registerNotificationOpen() {
  void notifee.getInitialNotification().then(initial => {
    const target = initial?.notification?.data?.target;
    if (typeof target === 'string') open(target);
  });
  return notifee.onForegroundEvent(({type, detail}) => {
    const target = detail.notification?.data?.target;
    if (type === EventType.PRESS && typeof target === 'string') open(target);
  });
}

notifee.onBackgroundEvent(async () => {
  // Presses are handled by getInitialNotification once the app opens.
});
