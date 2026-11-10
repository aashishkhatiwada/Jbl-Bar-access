import {useEffect, useRef} from 'react';
import {useSnapshot} from '../state/ControllerContext';
import {evaluate, type MonitorState} from './monitor';
import {loadMonitor, registerNotificationOpen, saveMonitor, showLowBattery} from './notify';
import {configureBackground} from './background';

// Foreground path: evaluates every live state change, so an alert fires as
// soon as the bar reports a low battery. Shares arm state with the
// background task through storage.
export function BatteryWatcher({enabled}: {enabled: boolean}) {
  const snap = useSnapshot();
  const state = useRef<MonitorState | null>(null);
  const lastSaved = useRef(0);

  useEffect(() => registerNotificationOpen(), []);

  useEffect(() => {
    void configureBackground(enabled).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    void loadMonitor().then(m => {
      state.current = m;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !state.current || !snap.online || !snap.state) return;
    const before = state.current;
    const {next, notify} = evaluate(before, snap.state, Date.now());
    state.current = next;
    const changed = notify.length > 0 || JSON.stringify(before.armed) !== JSON.stringify(next.armed) || JSON.stringify(before.battery) !== JSON.stringify(next.battery) || before.docked !== next.docked;
    // Persist on change, and at most every 30 s otherwise (last check time).
    if (changed || Date.now() - lastSaved.current > 30000) {
      lastSaved.current = Date.now();
      void saveMonitor(next);
    }
    for (const item of notify) void showLowBattery(item.side, item.percent);
  }, [snap.state, snap.online, enabled]);

  return null;
}

