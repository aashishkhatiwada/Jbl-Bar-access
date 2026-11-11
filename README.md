# JBL Bar Access

> ⚠️ **Experimental pre-release (0.6.2, public debug build).** See
> [releases/RELEASE_NOTES.md](releases/RELEASE_NOTES.md) for what is and isn't tested.

An accessible Android remote for the **JBL Bar 9.1** soundbar.

It talks to the local control API that [`jbl-bar-toolkit`](https://github.com/kisinga/jbl-bar-toolkit)
serves on the bar, and mirrors the toolkit's web remote section for section and rule for rule.
It is built for people who find the stock IR remote hard to use. Screen readers, switch access and
large text are requirements, not extras.

- No cloud, no accounts, no telemetry. The app only ever talks to the bar on your Wi-Fi.
- No firmware changes. The toolkit stays exactly as installed.
- Android only.

**Status:** 0.6.2, in testing. Runs on a Redmi Note 13 (Android 17) against a live bar. Reading
state, live updates, Settings and battery status are checked on the phone. The controls that change
the bar and the hands-on screen-reader pass are not tested on the phone yet. See
[CHANGELOG.md](CHANGELOG.md).

## What it does

| Area | Controls |
|---|---|
| Header | Connection status, refresh, power, settings |
| Listening room | Speaker drawing with rear battery and dock state, source (TV / ARC, HDMI, Bluetooth), Bluetooth pairing |
| Volume | Slider, − / + with hold-to-repeat, typed entry, mute, clear queued taps |
| Playback | Previous, play / pause, next, stop for Bluetooth and Cast sources |
| Sound | Standard / Smart mode, bass, center, Atmos height, rear level, night mode, audio format, audio sync |
| Tuning (experimental) | Front EQ (5 bands, presets, graph, apply / reset), bass offset |
| Room setup | Surround calibration, subwoofer pairing |
| System monitor | CPU and RAM history, storage, Wi-Fi traffic, uptime, load, Wi-Fi details |
| Details | Bluetooth name, Smart Mode automation, owner's manual, help |
| Battery alerts | A local notification when a detached rear speaker reaches 14 % |

Experimental panels appear only when the bar's `/api/features` says they are included, exactly as
on the web remote.

## Accessibility

- **Three ways to set any value with more than 6 steps** (volume, audio sync, EQ bands, bass offset):
  drag the slider, tap − / +, or type a number in the **Set value** dialog. Screen readers can also
  swipe up or down on the slider to step it.
- **Choices with 6 steps or fewer** are radio groups (bass 1–5, center 1–6, Atmos, rear, mode).
- **State is never colour alone.** The selected source says "selected", battery levels say "low" or
  "critical", and mute and night mode are switches with on/off state.
- **Results are announced** once ("Volume 14", "Night mode on."). Long volume changes are announced
  at the start and at the end, not at every step.
- 44 dp minimum touch targets, text that wraps at 200 % font size, no animations, and colours
  checked to 4.5:1 contrast.
- A visible **Jump to controls** link at the top moves focus to the volume panel.

Details and the on-phone test script: [docs/accessibility-checklist.md](docs/accessibility-checklist.md).

## Install

You need the JBL toolkit installed on the bar, and the phone on the same Wi-Fi network as the bar
(`192.168.100.x`). The toolkit refuses other networks.

1. Download [`releases/jbl-bar-access-0.6.2-experimental-debug.apk`](releases/jbl-bar-access-0.6.2-experimental-debug.apk)
   (check it against [`releases/SHA256SUMS`](releases/SHA256SUMS)), copy it to the phone and open
   it, or install it from a Mac:
   ```sh
   adb install -r releases/jbl-bar-access-0.6.2-experimental-debug.apk
   ```
   It is signed with React Native's public debug key, so a future release-signed build will need
   this one uninstalled first.
2. Open **JBL Bar Access**. Allow **Nearby devices** (Android 17 asks for this before an app can
   reach the local network) and **Notifications** (for battery alerts).
3. The address defaults to `192.168.100.25`. To change it, open **Settings** (the gear), enter the
   address, then **Test connection** and **Save address**.

Test connection reports one of: connected, soundbar starting, wrong network, not reachable, or not
the toolkit remote.

## Battery alerts

The bar shows "REAR SPKR LOW BATT" when a rear speaker reaches **14 %**. That value was read from the
bar's firmware ([docs/battery-trigger.md](docs/battery-trigger.md)). The app notifies you at the same
level:

- once per speaker, then again only after it has charged past 19 % or been docked;
- never while the speakers are docked, while the bar is in standby, or when the battery is not
  reported.

With the app open, alerts arrive as soon as the bar reports the level. In the background Android
checks about every 15 minutes, and later when the phone is saving battery. No alert arrives if the
app is force-stopped or the phone is off the bar's Wi-Fi. Settings shows the permission, the current
battery, and when the last check ran, and has a **Send test notification** button.

## How it behaves

The app follows the web remote's rules so the two never disagree:

- One command at a time. Taps queue (up to 8) and opposite volume taps cancel out.
- The bar only has volume up and down, so a jump from 10 to 25 is 15 confirmed steps, shown as
  "Setting volume 25… (7 of 15)" and cancellable with **Clear queued taps**.
- Live updates stream from the bar, with automatic reconnect and polling while the stream is down.
  The footer shows "Live updates" or "Synced N s ago".
- If the connection drops, queued taps are cleared and never replayed.
- When another remote or the toolkit's automation is busy, controls wait and say why.

## Development

```
app/                 React Native 0.88 app (TypeScript, Android only)
  src/api/           HTTP client, live stream, connection test
  src/engine/        controller (queue, volume plans, sessions, busy gate), features,
                     view rules, EQ / bass offset / monitor models
  src/components/    ValueControl (slider + steppers + Set value), Segmented, Picker, Disclosure…
  src/screens/       RemoteScreen (one scrolling page), SettingsScreen
  src/notifications/ threshold, alert logic, Notifee, background checks
  src/theme/         colours and sizes ported from the web remote, contrast checker
  __tests__/         engine, views, components, battery, accessibility audit, API vs mock-bar
mock-bar/            fake toolkit API with scenarios (standby, low battery, slow, restarting…)
docs/                toolchain, API notes, accessibility checklist, battery threshold
dist/                local build output (not committed)
releases/            published pre-release APK, checksum and notes (release branches only)
```

```sh
cd app
npm install
npm test               # 85 tests
npx tsc --noEmit       # typecheck
LIVE_BAR=192.168.100.25 npx jest __tests__/live.test.ts   # read-only check against the real bar
```

Without the bar, run the fake one and point the app's Settings at your computer's IP and port 8080:

```sh
node mock-bar/server.js --port 8080
curl -X POST localhost:8080/mock/scenario/low-battery
```

Building the APK needs JDK 17 and Android SDK 37. Setup, deviations from the plan, and build
commands are in [docs/toolchain.md](docs/toolchain.md):

```sh
cd app/android && ./gradlew assembleDebug
```

The debug APK includes the JavaScript bundle, so it runs without a Metro dev server.

## Known limits

- The API has no "set volume to N", so large volume changes take a few seconds.
- The audio format is only reported for TV / ARC and HDMI.
- Battery levels are the bar's last reported values and can lag while the speakers sleep.
- The battery threshold was read from firmware 21.23.11.80. It hasn't been confirmed that the bar's
  build 310669 uses the same program ([how to check](docs/battery-trigger.md#open-item)).
