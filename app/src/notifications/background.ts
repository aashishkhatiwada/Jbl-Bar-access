import BackgroundFetch from 'react-native-background-fetch';
import {createApi} from '../api/client';
import {loadSettings} from '../settings/store';
import {evaluate} from './monitor';
import {loadMonitor, saveMonitor, showLowBattery} from './notify';

// One background check: read state once, evaluate, notify, persist.
export async function checkBatteryOnce(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.batteryAlerts) return;
  const prev = await loadMonitor();
  let state = null;
  try {
    state = await createApi(settings.host).getState();
  } catch {
    state = null; // unreachable: suppress, keep arm state
  }
  const {next, notify} = evaluate(prev, state, Date.now());
  await saveMonitor(next);
  for (const item of notify) await showLowBattery(item.side, item.percent);
}

// WorkManager-backed periodic task (15 min minimum, may be deferred by
// Doze). Survives app close and reboot, not a force-stop.
export async function configureBackground(enabled: boolean): Promise<number | null> {
  if (!enabled) {
    await BackgroundFetch.stop();
    return null;
  }
  const status = await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async taskId => {
      try {
        await checkBatteryOnce();
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    taskId => BackgroundFetch.finish(taskId),
  );
  return status;
}

// Runs when the app process is not alive (registered in index.js).
export async function headlessTask(event: {taskId: string; timeout: boolean}) {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }
  try {
    await checkBatteryOnce();
  } finally {
    BackgroundFetch.finish(event.taskId);
  }
}
