import React, {useEffect, useState} from 'react';
import {BackHandler, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ControllerProvider} from './src/state/ControllerContext';
import {RemoteScreen} from './src/screens/RemoteScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {loadSettings, saveSettings, type Settings} from './src/settings/store';
import {BatteryWatcher} from './src/notifications/BatteryWatcher';
import {colors} from './src/theme/tokens';

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowSettings(false);
      return true;
    });
    return () => sub.remove();
  }, [showSettings]);

  const save = (next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {settings ? (
          <ControllerProvider host={settings.host}>
            <BatteryWatcher enabled={settings.batteryAlerts} />
            {/* Settings overlays the remote; the remote stays mounted so the
                live connection is not torn down. */}
            <View style={styles.fill} importantForAccessibility={showSettings ? 'no-hide-descendants' : 'auto'}>
              <RemoteScreen onSettings={() => setShowSettings(true)} />
            </View>
            {showSettings ? (
              <View style={StyleSheet.absoluteFill}>
                <SettingsScreen settings={settings} onSave={save} onClose={() => setShowSettings(false)} />
              </View>
            ) : null}
          </ControllerProvider>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  fill: {flex: 1},
});
