import React, {useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppButton} from '../components/Button';
import {probe, type ProbeResult} from '../api/probe';
import {normalizeHost} from '../api/client';
import {colors, font, radius} from '../theme/tokens';
import {DEFAULT_HOST, type Settings} from '../settings/store';
import {NotificationSettings} from '../notifications/NotificationSettings';

const RESULT_TITLE: Record<ProbeResult['kind'], string> = {
  connected: 'Connected',
  restarting: 'Soundbar starting',
  'wrong-network': 'Wrong network',
  offline: 'Not reachable',
  'not-toolkit': 'Not the toolkit remote',
};

export function SettingsScreen({settings, onSave, onClose}: {settings: Settings; onSave: (s: Settings) => void; onClose: () => void}) {
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState(settings.host);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const cleaned = normalizeHost(host);
  const valid = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(cleaned) && cleaned.length > 0;

  const test = async () => {
    if (!valid) return;
    setTesting(true);
    setResult(null);
    const r = await probe(cleaned);
    setResult(r);
    setTesting(false);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, {paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24}]} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <Text style={styles.h1} accessibilityRole="header">Settings</Text>
        <AppButton label="Done" onPress={onClose} accessibilityLabel="Close settings" testID="settings-done" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.h2} accessibilityRole="header">Soundbar address</Text>
        <Text style={styles.caption}>The bar’s IP address on your Wi-Fi. The toolkit only answers phones on its own network (192.168.100.x).</Text>
        <TextInput
          value={host}
          onChangeText={value => {
            setHost(value);
            setResult(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Soundbar address"
          accessibilityHint={'For example ' + DEFAULT_HOST}
          placeholder={DEFAULT_HOST}
          placeholderTextColor={colors.subtle}
          style={styles.input}
          testID="host-input"
        />
        {!valid ? <Text style={styles.error} accessibilityLiveRegion="polite">Enter an address like {DEFAULT_HOST}.</Text> : null}
        <View style={styles.actions}>
          <AppButton label="Test connection" disabled={!valid || testing} onPress={test} style={styles.flex} testID="host-test" />
          <AppButton
            label="Save address"
            disabled={!valid || cleaned === settings.host}
            onPress={() => onSave({...settings, host: cleaned})}
            style={[styles.flex, styles.primary]}
            textStyle={styles.primaryText}
            testID="host-save"
          />
        </View>
        {testing ? (
          <View style={styles.result} accessible accessibilityLabel="Testing connection">
            <ActivityIndicator color={colors.orange} />
            <Text style={styles.body}>Testing…</Text>
          </View>
        ) : null}
        {result ? (
          <View style={styles.resultBox} accessible accessibilityLiveRegion="polite" testID="host-result">
            <Text style={[styles.body, {color: result.kind === 'connected' ? colors.green : colors.danger}]}>
              {(result.kind === 'connected' ? '✓ ' : '✕ ') + RESULT_TITLE[result.kind]}
            </Text>
            <Text style={styles.caption}>
              {result.kind === 'connected' ? result.name + ' answered. Power: ' + result.power + '.' : result.message}
            </Text>
          </View>
        ) : null}
        <AppButton label="Use default address" onPress={() => setHost(DEFAULT_HOST)} style={styles.link} textStyle={styles.linkText} />
      </View>

      <NotificationSettings settings={settings} onSave={onSave} />

      <View style={styles.panel}>
        <Text style={styles.h2} accessibilityRole="header">About</Text>
        <Text style={styles.caption}>JBL Bar Access talks only to your soundbar on the local network. No cloud, no accounts, no telemetry.</Text>
      </View>
    </ScrollView>
  );
}

export const settingsStyles = StyleSheet.create({
  panel: {borderWidth: 1, borderColor: 'rgba(255,255,255,0.043)', backgroundColor: colors.panel, borderRadius: radius.panel, padding: 20, marginTop: 16},
  h2: {color: colors.text, fontSize: font.h2, fontWeight: '500'},
  caption: {color: colors.subtle, fontSize: font.small, lineHeight: 22, marginTop: 6},
  body: {color: colors.text, fontSize: font.body},
});

const styles = StyleSheet.create({
  ...settingsStyles,
  root: {flex: 1, backgroundColor: colors.bg},
  content: {paddingHorizontal: 16, maxWidth: 720, width: '100%', alignSelf: 'center'},
  top: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'},
  h1: {color: colors.text, fontSize: font.title, fontWeight: '500'},
  input: {marginTop: 14, minHeight: 50, borderWidth: 1, borderColor: colors.segmentBorder, borderRadius: radius.small, backgroundColor: colors.raised, color: colors.text, fontSize: font.body, paddingHorizontal: 14},
  error: {color: colors.danger, fontSize: font.small, marginTop: 8},
  actions: {flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap'},
  flex: {flexGrow: 1, flexBasis: 140},
  primary: {borderColor: colors.accentBorder, backgroundColor: colors.applyBg},
  primaryText: {color: colors.applyText},
  result: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap'},
  resultBox: {marginTop: 14, gap: 4, padding: 12, borderRadius: radius.button, borderWidth: 1, borderColor: colors.line},
  link: {alignSelf: 'flex-start', borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, marginTop: 6},
  linkText: {color: colors.orange, fontSize: font.small, textDecorationLine: 'underline'},
});
