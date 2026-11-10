# JBL Bar Access

A native Android remote for the JBL Bar 9.1, built on the local control API that
`jbl-bar-toolkit` serves on the bar. It mirrors the toolkit's web remote screen for screen and
rule for rule, and is built for people who use TalkBack, Switch Access or large text.

No cloud, no accounts, no telemetry. LAN only (`192.168.100.0/24`).

## Layout

```
app/         React Native app (Android only)
  src/api/           HTTP client, SSE adapter, connection probe
  src/engine/        controller (queue, coalescing, planned volume, sessions, busy gate),
                     capabilities, segments, view rules, EQ / offset / monitor models
  src/components/    AppSlider+steppers+dialog (ValueControl), Segmented, Picker, Disclosure…
  src/screens/       RemoteScreen (one scroll view), SettingsScreen
  src/notifications/ battery threshold, monitor, Notifee, background fetch
  src/theme/         tokens ported from the web CSS, contrast checker
  __tests__/         engine, view, components, battery, API vs mock-bar, live (opt-in)
mock-bar/    fake toolkit API with scenarios
docs/        api-notes, accessibility-checklist, battery-trigger, toolchain
```

## Develop

```sh
cd app
npm test                      # 90+ tests: engine, components, API against mock-bar
LIVE_BAR=192.168.100.25 npx jest __tests__/live.test.ts   # read-only check of the real bar
npx tsc --noEmit
node ../mock-bar/server.js --port 8080                     # then point Settings at this Mac
```

Build and install: see `docs/toolchain.md`.

## Status

See `CHANGELOG.md`.
