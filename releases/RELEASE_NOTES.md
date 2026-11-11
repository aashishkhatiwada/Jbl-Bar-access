# JBL Bar Access 0.6.2 — experimental pre-release

> ⚠️ **Experimental pre-release, public debug build.** Not a stable release. Use it to try the app
> and report problems, not as your only remote.

| | |
|---|---|
| File | `jbl-bar-access-0.6.2-experimental-debug.apk` |
| Version | 0.6.2 (version code 602) |
| Package | `com.jblbaraccess.app` |
| Android | 7.0 or newer (API 24+); built for API 37 |
| CPU | arm64-v8a, armeabi-v7a |
| SHA-256 | see `SHA256SUMS` |
| Branch / tag | `release/0.6.2-experimental` / `v0.6.2-experimental` |

## What "debug build" means here

- **Signed with React Native's public debug key.** Anyone can sign an APK with that key, so the
  signature does not prove who built it. Check the SHA-256 against `SHA256SUMS` and download only
  from this repository.
- **Updates:** a later build signed with a private release key will not install over this one.
  Uninstall this build first; app settings (bar address, alert preference) will be lost.
- **Self-contained.** The JavaScript is bundled in, so no Metro dev server is needed. It may still
  log that it can't reach a dev server; that is harmless.
- Not optimised or minified, which is why it is about 74 MB.

## Tested

On a Redmi Note 13 (Android 17) against a JBL Bar 9.1 running `jbl-bar-toolkit`:

- Connects and shows the bar's state; live updates stream in.
- Settings → Test connection; battery alert status (permission, current battery, last check).
- Layout of the header, listening room (speaker drawing), sources, volume, playback, the top of the
  Sound panel, the system monitor, the footer and Settings. Front EQ, bass offset and room setup
  were not seen on the phone.
- 85 automated tests (controller, views, components, battery alerts, a whole-screen accessibility
  audit, and the API client against a fake bar).

## Not yet tested on a phone

- **Controls that change the bar:** volume, mute, sources, sound levels, night mode, audio sync,
  Front EQ, bass offset, calibration, subwoofer pairing, playback. Their logic is unit-tested
  against a simulated bar only.
- Reconnecting after the phone loses Wi-Fi (unit-tested only).
- A hands-on screen-reader pass (TalkBack / TalkMan), Switch Access, and 200 % text.
- A low-battery notification from a real draining speaker. The 14 % threshold was read from the
  bar's own firmware build 310669 (`docs/battery-trigger.md`), but no speaker has been drained to it.

## Install

1. Download `jbl-bar-access-0.6.2-experimental-debug.apk` and check it:
   ```sh
   shasum -a 256 -c SHA256SUMS
   ```
2. Open it on the phone and allow installing from that app, or use `adb install -r <file>`.
3. In the app, allow **Nearby devices** and **Notifications**.
4. The phone must be on the soundbar's Wi-Fi (`192.168.100.x`). Open Settings to change the address
   from the default `192.168.100.25`.

## Requirements and limits

- The `jbl-bar-toolkit` web remote must already be installed and running on the bar.
- LAN only. No cloud, no accounts, no telemetry.
- Battery alerts in the background run about every 15 minutes and stop if the app is force-stopped.
