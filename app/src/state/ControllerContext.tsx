import React, {createContext, useContext, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {AccessibilityInfo, AppState} from 'react-native';
import {Controller, type Snapshot} from '../engine/controller';
import {sseStream} from '../api/stream';

const Context = createContext<Controller | null>(null);

// One controller per host. Foreground/background follows AppState, like the
// web page's visibilitychange: the stream closes in the background.
export function ControllerProvider({host, children}: {host: string; children: React.ReactNode}) {
  const [controller, setController] = useState<Controller | null>(null);
  useEffect(() => {
    const c = new Controller({host, stream: sseStream});
    setController(c);
    void c.start();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') c.resume();
      else if (next === 'background') c.pause();
    });
    return () => {
      sub.remove();
      c.dispose();
    };
  }, [host]);
  if (!controller) return null;
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}

export function useController(): Controller {
  const c = useContext(Context);
  if (!c) throw new Error('useController outside ControllerProvider');
  return c;
}

export function useSnapshot(): Snapshot {
  const c = useController();
  return useSyncExternalStore(c.subscribe, c.getSnapshot);
}

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// Re-render every second for "Synced N s ago" and aging monitors.
export function useTicker(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Action results are announced once, from one place. The feedback row is
// not a live region, so nothing is read twice. Step-by-step volume
// progress is not announced (the slider value is); its final result is.
export function useFeedbackAnnouncer(snap: Snapshot) {
  const last = useRef(0);
  const lastPendingKey = useRef('');
  useEffect(() => {
    const {feedback, active} = snap;
    if (feedback.seq === last.current) return;
    last.current = feedback.seq;
    if (!feedback.text) return;
    if (feedback.kind === 'pending') {
      const volumeStep = active === 'volume_up' || active === 'volume_down';
      const key = volumeStep ? 'volume' : feedback.text;
      if (key === lastPendingKey.current) return;
      lastPendingKey.current = key;
      if (volumeStep && snap.volumePlan) {
        AccessibilityInfo.announceForAccessibility('Setting volume ' + snap.volumePlan.target);
        return;
      }
      if (volumeStep) return;
    } else lastPendingKey.current = '';
    // While a planned volume run continues, intermediate "Volume N" results stay quiet.
    if (feedback.kind === 'success' && snap.queue.length > 0) return;
    AccessibilityInfo.announceForAccessibility(feedback.text);
  }, [snap]);
}
