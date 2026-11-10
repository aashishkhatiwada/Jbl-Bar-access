import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, findNodeHandle, StyleSheet, Text, View, type AccessibilityActionEvent} from 'react-native';
import Slider from '@react-native-community/slider';
import {colors, font} from '../theme/tokens';
import {AppButton} from './Button';
import {SetValueDialog, type ValueSpec} from './SetValueDialog';

export const SLIDER_IDLE_COMMIT = 300;

export interface ValueControlProps {
  name: string; // "Volume", "125 Hz gain"
  spec: ValueSpec;
  value: number | null; // shown value (confirmed, draft or optimistic)
  format: (value: number) => string; // visible text, "12", "−1.5 dB"
  spoken: (value: number) => string; // "Volume 12 of 31"
  onCommit: (value: number) => void; // slider release/idle, or typed value
  onStep: (direction: 1 | -1) => void; // one stepper tap / rotor step
  onHoldStart?: (direction: 1 | -1) => void; // volume only: hold to repeat
  onHoldEnd?: () => void;
  disabled?: boolean;
  downDisabled?: boolean;
  upDisabled?: boolean;
  stepLabels: {down: string; up: string};
  dialogTitle: string;
  dialogNote?: string;
  center?: React.ReactNode; // replaces the inline value between steppers (volume dial)
  showValue?: boolean;
  testID?: string;
}

// Every >6-step control: native slider, −/+ steppers, and typed entry. All
// three are equivalent paths to the same commit.
export function ValueControl(props: ValueControlProps) {
  const {name, spec, value, format, spoken, onCommit, onStep, onHoldStart, onHoldEnd, disabled, stepLabels, dialogTitle, dialogNote, center, testID} = props;
  const [drag, setDrag] = useState<number | null>(null);
  const [dialog, setDialog] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef<number | null>(null);
  const setButton = useRef<any>(null);
  const skipPress = useRef(false);

  useEffect(() => () => {
    if (idle.current) clearTimeout(idle.current);
  }, []);
  // A drag that lost its source (disabled mid-drag) falls back to confirmed.
  useEffect(() => {
    if (disabled) setDrag(null);
  }, [disabled]);

  const commit = (v: number) => {
    if (committed.current === v) return;
    committed.current = v;
    onCommit(v);
  };

  const shown = drag ?? value;
  const downDisabled = disabled || props.downDisabled || shown == null || shown <= spec.min;
  const upDisabled = disabled || props.upDisabled || shown == null || shown >= spec.max;

  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment' && !upDisabled) onStep(1);
    if (event.nativeEvent.actionName === 'decrement' && !downDisabled) onStep(-1);
  };

  const stepper = (direction: 1 | -1) => {
    const off = direction === 1 ? upDisabled : downDisabled;
    const hold = !!onHoldStart;
    return (
      <AppButton
        label={direction === 1 ? '+' : '−'}
        accessibilityLabel={direction === 1 ? stepLabels.up : stepLabels.down}
        accessibilityHint={shown == null ? undefined : spoken(shown)}
        disabled={off}
        style={styles.step}
        textStyle={styles.stepText}
        testID={testID ? testID + (direction === 1 ? '-up' : '-down') : undefined}
        // Touch: act on press-in and repeat while held. Screen readers and
        // switches send a plain press, which steps once.
        onPressIn={hold ? () => {
          skipPress.current = true;
          onHoldStart!(direction);
        } : undefined}
        onPressOut={hold ? () => {
          onHoldEnd?.();
          setTimeout(() => (skipPress.current = false), 60);
        } : undefined}
        onPress={() => {
          if (hold && skipPress.current) return;
          onStep(direction);
        }}
      />
    );
  };

  const openDialog = () => setDialog(true);
  const closeDialog = () => {
    setDialog(false);
    // Return focus to the control that opened the dialog.
    setTimeout(() => {
      const node = setButton.current && findNodeHandle(setButton.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
  };

  return (
    <View testID={testID}>
      <View style={styles.row}>
        {stepper(-1)}
        <View style={styles.center}>
          {center ?? (props.showValue !== false ? (
            <Text style={styles.value} importantForAccessibility="no">{shown == null ? '—' : format(shown)}</Text>
          ) : null)}
        </View>
        {stepper(1)}
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={name}
        accessibilityValue={shown == null ? {text: 'Unavailable'} : {min: spec.min, max: spec.max, now: shown, text: spoken(shown)}}
        accessibilityState={{disabled: !!disabled}}
        accessibilityActions={disabled ? [] : [{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={onAction}
        style={styles.sliderWrap}
        testID={testID ? testID + '-slider' : undefined}>
        <Slider
          importantForAccessibility="no-hide-descendants"
          style={styles.slider}
          minimumValue={spec.min}
          maximumValue={spec.max}
          step={spec.step}
          value={shown ?? spec.min}
          disabled={disabled || shown == null}
          minimumTrackTintColor={colors.orange}
          maximumTrackTintColor="rgba(255,255,255,0.25)"
          thumbTintColor={disabled ? colors.subtle : colors.orange}
          onSlidingStart={v => {
            committed.current = null;
            setDrag(v);
          }}
          onValueChange={v => {
            setDrag(v);
            if (idle.current) clearTimeout(idle.current);
            idle.current = setTimeout(() => commit(v), SLIDER_IDLE_COMMIT);
          }}
          onSlidingComplete={v => {
            if (idle.current) clearTimeout(idle.current);
            commit(v);
            setDrag(null);
          }}
        />
      </View>
      <AppButton
        ref={setButton}
        label="Set value"
        accessibilityLabel={'Set ' + name.toLowerCase() + ' by typing'}
        disabled={disabled || shown == null}
        onPress={openDialog}
        style={styles.setButton}
        textStyle={styles.setText}
        testID={testID ? testID + '-set' : undefined}
      />
      <SetValueDialog
        visible={dialog}
        title={dialogTitle}
        spec={spec}
        initial={shown}
        note={dialogNote}
        onCancel={closeDialog}
        onSet={v => {
          committed.current = null;
          commit(v);
          closeDialog();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  value: {color: colors.text, fontSize: font.body, fontVariant: ['tabular-nums']},
  step: {width: 48, height: 48, minHeight: 48, borderRadius: 24, paddingHorizontal: 0, paddingVertical: 0},
  stepText: {color: colors.text, fontSize: 26, fontWeight: '300', lineHeight: 30},
  sliderWrap: {minHeight: 48, justifyContent: 'center', marginTop: 6},
  slider: {width: '100%', height: 40},
  setButton: {alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6},
  setText: {color: colors.muted, fontSize: font.small},
});
