import React from 'react';
import {Pressable, StyleSheet, Text, type AccessibilityActionEvent, type AccessibilityRole, type AccessibilityState, type StyleProp, type TextStyle, type ViewStyle} from 'react-native';
import {colors, font, radius, touch} from '../theme/tokens';

export interface AppButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityActions?: {name: string; label?: string}[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  nativeID?: string;
}

// Web `button`: 1px translucent border, 9px radius, disabled at 38 % opacity.
// Every button is at least 44 dp tall and wide (the web's 40 px is raised).
export const AppButton = React.forwardRef<React.ElementRef<typeof Pressable>, AppButtonProps>(function AppButtonImpl(props, ref) {
  const {label, children, disabled, style, pressedStyle, textStyle, accessibilityState, accessibilityRole = 'button', accessibilityLabel, ...rest} = props;
  return (
    <Pressable
      ref={ref}
      {...rest}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{...accessibilityState, disabled: !!disabled}}
      style={({pressed}) => [styles.button, style, pressed && !disabled && [styles.pressed, pressedStyle], disabled && styles.disabled]}>
      {children ?? <Text style={[styles.text, textStyle]}>{label}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    minHeight: touch.min,
    minWidth: touch.min,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(255,255,255,0.012)',
    borderRadius: radius.button,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {backgroundColor: 'rgba(255,255,255,0.063)', borderColor: 'rgba(255,255,255,0.25)'},
  disabled: {opacity: 0.38},
  text: {color: colors.text, fontSize: font.control, textAlign: 'center'},
});
