import React, {useRef, useState} from 'react';
import {AccessibilityInfo, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors, font, radius, touch} from '../theme/tokens';
import {AppButton} from './Button';

// Web <select>: a button that opens a radio list.
export function Picker({label, value, options, onChange, disabled, testID}: {label: string; value: string; options: {value: string; label: string}[]; onChange: (v: string) => void; disabled?: boolean; testID?: string}) {
  const [open, setOpen] = useState(false);
  const button = useRef<any>(null);
  const current = options.find(o => o.value === value)?.label || value;
  const close = () => {
    setOpen(false);
    setTimeout(() => {
      const node = button.current && findNodeHandle(button.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
  };
  return (
    <>
      <AppButton ref={button} disabled={disabled} onPress={() => setOpen(true)} accessibilityLabel={label + ': ' + current} accessibilityHint="Opens a list of choices" style={styles.button} testID={testID}>
        <View style={styles.row}>
          <Text style={styles.value}>{current}</Text>
          <Text style={styles.caret} importantForAccessibility="no">▾</Text>
        </View>
      </AppButton>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title} accessibilityRole="header">{label}</Text>
            <ScrollView accessibilityRole="radiogroup" style={styles.list}>
              {options.map(option => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{checked: selected}}
                    accessibilityLabel={option.label}
                    onPress={() => {
                      onChange(option.value);
                      close();
                    }}
                    style={({pressed}) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
                    <Text style={[styles.optionText, selected && styles.selectedText]}>{(selected ? '● ' : '○ ') + option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <AppButton label="Cancel" onPress={close} style={styles.cancel} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {backgroundColor: '#24272d', borderRadius: radius.small, alignItems: 'stretch'},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  value: {color: colors.text, fontSize: font.control, flexShrink: 1},
  caret: {color: colors.subtle, fontSize: font.control},
  backdrop: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 16},
  card: {backgroundColor: colors.panel, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.line, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480, alignSelf: 'center'},
  title: {color: colors.text, fontSize: font.h2, fontWeight: '500', marginBottom: 12},
  list: {flexGrow: 0},
  option: {minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.small},
  selected: {backgroundColor: colors.segmentSelectedBg},
  pressed: {backgroundColor: 'rgba(255,255,255,0.063)'},
  optionText: {color: colors.muted, fontSize: font.control},
  selectedText: {color: colors.selectedText},
  cancel: {marginTop: 14},
});
