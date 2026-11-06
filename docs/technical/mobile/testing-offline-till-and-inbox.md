---
title: "Testing the offline till and inbox on a phone"
description: "Step by step: install the preview build, pair the phone as a till, redeem a reward with no connection and watch it go through when the connection comes back, then read the inbox offline. Enhancement 6.4."
order: 4
author: "Platform Team"
lastUpdated: 1793865600000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["mobile", "offline", "pos", "till", "notifications", "testing"]
---

# Testing the offline till and inbox on a phone

What 6.4 does, in one line each:

- **Till:** a redemption that gets **no answer** (no connection) is saved on the phone with its Idempotency-Key and sent when
  the connection comes back. A refusal from the API (expired code, under the minimum spend) is never saved: it shows at once.
- **Inbox:** the list you loaded stays readable with no connection, marked "may be out of date"; reading, removing and
  reporting wait for the connection.

The code: `apps/mobile/src/contexts/pos/checkout-queue.ts`, `use-checkout-queue.ts`, and
`apps/mobile/src/contexts/notifications/inbox-state.ts`.

## Before you start

| What | How |
|---|---|
| The API on your Mac | `pnpm dev` (or at least the API on port 8080). The preview build calls `http://192.168.100.30:8080`, your Mac on the Wi-Fi |
| The phone on the same Wi-Fi | Settings → Wi-Fi; the Mac's address must still be `192.168.100.30` (`ipconfig getifaddr en0`). If it changed, change `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` (`preview`) and build again |
| The preview build installed | See [over-the-air-updates.md](./over-the-air-updates.md), "Installing the preview build". A development build works too (`pnpm --filter @workspace/mobile android`), with Metro running |
| The phone on USB (optional) | `adb devices` lists it. Lets you switch the connection off from the Mac (below), which is quicker than the phone's settings |

Turning the connection off and on:

| | On the phone | From the Mac (USB) |
|---|---|---|
| Off | Pull down quick settings → Airplane mode on | `adb shell cmd connectivity airplane-mode enable` |
| On | Airplane mode off, wait for Wi-Fi | `adb shell cmd connectivity airplane-mode disable` |

> Airplane mode is the honest test: the phone itself says it's offline. Stopping the API on the Mac instead tests "the API is
> unreachable" (the request fails with no answer, so the till queues it too, but the inbox's offline note needs the phone's
> own reading).

## A. The till

### 1. Pair the phone as a till (once)

1. On the Mac, open the merchant portal: `http://localhost:3003`, sign in as **`brew.owner@kl-rewards.demo` /
   `BrewOwner@123`**.
2. **Operations → POS terminals → Add terminal**, store **Bukit Bintang**, any name. Copy the 8-character pairing code (it
   works once, for 15 minutes).
3. On the phone: sign in (any account), open **Settings → Till**, type the code, **Pair**. The till screen shows "Front counter"
   (or the name you gave) and the store.

### 2. Get a reward code to redeem

1. On the Mac, open the customer app: `http://localhost:3000`, sign in as **`user@example.com` / `User@123`**.
2. Claim a reward from Brew & Bean KL (Browse rewards → a reward → Claim). Open it in **My wallet**: it shows a QR code and an
   8-character **backup code**. Keep it open.

### 3. Redeem with no connection: it is saved

1. On the phone, in the till: scan the QR (or type the backup code) **while online**. The till checks it and shows the
   reward ("Valid").
2. Enter a bill, for example `25.50`.
3. **Turn the connection off** (airplane mode).
4. Tap **Redeem**.

   **Expect:** a card "Saved on this till" ("There's no connection, so this redemption is saved on the till…"), and under it
   **Waiting for the connection** with the reward and "RM 25.50 bill · waiting to send".
5. Tap **Next customer**: the waiting card stays on the till's main screen.
6. Close the app completely and open it again (still offline): the waiting card is still there (it is kept in Secure Store,
   not in memory).

### 4. Connection back: it is sent

1. **Turn the connection on.** Within a few seconds (or tap **Send now**). Leaving airplane mode, Android often brings
   mobile data up before Wi-Fi, so the first try can get no answer (the API is on your Wi-Fi); the till tries again
   after 2 s, then 4 s, 8 s and so on up to every minute, while the phone is online. Measured on the Realme, 2026-11-05:
   4 s from airplane mode off to redeemed (1 min 43 s before the retry existed).

   **Expect:** a toast "Free … redeemed on a RM 25.50 bill (sent when the connection came back)", and the waiting card
   disappears.
2. On the Mac, in the customer app, the reward now shows as redeemed; in the merchant portal, **Operations → Redemptions →
   Recent** lists it. It was redeemed **once**, even if the first attempt reached the API before the connection dropped (the
   same Idempotency-Key is answered with the first result).

### 5. A saved redemption the API refuses

1. Claim a second reward (step 2), check it on the till online, enter a bill, go offline, tap **Redeem** (it is saved).
2. Still offline on this phone, make the code unusable: redeem the same code on a second till (another paired phone, or the
   development build in an emulator), or let the claim expire.
3. Turn the connection back on (or **Send now**).

   **Expect:** the card stays, red: "Not redeemed: <the API's reason>". **Dismiss <reward>** removes it. Nothing was redeemed
   twice.

### 6. What is never saved

| Try | Expect |
|---|---|
| Online, a bill under the reward's minimum spend | The till refuses it before sending ("below the minimum spend") |
| Online, an expired or used code | The API's refusal shows at once; nothing is saved |
| Offline, a sixth redemption while five are waiting | "This till already holds 5 redemptions waiting for the connection. Reconnect before redeeming more." |
| **Unpair this phone** with redemptions waiting | They are forgotten with the pairing (they belong to that store and key; nothing was redeemed, so the customer keeps the reward) |

## B. The inbox

1. On the phone, open **Notifications** (the bell) **online**: the list loads.
2. **Turn the connection off.**

   **Expect:** the list stays, with "You're offline. This list may be out of date." above it. **Mark all as read** and each
   notice's menu are disabled; "See earlier notifications" is hidden.
3. **Turn the connection on.** The note disappears and the list (and the bell's count) reload. To see it bring in
   something new: while offline, run `pnpm --filter @workspace/api notifications:demo --email <your account>` on the
   Mac (three notifications); after reconnecting they're at the top within a few seconds.
4. Close the app, turn the connection off, open the app and go to Notifications.

   **Expect:** "You're offline. Your notifications will load when you're back online." (nothing was loaded on this run, and the
   inbox is kept in memory only).
5. With the list loaded, stop the API on the Mac (phone still online), then leave Notifications and open it again:
   "Couldn't refresh. This list may be out of date."

## C. Push notifications (the phone's notification shade)

1. Settings → Notifications: the green "This phone gets notifications." and the **Phone** options can be ticked.
2. Put the app in the background, then on the Mac: `pnpm --filter @workspace/api notifications:demo --email <your account>`.

   **Expect:** two "New sign-in" alerts and a "Test notification" in the shade within seconds.
3. The same with airplane mode on while you send, then off.

   **Today (2026-11-05):** only the newest of the three arrives; the inbox has all three. A push sent straight to
   FCM behaves the same, so it isn't our API; the cause isn't proven yet (docs/history/PROGRESS-2026-11-02.md §81.15).

## When it doesn't behave

| Symptom | Likely cause |
|---|---|
| Redeem online fails with "couldn't connect" | The phone can't reach `192.168.100.30:8080`: same Wi-Fi? API running? Mac's address unchanged? |
| Offline redeem shows an error instead of "Saved on this till" | The failure got an answer (a 4xx or 5xx from the API): only a call with no answer is saved |
| The waiting card never sends | The phone still has no route to the API; tap **Send now** after checking the connection |
| The inbox shows an error offline, not the list | It was never loaded on this run of the app (expected; see step B.4) |
| Phone options greyed out under "This phone gets notifications." | An older build cached the settings; the screen now always asks the API. Leave and reopen it |
| No pushes at all, `NotificationDelivery.lastError` says `installation-id-not-registered` | An API from before 2026-11-05: FCM refused the installation ID; the API now sends by token then |
