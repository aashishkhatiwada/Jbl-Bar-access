# Toolchain

Installed on 2026-11-10 (plan §9.1). Deviations from the plan are marked.

| Item | Installed | Note |
|---|---|---|
| JDK 17 | `brew install openjdk@17` → 17.0.21 | **Deviation:** formula instead of the `temurin@17` cask — no macOS password prompt. |
| SDK tools | `brew install --cask android-commandlinetools` | |
| SDK root | `~/Library/Android/sdk` | |
| Packages | `platform-tools`, `platforms;android-37.0`, `build-tools;37.0.0`, `ndk;27.1.12297006`, `cmake;3.22.1` | RN 0.88 needs API 37 / build-tools 37 / NDK 27.1, not the 35 in the plan. |
| Node | v25.9.0 | RN CLI and Jest work on it; no pin needed so far. |
| React Native | 0.88.1, new architecture | **Deviation:** legacy architecture was removed in RN 0.82, so `newArchEnabled=false` is not possible. All libraries build and load through the new architecture / interop layer. |

## Environment

Editing `~/.zshrc` was not permitted from the agent session. Add these lines yourself:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

`app/android/local.properties` points Gradle at the SDK, so builds work without `ANDROID_HOME`
as long as `JAVA_HOME` is set.

## Build and install

```sh
cd app/android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The debug APK bundles the JavaScript (`debuggableVariants = []` in `app/build.gradle`), so it runs
without Metro.

## Verify

```sh
java -version
sdkmanager --sdk_root=$ANDROID_HOME --list_installed
adb devices
cd app && npm test && npx tsc --noEmit
```
