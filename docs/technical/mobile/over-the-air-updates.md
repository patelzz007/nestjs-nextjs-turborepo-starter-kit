---
title: "Over-the-air updates with EAS"
description: "Ship a JavaScript fix to installed phones without a store release: setting up EAS for the first time (a fresh clone or your own machine), every command, a step-by-step first test, publishing, rolling back, and what goes wrong. Enhancement 6.3."
order: 3
author: "Platform Team"
lastUpdated: 1793750400000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["mobile", "expo", "eas", "ota", "updates", "release"]
---

# Over-the-air updates with EAS

An **over-the-air (OTA) update** sends new JavaScript to apps already installed on phones. The person opens
the app, it downloads the update in the background, and the next time they open it they're on the new
version: no store review, no reinstall.

It only carries **JavaScript and assets**. Anything native (a new native module, an Expo SDK upgrade, a new
permission, a change to `app.config.ts` plugins) needs a new build through the store. The app protects
itself here: an update made for different native code is refused (see [the fingerprint](#the-pieces)).

## Contents

1. [The pieces](#the-pieces)
2. [Getting started (first time)](#getting-started-first-time)
3. [Your first OTA test, step by step](#your-first-ota-test-step-by-step)
4. [Shipping a real fix](#shipping-a-real-fix)
5. [Every command](#every-command)
6. [When it doesn't work](#when-it-doesnt-work)
7. [Where it lives in the code](#where-it-lives-in-the-code)

## The pieces

| Word | What it is here |
|---|---|
| **EAS** | Expo Application Services: Expo's cloud. **EAS Build** makes the APK / AAB / iOS build; **EAS Update** hosts the OTA updates |
| **Project** | Your app's entry on expo.dev. This repo's is `@bishen/starter`, id `592c9738-0680-40f2-8f13-51db84601603`. A product made from this starter kit creates its own |
| **`EAS_PROJECT_ID`** | That id, given to the app config. **Unset, OTA is off** and the app runs exactly the JavaScript it was built with |
| **Profile** | A kind of build in `apps/mobile/eas.json`: `development` (the dev app you use with Metro), `preview` (an APK for testers), `production` (the store build) |
| **Channel** | Each profile's builds listen on the channel of the same name. An update published to `preview` reaches only preview builds, never a store build |
| **Runtime version** | The **fingerprint** of the build's native code. An update loads only on builds with the same fingerprint, so an update can never run on native code it wasn't made for |
| **On launch** | The app checks for an update but never waits for it (`fallbackToCacheTimeout: 0`): it opens on what it has, downloads in the background, and the update applies on the next launch |

> A **development build ignores OTA updates**: it loads JavaScript from Metro. Test OTA with a `preview` build.

## Getting started (first time)

Do this once per machine (steps 1–2) and once per project (steps 3–5). All commands run in `apps/mobile`.

### 1. An Expo account

Free, at [expo.dev/signup](https://expo.dev/signup).

### 2. Log in

```bash
cd apps/mobile
pnpm dlx eas-cli@latest login
```

`pnpm dlx` downloads the EAS CLI, runs it once, and throws it away, so **there is no `eas` command afterwards**
(`eas init` says "command not found", and `npx eas init` says "could not determine executable to run":
the package is called `eas-cli`, not `eas`). Every command in this guide therefore starts with
`pnpm dlx eas-cli@latest`. Your login is kept in `~/.expo` and lasts.

If you'd rather type `eas …`, install it once: `pnpm add -g eas-cli`.

### 3. Link the project

**This repo already has a project (`@bishen/starter`): skip to step 4.** For a new product made from the
starter kit, change the app's identity first (`MOBILE_APP_SLUG`, `MOBILE_BUNDLE_ID`, … in `apps/mobile/.env`),
then:

```bash
pnpm dlx eas-cli@latest init
```

It creates the project and then prints:

```
Warning: Your project uses dynamic app configuration, and the EAS project ID can't automatically be added to it.
…
Cannot automatically write to dynamic config at: app.config.ts
    Error: project:init command failed.
```

**That's expected, and the project was created.** Our config is TypeScript (`app.config.ts`), not JSON, so
EAS can't write into it; it reads the id from `EAS_PROJECT_ID` instead. Copy the `projectId` it printed.

### 4. Give the app the project id

Two places, because your machine and Expo's cloud read different files:

| Where | Why | What |
|---|---|---|
| `apps/mobile/.env` | `expo` commands on your machine | `EAS_PROJECT_ID=<the id>` |
| `apps/mobile/eas.json`, in each profile's `env` | EAS Build runs in the cloud and never receives `.env` (it's git-ignored) | `"env": { "EAS_PROJECT_ID": "<the id>" }` |

`env` goes **inside a profile** (`build.preview.env`), never at the top of `eas.json`; at the top EAS refuses
the file (`"env" is not allowed`).

### 5. Check it's on

```bash
pnpm exec expo config --type public
```

Look for:

```
runtimeVersion: { policy: 'fingerprint' },
updates: { enabled: true, url: 'https://u.expo.dev/<the id>', checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 }
```

`updates: { enabled: false }` means `EAS_PROJECT_ID` isn't set (or the shell didn't load `.env`).

## Your first OTA test, step by step

The goal: install a preview build, change some text, publish it, and watch the phone pick it up.

### Step 1. Point the preview build at your API

A preview build isn't connected to Metro, so it needs the API's address at build time. To use the API on your
Mac over Wi-Fi (the [LAN test APK](./building-installable-apps.md#7-android-a-test-apk-that-talks-to-the-api-on-your-mac-over-wi-fi)),
the `preview` profile in `eas.json` carries:

```json
"preview": {
  "distribution": "internal",
  "channel": "preview",
  "android": { "buildType": "apk" },
  "env": {
    "EAS_PROJECT_ID": "592c9738-0680-40f2-8f13-51db84601603",
    "EXPO_PUBLIC_API_URL": "http://<your Mac's Wi-Fi IP>:8080",
    "EXPO_PUBLIC_ALLOW_LAN_HTTP_API": "true"
  }
}
```

Find your Mac's Wi-Fi IP with `ipconfig getifaddr en0` (it was `192.168.100.30` when this was written; a router
restart can change it, and then the build needs the new one). The phone must be on the **same Wi-Fi**, with the
API running (`pnpm dev` at the repository root).

### Step 2. Build it

```bash
pnpm dlx eas-cli@latest build --profile preview --platform android
```

The terminal prints a link to follow the build on expo.dev. Free-tier builds can queue for a while. When it's
done you get a link (and a QR code) to the APK.

> **Firebase in the cloud build.** `google-services.json` is git-ignored, so EAS never receives it with the code. It is
> uploaded once as an EAS file variable with visibility **secret** (only builds can read it; it never reaches your
> machine):
>
> ```bash
> export EAS_PROJECT_ID=592c9738-0680-40f2-8f13-51db84601603
> pnpm dlx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json \
>   --visibility secret --environment development --environment preview --environment production
> ```
>
> (Already done for `@bishen/starter`, 2026-11-05. Replace it with `env:update --variable-name GOOGLE_SERVICES_JSON
> --variable-environment <env> --type file --value ./google-services.json` when you download a new file.) The build
> log then shows `GOOGLE_SERVICES_JSON=/home/expo/workingdir/eas-environment-secrets/…` under "Environment secrets",
> and the APK carries Crashlytics and FCM.

### Step 3. Install it on the phone

On the phone: open the APK link and install it (allow installing from your browser if Android asks).

From the Mac, with the phone on USB (`adb devices` lists it):

```bash
pnpm dlx eas-cli@latest build:view <build-id>      # "Application Archive URL" is the APK
curl -L -o starter-preview.apk "<that URL>"
adb install -r starter-preview.apk
```

`INSTALL_FAILED_UPDATE_INCOMPATIBLE: … signatures do not match` means the app on the phone was signed with
another key (a local build signs with the debug key, EAS with the project's keystore). Android can't update one
with the other: `adb uninstall com.example.starter` first (the app's data on the phone, its sign-in, a paired till,
its settings, is lost), then install. Every later EAS build signs with the same keystore and installs over it.

Open the app once, so you know what it looks like before the update.

### Step 4. Change something you can see

A JavaScript-only change, for example the first onboarding page's title (`apps/mobile/src/app/auth/onboarding.tsx`):
`` `Welcome to ${appName}` `` → `` `Welcome to ${appName} (OTA test)` ``.

Don't change anything native for this test (no new package, no `app.config.ts` plugin): the update would be
refused by the fingerprint, which is the point of it but not what you're testing.

### Step 5. Publish the update

```bash
cd apps/mobile
GOOGLE_SERVICES_JSON=./google-services.json \
EAS_PROJECT_ID=592c9738-0680-40f2-8f13-51db84601603 \
EXPO_PUBLIC_API_URL=http://192.168.100.30:8080 \
EXPO_PUBLIC_ALLOW_LAN_HTTP_API=true \
EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true \
pnpm dlx eas-cli@latest update --channel preview --environment preview --platform android \
  --message "OTA test: onboarding title" --non-interactive
```

Check the **Runtime version** it prints: it must equal the build's (`pnpm dlx eas-cli@latest build:view <build-id>`,
"Runtime Version"). If it differs, the phone will never see the update.

Why every variable is spelled out: **eas-cli reads the app config with `.env` switched off** (it sets
`EXPO_NO_DOTENV=1`), and an update doesn't get the build profile's `env` from `eas.json` either. So the update has
to be given the same inputs the build had: the Firebase file (the build got it from the EAS secret; here it's the
local copy, so the config lists the Firebase plugins and the fingerprint matches), the project id, and the preview
profile's `EXPO_PUBLIC_*` values (`eas.json` → `build.preview.env`; also baked into the update's JavaScript, so the
app keeps calling the same API, and an update without `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` would take the demo logins off a preview phone). Leave out `GOOGLE_SERVICES_JSON` and the fingerprint comes out different
(verified: `bd8355…` without it, `c058bb…` with it, the build's). `pnpm dlx eas-cli@latest fingerprint:compare
--build-id <build-id> --environment preview` shows exactly what differs.

### Step 6. See it on the phone

1. Open the app (it downloads the update in the background).
2. Close it fully (swipe it away from recent apps).
3. Open it again: the change shows (for the test on 2026-11-05: "Welcome to Starter (OTA test)" on the first
   onboarding page, on a Realme RMX3741).

From the Mac: `adb shell am force-stop com.example.starter` then
`adb shell monkey -p com.example.starter -c android.intent.category.LAUNCHER 1` opens it; do it twice, about 20 s
apart.

Two opens, because the app never waits for a download at launch. That's deliberate: a slow network never
holds the app on the splash screen.

### Step 7. Undo the test

Revert the text and publish again with the same command (a new message): two more opens and the phone is back on the
real code. Or roll back (see [Every command](#every-command)).

## Shipping a real fix

1. Make the fix (JavaScript only) and run the checks as for any change.
2. Publish to **preview** first and check it on a preview build:
   `pnpm dlx eas-cli@latest update --channel preview --message "Fix: reward card total"`
3. Then to **production**:
   `pnpm dlx eas-cli@latest update --channel production --message "Fix: reward card total"`
4. Watch Crashlytics (Firebase console) for new errors after it goes out.
5. If it went wrong, roll back at once (below).

A fix that needs native code is a store release instead: raise `APP_VERSION` in `app.config.ts`, build with
`--profile production`, submit. Builds of the new native code get a new fingerprint, so older updates never
reach them.

## Every command

All in `apps/mobile`. Replace `pnpm dlx eas-cli@latest` with `eas` if you installed it globally. eas-cli never reads
`.env`, so commands that need the project say so: `export EAS_PROJECT_ID=592c9738-0680-40f2-8f13-51db84601603` once
per terminal (and the extra variables of [Step 5](#step-5-publish-the-update) for a publish).

| What | Command |
|---|---|
| Log in (once per machine) | `pnpm dlx eas-cli@latest login` |
| Who am I? | `pnpm dlx eas-cli@latest whoami` |
| Create / link the project (once per product) | `pnpm dlx eas-cli@latest init` |
| Is OTA on? | `pnpm exec expo config --type public` (look for `updates.enabled: true`) |
| Preview APK (testers) | `pnpm dlx eas-cli@latest build --profile preview --platform android` |
| Store build, Android (AAB) | `pnpm dlx eas-cli@latest build --profile production --platform android` |
| Store build, iOS | `pnpm dlx eas-cli@latest build --profile production --platform ios` |
| Submit to the stores | `pnpm dlx eas-cli@latest submit --platform android` (or `ios`) |
| Your builds | `pnpm dlx eas-cli@latest build:list` |
| One build (status, APK link, runtime version) | `pnpm dlx eas-cli@latest build:view <build-id>` |
| Install it from the Mac | `curl -L -o app.apk "<Application Archive URL>"`, then `adb install -r app.apk` |
| Publish an update (preview) | The command in [Step 5](#step-5-publish-the-update): `GOOGLE_SERVICES_JSON`, `EAS_PROJECT_ID` and the profile's `EXPO_PUBLIC_*` set, then `update --channel preview --environment preview` |
| Publish an update (production) | The same with the production profile's values (`EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=false`, no LAN flag) and `--channel production --environment production` |
| Does a publish match a build? | `pnpm dlx eas-cli@latest fingerprint:compare --build-id <build-id> --environment preview` |
| Updates on a channel | `pnpm dlx eas-cli@latest update:list --branch preview` |
| Roll back a channel | `pnpm dlx eas-cli@latest update:rollback` (it asks which channel and to what) |
| Republish an earlier update | `pnpm dlx eas-cli@latest update:republish --group <update group id>` |
| Channels and what they serve | `pnpm dlx eas-cli@latest channel:list` |
| Set a variable for cloud builds | `pnpm dlx eas-cli@latest env:set --name EAS_PROJECT_ID --value <id>` (or keep it in `eas.json`) |
| This machine's fingerprint | `GOOGLE_SERVICES_JSON=./google-services.json pnpm exec expo-updates fingerprint:generate --platform android` (the `hash`) |
| Cloud-build file secrets | `pnpm dlx eas-cli@latest env:list --environment preview` |

## When it doesn't work

| You see | Why | Fix |
|---|---|---|
| `zsh: command not found: eas` | `pnpm dlx` doesn't install the CLI | Use `pnpm dlx eas-cli@latest …`, or `pnpm add -g eas-cli` |
| `npx eas init`: "could not determine executable to run" | The package is `eas-cli`, not `eas` | `pnpm dlx eas-cli@latest init` |
| `init`: "Cannot automatically write to dynamic config" | Our config is TypeScript; EAS can't edit it | Expected: the project was created. Set `EAS_PROJECT_ID` (step 4) |
| `eas.json is not valid. "env" is not allowed` | `env` is at the top of `eas.json` | Move it inside a profile: `build.preview.env` |
| `expo config` shows `updates: { enabled: false }` | `EAS_PROJECT_ID` not set | Add it to `apps/mobile/.env` |
| `Invalid EAS_PROJECT_ID` when building | It isn't a UUID (a typo, or quotes copied in) | Paste the bare id |
| The update never shows on the phone | It's a development build (Metro), or you opened the app only once | Use a preview build; open, close fully, open again |
| The update never shows, on a preview build | It was published to another channel, or it needs other native code (fingerprint) | `update --channel preview`; `update:list --branch preview`; a native change needs a new build |
| The preview app opens on "Can't reach the server" | The API isn't running, the phone is on another network, or the Mac's IP changed | Start the API; same Wi-Fi; update `EXPO_PUBLIC_API_URL` in `eas.json` and rebuild |
| The preview app opens on a configuration error | No `EXPO_PUBLIC_API_URL` in the profile's `env` | Add it (step 1) and rebuild |
| The cloud build fails: "Unknown error. See logs of the Install dependencies build phase" | EAS's image has an older Node and pnpm than the repository requires (`ERR_PNPM_UNSUPPORTED_ENGINE` in that phase's log) | `eas.json`'s `base` profile pins `node` and `pnpm`; keep them equal to `.nvmrc` and `packageManager` (a test checks) |
| The cloud build stops: "Runtime version mismatch", the diff naming `google-services.json` | The file is git-ignored, so EAS builds without Firebase while your Mac builds with it | From `apps/mobile`, after `export EAS_PROJECT_ID=…`: `pnpm dlx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility sensitive --environment development --environment preview --environment production` ([building-installable-apps §11](building-installable-apps.md#11-eas-build-cloud-builds)), then rebuild. Use `--visibility secret`: only builds need it |
| A published update's **Runtime version** differs from the build's | eas-cli reads the config with `.env` off, so the update was made without the Firebase file or the profile's `EXPO_PUBLIC_*` values the build had | Publish with them set ([Step 5](#step-5-publish-the-update)); `fingerprint:compare --build-id <id> --environment preview` names the difference |
| `adb install`: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app was signed with another key (a local build) | `adb uninstall com.example.starter` (loses that app's data on the phone), then install |
| `build:view` / `build:list`: "EAS project not configured" | eas-cli doesn't read `.env` | `export EAS_PROJECT_ID=592c9738-0680-40f2-8f13-51db84601603` first |
| `eas build:list` (or any `eas` command on your Mac): "EAS project not configured" | The EAS CLI does not read `apps/mobile/.env`, so it never sees `EAS_PROJECT_ID` | `export EAS_PROJECT_ID=$(grep ^EAS_PROJECT_ID= apps/mobile/.env \| cut -d= -f2)` first, in the same terminal |

## Where it lives in the code

| File | What |
|---|---|
| `apps/mobile/config-plugins/over-the-air-updates.ts` | Turns OTA on from `EAS_PROJECT_ID`: `runtimeVersion: { policy: "fingerprint" }`, `updates` (URL, check on launch, never wait), `extra.eas.projectId`. Tests in `config-plugins/__tests__/` |
| `apps/mobile/app.config.ts` | Registers the plugin with `{ projectId: process.env.EAS_PROJECT_ID }` |
| `apps/mobile/eas.json` | The three profiles, their channels, and each one's `env` |
| `apps/mobile/.env.example` | `EAS_PROJECT_ID`, documented |
| `apps/mobile/package.json` | `expo-updates` (`~58.0.20`) |

The Expo boilerplate has no OTA: its rules keep it on Expo Go with no EAS.
