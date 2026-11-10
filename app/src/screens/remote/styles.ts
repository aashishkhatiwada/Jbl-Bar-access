import {StyleSheet} from 'react-native';
import {colors, font, radius} from '../../theme/tokens';

// Shared section styles, from the web's phone breakpoint (≤ 640 px).
export const s = StyleSheet.create({
  panel: {borderWidth: 1, borderColor: 'rgba(255,255,255,0.043)', backgroundColor: colors.panel, borderRadius: radius.panel},
  panelPad: {paddingHorizontal: 21, paddingTop: 22},
  sectionHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'},
  h1: {color: colors.text, fontSize: font.title, letterSpacing: -0.8, fontWeight: '500'},
  h2: {color: colors.text, fontSize: font.h2, fontWeight: '500', letterSpacing: -0.3},
  h2Everyday: {color: colors.muted, fontSize: font.control, fontWeight: '400'},
  h3: {color: colors.text, fontSize: font.body, fontWeight: '500'},
  body: {color: colors.text, fontSize: font.body},
  muted: {color: colors.muted, fontSize: font.small, lineHeight: 22},
  caption: {color: colors.subtle, fontSize: font.caption, lineHeight: 21},
  note: {color: colors.subtle, fontSize: font.caption, lineHeight: 24, marginVertical: 15},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', minHeight: 70, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line},
  rowLabel: {minWidth: 75, flexShrink: 1, flexGrow: 1, flexBasis: 90},
  rowTitle: {color: colors.text, fontSize: font.control},
  rowValue: {color: colors.subtle, fontSize: font.caption, lineHeight: 21, marginTop: 5},
  rowControl: {flexGrow: 2, flexBasis: 190},
  tag: {color: colors.devTag, fontSize: font.caption, borderWidth: 1, borderColor: 'rgba(238,155,124,0.15)', paddingVertical: 5, paddingHorizontal: 7, borderRadius: radius.tag, letterSpacing: 0.2},
  smallButton: {paddingVertical: 7, paddingHorizontal: 12},
  smallButtonText: {color: colors.text, fontSize: font.small},
  accentText: {color: colors.orange},
});
