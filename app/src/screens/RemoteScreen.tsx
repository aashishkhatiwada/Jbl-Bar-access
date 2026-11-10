import React, {useEffect, useRef} from 'react';
import {AccessibilityInfo, findNodeHandle, NativeModules, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFeedbackAnnouncer, useSnapshot} from '../state/ControllerContext';
import {colors} from '../theme/tokens';
import {Header} from './remote/Header';
import {Listening} from './remote/Listening';
import {FeedbackRow, Playback} from './remote/Playback';
import {Sound} from './remote/Sound';
import {Tuning} from './remote/Tuning';
import {Details, Footer, RoomSetup, SystemMonitor} from './remote/Lower';
import {onOpenTarget} from '../notifications/notify';

export type ViewRef = React.ComponentRef<typeof View>;

function phoneLocales(): string[] {
  const locale = NativeModules.I18nManager?.localeIdentifier || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  return [String(locale).replace('_', '-')];
}

// One scrolling screen mirroring the web page, in its order.
export function RemoteScreen({onSettings}: {onSettings: () => void}) {
  const snap = useSnapshot();
  useFeedbackAnnouncer(snap);
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const volume = useRef<ViewRef>(null);
  const sound = useRef<ViewRef>(null);
  const scrollY = useRef(0);
  // Scrolls the target into view, then moves screen-reader focus to it.
  const focus = (target: React.RefObject<ViewRef | null>) => {
    const node = target.current;
    const list = scroll.current;
    if (!node || !list) return;
    node.measureInWindow((_x, nodeY) => {
      (list as any).measureInWindow?.((_lx: number, listY: number) => {
        list.scrollTo({y: Math.max(0, scrollY.current + nodeY - listY - 24), animated: false});
      });
    });
    setTimeout(() => {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 200);
  };
  const jump = () => focus(volume);
  // A battery notification opens the app on the Sound panel.
  useEffect(() => onOpenTarget(target => target === 'sound' && setTimeout(() => focus(sound), 400)), []);
  return (
    <ScrollView
      ref={scroll}
      style={styles.root}
      contentContainerStyle={[styles.content, {paddingTop: insets.top, paddingBottom: insets.bottom + 8}]}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={32}
      onScroll={e => (scrollY.current = e.nativeEvent.contentOffset.y)}>
      <Header onSettings={onSettings} onJump={jump} />
      <Listening volumeRef={volume} />
      <Playback />
      <FeedbackRow />
      <View style={styles.grid}>
        <Sound headingRef={sound} />
        <Tuning />
      </View>
      <RoomSetup />
      <SystemMonitor />
      <Details locales={phoneLocales()} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  content: {paddingHorizontal: 16, maxWidth: 1120, width: '100%', alignSelf: 'center'},
  grid: {gap: 16},
});
