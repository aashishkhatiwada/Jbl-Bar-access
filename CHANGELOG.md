# Changelog

## Unreleased

- Battery threshold (14 %) confirmed by analysing the bar's own `bdpprog` (build 310669); the rule is
  unchanged from 21.23.11.80. Docs updated; no behaviour change.

## 0.6.2 — 2026-11-11 (second on-device pass) · experimental pre-release

Published as a public debug build on branch `release/0.6.2-experimental`, tag
`v0.6.2-experimental` (`releases/`, version code 602).

Checked on the phone (Redmi Note 13, Android 17, screen reader TalkMan/Jieshuo):
- Footer shows "Live updates"; system monitor fills with live samples.
- Settings → Test connection: "Connected · JBL Bar 9.1 answered. Power: On."
- Battery alerts panel: permission Allowed, live battery and dock state, last check.
- Fixed: battery labels truncated, then sharing a line with the bass caption; light
  system navigation bar over the dark page; Test connection result laid out side by side.
- Selected source now says "selected" in its spoken label; every button has an explicit label.
- New whole-screen accessibility audit test.

## 0.6.1 — 2026-11-10 (first on-device run)

Installed on Redmi Note 13 (Android 17, API 37) over wireless adb.
- Works: connects, shows live state, live updates, Android 17 local-network permission granted,
  Sound panel and Set value dialog render as designed.
- Fixed: rear battery labels overflowed the speaker drawing; SSE line endings set to `\n`
  (library warned it could not detect them); notification permission now requested at startup.

## 0.6.0 — 2026-11-10 (M0–M6 code complete, APK built, not yet tested on a phone)

APK: `dist/jbl-bar-access-0.6.0-m6-debug.apk` (debug-signed, JS bundled, arm64 + armv7).

### M0 Foundations
- Toolchain: JDK 17 (Homebrew formula), Android SDK 37 / build-tools 37 / NDK 27.1.
- RN 0.88.1 project, package `com.jblbaraccess.app`, label "JBL Bar Access", cleartext LAN traffic.
- Theme tokens ported from the web CSS; API client with plan timeouts and error mapping.
- Settings: host address, Test connection (connected / restarting / wrong network / offline / not the toolkit).

### M1 Live layer
- SSE stream with reconnect back-off (1/2/5/10 s), polling fallback every 5 s, 30 s silence watchdog,
  quiet recycling every 10 min, foreground/background lifecycle.
- Revision ordering, CSRF session change → queue cleared and features refetched. "Synced N s ago".

### M2 Engine
- Single-flight queue, opposite-tap coalescing, 8-tap cap, never replay on disconnect.
- Planned volume transactions ("Setting volume 25… (7 of 15)"), cancellable.
- Segment step planning, capability mapping, busy gate with 800 ms grace, automation/calibration locks.

### M3–M5 UI
- Header, listening panel (speaker drawing + spoken summary), sources, Bluetooth, volume
  (slider + steppers + typed entry + hold-to-repeat), playback, feedback.
- Sound: mode, bass, center, atmos, rear, night, audio format, audio sync (slider + steppers + dialog).
- Front EQ (graph, presets, five band controls, Apply/Reset, keep-while-standby), bass offset.
- Room setup, system monitor (CPU/RAM charts with text equivalents), details, manual, help, footer.

### M6 Battery notification
- Threshold 14 % from static analysis of `bdpprog` (docs/battery-trigger.md).
- Notifee channel "Soundbar battery", permission handling, test notification, dedupe and re-arm,
  WorkManager background check, Settings status rows and limits copy.

### Not done
- APK built but not yet installed on the phone; no TalkBack/Switch Access/200 % device pass (M7).
- Bar's `bdpprog` hash not yet compared with the analysed firmware.
