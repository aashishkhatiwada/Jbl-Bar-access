import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../components/Button';
import {Icon} from '../../components/Icon';
import {useController, useSnapshot} from '../../state/ControllerContext';
import {colors, font} from '../../theme/tokens';
import {connection, disabled, powerView, anyPending} from '../../engine/view';

export function Header({onSettings, onJump}: {onSettings: () => void; onJump: () => void}) {
  const c = useController();
  const snap = useSnapshot();
  const conn = connection(snap);
  const power = powerView(snap);
  const model = (snap.features?.name || 'JBL Bar 9.1').replace(/^JBL\s+/i, '').toUpperCase();
  return (
    <View>
      {/* Web skip link: first focus stop, jumps to the volume panel. */}
      <AppButton label="Jump to controls" onPress={onJump} style={styles.jump} textStyle={styles.jumpText} accessibilityHint="Moves focus to the volume controls" />
      <View style={styles.header}>
        <View style={styles.brandRow} accessible accessibilityRole="header" accessibilityLabel={(snap.features?.name || 'JBL Bar 9.1') + ' remote'}>
          <View style={styles.brand}><Text style={styles.brandText} allowFontScaling={false}>JBL</Text></View>
          <View style={styles.wordmarkWrap}>
            <Text style={styles.wordmark}>{model}</Text>
            <Text style={styles.wordmarkSmall}>YOUR LOCAL REMOTE</Text>
          </View>
        </View>
        <View style={styles.status}>
          <View style={styles.connection} accessible accessibilityLabel={'Connection: ' + conn.label} testID="connection">
            <View style={[styles.dot, {backgroundColor: conn.state === 'offline' ? colors.orange : conn.state === 'online' ? colors.green : colors.subtle}]} />
            <Text style={styles.connectionText}>{conn.label}</Text>
          </View>
          <AppButton
            accessibilityLabel="Refresh soundbar state"
            disabled={(anyPending(snap) || snap.refreshing) && !!snap.state}
            onPress={() => c.manualRefresh()}
            style={styles.icon}
            testID="refresh">
            <Icon name="refresh" size={18} color={colors.text} />
          </AppButton>
          <AppButton
            accessibilityLabel={power.accessibilityLabel}
            accessibilityHint={power.label}
            accessibilityState={{busy: snap.active === 'power'}}
            disabled={disabled(snap, 'power')}
            onPress={() => c.enqueue('power')}
            style={styles.power}
            testID="power">
            <Icon name="power" size={18} color={colors.orange} />
          </AppButton>
          <AppButton accessibilityLabel="App settings" onPress={onSettings} style={styles.icon} testID="settings">
            <Icon name="settings" size={18} color={colors.muted} />
          </AppButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  jump: {alignSelf: 'flex-start', borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, marginTop: 4},
  jumpText: {color: colors.orange, fontSize: font.small, textDecorationLine: 'underline'},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 84, paddingVertical: 12},
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1},
  brand: {width: 35, height: 35, borderRadius: 5, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingRight: 3},
  brandText: {color: colors.brandText, fontSize: 20, fontWeight: '900', letterSpacing: -2},
  wordmarkWrap: {flexShrink: 1},
  wordmark: {color: colors.text, fontSize: font.control, letterSpacing: 1.6, fontWeight: '700'},
  wordmarkSmall: {color: colors.muted, fontSize: font.caption, letterSpacing: 1.2, marginTop: 4},
  status: {flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end'},
  connection: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, minHeight: 44},
  dot: {width: 6, height: 6, borderRadius: 3},
  connectionText: {color: colors.muted, fontSize: font.caption},
  icon: {borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 8},
  power: {width: 44, height: 44, borderRadius: 22, paddingHorizontal: 0, paddingVertical: 0, marginLeft: 4, borderColor: colors.powerBorder, backgroundColor: colors.powerBg},
});
