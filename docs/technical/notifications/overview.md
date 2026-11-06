---
title: "Notifications: how they work"
description: "One notifications system for web, merchant, admin and mobile: notify(), the fan-out, the four channels, the inbox and its live unread count, the mobile feed, settings, operations alerts, and how to try it all locally."
order: 47
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["notifications", "push", "inbox", "realtime", "mobile"]
---

# Notifications: how they work

Every message the platform sends a person — a new sign-in, a reward decision, a store's broadcast,
an operations alert — goes through **one** notifications context (`apps/api/src/contexts/notifications`,
[ADR 070](../../adr/070-multi-channel-notifications.md)). It decides where the message goes (in the
app, by email, as a push on the phone, by SMS), respects the person's settings, and keeps a record of
every delivery. To set up phone push, read [Push notifications setup](./push-setup.md).

## The journey of one notification

```
producer ──notify()──▶ Notification row ──after commit──▶ fan-out ──▶ deliveries
 (any context,          (same transaction                 (queue:       IN_APP  → inbox row + live signal
  in its own             as the business                   notifications EMAIL   → email log + email queue
  transaction)           change)                           .fan-out)     PUSH    → push queue → FCM / APNs
                                                                         SMS     → SMS queue → Twilio
```

1. **`notify()`** — a context asks for a notification of a catalog **type** for a **recipient**
   (a user, or a bare email/phone for the few types that allow it), with a payload and a dedupe key.
   The row commits with the business change that caused it; a repeated call with the same key is the
   same notification.
2. **The fan-out** runs after commit (a minute sweep catches any it missed). For each channel of the
   type it checks, in order: is the person still active → is the tenant still served → which
   **surfaces** (apps) the person uses → marketing consent → the person's **preference** (or the
   always-on lock) → a reachable destination → caps → **quiet hours** → grouping → digest.
3. **Deliveries** — one row per channel and device, each with its own status (`QUEUED`, `HELD`,
   `DELIVERED`, `SUPPRESSED` with a reason, `FAILED`…). Admins see them in the admin panel's delivery log.

### Types and categories

Every type is declared once in `domain/catalog/types/*.types.ts`: its key, category, surfaces,
channels, urgency and one renderer per channel (all copy lives there, never in the producer).

| Category | What it is | Always on (cannot be turned off) |
| --- | --- | --- |
| Security | Sign-ins, password and two-factor changes | In app, email |
| Account | Profile, invitations, store changes | — |
| Activity (`TRANSACTIONAL`) | Claims, redemptions, referrals, reviews | — |
| Product news | New features, maintenance | — |
| Offers (`MARKETING`) | Stores' broadcasts — only with consent | — |
| Operations | The platform's own alerts, to the admin panel's people only | In app, push |

`urgency: "immediate"` types (security, operations alerts, test notifications) skip quiet hours, grouping
and digests.

### Surfaces: which app shows it

A person has one inbox per **surface**: `CUSTOMER` (the web app and the **mobile app**), `MERCHANT`
(the merchant app) and `ADMIN` (the admin panel). A type lists the surfaces it shows on; the fan-out keeps
only those the person actually uses — customer always, merchant with a live membership, admin with the
SuperAdmin flag or a SuperAdmin, Admin or Platform Developer role. Phone pushes go to devices registered
from the mobile app, which is the customer surface.

## The bell and the inbox — live

| | Web, merchant, admin | Mobile |
| --- | --- | --- |
| Bell count | `AppShellNotificationBell`: the unread number ("3", "99+") on the bell | `CountBadge` on the header bell; the bell's spoken name says the count |
| Where it comes from | `GET /notifications/unread-count?surface=…` | the same |
| Live | `GET /notifications/stream` (SSE): every frame reloads the count and the inbox; polls every 60 s while the stream is down | the same stream over `expo/fetch` with the bearer token, only while the app is in the foreground; one reload whenever it reconnects or the app comes back |
| Inbox | Bell dropdown (newest 4) and the full notifications page | The notifications screen (below) |

A notification is signalled over Redis pub/sub (`notifications:inbox`), so the stream works whichever API
instance holds it. The stream carries no content — just "your inbox changed".

### The mobile notifications screen

`apps/mobile/src/contexts/notifications/notifications-feed.tsx`, drawn with the kit's `NotificationRow`
(`@workspace/ui-native`). It reads like a social app's notifications:

- **All / Unread** chips, with **Mark all as read** and the settings beside them.
- **New** (the last day) and **Earlier** sections.
- Each row: a round picture (the sender's logo or initials with the kind's glyph on its corner, or the
  glyph alone when the app sent it), the bold title running into the message, a short time ("25m",
  "3d"). Unread rows are tinted, with a dot.
- Tap a row: it is marked read and its full message opens in a sheet (a broadcast's rich text, a link).
- The **…** menu: mark as read, remove (archive), report a broadcast, notification settings.
- **See earlier notifications** loads a page more.

### The web notifications page

`packages/client/src/lib/features/notifications/notifications-inbox.tsx` (web, merchant, admin). Each
row shows the sender's initials (or the kind's symbol), the kind ("Security", "Operations"), who sent it,
how long ago (the exact time on hover), the bold title and the full message with its line breaks, an
unread dot, and an **Open** button when it links somewhere. A **kind** filter sits beside All / Unread /
Archived (`?kind=OPERATIONS`). A link to the same app opens in place.

The expo-boilerplate has the same screen, the same kit components and the same header count, on sample
data kept on the phone.

## Settings

Every app has the same settings page (web `/dashboard/notifications/settings`, merchant
`/t/:slug/notifications/settings`, admin `/notifications/settings`, mobile **Settings → Notification
settings**):

- **What reaches you**: a tree. Each kind of message is a parent node — its checkbox, its symbol and a
  line saying what it is about — and its channels hang under it on a guide line, indented, one
  checkbox each with its own symbol (`TreeBranch` in `@workspace/ui` and `@workspace/ui-native`).
  The tree is always open: there is nothing to expand.

  | Checkbox looks | Means |
  | --- | --- |
  | Filled, with a tick | On (a kind: every channel that can reach the person is on) |
  | Filled, with a dash | A kind with some of its channels on ("mixed"); pressing it turns the rest on |
  | Empty outline | Off — tap to turn on |
  | Faded | Not available yet; the line under it says what to do ("Add and verify your phone number first", "Turn on notifications on this phone first", "Turn on offers from us or a store below first") |
  | Pale filled, with a lock | Always on; the line says why ("Always on, to keep your account safe") |

  A kind's checkbox changes only the channels the person can switch — not the locked ones and not
  the unavailable ones — in one save (`kindCheckStateOf`, `kindChannelChangesOf`, `isKindSwitchable`
  in `@workspace/shared`). A kind whose channels are all locked shows a locked checkbox; one with no
  channel that can change and none on shows a faded one. A channel a kind is never sent on
  (`not-offered`) is not in the tree at all. On mobile, a phone channel that needs push has a
  **Turn on** button in its row.
- **Quiet hours and digest** (only security notices and operations alerts buzz the phone during quiet
  hours);
- **Offers**: offers from the platform and per store; **Leave store** asks first;
- on web, merchant and admin, the phones that receive push (remove one you no longer use); on mobile,
  the switch that turns push on for this phone.

The checkbox states come from the cell (`preferenceCellStateOf`, `isPreferenceCellOn`,
`shownPreferenceCellsOf` in `@workspace/shared`), so every app shows the same thing. The kit
checkboxes (`@workspace/ui` and `@workspace/ui-native` `Checkbox`) take `indeterminate` for "some"
and `locked` for "always on", like the kit `Switch`.

The **Operations** row is shown only to SuperAdmins, Admins and Platform Developers.

## Operations alerts

When the operations monitor (ADR 068) opens or resolves an alert — a server's CPU or disk, an instance
that stopped reporting, a dependency or address down, a certificate expiring — it calls `notify()` with
`operations.alert` for every SuperAdmin (flag or role), Admin and Platform Developer, in the same
transaction as the alert. They get it under the admin panel's bell, in the mobile app's notifications,
as a push on their phone at any hour, and by email. The notice names what and where ("High CPU on
web-01"), the limit and the reading ("Limit 80%, now 93.5%."), when it started and where to look
(`alertTitleOf` / `alertDetailLinesOf` in `domain/catalog/types/operations.types.ts`). The extra addresses in the alert settings are not
accounts, so they get the alert email only.

## Attachments

Any notification may carry one optional public file: `notify({ ..., attachment })`, built from a stored file with `notificationAttachmentOf`. Sensitive types refuse one.

| Where | What shows |
| --- | --- |
| Inbox (web, merchant, admin, mobile) | A photo's copy, up to 1280 px wide, opening the original; a PDF as a file link |
| Email | The file itself as a real attachment (up to 15 MB), the photo's copy in the body, and the file's name and link in the plain-text part |
| Push on Android | A thumbnail while collapsed and the picture under the text once expanded, whether the app is open or not (`modules/picture-notification` when it is open) |
| Push on iOS | Needs a Notification Service Extension, not built yet; the API already sends `mutable-content` and `imageUrl` |
| SMS | Nothing |

`pnpm db:seed` gives the superadmin and `user@example.com` three notices with a 4K photo and one with a PDF, and `notifications:demo` sends the same four through every channel. See [ADR 070](../../adr/070-multi-channel-notifications.md#implementation-notes-2026-11-06-attachments).

## Try it locally

| What | How |
| --- | --- |
| Push and SMS without real providers | Leave `PUSH_PROVIDER` / `SMS_PROVIDER` unset: in development each push lands in **Mailpit** as `<device-id>@push.localhost`, each SMS as `<number>@sms.localhost` |
| A few notifications for yourself | `pnpm --filter @workspace/api notifications:demo` (the only SuperAdmin by default, or `--email <address>`): two new sign-ins and a test notification |
| An operations alert | Restart the dev API: the old instance stops reporting and an alert opens within a few minutes |
| Real phone push | [Push notifications setup](./push-setup.md) |

## Where things are

| Piece | Path |
| --- | --- |
| Catalog and types | `apps/api/src/contexts/notifications/domain/catalog/` |
| Rules (always-on, defaults, quiet hours) | `apps/api/src/contexts/notifications/domain/policies/` |
| `notify()` and the fan-out | `apps/api/src/contexts/notifications/application/services/notification-fan-out.ts`, `infrastructure/adapters/transactional-notify.adapter.ts` |
| FCM and APNs senders | `apps/api/src/contexts/notifications/infrastructure/channels/` |
| Operations alerts → notify | `apps/api/src/contexts/operations/application/services/ops-alert-notifier.ts` |
| Web bell, inbox, settings | `packages/client/src/lib/features/notifications/` |
| Mobile screens, live count, push, Android channels | `apps/mobile/src/contexts/notifications/` (`push-channels.ts`) |
| Mobile kit pieces | `packages/ui-native/src/components/notification-row.tsx`, `count-badge.tsx`, `checkbox.tsx`, `tree-branch.tsx`, `switch.tsx` |
| Decision record | [ADR 070](../../adr/070-multi-channel-notifications.md), [ADR 073](../../adr/073-broadcasts-and-tenant-customers.md) |
