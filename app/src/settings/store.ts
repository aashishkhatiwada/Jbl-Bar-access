import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_HOST = '192.168.100.25';
const KEY = 'jbl-bar-access/settings/v1';

export interface Settings {
  host: string;
  batteryAlerts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {host: DEFAULT_HOST, batteryAlerts: true};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const value = JSON.parse(raw);
    return {
      host: typeof value.host === 'string' && value.host.trim() ? value.host : DEFAULT_HOST,
      batteryAlerts: typeof value.batteryAlerts === 'boolean' ? value.batteryAlerts : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage failure only loses the preference; the app keeps working.
  }
}
