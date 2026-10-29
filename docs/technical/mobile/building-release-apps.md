---
title: "Building the mobile app: APK, AAB and iOS"
description: "A step-by-step guide for newcomers (and the AI agent they hand it to): how to turn apps/mobile into an Android APK or AAB and an iOS build, locally or with EAS Build, what to check first, how signing works, and what to do when it fails."
order: 2
author: "Platform Team"
lastUpdated: 1793232000000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["mobile", "expo", "android", "ios", "build", "release", "eas"]
---

# Building the mobile app: APK, AAB and iOS

Day to day, the app runs in **Expo Go** and needs no build at all
([Mobile app §15](./mobile-app.md#15-developing-with-expo-go)). This page is for when you need a real
app: one to install on a phone without Expo Go, to send to testers, or to upload to Google Play or
the App Store.

It is written so a newcomer can follow it alone, **or hand it to Claude** (or another AI agent) and
say "do this with me". The agent instructions are in
[If you are an AI agent reading this](#if-you-are-an-ai-agent-reading-this).

## Contents

1. [The words you will meet](#1-the-words-you-will-meet)
2. [Pick a route](#2-pick-a-route)
3. [Before any build: the checklist](#3-before-any-build-the-checklist)
4. [Android on your own machine](#4-android-on-your-own-machine)
5. [iOS on your own Mac](#5-ios-on-your-own-mac)
6. [Either platform with EAS Build](#6-either-platform-with-eas-build)
7. [Never commit these](#7-never-commit-these)
8. [When it fails](#8-when-it-fails)
9. [If you are an AI agent reading this](#if-you-are-an-ai-agent-reading-this)
10. [Known gaps in the starter](#10-known-gaps-in-the-starter)

---

## 1. The words you will meet

| Word | What it means here |
| --- | --- |
| **Expo Go** | The app from the stores that runs our JavaScript during development. It is not our app: our name, icon, Face ID and the in-app PDF engine only work in a real build. |
| **Development build** | Our own app, with a dev menu, loading JavaScript from Metro like Expo Go does. Use it when you need native features while developing. |
| **Release build** | Our own app with the JavaScript bundled inside. It runs with no laptop and no Metro. This is what testers and stores get. |
| **APK** | An Android app file you can install directly on a phone (`adb install`, or open it on the phone). Good for testers. |
| **AAB** (Android App Bundle) | The file Google Play wants. Play turns it into per-device APKs. You cannot install an AAB directly on a phone. |
| **IPA** | The iOS app file. It is made by *archiving* in Xcode or by EAS, and goes to TestFlight or the App Store. |
| **Prebuild** | `npx expo prebuild` generates the native projects `apps/mobile/android/` and `apps/mobile/ios/` from `app.config.ts`. Both folders are **generated and git-ignored**: never edit them by hand expecting the change to last, and never commit them. Running prebuild again with `--clean` rebuilds them from scratch. |
| **Signing** | Every Android and iOS app is signed with a key that proves who made it. A store only accepts updates signed by the same key, so losing the key can mean you can never update the app. |
| **Upload key** (Android) | The key you sign AABs with before uploading. Google Play then re-signs the app for phones with its own *app signing key* (Play App Signing). |
| **Certificate + provisioning profile** (iOS) | Apple's version of signing: a certificate for your team, and a profile saying which app (bundle id) may run on which devices. Xcode or EAS can manage both for you. |
| **EAS Build** | Expo's cloud build service. It builds and signs both platforms for you, so no Mac is needed for iOS. It needs an Expo account. |

## 2. Pick a route

| You want | Route | Needs |
| --- | --- | --- |
| An APK on your own Android phone or emulator, today | [§4.2](#42-a-release-build-straight-onto-a-phone) or [§4.3](#43-an-apk-file) | JDK 17 and the Android SDK. No accounts. |
| An AAB for Google Play | [§4.4](#44-an-aab-file-for-google-play) + [§4.5](#45-signing-for-google-play), or [§6](#6-either-platform-with-eas-build) | Your own upload key. A Google Play developer account to upload. |
| The app on the iOS Simulator | [§5.2](#52-a-release-build-on-the-simulator) | A Mac with full Xcode. No Apple account. |
| The app on a real iPhone, TestFlight or the App Store | [§5.3](#53-on-a-real-iphone) / [§5.4](#54-an-archive-for-testflight-and-the-app-store), or [§6](#6-either-platform-with-eas-build) | An Apple Developer Program membership (paid, yearly) for TestFlight and the App Store. |
| iOS builds without a Mac, or builds a whole team can repeat | [§6](#6-either-platform-with-eas-build) | An Expo account, and the store accounts above for store builds. |

For store releases, **EAS is the recommended route**. Local builds are fine for trying a release
build, but local signing setup lives inside the generated `android/` and `ios/` folders and is lost
on every `prebuild --clean` ([§4.5](#45-signing-for-google-play)).

---

## 3. Before any build: the checklist

Work through this list every time. Most "the build works but the app is broken" reports come from
skipping it.

### 3.1 The repository is healthy

From the repository root:

```bash
pnpm install
pnpm run lint
pnpm run test
cd apps/mobile && npx expo install --check   # every Expo package matches the SDK
```

`expo install --check` matters most. The app's JavaScript and the native code must agree on versions.
A `react-native` one patch ahead of what the Expo SDK expects can build fine and then fail at launch
with `Cannot find native module …`. If it lists packages, **don't** blindly run
`expo install --fix`. pnpm refuses releases younger than a day (`minimumReleaseAge`), and the repo's
version policy (`syncpack`) pins React Native to the SDK's version. Ask a maintainer, or see
[apps/mobile/README.md → Adding a dependency](../../../apps/mobile/README.md).

### 3.2 The app knows which API to talk to

A release build has **no dev server**, so it cannot find the API on your laptop the way Expo Go does.
Set the API's address in `apps/mobile/.env` before building (copy `.env.example` if you have no
`.env`):

```bash
EXPO_PUBLIC_API_URL=https://api.your-domain.com
```

- It must be an absolute **`https://`** URL. Outside development the app refuses `http://` and shows
  its configuration-error screen naming `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_*` values are **baked into the app at build time** and anyone can read them from the
  installed app. Never put a secret in one. Changing the value means building again.
- To try a release build against the API on your laptop, give the API a temporary https address with
  `pnpm tools dev:tunnel` (a Cloudflare quick tunnel), then use that URL.

### 3.3 The app's identity

Read by `apps/mobile/app.config.ts` on the build machine, from `apps/mobile/.env` or the shell:

| Variable | Default | Notes |
| --- | --- | --- |
| `MOBILE_APP_NAME` | `Starter` | The name under the icon (30 characters at most). |
| `MOBILE_BUNDLE_ID` | `com.example.starter` | The iOS bundle identifier **and** the Android package name. **It is permanent once published:** a store treats a new id as a new app. Choose your own (reverse DNS, letters and digits only) before the first store build; `com.example.*` is for development only. |
| `MOBILE_SCHEME` | `starter` | The deep-link URL scheme. |
| `MOBILE_APP_SLUG` | `starter` | The Expo project slug (used by EAS). |

Products rename the app with these variables, never by editing `app.config.ts`.

### 3.4 Version numbers

Each store build carries two numbers:

| Number | Where it lives | Rule |
| --- | --- | --- |
| The version people see (`1.0.0`) | `APP_VERSION` in `apps/mobile/app.config.ts` | Raise it for every store release. The app sends it as `X-App-Version`, and the API's `MOBILE_MIN_SUPPORTED_VERSION` can force older versions to update ([ADR 033](../../adr/033-mobile-forced-upgrade.md)). |
| The build number (Android `versionCode`, iOS `buildNumber`) | **Not set in `app.config.ts` today, so always `1`** | Each upload must be higher than the last one, or the store rejects it. With EAS, let it count for you ([§6.2](#62-configure-the-project-once)). Locally, see [§10](#10-known-gaps-in-the-starter). |

### 3.5 The native sources are present

The in-app PDF viewer is a small local native module ([ADR 056](../../adr/056-in-house-pdf-viewer.md)).
Check its Swift and Kotlin sources are in your checkout:

```bash
git ls-files apps/mobile/modules/pdf-renderer
```

You should see `ios/PdfRendererModule.swift`, `ios/PdfRenderer.podspec`, `android/build.gradle` and
`android/src/main/java/expo/modules/pdfrenderer/PdfRendererModule.kt` beside
`expo-module.config.json`. If only the JSON file is listed, the build still succeeds, but the app
has no PDF engine (see the ADR's 2026-10-29 amendment).

---

## 4. Android on your own machine

All commands run from `apps/mobile` unless a step says otherwise.

### 4.1 One-time setup

1. **JDK 17.** React Native 0.88 builds with Java 17. Zulu 17 is a good choice:
   `brew install --cask zulu@17` on macOS. Check with `java -version` (it should say `17`).
2. **Android Studio**, then in *Settings → Languages & Frameworks → Android SDK*:
   - *SDK Platforms*: the latest Android platform.
   - *SDK Tools*: Android SDK Build-Tools, Android SDK Platform-Tools, Android Emulator and NDK
     (Side by side). Gradle downloads the exact versions it needs on the first build.
3. Point your shell at the SDK (add these to `~/.zshrc`, then open a new terminal):

   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"   # Linux: $HOME/Android/Sdk
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
   ```

4. Something to install on: an emulator (Android Studio → *Device Manager*), or a phone with
   *Developer options → USB debugging* on. `adb devices` should list it.

### 4.2 A release build straight onto a phone

The quickest way to see the real app:

```bash
npx expo run:android --variant release
```

This generates `android/` if it is missing, builds a release APK, installs it on the connected
device and opens it. The first build downloads Gradle and its dependencies and can take 10–20
minutes; later builds are much faster.

This APK is signed with Android's **debug key**. That is fine on your own devices, but Google Play
will not accept it.

### 4.3 An APK file

To get a file you can send to a tester:

```bash
npx expo prebuild --platform android --clean   # regenerate android/ from app.config.ts
cd android
./gradlew assembleRelease
```

The file is `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Install it with:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Or copy it to the phone and open it (the phone must allow installing unknown apps from that source).
Like §4.2, it is debug-signed unless you set up [§4.5](#45-signing-for-google-play).

### 4.4 An AAB file for Google Play

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew bundleRelease
```

The file is `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`. It must be signed
with **your upload key** ([§4.5](#45-signing-for-google-play)) before Play will take it. To test an
AAB on a device, use Google's `bundletool` to turn it into APKs (`bundletool build-apks …`), or upload
it to a Play *internal testing* track.

### 4.5 Signing for Google Play

1. **Create an upload key once**, outside the repository:

   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore ~/keys/starter-upload.keystore \
     -alias starter-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Keep the keystore file and its passwords in your team's password manager. **If you lose them, you
   cannot sign updates** (Play App Signing lets you reset an upload key, but only through Google
   support).
2. **Put the passwords in your user-level Gradle file**, `~/.gradle/gradle.properties`, never in the
   repository:

   ```properties
   STARTER_UPLOAD_STORE_FILE=/Users/you/keys/starter-upload.keystore
   STARTER_UPLOAD_KEY_ALIAS=starter-upload
   STARTER_UPLOAD_STORE_PASSWORD=…
   STARTER_UPLOAD_KEY_PASSWORD=…
   ```

3. **Point the release build at it.** In the generated `android/app/build.gradle`, add a `release`
   entry to `signingConfigs` and use it in `buildTypes.release`, which by default reads
   `signingConfig signingConfigs.debug`:

   ```groovy
   signingConfigs {
       debug { /* unchanged */ }
       release {
           storeFile file(STARTER_UPLOAD_STORE_FILE)
           storePassword STARTER_UPLOAD_STORE_PASSWORD
           keyAlias STARTER_UPLOAD_KEY_ALIAS
           keyPassword STARTER_UPLOAD_KEY_PASSWORD
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           // the rest unchanged
       }
   }
   ```

   ⚠️ `android/` is generated: **`prebuild --clean` throws this edit away**, so you must redo it after
   every clean prebuild. That is the main reason to use EAS for store builds. See
   [§10](#10-known-gaps-in-the-starter) for the lasting fix.
4. **Check the signature** before uploading:

   ```bash
   keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
   ```

   It must show your upload key's owner, not `CN=Android Debug`.
5. **Upload** the AAB in the Google Play Console (*Testing → Internal testing* first). The first
   upload enrols the app in Play App Signing.

---

## 5. iOS on your own Mac

iOS apps can only be built on macOS.

### 5.1 One-time setup

1. **Full Xcode** from the Mac App Store. The Command Line Tools alone are not enough: `xcodebuild`
   then fails with *"requires Xcode, but active developer directory … is a command line tools
   instance"*. After installing Xcode, open it once to accept the licence, then run:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```

2. An iOS Simulator runtime (Xcode → *Settings → Components*).
3. **CocoaPods** (`brew install cocoapods`). `pod --version` should print a version.
4. For real devices: sign in to Xcode with your Apple ID (*Settings → Accounts*). For TestFlight and
   the App Store you need an **Apple Developer Program** membership.

### 5.2 A release build on the Simulator

No Apple account needed:

```bash
npx expo run:ios --configuration Release
```

It generates `ios/`, installs the pods, builds, and opens the app in a Simulator.

### 5.3 On a real iPhone

Connect the iPhone by cable, trust the computer, and turn on *Developer Mode* (*Settings → Privacy &
Security*). Then run:

```bash
npx expo run:ios --configuration Release --device
```

Pick your phone from the list. If Xcode reports a signing error, open
`ios/<AppName>.xcworkspace`, select the app target → *Signing & Capabilities*, tick *Automatically
manage signing* and choose your team. With a free Apple ID (a "Personal Team") the app stops
opening after 7 days, and some capabilities are unavailable. A paid membership removes both
limits.

Face ID in the app lock works only in real builds like this one (never in Expo Go). The permission
text is set in `app.config.ts`.

### 5.4 An archive for TestFlight and the App Store

1. Regenerate the project: `npx expo prebuild --platform ios --clean`. This also runs `pod install`.
2. Open **`ios/<AppName>.xcworkspace`**, not the `.xcodeproj`.
3. App target → *Signing & Capabilities*: your paid team, *Automatically manage signing*. The bundle
   identifier comes from `MOBILE_BUNDLE_ID`.
4. Choose *Any iOS Device (arm64)* as the destination, then *Product → Archive*.
5. In the Organizer: *Distribute App → App Store Connect → Upload*. The build appears in App Store
   Connect → TestFlight after Apple processes it (minutes to an hour).
6. Raise the build number for every upload ([§3.4](#34-version-numbers)). In Xcode it is *General →
   Identity → Build*, but like the Android signing, a clean prebuild resets it.

The app must first exist in App Store Connect (*Apps → +*) with the same bundle identifier.

---

## 6. Either platform with EAS Build

EAS builds in Expo's cloud, keeps your signing credentials, and can count build numbers for you.
Check Expo's website for the current free-tier limits and prices.

### 6.1 One-time setup

```bash
cd apps/mobile
pnpm dlx eas-cli@latest login    # a free Expo account
```

(`pnpm dlx eas-cli@latest <command>` runs the CLI without installing it. Teams often install it
globally as `eas`; the commands below write `eas` for short.)

### 6.2 Configure the project once

```bash
eas init              # links the app to an Expo project
eas build:configure   # creates apps/mobile/eas.json
```

The repository has no `eas.json` yet: whoever sets up releases creates it, gets it reviewed and
commits it. A sensible starting point:

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

- `preview` gives an **APK** to share with testers. `production` gives an **AAB** for Play and a store
  build for iOS.
- `appVersionSource: remote` plus `autoIncrement` lets EAS raise the build number on every production
  build, so the store never rejects a duplicate.
- A `development` build needs the `expo-dev-client` package (`npx expo install expo-dev-client`). Add
  it only when the team moves off Expo Go.

### 6.3 Environment variables on EAS

EAS uploads your project the way git sees it: **`.env` is git-ignored, so EAS never receives it.**
Give each build its values in one of two ways:

- in `eas.json`, per profile: `"production": { "env": { "EXPO_PUBLIC_API_URL": "https://api.your-domain.com", "MOBILE_BUNDLE_ID": "com.yourcompany.app" } }`;
- or as EAS environment variables (`eas env:create`, or the Expo dashboard), which keeps them out of
  the repository.

A build without `EXPO_PUBLIC_API_URL` installs fine and then opens on the configuration-error screen.

### 6.4 Build

```bash
eas build --platform android --profile preview      # APK, link to download
eas build --platform android --profile production   # AAB
eas build --platform ios --profile production       # iOS store build
```

- **Android:** on the first build EAS offers to create and keep an upload keystore. Accept, or upload
  your own (`eas credentials`). Download a copy and store it in your password manager anyway.
- **iOS:** EAS asks for your Apple Developer account and creates the certificate and provisioning
  profile itself. No Mac needed.
- Run the commands from `apps/mobile`. EAS recognises the pnpm workspace and installs the monorepo
  for you.

### 6.5 Submit to the stores

```bash
eas submit --platform android   # needs a Google service-account key (Play Console → API access)
eas submit --platform ios       # needs your Apple account / an App Store Connect API key
```

Or download the file from the build page and upload it by hand.

---

## 7. Never commit these

| File | Why |
| --- | --- |
| `apps/mobile/android/`, `apps/mobile/ios/` | Generated by prebuild and git-ignored (`/android/`, `/ios/` in `apps/mobile/.gitignore`). Only the *local modules'* `ios/` and `android/` folders under `apps/mobile/modules/` are source and are committed. |
| `*.keystore`, `*.jks`, `*.p12`, `*.mobileprovision`, `*.p8` | Signing keys and certificates. Leaking one lets someone else publish "your" app. |
| `~/.gradle/gradle.properties`, App Store Connect or Play service-account keys | Passwords and API keys. |
| `apps/mobile/.env` | Your local values (git-ignored). |

## 8. When it fails

| You see | Cause | Fix |
| --- | --- | --- |
| The app opens on the **configuration error** screen naming `EXPO_PUBLIC_API_URL` | The build had no API address, or an `http://` one | Set an `https://` `EXPO_PUBLIC_API_URL` ([§3.2](#32-the-app-knows-which-api-to-talk-to)) and build again; on EAS, set it in the profile ([§6.3](#63-environment-variables-on-eas)). |
| `Cannot find native module '…'` at launch | The JavaScript and native code disagree, usually a package newer than the Expo SDK expects | `npx expo install --check`; bring the package back to the SDK's version ([§3.1](#31-the-repository-is-healthy)). |
| `SDK location not found` | Gradle cannot find the Android SDK | Set `ANDROID_HOME` ([§4.1](#41-one-time-setup)), or write `sdk.dir=/path/to/sdk` into `android/local.properties`. |
| `Unsupported class file major version` or Gradle complains about Java | The wrong JDK | Use JDK 17: `java -version`; on macOS `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`. |
| `xcodebuild … requires Xcode, but active developer directory … is a command line tools instance` | Only the Command Line Tools are selected | Install Xcode and run `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` ([§5.1](#51-one-time-setup)). |
| `pod install` fails | Outdated CocoaPods or its repo | `brew upgrade cocoapods`, then `npx expo prebuild --platform ios --clean`. |
| Google Play: *"You need to use a different version code"* | The build number did not go up | Raise it ([§3.4](#34-version-numbers)), or use EAS `autoIncrement`. |
| Google Play: *"signed in debug mode"* | The AAB was signed with the debug key | Set up [§4.5](#45-signing-for-google-play) and rebuild. |
| A release build crashes right after the splash screen | A JavaScript error at start-up | Android: `adb logcat -s ReactNativeJS:V ReactNative:V AndroidRuntime:E`. iOS: Xcode → *Window → Devices and Simulators → Open Console*. |
| The PDF viewer offers "open in another app" in a real build | The module's native sources are missing from your checkout | [§3.5](#35-the-native-sources-are-present). |
| A change to `app.config.ts` (name, icon, permissions) does not show up | `android/` and `ios/` were generated before the change | `npx expo prebuild --clean`, then build again. |

## If you are an AI agent reading this

A person handed you this page to build the mobile app with them. Work this way:

1. **Ask which route** ([§2](#2-pick-a-route)): APK for testing, AAB for Play, Simulator, iPhone or
   TestFlight, local or EAS. Don't assume.
2. **Run the checklist in [§3](#3-before-any-build-the-checklist) first**, and show the output of
   `npx expo install --check` and `git ls-files apps/mobile/modules/pdf-renderer`. Stop and report if
   either is wrong. Don't "fix" versions with `expo install --fix` on your own, and never turn off
   pnpm's `minimumReleaseAge`.
3. **Ask the person for** the `EXPO_PUBLIC_API_URL` and the `MOBILE_BUNDLE_ID`. Never invent a bundle
   id for a store build, because it is permanent.
4. **Never create, print, move or commit signing keys or passwords.** The person runs `keytool`,
   types passwords and answers Apple or EAS credential prompts themselves. Tell them to type
   `! <command>` in Claude Code to run an interactive command in the session.
5. **Never commit** anything in [§7](#7-never-commit-these). Never edit the generated `android/` or
   `ios/` without saying the edit is lost on the next `prebuild --clean`.
6. Builds are long: run them in the background and report the artifact's path (or the EAS link) and
   how you checked it (signature, install, first launch).

## 10. Known gaps in the starter

The starter deliberately stops before a release pipeline ([Mobile app §17](./mobile-app.md#17-out-of-scope-and-next-steps)).
What a team adds when it ships:

- **`eas.json`**: not in the repository yet ([§6.2](#62-configure-the-project-once)).
- **Build numbers**: `app.config.ts` sets no `android.versionCode` or `ios.buildNumber`, so local
  builds are always `1`. Use EAS remote versioning, or add both to `app.config.ts`, read from a
  validated `MOBILE_*` variable, when local store builds are needed.
- **Lasting local signing**: the release signing config in [§4.5](#45-signing-for-google-play) lives
  in the generated `android/` folder. A small Expo config plugin in `apps/mobile/config-plugins/` that
  adds it on every prebuild, with the passwords still read from `~/.gradle/gradle.properties`, makes
  it last.
- **Store listing URLs**: set `EXPO_PUBLIC_IOS_STORE_URL` and `EXPO_PUBLIC_ANDROID_STORE_URL` once the
  app is in the stores, so the "Update required" screen ([ADR 033](../../adr/033-mobile-forced-upgrade.md))
  can open them.
