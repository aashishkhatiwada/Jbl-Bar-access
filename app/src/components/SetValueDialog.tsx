import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, KeyboardAvoidingView, Modal, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, font, radius} from '../theme/tokens';
import {parseTyped, snap} from '../engine/format';
import {AppButton} from './Button';

export interface ValueSpec {
  min: number;
  max: number;
  step: number;
  unit?: string; // "dB", "ms"
}

export type Validation = {ok: true; value: number} | {ok: false; error: string};

function fmt(value: number, spec: ValueSpec) {
  const text = Number.isInteger(spec.step) ? String(value) : value.toFixed(1);
  return text.replace('-', '−') + (spec.unit ? ' ' + spec.unit : '');
}

export function rangeText(spec: ValueSpec) {
  return fmt(spec.min, spec) + ' to ' + fmt(spec.max, spec) + ', step ' + (Number.isInteger(spec.step) ? spec.step : spec.step.toFixed(1)) + (spec.unit ? ' ' + spec.unit : '');
}

// Numeric, inside the range, snapped to the step. A cuts-only range
// (max ≤ 0) accepts "2.5" as −2.5, because many number pads have no minus.
export function validate(text: string, spec: ValueSpec): Validation {
  let value = parseTyped(text);
  if (value === null) return {ok: false, error: 'Enter a number.'};
  if (spec.max <= 0 && spec.min < 0 && value > 0) value = -value;
  if (value < spec.min || value > spec.max) return {ok: false, error: 'Out of range. Enter ' + rangeText(spec) + '.'};
  return {ok: true, value: snap(value, spec.min, spec.max, spec.step)};
}

export interface SetValueDialogProps {
  visible: boolean;
  title: string; // "Set volume"
  spec: ValueSpec;
  initial: number | null;
  onCancel: () => void;
  onSet: (value: number) => void;
  note?: string;
}

export function SetValueDialog({visible, title, spec, initial, onCancel, onSet, note}: SetValueDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!visible) return;
    setText(initial == null ? '' : String(initial));
    setError('');
    // Focus the field once the modal is on screen.
    const timer = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [visible, initial]);

  const submit = () => {
    const result = validate(text, spec);
    if (!result.ok) {
      setError(result.error);
      AccessibilityInfo.announceForAccessibility(result.error);
      return;
    }
    onSet(result.value);
  };

  const negativeAllowed = spec.min < 0 && spec.max > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="height" style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.range} nativeID="set-value-range">{rangeText(spec)}</Text>
          <TextInput
            ref={input}
            value={text}
            onChangeText={value => {
              setText(value);
              if (error) setError('');
            }}
            keyboardType={negativeAllowed || !Number.isInteger(spec.step) ? 'numeric' : 'number-pad'}
            returnKeyType="done"
            onSubmitEditing={submit}
            selectTextOnFocus
            accessibilityLabel={title + ', ' + rangeText(spec)}
            accessibilityHint={note}
            style={[styles.input, !!error && styles.inputError]}
            placeholderTextColor={colors.subtle}
            testID="set-value-input"
          />
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="assertive" testID="set-value-error">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <AppButton label="Cancel" onPress={onCancel} style={styles.action} testID="set-value-cancel" />
            <AppButton label="Set" onPress={submit} style={[styles.action, styles.primary]} textStyle={styles.primaryText} testID="set-value-set" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 16},
  card: {backgroundColor: colors.panel, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.line, padding: 22, maxWidth: 480, width: '100%', alignSelf: 'center'},
  title: {color: colors.text, fontSize: font.h2, fontWeight: '500'},
  range: {color: colors.subtle, fontSize: font.small, marginTop: 6},
  input: {marginTop: 16, minHeight: 52, borderWidth: 1, borderColor: colors.segmentBorder, borderRadius: radius.small, backgroundColor: colors.raised, color: colors.text, fontSize: 22, paddingHorizontal: 14, paddingVertical: 8},
  inputError: {borderColor: colors.danger},
  note: {color: colors.subtle, fontSize: font.caption, marginTop: 8, lineHeight: 20},
  error: {color: colors.danger, fontSize: font.small, marginTop: 10},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20},
  action: {flexGrow: 1, flexBasis: 120},
  primary: {borderColor: colors.accentBorder, backgroundColor: colors.applyBg},
  primaryText: {color: colors.applyText},
});
