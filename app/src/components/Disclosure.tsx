import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {colors, font, touch} from '../theme/tokens';

export interface DisclosureProps {
  title: string;
  subtitle?: string;
  tag?: string;
  initiallyOpen?: boolean;
  right?: React.ReactNode; // status text shown in the summary (system monitor)
  rightSpoken?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  summaryStyle?: StyleProp<ViewStyle>;
  titleStyle?: object;
  border?: boolean;
  testID?: string;
}

// Web <details>: a summary row with +/− and an explicit expand/collapse
// state for screen readers.
export function Disclosure({title, subtitle, tag, initiallyOpen = false, right, rightSpoken, children, style, summaryStyle, titleStyle, border = true, testID}: DisclosureProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const spoken = [title, tag, subtitle, rightSpoken].filter(Boolean).join(', ');
  return (
    <View style={[border && styles.border, style]} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={open ? 'Collapse section' : 'Expand section'}
        accessibilityState={{expanded: open}}
        onPress={() => setOpen(o => !o)}
        style={({pressed}) => [styles.summary, summaryStyle, pressed && styles.pressed]}>
        <View style={styles.titles}>
          <Text style={[styles.title, titleStyle]}>
            {title}
            {tag ? <Text style={styles.tag}>{'  ' + tag}</Text> : null}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
        <Text style={styles.mark} importantForAccessibility="no">{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  border: {borderTopWidth: 1, borderTopColor: colors.line},
  summary: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: touch.min, paddingVertical: 16},
  pressed: {opacity: 0.7},
  titles: {flex: 1},
  title: {color: colors.text, fontSize: font.control, lineHeight: 22},
  tag: {color: colors.subtle, fontSize: font.caption},
  subtitle: {color: colors.subtle, fontSize: font.caption, marginTop: 4},
  mark: {color: colors.subtle, fontSize: 20, fontWeight: '300', width: 18, textAlign: 'center'},
});
