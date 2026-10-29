---
title: "Building installable apps: APK, AAB and iOS"
description: "A step-by-step guide for newcomers (and the AI agent they hand it to): how to turn the Expo app into an Android APK or AAB and an iOS build, including a test APK that talks to the API on your Mac over Wi-Fi, what to check first, how signing works, and what to do when it fails. The same file lives in the starter kit and in the Expo boilerplate."
order: 2
author: "Platform Team"
lastUpdated: 1793318400000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["mobile", "expo", "android", "ios", "build", "release", "eas", "apk"]
---

# Building installable apps: APK, AAB and iOS

How to turn the Expo app into an app file you can put on a real phone, with no Expo Go and no Metro
running. It is written so a newcomer can follow it alone, **or hand it to Claude** (or another AI
agent) and say "do this with me". The agent instructions are in
[If you are an AI agent reading this](#if-you-are-an-ai-agent-reading-this).

**One guide, two repositories.** This file is kept identical in the starter kit
(`nestjs-nextjs-turborepo-starter-kit`, at `docs/technical/mobile/building-installable-apps.md`) and
in the Expo boilerplate (`expo-boilerplate`, at `docs/building-installable-apps.md`). Where the two
differ, the table below says how; everywhere else, the steps are the same.

| | Starter kit | Expo boilerplate |
| --- | --- | --- |
| **The app folder** (run the commands there; `android/`, `ios/`, `.env`, `config-plugins/`, `modules/` live in it) | `apps/mobile` | the repository root |
| App configuration | `app.config.ts` (identity from `MOBILE_*` variables) | `app.json`, with `app.config.ts` adding the identity from the same `MOBILE_*` variables |
| Package name / bundle id | `com.example.starter` (development default, from `MOBILE_BUNDLE_ID`) | `com.bishen.helloworld` |
| Has an API to talk to | Yes: `apps/api` (`EXPO_PUBLIC_API_URL`) | Not yet: `EXPO_PUBLIC_API_URL` is left empty (a local demo session); the Team list reads the public JSONPlaceholder demo API (`EXPO_PUBLIC_API_JSON_PLACEHOLDER`) |
| Run a script | `pnpm --filter @workspace/mobile exec …`, or `pnpm exec …` inside `apps/mobile` | `pnpm exec …` |

In this guide, **`<app>`** means the app folder of the repository you are in.

## Contents

0. [Quick reference: a test APK into `dist/`](#0-quick-reference-a-test-apk-into-dist)
1. [Pick a route](#1-pick-a-route)
2. [The words you will meet](#2-the-words-you-will-meet)
3. [One-time setup](#3-one-time-setup)
4. [Before any build: the checklist](#4-before-any-build-the-checklist)
5. [Generate the native projects (prebuild)](#5-generate-the-native-projects-prebuild)
6. [Android: a test APK](#6-android-a-test-apk)
7. [Android: a test APK that talks to the API on your Mac over Wi-Fi](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi)
8. [Android: an AAB for Google Play](#8-android-an-aab-for-google-play)
9. [Android: signing with your own key](#9-android-signing-with-your-own-key)
10. [iOS](#10-ios)
11. [EAS Build (cloud builds)](#11-eas-build-cloud-builds)
12. [Version numbers](#12-version-numbers)
13. [Never commit these](#13-never-commit-these)
14. [When it fails](#14-when-it-fails)
15. [Checklist](#15-checklist)
16. [If you are an AI agent reading this](#if-you-are-an-ai-agent-reading-this)
17. [Known gaps](#17-known-gaps)
18. [Verified](#18-verified)

---

## 0. Quick reference: a test APK into `dist/`

For someone who has built before and only needs the commands. Run them in **`<app>`**.

```bash
# 1. Only if android/ is missing, or after changing app.config.ts / app.json, a config plugin or a native package:
pnpm exec expo prebuild --platform android          # add --clean after a native change
git status --short                                  # boilerplate: revert app.json if prebuild changed it (section 5)

# 2. Build the test APK (release, debug-signed, JavaScript bundled inside, phone CPUs only)
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
cd ..

# 3. Copy it into dist/ under a clear name (dist/ is git-ignored, so it is never committed)
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/app-1.0.0-release.apk

# 4. Install on a phone over USB (-r replaces an installed copy and keeps its data)
adb install -r dist/app-1.0.0-release.apk          # add -s <serial> when an emulator is also connected
```

- The Gradle build does **not** write to `dist/`. Step 3 copies the APK there by hand.
- **The file is not "unsigned".** It is signed with the debug key, which is what lets a phone install
  it. Android refuses an APK with no signature at all ([6.1](#61-a-truly-unsigned-apk-and-why-you-rarely-want-one)).
- Starter kit: a release build needs an API address first ([4.3](#43-the-app-knows-which-api-to-talk-to)).
  To test against the API on your Mac from a phone on Wi-Fi, follow [section 7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi).

| Command (in `<app>/android`, unless noted) | What you get | Output |
| --- | --- | --- |
| `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a` | Test APK for phones (about 61 MB in the boilerplate) | `app/build/outputs/apk/release/app-release.apk` |
| `./gradlew assembleRelease` | The same APK, also for x86 emulators (bigger, slower to build) | same |
| `./gradlew assembleDebug` | Debug APK: loads JavaScript from Metro (`pnpm start`) on the same Wi-Fi; has the dev menu | `app/build/outputs/apk/debug/app-debug.apk` |
| `./gradlew bundleRelease` | `.aab` for Google Play only (cannot be installed on a phone) | `app/build/outputs/bundle/release/app-release.aab` |
| `npx expo run:android --variant release` (in `<app>`) | Builds the release APK **and** installs it on the connected device or emulator | same as `assembleRelease` |

`npx expo run:android` with no `--variant` builds and installs a **debug** build, which needs Metro.

## 1. Pick a route

| You want to… | Build | Section | Needs |
| --- | --- | --- | --- |
| Try the app on your own Android phone | Release APK, debug-signed | [6](#6-android-a-test-apk) | JDK 17 and the Android SDK. No accounts |
| Try it on a phone on your Wi-Fi, against the API on your Mac (starter kit) | LAN test APK | [7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi) | The same, plus the API running on your Mac |
| Upload to Google Play | Release AAB, signed with your upload key | [8](#8-android-an-aab-for-google-play), [9](#9-android-signing-with-your-own-key), or [11](#11-eas-build-cloud-builds) | Your own upload key; a Google Play developer account |
| Send a test build to other Android users | Release APK, signed with your own key | [9](#9-android-signing-with-your-own-key) | Your own key |
| Run on the iOS Simulator | Release build for the simulator | [10.2](#102-ios-simulator) | A Mac with full Xcode. No Apple account |
| Run on your own iPhone | Xcode build with your Apple ID | [10.3](#103-your-own-iphone) | Xcode, a free Apple ID |
| TestFlight, the App Store, or an `.ipa` for others | Archive | [10.4](#104-an-ipa-testflight-app-store-ad-hoc), or [11](#11-eas-build-cloud-builds) | The Apple Developer Program (paid, yearly) |
| iOS without a Mac, or builds a whole team can repeat | EAS Build | [11](#11-eas-build-cloud-builds) | An Expo account |

Two facts that save the most confusion:

- **There is no installable "unsigned" Android app.** A "test" APK is one signed with the **debug key**
  that every Android SDK creates. That is what sections 6 and 7 build.
- **An `.aab` cannot be installed on a phone.** It is the format Google Play takes; Play turns it into
  APKs for each device.

## 2. The words you will meet

| Word | What it means here |
| --- | --- |
| **Expo Go** | The app from the stores that runs the JavaScript during development. It is not our app: our name, icon, Face ID, Google's QR scanner and the in-app PDF engine only work in a real build. |
| **Development (debug) build** | Our own app, with a dev menu, loading JavaScript from Metro like Expo Go does. |
| **Release build** | Our own app with the JavaScript bundled inside. It runs with no computer and no Metro. This is what testers and stores get. `__DEV__` is `false`, and R8 shrinks the native code. |
| **APK** | An Android app file you can install directly on a phone. Good for testers. |
| **AAB** (Android App Bundle) | The file Google Play wants. You cannot install it directly on a phone. |
| **IPA** | The iOS app file, made by *archiving* in Xcode or by EAS. |
| **Prebuild** | `npx expo prebuild` generates the native projects `<app>/android/` and `<app>/ios/` from the app configuration and the config plugins. Both folders are **generated and git-ignored**: never edit them expecting the change to last, never commit them. |
| **Config plugin** | A small file in `<app>/config-plugins/` that prebuild runs to change the generated native projects, so a native change survives every prebuild. |
| **R8** | The tool that shrinks and renames a release build's native code (`android.enableMinifyInReleaseBuilds=true`). |
| **Signing** | Every Android and iOS app is signed with a key that proves who made it. A store only accepts updates signed by the same key. |
| **Upload key** (Android) | The key you sign AABs with before uploading. Google Play re-signs the app for phones with its own *app signing key* (Play App Signing). |
| **Certificate + provisioning profile** (iOS) | Apple's signing: a certificate for your team, and a profile saying which app may run on which devices. |
| **EAS Build** | Expo's cloud build service. It builds and signs both platforms, so no Mac is needed for iOS. |

## 3. One-time setup

### 3.1 Everyone

- Node and pnpm, with `pnpm install` done at the repository root.

### 3.2 Android (macOS, Windows or Linux)

| Need | Check it | Notes |
| --- | --- | --- |
| JDK 17 | `java -version` → `17.x` | Android Studio bundles one; on macOS `brew install --cask zulu@17` works too |
| Android SDK | `echo $ANDROID_HOME` → a path, e.g. `~/Library/Android/sdk` | Android Studio → *Settings → Languages & Frameworks → Android SDK*: the latest platform; Build-Tools, Platform-Tools, Emulator and NDK |
| `adb` (to install over USB) | `adb version` | In `$ANDROID_HOME/platform-tools` |
| Something to install on | `adb devices` lists it | An emulator (Android Studio → *Device Manager*), or a phone with *Developer options → USB debugging* on |

If `ANDROID_HOME` is empty, add this to `~/.zshrc` and open a new terminal:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # Linux: $HOME/Android/Sdk
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

### 3.3 iOS (macOS only)

| Need | Check it | Notes |
| --- | --- | --- |
| Xcode (the full app, not just the Command Line Tools) | `xcode-select -p` → `/Applications/Xcode.app/Contents/Developer` | From the Mac App Store. Open it once to accept the licence. If it prints `/Library/Developer/CommandLineTools`, run `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` |
| An iOS Simulator runtime | Xcode → *Settings → Components* | |
| CocoaPods | `pod --version` | `brew install cocoapods`. Prebuild runs `pod install` for you |
| An Apple ID (your own iPhone) or the Apple Developer Program (anyone else's) | Xcode → *Settings → Accounts* | See [10](#10-ios) |

## 4. Before any build: the checklist

Work through this every time. Most "the build works but the app is broken" reports come from
skipping it.

### 4.1 The repository is healthy

A build compiles what is there, broken or not. At the repository root:

```bash
pnpm run lint && pnpm run typecheck && pnpm run test
```

Then, in `<app>`: `pnpm exec expo install --check` (every Expo package matches the SDK).

That last check matters most. The app's JavaScript and native code must agree on versions: a
`react-native` one patch ahead of what the Expo SDK expects can build fine and then fail at launch
with `Cannot find native module …`. If it lists packages, **don't** blindly run `expo install --fix`.
pnpm refuses releases younger than a day (`minimumReleaseAge`), and the starter kit's version policy
(`syncpack`) pins React Native to the SDK's version. Ask a maintainer.

### 4.2 The app's identity

- Both repositories: read by `<app>/app.config.ts` on the build machine, from `<app>/.env` or the
  shell. Products rename the app with these variables, never by editing a file. The defaults below
  are the starter kit's; the boilerplate's are `app.json`'s (`hello-world`, `com.bishen.helloworld`).

  | Variable | Default | Notes |
  | --- | --- | --- |
  | `MOBILE_APP_NAME` | `Starter` | The name under the icon (30 characters at most) |
  | `MOBILE_BUNDLE_ID` | `com.example.starter` | The iOS bundle identifier **and** the Android package name. **Permanent once published:** a store treats a new id as a new app. `com.example.*` is for development only |
  | `MOBILE_SCHEME` | `starter` | The deep-link URL scheme |
  | `MOBILE_APP_SLUG` | `starter` | The Expo project slug (used by EAS) |

- **Boilerplate:** `app.json` keeps the rest of the native configuration; `app.config.ts` lays the
  identity over it.

### 4.3 The app knows which API to talk to

*Starter kit. In the boilerplate `EXPO_PUBLIC_API_URL` is left empty until it is connected to an API;
an empty value means "no API" there, and the same rules apply once it is set.*

A release build has **no dev server**, so it cannot find the API on your laptop the way Expo Go does.
Set the API's address in `apps/mobile/.env` before building (copy `.env.example` if you have none):

```bash
EXPO_PUBLIC_API_URL=https://api.your-domain.com
```

- It must be an absolute **`https://`** URL. Outside development the app refuses `http://` and shows
  its configuration-error screen naming `EXPO_PUBLIC_API_URL`. The one exception is a LAN test APK
  ([section 7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi)).
- `EXPO_PUBLIC_*` values are **baked into the app at build time**, and anyone can read them from the
  installed app. Never put a secret in one. Changing a value means building again.

### 4.4 The demo logins (both repositories)

`EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` in `<app>/.env` puts the one-tap demo logins on the sign-in
screen of a **release** build too. Development builds always have them.

- Without the flag, the list and its passwords are left out of the bundle entirely, which is what a
  store build needs. With it, the passwords are inside the APK: never set it for a build that leaves
  the team.
- `true`, `false` or unset. Any other value is a configuration error: the app opens on its
  configuration-error screen, which names the variable and shows an example.

### 4.5 The native sources are present

The in-app PDF viewer is a small local native module, `<app>/modules/pdf-renderer` (ADR 056). Check
its sources are in your checkout. In the starter kit run `git ls-files apps/mobile/modules/pdf-renderer`;
in the boilerplate, `git ls-files modules/pdf-renderer`.

You should see `ios/PdfRendererModule.swift`, `ios/PdfRenderer.podspec`, `android/build.gradle` and
`android/src/main/java/expo/modules/pdfrenderer/PdfRendererModule.kt` beside
`expo-module.config.json`. If only the JSON file is listed, the build still succeeds, but the app has
no PDF engine.

## 5. Generate the native projects (prebuild)

Do this once, and again after any change to the app configuration, a config plugin, a native
dependency, `modules/`, or a **prebuild-time variable** (`EXPO_PUBLIC_ALLOW_LAN_HTTP_API`,
`MOBILE_*`). In `<app>`:

```bash
pnpm exec expo prebuild --platform android   # Android only
pnpm exec expo prebuild --platform ios       # iOS only (macOS, needs CocoaPods)
pnpm exec expo prebuild                      # both
```

- Add `--clean` to delete and regenerate the folders from scratch. Use it when a native build
  behaves strangely after an upgrade.
- `npx expo run:android` / `run:ios` also run prebuild when the folder is missing.
- **Boilerplate:** the first run asks for an Android package name and an iOS bundle identifier, and
  writes what it asked or inferred back into `app.json`. Just trying a build? Revert it:
  `git checkout -- app.json package.json`. Shipping for real? Keep `android.package` and
  `ios.bundleIdentifier` in `app.json` in a reviewed change.

**Verify:**

```bash
ls android/app/build.gradle    # the Android project exists
git status --short             # android/ and ios/ must NOT appear (they are ignored)
```

## 6. Android: a test APK

A **release** build signed with the **debug key**:

- the JavaScript is bundled inside, so no Metro is needed;
- it runs at release speed, with no dev menu;
- it installs on any phone that allows "Install unknown apps".

The generated `android/app/build.gradle` signs release builds with the debug key
(`signingConfig signingConfigs.debug`), so no setup is needed. In `<app>`:

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
cd ..
```

- `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` builds for phone CPUs only: faster, and a smaller
  APK. Leave it out to also include `x86`/`x86_64` for emulators.
- The first build downloads Gradle and its dependencies and can take 10–20 minutes; later builds
  are faster.

**Output:** `<app>/android/app/build/outputs/apk/release/app-release.apk`. Copy it into `dist/` under
a clear name ([0](#0-quick-reference-a-test-apk-into-dist)).

**Verify** (the build tools are in the SDK):

```bash
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
"$BT/apksigner" verify --print-certs dist/app-1.0.0-release.apk   # "CN=Android Debug" = the debug key
"$BT/aapt2" dump badging dist/app-1.0.0-release.apk | grep -E "^package|native-code"
unzip -l dist/app-1.0.0-release.apk | grep index.android.bundle   # the JavaScript is inside
```

### Install it

- **Over USB** (Developer options → USB debugging on the phone, then accept the prompt):

  ```bash
  adb devices                                    # lists the phone; note its serial
  adb install -r dist/app-1.0.0-release.apk      # -r: replace an installed copy, keep its data
  adb -s <serial> install -r dist/app-1.0.0-release.apk   # when an emulator is also connected
  ```

- **Without a cable:** send the file to the phone (Google Drive, a messaging app, email), tap it,
  and allow "Install unknown apps" for the app that opened it.

### 6.1 A truly unsigned APK (and why you rarely want one)

"Unsigned" is often used loosely to mean "not signed with the real store key". The APK above is that:
it is signed with the debug key. A **truly** unsigned APK has no signature at all, and **no phone
installs it**: the install fails with "App not installed" (`INSTALL_PARSE_FAILED_NO_CERTIFICATES`
over `adb`).

You only need one when somebody else signs the app: a release manager, or a signing service that
takes an unsigned file. To get one:

1. In `android/app/build.gradle`, under `buildTypes { release { … } }`, delete the line
   `signingConfig signingConfigs.debug`.
2. Build: `cd android && ./gradlew assembleRelease`.
3. The output is now **`app/build/outputs/apk/release/app-release-unsigned.apk`**: Gradle adds
   `-unsigned` to the name.

To sign it by hand later, with your own keystore from [9.1](#91-create-the-keystore-once):

```bash
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
"$BT/zipalign" -p -f 4 app-release-unsigned.apk app-release-aligned.apk   # align first, then sign
"$BT/apksigner" sign --ks ~/keys/app-upload.jks --ks-key-alias upload \
  --out app-release-signed.apk app-release-aligned.apk
"$BT/apksigner" verify --print-certs app-release-signed.apk
```

Step 1 edits a generated file, so the next `prebuild --clean` puts the debug signing back. That is
usually what you want.

### 6.2 How a release build differs from Expo Go and a debug build

A release build turns off development-only code (`__DEV__` is `false`) and shrinks the native code
with R8. On a phone you will notice:

| Feature | Expo Go / debug build | Release APK | Why |
| --- | --- | --- | --- |
| Demo logins on the sign-in screen | Shown | Only when built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` | `src/lib/env.ts` (`loadBundledDemoAccounts`) bundles the list only in development or with the flag ([4.4](#44-the-demo-logins-both-repositories)) |
| "Sign out and replay onboarding" (Settings → About) | Shown | Only when built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` (a test build) | `canReplayOnboarding(env)` in `src/lib/env.ts`: development and test builds, never a store build. Onboarding's "seen" flag outlives a reinstall, so this is how a tester sees it again |
| Component gallery (drawer → Developer) | Shown | Hidden | Development-only by design: the route redirects to Settings and the code is left out of the bundle |
| PDF viewer | Expo Go: hands the file to another app. Debug build: pages in the app | Pages in the app | The engine (`modules/pdf-renderer`) exists only in a real build. Its toolbar has paging ("1 / 3"), zoom, search (Android 15 and newer; iOS) and a "More actions" menu with Download (Android: into Downloads; iOS: Save to Files) and "Open in another app" |
| QR scanner (Android) | Expo Go: the app's own camera scanner. Debug build: Google's scanner | Google's scanner | Kept working by the release keep rules ([6.3](#63-release-keep-rules-r8)) |
| API | Starter kit: found on your laptop (Expo Go) | Only the address it was built with (boilerplate: none yet) | [4.3](#43-the-app-knows-which-api-to-talk-to), [7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi) |

### 6.3 Release keep rules (R8)

R8 removes and renames classes nothing refers to directly. Two things native code looks up **by
name** at runtime broke in a release build, while a debug build was fine:

- ML Kit's scanner entry point (`com.google.mlkit.vision.barcode.BarcodeScanning`), which expo-camera
  checks before it opens Google's scanner. The release APK opened the camera scanner instead.
- Expo's error classes, whose codes come from their class names. Closing Google's scanner opened the
  camera scanner too, and the PDF viewer's error codes were wrong.

`<app>/config-plugins/release-keep-rules.pro` keeps them, with the reason written next to each rule.
The config plugin `<app>/config-plugins/release-keep-rules.ts` adds that file to the release build at
prebuild. It is registered in `plugins` (`app.config.ts` / `app.json`). Check a build with:

```bash
grep -E "^com\.google\.mlkit\.vision\.barcode\.BarcodeScanning |^expo\.modules\.camera\.CameraExceptions " \
  android/app/build/outputs/mapping/release/mapping.txt
# both lines must map each class to itself (kept, not renamed)
```

Leave minify on. Turning it off hides these problems instead of fixing them, and ships a bigger app.

## 7. Android: a test APK that talks to the API on your Mac over Wi-Fi

*Written for the starter kit, which has an API. The boilerplate has the same flag and plugin, ready for
when it is connected to one; until then its test APK from [section 6](#6-android-a-test-apk) needs
nothing more.*

For testing the real app on a phone that is **not** connected to your Mac by USB, against the API
running on your Mac, with no Metro and no cloud. The phone and the Mac must be on the **same Wi-Fi**.

A normal release build refuses this twice: the app requires an `https://` API outside development,
and Android blocks plain `http://` in a release build. One build-time flag,
`EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true`, relaxes both, **for that build only**:

- `apps/mobile/src/lib/env.ts` then accepts an `http://` API address, but only to a **private LAN
  address** (`10.x`, `172.16–31.x`, `192.168.x`). Anything else still needs `https://`.
- The config plugin `apps/mobile/config-plugins/lan-http-api.ts` allows plain http in the generated
  Android manifest (`android:usesCleartextTraffic`). Without the flag, the next prebuild removes it
  again.

**Never use this for a build that leaves your desk:** the app's traffic to the API is unencrypted on
the Wi-Fi.

### 7.1 Steps

1. **Let the API accept connections from the network.** By default it listens on `127.0.0.1` only,
   which a phone cannot reach. In `apps/api/.env` set:

   ```bash
   HOST=0.0.0.0
   ```

   Then start the stack as usual: `pnpm docker:up`, then `pnpm run dev` at the repository root. On
   macOS, allow incoming connections for `node` if the firewall asks.

2. **Find your Mac's Wi-Fi address:**

   ```bash
   ipconfig getifaddr en0          # e.g. 192.168.1.20 (Linux: hostname -I)
   ```

3. **Check the phone can reach it.** Open `http://192.168.1.20:8080/health` in the phone's browser,
   using your address. It must answer. If it doesn't, see the troubleshooting rows below before
   building anything.

4. **Generate the native project with the flag.** It is a prebuild-time setting. In `apps/mobile`:

   ```bash
   export EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true
   export EXPO_PUBLIC_API_URL=http://192.168.1.20:8080     # your Mac's address from step 2
   pnpm exec expo prebuild --platform android
   grep -o 'android:usesCleartextTraffic="true"' android/app/src/main/AndroidManifest.xml   # must print it
   ```

   You can put both lines in `apps/mobile/.env` instead of exporting them, but remember to take them
   out again (step 7).

5. **Build the APK in the same shell**, so the bundle gets the same values:

   ```bash
   cd android
   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
   cd ..
   mkdir -p dist && cp android/app/build/outputs/apk/release/app-release.apk dist/app-1.0.0-lan.apk
   ```

   Add `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` ([4.4](#44-the-demo-logins-both-repositories)) if you
   want the one-tap demo logins in it.

6. **Put it on the phone without a cable:** send `dist/app-1.0.0-lan.apk` to the phone (Google
   Drive, a messaging app, email), tap it, and allow "Install unknown apps". Open the app and sign in.

7. **Afterwards, go back to a normal build.** Unset the variables (or remove them from `.env`) and run
   `pnpm exec expo prebuild --platform android` again. The plugin removes the cleartext permission:
   `grep -c usesCleartextTraffic android/app/src/main/AndroidManifest.xml` prints `0`.

Notes:

- **The phone's own hotspot works too.** Turn the hotspot on, connect the Mac to it, then run
  `ipconfig getifaddr en0` on the Mac: that address (an iPhone hotspot hands out `172.20.10.x`, an
  Android one usually `192.168.x.x` or `10.x.x.x`, all private) is the one to build with. Every other
  step is the same. The phone reaches the Mac directly, with no internet traffic. Two things change:
  the address is new each time the Mac joins the hotspot, so build again whenever it changes; and if
  `en0` prints nothing, the Mac is not on Wi-Fi (check `ipconfig getifaddr en1`, or *System
  Settings → Wi-Fi → Details*).
- **The address is baked in.** If your Mac gets a new address (another network, or the router hands
  out a new one), build again with the new one.
- **An emulator on the same Mac** reaches the Mac at `10.0.2.2`, a private address, so
  `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080` works there with the default `HOST`.
- The APK is debug-signed like any test APK ([6](#6-android-a-test-apk)). "Unsigned" in the strict
  sense cannot be installed ([6.1](#61-a-truly-unsigned-apk-and-why-you-rarely-want-one)).

### 7.2 Your phone's hotspot, step by step

Yes, this works with the phone's own hotspot, but pasting the IP alone isn't enough. Three things
block it by default, and each needs one setting.

**Why there are three settings.** "localhost" on your phone means the phone itself, so the app must
use the Mac's hotspot IP. Then three things stand in the way:

1. **The API only listens on the Mac itself.** By default it accepts connections from `127.0.0.1`
   only, so your phone can't reach it, even with the right IP.
2. **The app refuses `http://` in a release APK.** Its env check allows only `https://` outside
   development, unless the LAN flag is on.
3. **Android blocks plain `http://` in a release APK.** The flag also lifts this, but only when you
   run prebuild after setting it.

**The steps** (starter kit):

1. **API** – in `apps/api/.env`, add `HOST=0.0.0.0`, then restart `pnpm run dev`.
2. **Hotspot** – turn it on on your phone and connect the Mac to it. On the Mac, run
   `ipconfig getifaddr en0`; say it prints `172.20.10.2`.
3. **Check from the phone** – open `http://172.20.10.2:8080/health` in the phone's browser. If that
   doesn't load, the app won't connect either; fix this first (on macOS, allow `node` through the
   firewall).
4. **App** – in `apps/mobile/.env`:

   ```bash
   EXPO_PUBLIC_API_URL=http://172.20.10.2:8080
   EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true
   ```

5. **Build**, in `apps/mobile`. Prebuild must come first, because that's where the http permission
   gets added:

   ```bash
   pnpm exec expo prebuild --platform android
   cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
   ```

6. **Install** `android/app/build/outputs/apk/release/app-release.apk` on the phone and sign in.

**Things to know:**

- **The IP is built into the APK.** If the Mac gets a different address (it reconnects to the
  hotspot, or joins another network), run `ipconfig getifaddr en0` again; if it changed, update
  `.env` and rebuild.
- **The Mac must stay on the phone's hotspot** while you test.
- **Afterwards**, remove the two lines from `apps/mobile/.env` and run prebuild again, so your next
  build is `https://`-only.
- **Verified:** first on the emulator against the local API, then by the owner on a real phone
  (2026-10-30), who signed in and used the app.

### 7.3 Why a flag, and not the alternatives

- **Always allowing `http://` in release builds:** a store build would then accept an unencrypted API
  address, and allow cleartext traffic for good. The flag keeps that to builds made on purpose.
- **A tunnel (`pnpm tools dev:tunnel`, a Cloudflare quick tunnel):** gives the local API a temporary
  `https://` address, so no flag is needed, and it also works when the phone is not on your Wi-Fi.
  But your local API is reachable through a third-party service while it runs. Use it when the phone
  cannot be on the same network.
- **A debug APK over Wi-Fi:** needs Metro (`pnpm start`) running on the Mac whenever you test, and
  behaves like development (`__DEV__`), not like the release the testers get.

## 8. Android: an AAB for Google Play

```bash
cd android
./gradlew bundleRelease
cd ..
```

**Output:** `<app>/android/app/build/outputs/bundle/release/app-release.aab`

- Do **not** pass `-PreactNativeArchitectures`: Play delivers the right CPU code to each phone, so the
  bundle should contain all of them.
- Out of the box this is signed with the **debug key**, and **Google Play rejects that.** Set up your
  own key first ([9](#9-android-signing-with-your-own-key)), then rebuild.
- To test an AAB on a device, upload it to a Play *internal testing* track, or use Google's
  `bundletool` (`build-apks --connected-device`, then `install-apks`).

## 9. Android: signing with your own key

Use your own key for anything other people install: Play uploads, or test APKs you send around.
Android only installs an update when it is **signed with the same key** as the installed app.

> **Keep the keystore and its passwords out of git, forever.** The safest place for the keystore is
> outside the repository entirely, with its passwords in your team's password manager. Lose the key
> and you cannot update the app; leak it and anyone can ship "updates" as you. With Play App Signing
> (the default for new apps), Google holds the real app key and yours is the *upload* key, which
> Google support can reset if it is lost.

### 9.1 Create the keystore (once)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/keys/app-upload.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` comes with the JDK. It asks for a password and your name or organisation.

### 9.2 Tell Gradle about it, outside the repository

Put the values in `~/.gradle/gradle.properties` (your user-wide Gradle file, never committed):

```properties
APP_UPLOAD_STORE_FILE=/Users/you/keys/app-upload.jks
APP_UPLOAD_KEY_ALIAS=upload
APP_UPLOAD_STORE_PASSWORD=your-store-password
APP_UPLOAD_KEY_PASSWORD=your-key-password
```

### 9.3 Use it for release builds

In `android/app/build.gradle`, add a `release` entry to `signingConfigs` and point the `release` build
type at it:

```groovy
signingConfigs {
    debug { /* unchanged */ }
    release {
        if (project.hasProperty('APP_UPLOAD_STORE_FILE')) {
            storeFile file(APP_UPLOAD_STORE_FILE)
            storePassword APP_UPLOAD_STORE_PASSWORD
            keyAlias APP_UPLOAD_KEY_ALIAS
            keyPassword APP_UPLOAD_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release   // was signingConfigs.debug
        // …the rest unchanged
    }
}
```

`android/` is generated, so **this edit is lost on `prebuild --clean`**. For a one-off build, redo it.
A team that signs regularly moves it into a config plugin in `<app>/config-plugins/` (passwords still
read from `~/.gradle/gradle.properties`), or uses EAS ([11](#11-eas-build-cloud-builds)).

**Verify** before uploading:

```bash
"$BT/apksigner" verify --print-certs android/app/build/outputs/apk/release/app-release.apk
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
# both must show your own name, NOT "CN=Android Debug"
```

Then upload the AAB in the Google Play Console (*Testing → Internal testing* first). The first upload
enrols the app in Play App Signing.

## 10. iOS

### 10.1 What Apple allows

| Goal | Needs | Lasts |
| --- | --- | --- |
| iOS Simulator | Xcode | Forever |
| Your own iPhone, plugged into your Mac | Xcode + a free Apple ID | **7 days**, then rebuild |
| Other people's iPhones (TestFlight, ad hoc `.ipa`, App Store) | Apple Developer Program (paid, yearly) | 90 days (TestFlight) or a year (ad hoc) |

There is no iOS equivalent of "send an APK and tap it": every iPhone install is signed for devices or
testers Apple knows about. All of these need **macOS with the full Xcode**. First generate the project
([5](#5-generate-the-native-projects-prebuild)): `pnpm exec expo prebuild --platform ios`.

### 10.2 iOS Simulator

```bash
npx expo run:ios --configuration Release            # builds, installs and opens the Simulator
```

The `.app` is under `ios/build/Build/Products/Release-iphonesimulator/`. Simulator builds do not run on
a real iPhone.

### 10.3 Your own iPhone

1. Open the workspace: `xed ios`, or open `ios/*.xcworkspace` (not the `.xcodeproj`).
2. Xcode → *Settings → Accounts* → **+** → add your Apple ID.
3. Select the app target → **Signing & Capabilities**: turn on **Automatically manage signing** and set
   **Team** (your Apple ID's "Personal Team", or your paid team). If the bundle identifier is
   "unavailable", change it to something unique.
4. Plug in the iPhone, unlock it and tap **Trust**. On iOS 16 and later also turn on *Settings →
   Privacy & Security → Developer Mode* (it restarts the phone).
5. Install a release build: `npx expo run:ios --configuration Release --device`, then pick the phone.
6. The first launch says "Untrusted Developer": on the phone, *Settings → General → VPN & Device
   Management* → your Apple ID → **Trust**.

A free-account install stops opening after **7 days**; plug in and build again. Face ID in the app
lock works only in real builds like this one, never in Expo Go.

### 10.4 An `.ipa` (TestFlight, App Store, ad hoc)

This needs the Apple Developer Program, and the app must first exist in App Store Connect (*Apps → +*)
with the same bundle identifier. In Xcode:

1. Target → *Signing & Capabilities* → **Team**: your paid team.
2. Destination: **Any iOS Device (arm64)**.
3. **Product → Archive.** The Organizer opens when it finishes.
4. **Distribute App**: **App Store Connect** (upload, then TestFlight or review), **Ad Hoc** (an `.ipa`
   for registered devices) or **Development**.
5. Raise the build number for every upload ([12](#12-version-numbers)).

The command-line equivalent, for automation (workspace and scheme names: `ls ios`):

```bash
xcodebuild -workspace ios/<Name>.xcworkspace -scheme <Name> \
  -configuration Release -archivePath build/app.xcarchive archive
xcodebuild -exportArchive -archivePath build/app.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ipa
```

Keep `ExportOptions.plist`, certificates and profiles **out of the repository**.

## 11. EAS Build (cloud builds)

EAS builds in Expo's cloud, keeps your signing credentials, and can count build numbers for you; it
is the recommended route for store releases. Neither repository is set up for it yet (no `eas.json`).
The boilerplate's rules keep it on Expo Go and local builds, so adding EAS there is a decision for its
maintainers.

```bash
cd <app>
pnpm dlx eas-cli@latest login     # a free Expo account
eas init                          # links the app to an Expo project
eas build:configure               # creates eas.json, which is reviewed and committed
```

A sensible starting `eas.json`:

```json
{
	"cli": { "appVersionSource": "remote" },
	"build": {
		"development": { "developmentClient": true, "distribution": "internal" },
		"preview": { "distribution": "internal", "android": { "buildType": "apk" } },
		"production": { "autoIncrement": true }
	},
	"submit": { "production": {} }
}
```

- `preview` gives an **APK** for testers; `production` gives an **AAB** for Play and a store build for
  iOS. `appVersionSource: remote` plus `autoIncrement` raises the build number on every production
  build.
- **EAS never receives `.env`** (it is git-ignored). Give each build its values in `eas.json`
  (`"env": { "EXPO_PUBLIC_API_URL": "…" }` per profile), or as EAS environment variables
  (`eas env:create`). A starter-kit build without `EXPO_PUBLIC_API_URL` installs fine and then opens on
  the configuration-error screen. Never set `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT` or
  `EXPO_PUBLIC_ALLOW_LAN_HTTP_API` in a `production` profile.
- Build: `eas build --platform android --profile preview` (APK), `--profile production` (AAB), and
  `eas build --platform ios --profile production`. Submit with `eas submit`.

## 12. Version numbers

Each store upload needs a higher build number than the last.

| | User-visible version | Build number |
| --- | --- | --- |
| Starter kit | `APP_VERSION` in `apps/mobile/app.config.ts` (sent to the API as `X-App-Version`; the API's `MOBILE_MIN_SUPPORTED_VERSION` can force an update, ADR 033) | Not set in `app.config.ts` yet, so always `1` ([17](#17-known-gaps)) |
| Boilerplate | `app.json` → `expo.version` | `expo.android.versionCode` (integer) / `expo.ios.buildNumber` (string) in `app.json` |

Change them, then run prebuild again. Two installs with the same build number are fine for testing;
the stores reject them.

## 13. Never commit these

| File | Why |
| --- | --- |
| `<app>/android/`, `<app>/ios/` | Generated by prebuild and git-ignored. Only the local modules' `ios/` and `android/` folders under `<app>/modules/` are source and are committed. |
| `dist/`, `*.apk`, `*.aab`, `*.ipa` | Built files. |
| `*.keystore`, `*.jks`, `*.p12`, `*.mobileprovision`, `*.p8`, `ExportOptions.plist` | Signing keys and certificates. Leaking one lets someone else publish "your" app. |
| `~/.gradle/gradle.properties`, App Store Connect or Play service-account keys | Passwords and API keys. |
| A `.env` that contains anything private | The starter kit's `apps/mobile/.env` is git-ignored. The boilerplate's `.env` holds public build settings only (`EXPO_PUBLIC_*`), never a secret. |

## 14. When it fails

| You see | Cause | Fix |
| --- | --- | --- |
| The app opens on the **configuration error** screen naming `EXPO_PUBLIC_API_URL` (starter kit) | The build had no API address, or an `http://` one | Set an `https://` `EXPO_PUBLIC_API_URL` ([4.3](#43-the-app-knows-which-api-to-talk-to)), or follow [7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi) for a LAN address, and build again |
| A LAN test APK says the network request failed | Android blocked plain http: the APK was built from an `android/` generated without the flag | Step 4 of [7.1](#71-steps): prebuild **with** `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true`, check the manifest line, build again |
| A LAN test APK can't reach the API, but the flag is set | The API listens on `127.0.0.1`, the Mac's firewall blocks `node`, the phone is on another network (a guest Wi-Fi often isolates devices), or the Mac's address changed | `HOST=0.0.0.0` in `apps/api/.env` and restart; allow `node` in the firewall; open `http://<address>:8080/health` in the phone's browser; rebuild with the current address |
| Configuration error naming `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT`, `EXPO_PUBLIC_ALLOW_LAN_HTTP_API` or `EXPO_PUBLIC_API_JSON_PLACEHOLDER` | A yes/no value other than `true`, `false` or blank, or a demo API address that is not `https://` | Fix the value, build again |
| No demo logins on the sign-in screen | The release build was made without `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` | [4.4](#44-the-demo-logins-both-repositories) |
| A release build opens the camera scanner instead of Google's, or closing Google's scanner opens the camera scanner, while a debug build is fine | The release keep rules are missing (plugin not registered, or `android/` generated before it) | [6.3](#63-release-keep-rules-r8): register the plugin, prebuild, build again |
| `Cannot find native module '…'` at launch | The JavaScript and native code disagree, usually a package newer than the Expo SDK expects | `pnpm exec expo install --check` ([4.1](#41-the-repository-is-healthy)) |
| The app opens to a red screen saying it cannot connect to Metro | You installed a **debug** APK | Build the release one ([6](#6-android-a-test-apk)), or run `pnpm start` |
| The PDF viewer offers "open in another app" in a real build | The module's native sources are missing, or you are in Expo Go | [4.5](#45-the-native-sources-are-present); open the installed app, not Expo Go |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` / "App not installed as package conflicts" | An installed copy was signed with a different key | Uninstall it (`adb uninstall <package>`), then install. This deletes its data |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | A phone-CPUs-only APK on an x86 emulator | Build without `-PreactNativeArchitectures`, or install on a phone |
| `INSTALL_PARSE_FAILED_NO_CERTIFICATES` / "App not installed" for `app-release-unsigned.apk` | The APK has no signature at all | Install the debug-signed one, or sign it first ([6.1](#61-a-truly-unsigned-apk-and-why-you-rarely-want-one)) |
| `adb: more than one device/emulator` | Phone and emulator both connected | `adb -s <serial> install …` |
| `SDK location not found` | Gradle cannot find the Android SDK | Set `ANDROID_HOME` ([3.2](#32-android-macos-windows-or-linux)), or write `sdk.dir=/path/to/sdk` into `android/local.properties` |
| `Unsupported class file major version`, or Gradle complains about Java | The wrong JDK | JDK 17: on macOS `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` |
| `A problem occurred starting process 'command 'node''` while evaluating settings, and `--stacktrace` shows `Failed to exec spawn helper` | The Gradle daemon (a Java process that stays running between builds) can no longer start child processes such as `node`. It typically happens after the JDK on disk changed while the daemon kept running. Node itself is fine | `cd android && ./gradlew --stop`, then build again ([14.1](#141-restart-gradle-and-rebuild-the-native-code)) |
| `Execution failed for task ':app:buildCMakeRelWithDebInfo[arm64-v8a]'` with `FileNotFoundException: …/intermediates/cxx/…/build_stdout_targets.txt` | The C++ (CMake) build cache is stale or half-written, often after a `prebuild --clean` or an interrupted build | `cd android && rm -rf app/.cxx app/build/intermediates/cxx`, then build again ([14.1](#141-restart-gradle-and-rebuild-the-native-code)) |
| `Task 'stop' not found in root project` | `./gradlew stop` runs a task named `stop`, which does not exist | Use the flag with two dashes: `./gradlew --stop` |
| `NoSuchFileException: …/node_modules/…/classes.jar`, or a build fails strangely after an upgrade | Stale Gradle outputs from before the upgrade | `cd android && ./gradlew clean`, or `prebuild --clean`, then build again |
| A change to the app configuration or a plugin (name, icon, permissions) does not show up | `android/` and `ios/` were generated before the change | `pnpm exec expo prebuild --clean`, then build again |
| A release build crashes right after the splash screen | A JavaScript error at start-up | Android: `adb logcat -s ReactNativeJS:V ReactNative:V AndroidRuntime:E`. iOS: Xcode → *Window → Devices and Simulators → Open Console* |
| Google Play: *"You need to use a different version code"* / *"signed in debug mode"* | The build number did not go up / the AAB has the debug key | [12](#12-version-numbers) / [9](#9-android-signing-with-your-own-key) |
| `xcodebuild … requires Xcode, but active developer directory … is a command line tools instance` | Only the Command Line Tools are selected | Install Xcode, then `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` |
| `pod install` fails | Outdated CocoaPods or its repo | `brew upgrade cocoapods`, then `pnpm exec expo prebuild --platform ios --clean` |
| iOS: "Untrusted Developer", or the app stopped opening after a week | Free-account signing | Trust the developer on the phone; build and install again after 7 days |
| `git status` shows `app.json` changed (boilerplate) | Prebuild wrote the package or permissions | [5](#5-generate-the-native-projects-prebuild) |

### 14.1 Restart Gradle and rebuild the native code

When an Android build fails in a way that has nothing to do with your change (Gradle cannot start
`node`, or a CMake step cannot find its own files), restart Gradle and clear the native build cache.
Run it in **`<app>`**:

```bash
pnpm exec expo prebuild --platform android      # only if android/ is missing or the native config changed
cd android
./gradlew --stop                                # stop the Gradle daemon; the next command starts a fresh one
rm -rf app/.cxx app/build/intermediates/cxx     # delete the C++ build cache; CMake recreates it
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
cd ..
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/app-1.0.0-release.apk
```

- `--stop` is a **flag** with two dashes. `./gradlew stop` asks for a task named `stop` and fails with
  `Task 'stop' not found`; with `&&` nothing after it runs.
- Both folders are generated output, so deleting them is safe. The cost is time: the next build
  compiles the C++ code from scratch, so use this when a build has failed, not on every build.
- If it still fails, run the build with `--stacktrace` and read the last `Caused by:` line. It names the
  real error more precisely than the summary at the top.

## 15. Checklist

- [ ] The gate is green, and `pnpm exec expo install --check` lists nothing ([4.1](#41-the-repository-is-healthy)).
- [ ] Starter kit: `EXPO_PUBLIC_API_URL` set for this build ([4.3](#43-the-app-knows-which-api-to-talk-to) or [7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi)).
- [ ] `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT` and `EXPO_PUBLIC_ALLOW_LAN_HTTP_API` are **off** for anything that leaves the team.
- [ ] Prebuild was run after the last configuration change; boilerplate: `git diff app.json package.json` reverted or deliberately kept.
- [ ] Android test build: `assembleRelease`, and `apksigner verify` shows the expected key. Play build: `bundleRelease`, signed with **your** upload key.
- [ ] iOS: release configuration; signing team set; on a device, Developer Mode on and the developer trusted.
- [ ] Nothing generated or secret is staged ([13](#13-never-commit-these)).
- [ ] Tested on the device, with Metro off: sign-in, tabs and theme; the PDF viewer shows pages; Google's QR scanner opens and closes back to the page; the demo logins only when intended.

## If you are an AI agent reading this

A person handed you this page to build the mobile app with them. Work this way:

1. **Find out which repository you are in** (the table at the top) and run every command in its app
   folder.
2. **Ask which route** ([1](#1-pick-a-route)): test APK, LAN test APK, AAB for Play, Simulator, iPhone
   or TestFlight, local or EAS. Don't assume.
3. **Run the checklist in [4](#4-before-any-build-the-checklist) first**, and show the output of
   `pnpm exec expo install --check` and the `git ls-files …/modules/pdf-renderer` check. Stop and
   report if either is wrong. Don't "fix" versions with `expo install --fix` on your own, and never
   turn off pnpm's `minimumReleaseAge`.
4. **Ask the person for** the API address and the bundle id. Never invent a bundle id for a store
   build: it is permanent. For a LAN test APK, read the Mac's address with `ipconfig getifaddr en0`
   and confirm it with them.
5. **Never create, print, move or commit signing keys or passwords.** The person runs `keytool`, types
   passwords and answers Apple or EAS credential prompts themselves. In Claude Code they can type
   `! <command>` to run an interactive command in the session.
6. **Never commit** anything in [13](#13-never-commit-these). Never edit the generated `android/` or
   `ios/` without saying the edit is lost on the next `prebuild --clean`. After a LAN test build, run
   step 7 of [7.1](#71-steps) so the next build is https-only again.
7. Builds are long: run them in the background, then report the file's path and how you checked it
   (signature, install, first launch, the [checklist](#15-checklist)'s device tests).
8. If a step needs something the machine does not have (Xcode, an Apple account, a release keystore),
   stop and say so. Do not work around it.

## 17. Known gaps

- **`eas.json`:** in neither repository yet ([11](#11-eas-build-cloud-builds)).
- **Build numbers (starter kit):** `app.config.ts` sets no `android.versionCode` or `ios.buildNumber`, so
  local builds are always `1`. Use EAS remote versioning, or add both to `app.config.ts` from a
  validated `MOBILE_*` variable, when local store builds are needed.
- **Lasting local signing:** the release signing in [9.3](#93-use-it-for-release-builds) lives in the
  generated `android/` folder. A config plugin that adds it on every prebuild makes it last.
- **Store listing URLs (starter kit):** set `EXPO_PUBLIC_IOS_STORE_URL` and `EXPO_PUBLIC_ANDROID_STORE_URL`
  once the app is in the stores, so the "Update required" screen can open them.
- **LAN test APK on iOS:** [section 7](#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi)
  is Android only. An iOS build would also need App Transport Security to allow the local network.

## 18. Verified

| Repository | Step | Result |
| --- | --- | --- |
| Boilerplate | `expo prebuild --platform android --no-install`; `assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a` | `app-release.apk`, 61 MB, `com.bishen.helloworld` 1.0.0, signed `CN=Android Debug`, JavaScript bundle inside (2026-10-29) |
| Boilerplate | `bundleRelease` | `app-release.aab`, 80 MB, all four ABIs, debug-signed (2026-10-29) |
| Boilerplate | Release APK with the keep rules, PDF search and download (Android 16 emulator, Google Play image, 2026-10-30) | Google's scanner opens; Back, its X and Back again return to the QR page. PDF search finds "page" (1 of 5, highlighted); Download saves into Downloads. The demo logins show (`.env` flag `true`). `expo export` without the flag: no demo password in the bundle |
| Starter kit | Release APK, minified (2026-10-29/30) | Builds; R8 mapping keeps `BarcodeScanning` and `CameraExceptions`. A minified debug build (R8 on, against the dev API): Google's scanner opens; Back, X and Back return to Till |
| Starter kit | LAN test APK (2026-10-30): `EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true`, `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`, prebuild + `assembleRelease`, installed on the Android 16 emulator with no USB port forwarding | The manifest has `usesCleartextTraffic="true"`; the app signed in and loaded data from the local API over http (`200`s in the API's log). Prebuild again without the flag: the attribute is gone. A real phone: verified by the owner (2026-10-30), signed in and used the app over the LAN |
| Both | Own-key signing ([9](#9-android-signing-with-your-own-key)), truly unsigned APK ([6.1](#61-a-truly-unsigned-apk-and-why-you-rarely-want-one)) | **NOT VERIFIED**: no release keystore on this machine |
| Both | Every iOS step ([10](#10-ios)) | **NOT VERIFIED**: no Xcode on this machine |
