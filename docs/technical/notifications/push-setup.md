---
title: "Set up push notifications"
description: "Step by step: the Firebase project, FCM_SERVICE_ACCOUNT_JSON for the API, google-services.json for the Android app, the encryption keys, the one rebuild, APNs for iOS, verification and troubleshooting."
order: 48
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["notifications", "push", "firebase", "fcm", "apns", "setup"]
---

# Set up push notifications

Real phone push needs **two** Firebase files that are easy to mix up. Read
[Notifications: how they work](./overview.md) first for the big picture.

| File | Who uses it | What it is | Where it goes |
| --- | --- | --- | --- |
| **Service account key** (`FCM_SERVICE_ACCOUNT_JSON`) | The **API** — it *sends* pushes | A secret: a private key that lets the server call FCM for your project | `apps/api/.env`, on one line. Never committed |
| **`google-services.json`** | The **Android app** — it *receives* pushes | Your Firebase project's public app config (project number, app ID, API key) baked into the build so the phone can get an FCM token | `apps/mobile/google-services.json`, pointed to by `GOOGLE_SERVICES_JSON`. Git-ignored |

Both must come from the **same Firebase project**. A token the phone got from project A cannot be
pushed to with project B's service account.

Without any of this, development still works: leave `PUSH_PROVIDER` unset and every push lands in
Mailpit as `<device-id>@push.localhost`.

## 1. Create (or pick) the Firebase project

1. Open the [Firebase console](https://console.firebase.google.com/) → **Add project** (or open an
   existing one). Google Analytics is not needed.
2. Note the **project ID** (Project settings → General), e.g. `rewardhub-66b4a`.
3. **Cloud Messaging API (V1)** must be enabled: Project settings → **Cloud Messaging**. It is on by
   default for new projects; the old "legacy" API is not used.

## 2. The API's key: `FCM_SERVICE_ACCOUNT_JSON`

1. Firebase console → ⚙️ **Project settings** → **Service accounts** tab → **Firebase Admin SDK** →
   **Generate new private key** → **Generate key**. A JSON file downloads; it looks like
   `{"type":"service_account","project_id":"…","private_key":"-----BEGIN PRIVATE KEY-----…","client_email":"firebase-adminsdk-…@….iam.gserviceaccount.com", …}`.
2. Turn it into one line (the env file holds one value per line):

   ```bash
   jq -c . ~/Downloads/<project-id>-firebase-adminsdk-xxxx.json
   ```

3. Put it in `apps/api/.env`, in single quotes so the shell leaves it alone:

   ```bash
   PUSH_PROVIDER=native
   FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"<project-id>",…}'
   ```

4. Delete the downloaded file, or keep it in a password manager. It is a credential: anyone with it
   can push to every install of your app. Rotate it in the same Service accounts tab
   (Google Cloud console → IAM → Service accounts → Keys) if it leaks.

The API reads only `project_id`, `client_email` and `private_key` from it
(`infrastructure/channels/fcm-push.sender.ts`, through `firebase-admin`).

## 3. Encryption keys for device tokens: `NOTIFICATIONS_ENCRYPTION_KEYS`

Push tokens are stored encrypted. Without this key ring, the app cannot register a phone.

```bash
# apps/api/.env — its OWN keys, never reuse MFA_ENCRYPTION_KEYS
NOTIFICATIONS_ENCRYPTION_KEYS='{"1":"<output of: openssl rand -base64 32>"}'
```

To rotate, add a higher version (`{"1":"…","2":"…"}`); older tokens still decrypt.

Restart the API. It refuses to start with `PUSH_PROVIDER=native` but neither FCM nor APNs configured.

## 4. The Android app's config: `google-services.json`

1. Find the app's **Android package name**: `MOBILE_BUNDLE_ID` in `apps/mobile/.env`, or
   `com.example.starter` when it is unset. (Check an installed build with
   `adb shell pm list packages | grep <name>`.)
2. Firebase console → **Project overview** → **Add app** → the **Android** icon.
   - **Android package name**: exactly that package name. It cannot be changed later.
   - App nickname: anything ("Starter Android").
   - Debug signing certificate SHA-1: **not needed** for push. Skip it.
3. **Register app** → **Download google-services.json**. Skip the "Add Firebase SDK" steps; the app's
   build already does that (`expo-notifications` and the Google services Gradle plugin).
4. Save it as `apps/mobile/google-services.json` (git-ignored; `google-services.example.json` shows the
   shape) and point to it in `apps/mobile/.env`:

   ```bash
   GOOGLE_SERVICES_JSON=./google-services.json
   ```

   Already added the Android app? Download the file again from Project settings → General → **Your
   apps** → the Android app → `google-services.json`.

5. **Rebuild once.** This is native configuration: hot reload cannot add it.

   ```bash
   pnpm --filter @workspace/mobile exec expo run:android --device
   ```

   After that, `pnpm run dev` plus `adb reverse tcp:8081 tcp:8081` is enough again for JavaScript
   changes. For EAS builds, upload the file as a **file secret** named `GOOGLE_SERVICES_JSON`: EAS sets
   the variable to the file's path, which is exactly what `app.config.ts` reads.

Without `GOOGLE_SERVICES_JSON` the build simply has no FCM: the app runs, and it registers no push device.

## 5. Register the phone and test

1. Start the API with the settings above, open the app and sign in.
2. **Settings → Notification settings → Turn on notifications.** The app explains first, then asks
   Android for permission, then registers its token (`PUT /notifications/push-devices`). It says
   "This phone gets notifications." The phone is listed under **Phones** on the web, merchant and admin
   notification settings pages, where it can be removed.
   From then on the app keeps it registered by itself: each time it starts signed in or comes back to
   the foreground (and when Android rotates the token) it registers the token again, without asking.
   Signing out ends the phone's binding; signing back in re-binds it.
3. Send yourself something:

   ```bash
   pnpm --filter @workspace/api notifications:demo
   ```

   The phone buzzes with "Test notification — Push delivery works." and two "New sign-in" notices.
   Tapping one marks it read everywhere and opens the app's notifications.

4. A real operations alert (SuperAdmin, Admin or Platform Developer): restart the dev API. Within a
   few minutes "Stopped reporting on api on …" arrives as a push, with what is affected, when it
   started and where to look on the lines under it; once the instance is back, "Recovered: …".

### What a push carries

| Field | Value |
| --- | --- |
| Title and body | The notice's own push text; the body can run to several lines (an alert's figures, a broadcast's preview) and expands on the lock screen |
| Android channel | One per kind of message (`NOTIFICATION_PUSH_CHANNEL_IDS` in `@workspace/shared`): Security, Account, Activity, Product news, Offers, Operations. The app creates them on start (`push-channels.ts`), Security and Operations at high importance, so a person can tune each kind in the phone's own settings |
| Time | When the notice happened (`eventTimestamp`), not when the push arrived |
| Badge | The unread count (`notificationCount` on Android, `badge` on iOS) |
| Grouping | Notices of the same kind stack together (`thread-id` on iOS) |
| Data | The notification id, its link and its kind — tapping it opens the app's notifications |

The API addresses a phone by its **FCM registration token** (what the app gets from
`getDevicePushTokenAsync`). `firebase-admin` 14 marks token addressing as deprecated in favour of
Firebase Installation IDs (FIDs); FCM still delivers to tokens. Moving to FIDs means the app reporting
its installation ID instead, and is tracked as a follow-up.

## iOS (APNs)

iOS pushes go straight to Apple, not through FCM.

1. [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → **+** →
   enable **Apple Push Notifications service (APNs)** → download the `.p8` (only once) and note its
   **Key ID** and your **Team ID** (top right of the developer site).
2. In `apps/api/.env` (all four together):

   ```bash
   APNS_KEY_ID=ABC123DEFG
   APNS_TEAM_ID=TEAM123456
   APNS_BUNDLE_ID=com.example.starter        # the iOS bundle identifier (MOBILE_BUNDLE_ID)
   APNS_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----'
   APNS_ENVIRONMENT=sandbox                  # production for TestFlight / App Store builds
   ```

3. The iOS build needs the Push Notifications capability: an EAS build with your Apple account sets it up.

## Troubleshooting

Open the admin panel's notification delivery log: every push delivery has a status and a reason.

| Symptom | Cause | Fix |
| --- | --- | --- |
| In-app notifications arrive, the phone never buzzes; deliveries say `SUPPRESSED · no-device` | The phone is not registered for this account: it was never turned on, or the database was reset since | Open the app signed in: a phone whose notifications are already allowed registers again by itself (on every start and return to the app, and when the OS rotates its token). Never allowed yet: turn on notifications in the app's notification settings. If that says the build can't receive notifications, the build has no `google-services.json`: do step 4 and rebuild |
| `SUPPRESSED · provider-disabled` | `PUSH_PROVIDER` is `none` (the default outside development) | Set `PUSH_PROVIDER=native` |
| Pushes land in Mailpit instead of the phone | `PUSH_PROVIDER` is unset in development (Mailpit is the default there) | Set `PUSH_PROVIDER=native` |
| Registering fails with 503 | `NOTIFICATIONS_ENCRYPTION_KEYS` is unset | Step 3 |
| `FAILED · messaging/mismatched-credential` or `SenderId mismatch` | The service account and `google-services.json` are from different Firebase projects | Download both from the same project, rebuild, register again |
| The device disappears after a send (`invalid-destination`) | FCM says the token is dead: the app was uninstalled or its data cleared | Open the app and turn notifications on again |
| `HELD · quiet-hours` | The person's quiet hours | Expected for normal notices; security and operations alerts are never held |
| Nothing shows while the app is open | Android shows a push in the tray; inside the app the bell count updates live instead | Expected |
| The phone's notification settings list nothing for the app | Android 13+ permission refused for good | Android Settings → Apps → the app → Notifications → allow |

## Checklist

- [ ] One Firebase project; Cloud Messaging API (V1) enabled
- [ ] `PUSH_PROVIDER=native` and `FCM_SERVICE_ACCOUNT_JSON` (one line) in `apps/api/.env`
- [ ] `NOTIFICATIONS_ENCRYPTION_KEYS` in `apps/api/.env`
- [ ] Android app with the exact package name; `apps/mobile/google-services.json`; `GOOGLE_SERVICES_JSON=./google-services.json`
- [ ] Rebuilt once with `expo run:android --device`
- [ ] Notifications turned on in the app; `notifications:demo` buzzes the phone
