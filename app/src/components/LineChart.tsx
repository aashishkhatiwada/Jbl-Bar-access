import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {colors} from '../theme/tokens';

export interface ChartPoint {
  time: number;
  value: number | null;
}

// The monitor chart: 2-minute window, gaps where a sample was missing.
// Drawn statically (no animation), so Reduce Motion needs nothing extra.
export function LineChart({points, now, color, fill, label}: {points: ChartPoint[]; now: number; color: string; fill: string; label: string}) {
  let line = '';
  let area = '';
  let segment: [number, number][] = [];
  const finish = () => {
    if (!segment.length) return;
    line += 'M' + segment.map(p => p.join(',')).join('L');
    if (segment.length > 1) area += 'M' + segment[0][0] + ',72L' + segment.map(p => p.join(',')).join('L') + 'L' + segment[segment.length - 1][0] + ',72Z';
    segment = [];
  };
  for (const point of points) {
    if (point.value == null || !Number.isFinite(point.value)) {
      finish();
      continue;
    }
    const x = Math.max(0, 300 - ((now - point.time) / 120000) * 300);
    segment.push([Number(x.toFixed(2)), Number((70 - point.value * 0.68).toFixed(2))]);
  }
  finish();
  const last = points[points.length - 1];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.wrap}>
      <Svg width="100%" height={72} viewBox="0 0 300 72" preserveAspectRatio="none">
        <Path d="M0 18H300M0 36H300M0 54H300" stroke={colors.chartGrid} strokeWidth={1} />
        {area ? <Path d={area} fill={fill} stroke="none" /> : null}
        {line ? <Path d={line} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {last?.value != null ? <Circle cx={300} cy={70 - last.value * 0.68} r={2.5} fill={color} stroke={colors.panel} /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({wrap: {marginTop: 13, height: 72}});
