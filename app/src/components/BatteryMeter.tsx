import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors} from '../theme/tokens';

export type BatteryLevel = 'unknown' | 'critical' | 'low' | 'normal';

export function batteryLevel(value: unknown): BatteryLevel {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) return 'unknown';
  const v = value as number;
  return v < 20 ? 'critical' : v < 40 ? 'low' : 'normal';
}

// Text label that never depends on colour.
export const LEVEL_WORD: Record<BatteryLevel, string> = {unknown: 'unknown', critical: 'critical', low: 'low', normal: 'OK'};

// The web <meter>: a 3 px bar. Decorative; the percentage and level word
// are in the adjacent text.
export function BatteryMeter({value, docked}: {value: number; docked: boolean}) {
  const level = batteryLevel(value);
  const color = docked ? colors.orange : level === 'critical' ? colors.batteryCritical : level === 'low' ? colors.batteryLow : colors.green;
  return (
    <View style={styles.track} importantForAccessibility="no-hide-descendants">
      <View style={[styles.fill, {width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {width: 32, height: 3, borderRadius: 4, backgroundColor: colors.meterTrack, overflow: 'hidden'},
  fill: {height: 3, borderRadius: 4},
});
