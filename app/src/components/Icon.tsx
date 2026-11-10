import React from 'react';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

// The web remote's inline <symbol> set, stroked at 1.6 on a 24 grid.
export type IconName = 'power' | 'volume' | 'muted' | 'tv' | 'hdmi' | 'bluetooth' | 'wifi' | 'cast' | 'check' | 'refresh' | 'play' | 'pause' | 'next' | 'previous' | 'stop' | 'settings';

const PATHS: Record<IconName, React.ReactNode> = {
  power: <Path d="M12 3v9M7 5.5a8 8 0 1 0 10 0" />,
  volume: <Path d="M11 4 6 8H3v8h3l5 4V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />,
  muted: <Path d="M11 4 6 8H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6" />,
  tv: <><Rect height={13} rx={2} width={18} x={3} y={4} /><Path d="M8 21h8m-4-4v4" /></>,
  hdmi: <Path d="M3 6h18v9l-4 4H7l-4-4V6Zm4 4h10M9 14h6" />,
  bluetooth: <Path d="m7 7 10 10-5 4V3l5 4L7 17" />,
  wifi: <><Path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0" /><Circle cx={12} cy={20} r={0.6} /></>,
  cast: <><Path d="M3 9V5h18v14h-9M3 14a5 5 0 0 1 5 5m-5-9a9 9 0 0 1 9 9" /><Circle cx={3} cy={19} r={0.5} /></>,
  check: <Path d="m5 12 4 4L19 6" />,
  refresh: <Path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />,
  play: <Path d="m8 4 12 8-12 8V4Z" />,
  pause: <Path d="M8 4v16M16 4v16" />,
  next: <Path d="m5 5 10 7-10 7V5Zm13 0v14" />,
  previous: <Path d="m19 5-10 7 10 7V5ZM6 5v14" />,
  stop: <Rect height={12} rx={1} width={12} x={6} y={6} />,
  settings: <><Circle cx={12} cy={12} r={3} /><Path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1" /></>,
};

export function Icon({name, size = 21, color}: {name: IconName; size?: number; color: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessible={false} importantForAccessibility="no-hide-descendants">
      {PATHS[name]}
    </Svg>
  );
}
