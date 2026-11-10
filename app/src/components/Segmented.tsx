import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, font, radius, touch} from '../theme/tokens';

export interface SegmentedProps {
  label: string; // group name for screen readers, e.g. "Bass level"
  options: {value: number | string; label: string; spoken?: string}[];
  value: number | string | null | undefined;
  target?: number | string; // chosen while its steps run
  disabled?: boolean;
  onChange: (value: number | string) => void;
  large?: boolean;
  testID?: string;
}

// ≤6 discrete steps: a radio group of segments. Selection is carried by
// text state ("selected"), not only by colour.
export function Segmented({label, options, value, target, disabled, onChange, large, testID}: SegmentedProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group} testID={testID}>
      {options.map((option, index) => {
        const selected = option.value === value;
        const isTarget = target !== undefined && option.value === target && !selected;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={(option.spoken || option.label) + (isTarget ? ', changing to this' : '')}
            accessibilityHint={label}
            accessibilityState={{checked: selected, disabled: !!disabled, busy: isTarget}}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            testID={testID ? testID + '-' + option.value : undefined}
            style={({pressed}) => [
              styles.segment,
              index > 0 && styles.divider,
              selected && styles.selected,
              isTarget && styles.target,
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <Text style={[styles.text, large && styles.large, selected && styles.selectedText]}>{option.label}</Text>
            {selected ? <View style={styles.underline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {flexDirection: 'row', borderWidth: 1, borderColor: colors.segmentBorder, borderRadius: radius.segment, overflow: 'hidden', flexWrap: 'nowrap'},
  segment: {flex: 1, minWidth: 0, minHeight: touch.min, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,23,28,0.19)'},
  divider: {borderLeftWidth: 1, borderLeftColor: colors.line},
  selected: {backgroundColor: colors.segmentSelectedBg, borderWidth: 1, borderColor: colors.segmentSelectedRing},
  target: {borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange},
  pressed: {backgroundColor: 'rgba(255,255,255,0.063)'},
  disabled: {opacity: 0.38},
  text: {color: colors.muted, fontSize: font.small, textAlign: 'center'},
  large: {fontSize: font.control},
  selectedText: {color: colors.selectedText, fontWeight: '600'},
  // Non-colour selection cue: a short bar under the chosen segment.
  underline: {position: 'absolute', bottom: 4, width: 14, height: 2, borderRadius: 1, backgroundColor: colors.orange},
});
