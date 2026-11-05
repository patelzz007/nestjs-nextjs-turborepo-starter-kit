---
title: "ADR 070: Multi-channel notifications — one catalog for in-app, push, email and SMS"
tags: ["adr", "notifications", "push", "sms", "email", "in-app", "consent", "plan"]
description: "One notifications context owns every channel: a typed, locale-ready catalog; users and contact points as recipients; notify() through the outbox; a fan-out that resolves surfaces, preferences, consent, suppressions, quiet hours, grouping, digests and fallbacks; delivery rows with their own state machine; direct FCM and APNs; Twilio; Mailpit as the local sink for every channel; and the bell, inbox, preferences and delivery-log screens on web, merchant, admin and mobile."
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=1200&h=630&fit=crop"
order: 70
---

# ADR 070: Multi-channel notifications — one catalog for in-app, push, email and SMS

## Status

**Accepted (2026-10-30); built (2026-10-31)** — see [Implementation notes](#implementation-notes-2026-10-31). Every decision was agreed in a design interview; the
[decision trail](#the-decision-trail) records it. Terms are defined in [`GLOSSARY.md`](../../GLOSSARY.md)
under *Notifications*. Broadcasts and tenant customers are a separate decision:
[ADR 073](./073-broadcasts-and-tenant-customers.md).

## Context

What exists today:

| Piece | Where | Limitation |
|---|---|---|
| Durable email: request → outbox → `email.send` → Resend/Mailpit, delivery webhooks, email log | `contexts/notifications`, [ADR 060](./060-durable-email-through-outbox.md) | Email only |
| Inbox rows (`RewardNotification`), `GET /reward-notifications`, mark read | `contexts/claims` | Owned by one feature, reward-shaped |
| Bell dropdown on web, merchant and admin | `packages/client/.../notifications-dropdown.tsx` | Reads the reward inbox only, polls |
| Mobile bell | `apps/mobile/src/features/app-shell/app-header.tsx` | A "coming soon" toast |
| Verified phone (`User.phoneVerifiedAt`), phone OTP challenges | `schema.prisma` | Nothing sends SMS |
| `firebase-admin` | storage adapter | Not used for messaging |
| Per-recipient email limit | `email-recipient-rate-limiter.adapter.ts` | Non-atomic, see [ADR 071](./071-unified-rate-limiting.md) |

A feature that wants to tell someone something must pick a channel itself, and only email is
durable. Nothing knows that a person muted product email, has two phones, is asleep, bounced last
week, or never agreed to marketing.

## Decision

### Ownership and flow

The `notifications` bounded context owns **every** message to a person. Other contexts never send an
email, push or SMS; they call `NotificationsPublicApi.notify()` inside their own unit of work.

```
producer ──notify(type, recipient, payload, dedupeKey)──▶ Notification row + outbox row (same transaction)
                                                   │ outbox relay (ADR 015)
                                                   ▼
                                          Fan-out (notifications.fan-out queue)
   1 recipient alive? 2 type allowed for recipient kind? 3 surfaces 4 tenant lifecycle
   5 mandatory lock 6 preference (tenant → platform → catalog) 7 consent (marketing)
   8 suppression list 9 destination exists & verified 10 caps (ADR 071) 11 quiet hours
   12 grouping 13 digest 14 fallback
          │                │                     │                       │
     in-app row       email.send            notifications.push     notifications.sms
     + live signal    (ADR 060)             FCM / APNs              Twilio
          └──────── NotificationDelivery per channel, own state machine ────────┘
```

### The catalog

Code, like the email template registry: one `NotificationType` per kind of message in
`domain/catalog/`, each with a test per channel renderer.

| Field | Meaning |
|---|---|
| `key` | Stable id `context.event` (`identity.new-sign-in`, `rewards.referral-credited`) |
| `category` | `security`, `account`, `transactional`, `product`, `marketing`, `operations` (added 2026-11-01: the platform's own alerts, for the admin panel's people) |
| `surfaces` | Any of `customer`, `merchant`, `admin`. A notification shows (bell, inbox, push) only on its surfaces |
| `recipientKinds` | `user`, and `contact-point` only for types marked `allowsContactRecipient` (invites, OTPs, receipts) |
| `payloadSchema` | zod; checked in `notify()` and again in the worker |
| `channels` | Allowed channels, each with a renderer and an optional `fallback` channel |
| `mandatory` | Channels the person cannot turn off (security: in-app + email; operations: in-app + push) |
| `urgency` | `immediate` (skips quiet hours, grouping and digests) or `normal` |
| `sensitive` | Content carries a secret: body never stored, no in-app row, generic lock-screen text |
| `grouping` | `{ key(payload), windowMs }`, default 10 minutes; never on security or sensitive types |
| `digestible` | May be held for a daily/weekly email digest (`product`, `transactional` only) |

**Locale-ready.** Renderers are keyed by locale; `en` is the only shipped locale; `User.locale`
(new, default `en`) picks one, and a missing locale falls back to `en`. Producers pass data, never
copy, so translating later touches no producer.

Renderer limits, enforced by the catalog test: push title ≤ 65 and body ≤ 240 characters; SMS one
GSM-7 segment unless the type declares more; in-app title ≤ 120.

### Recipients

- **User** — inbox, preferences, devices, consent, quiet hours.
- **Contact point** — an email address or E.164 phone with no account (an invite, a pre-signup OTP).
  Email or SMS only; no inbox, no preferences, no push. Its unsubscribes and suppressions are stored
  by a SHA-256 of the normalized address, so they still apply when that person later signs up.

### Preferences, consent and unsubscribe

- **Resolution order:** tenant override → platform preference → catalog default → mandatory lock
  (the lock always wins).
- **Defaults:** quiet hours off; digest off; `product` in-app only; `marketing` off everywhere;
  everything else on, on every channel the person can receive.
- **Consent** is a separate, append-only record (`MarketingConsent`): scope (`platform` or one
  tenant), granted or withdrawn, when, source (`signup`, `first-claim`, `settings`,
  `unsubscribe-link`, `leave-tenant`), the wording version shown, IP and device. A marketing delivery
  needs a current grant for its scope; withdrawing one tenant's consent leaves the others untouched.
- **One-click unsubscribe** (RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post`) on every email of
  a non-mandatory category. For a user it switches that category's email preference off (marketing:
  withdraws consent); for a contact point it adds a suppression.

### Suppression list

`NotificationSuppression` per channel and destination hash, separate from preferences:

| Cause | Channel |
|---|---|
| Hard bounce, spam complaint (Resend webhook) | email |
| Twilio `STOP` reply, permanently invalid number (status callback) | SMS |
| Contact-point unsubscribe | email / SMS |

A suppression is lifted only when that address or number is verified again (new email verification,
new phone OTP). Mandatory security email to a suppressed address is suppressed too: a bounced
address cannot receive anything, and the in-app copy remains.

### Data model

All tables extend `BaseModel`, carry `tenantId` when tenant-scoped, and get RLS policies and full seed
coverage.

| Model | Purpose | Key constraints |
|---|---|---|
| `Notification` | One message to one recipient | Unique `(recipientKey, typeKey, dedupeKey)`; `recipientKey` = user id or destination hash |
| `NotificationDelivery` | One per channel | `PENDING → QUEUED → SENDING → SENT → DELIVERED`, or `FAILED`, `SUPPRESSED (reason)`, `HELD (quiet-hours / digest / grouping)`; attempts; provider message id; masked destination |
| `InAppNotification` | The inbox row (replaces `RewardNotification`) | `surface`, `readAt`, `archivedAt`, `groupCount`; index `(userId, surface, createdAt desc, id desc)` |
| `NotificationPreference` | user × tenant (nullable) × category × channel | Unique on those four |
| `NotificationSchedule` | Quiet hours and digest frequency per user | Time zone from the person's display region |
| `MarketingConsent` | Append-only consent events | Latest event per `(userId, scope)` decides |
| `NotificationSuppression` | Per channel and destination hash | Lifted by re-verification |
| `PushDevice` | One installed app | `platform`, encrypted token + SHA-256, `deviceSessionId`, `surface`, `appVersion`, `lastSeenAt`, `revokedAt` |

`RewardNotification` is migrated, not kept: a one-time audited system operation copies its rows into
`InAppNotification` (type `rewards.legacy`, surface `customer`); claims switches to `notify()`;
`GET /reward-notifications` answers for one release with a `Deprecation` header, then goes.

### Channels

**In-app.** Written inside the fan-out transaction, then signalled over Redis pub/sub;
`GET /notifications/stream` (SSE, like GitHub live updates) invalidates the TanStack Query cache; the
bell falls back to polling every 60 s. No browser push.

**Email.** The existing pipeline. The fan-out calls the email request port; the email log row links to
its `NotificationDelivery`.

**Push — direct FCM and APNs.** The app registers its **native** token
(`expo-notifications` `getDevicePushTokenAsync`) with `PUT /me/push-devices`, bound to the signed-in
device session.
- Android: FCM HTTP v1 through `firebase-admin` (`FCM_SERVICE_ACCOUNT_JSON`). The app reads
  `google-services.json`; the repository ships `apps/mobile/google-services.example.json` and
  `app.config.ts` uses the real file only when `GOOGLE_SERVICES_JSON` points at it.
- iOS: an in-house APNs client over `node:http2` with token auth (ES256 JWT from the `.p8`, renewed
  every 50 minutes; `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`,
  `APNS_ENVIRONMENT`).
- FCM `UNREGISTERED`/`INVALID_ARGUMENT` and APNs `410`/`BadDeviceToken` revoke the device at once.
- Collapse key = grouping key; sensitive types show "You have a new security message".
- **Read sync.** Reading in-app anywhere sends a silent push that removes the delivered notification
  from the tray and updates the badge; tapping a push marks the in-app row read.

**SMS — Twilio.** Messaging Service SID; status callbacks on `POST /webhooks/twilio/status` verified
with `X-Twilio-Signature`; inbound `STOP` on `POST /webhooks/twilio/inbound`. Verified phones only;
`SMS_ALLOWED_COUNTRIES` allowlist; per-recipient and per-tenant daily caps (ADR 071) against SMS
pumping. Sensitive SMS bodies are never stored.

**Local sinks.** `PUSH_PROVIDER=none|mailpit|native`, `SMS_PROVIDER=none|mailpit|twilio`. Mailpit
receives `<device-id>@push.localhost` and `<e164>@sms.localhost`, so
`pnpm mail:latest --to +60123456789@sms.localhost --code` reads an SMS code. `none` records
`SUPPRESSED (provider-disabled)`, never a fake `SENT`.

**Workers.** Each external channel has its own queue (`notifications.push`, `notifications.sms`;
`email.send` stays) with exponential back-off. A job re-reads its delivery and acts only on `QUEUED`,
moving it to `SENDING` with a conditional update. The one duplicate left — provider accepted, process
died before `SENT` — is accepted: Twilio and FCM take no idempotency key, and a rare repeat beats a
lost message.

### Grouping, digests and fallback

- **Grouping.** A notification whose grouping key has an open window updates that in-app row
  (`groupCount`, re-rendered copy) and re-sends push with the same collapse key instead of a new one.
- **Digest.** With digest on, `digestible` email deliveries are `HELD (digest)`; a job sends one
  digest at 08:00 in the person's time zone (daily, or Mondays for weekly). Push and in-app are not
  digested.
- **Fallback.** On *cannot deliver* only — no device, device revoked, number unverified, suppressed —
  a type's declared fallback channel is tried once. Time-based escalation is a
  [possible extension](#possible-extensions).

### Edge cases

| Situation | Behaviour |
|---|---|
| Phone or email changes while a delivery waits | Destination resolved at send time; an unverified phone suppresses SMS (`unverified-phone`) |
| Email changed | Security type notifies both the old and the new address |
| User soft-deleted | Every pending delivery `SUPPRESSED (recipient-deleted)`; devices revoked |
| Tenant `SUSPENDED`, `BANNED`, `PENDING_DELETION`, `DELETED` | Its scheduled broadcasts cancelled; tenant-surface notifications suppressed; security notices to its owner still sent |
| Impersonated session | Inbox read-only (no mark read), device registration refused, both audited |
| Shared phone | Device belongs to the session: sign-out revokes, sign-in re-registers; at most 10 active devices per user, oldest revoked first |
| Token rotated by the OS | The app re-registers on `addPushTokenListener`; the old hash is revoked |
| Push permission denied | No device; fallback applies; Settings shows "Turn on in Settings" |
| Quiet hours across a DST change | Computed in the IANA zone at release time, not stored as UTC offsets |
| Locale missing for a type | `en` renderer, logged once per type and locale |
| Contact point later signs up | Its suppressions and unsubscribes carry over by destination hash |
| Producer retries `notify()` | Unique `(recipientKey, typeKey, dedupeKey)` returns the existing notification |
| Provider outage | Queue back-off up to 24 h, then `FAILED`; health shows the provider degraded |

### Security, tenancy and audit

- **Tenancy ([ADR 062](./062-tenancy-modes-and-isolation.md)).** Recipient lists for tenant
  audiences are resolved inside the tenant scope; `InAppNotification` RLS `app_owns(userId)`; the
  delivery log readable by platform staff and that tenant's admins only.
- **Permissions ([ADR 067](./067-unified-authorization-model.md)).** `notifications:read-own`,
  `notifications:manage-own-preferences`, `notifications:read-delivery-log`,
  `notifications:retry-delivery`, `notifications:send-test`, `notifications:manage-suppressions`.
- **Audit.** Preference, consent and quiet-hour changes, device registration and revocation, retries,
  test sends and suppression lifts go through the request audit. Deliveries store masked
  destinations (`+60••••6789`, `j•••@example.com`).
- **Retention.** ~~In-app rows: soft-deleted 90 days after read, 365 days if unread. Deliveries: 180 days.~~ **Changed 2026-11-03:** every record, in-app rows and deliveries included, is kept for ten years (`apps/api/src/platform/domain/record-retention.ts`), then soft-deleted.
  Sensitive deliveries: metadata only, 30 days. Consent events are kept for the life of the account
  (proof of consent).

### UI design

**Bell (web, merchant, admin — the shared `NotificationsDropdown`).** Only the current app's surface;
unread badge (99+); live through SSE.

```
┌─ Notifications ──────────────── Mark all read ┐
│  [ All ]  [ Unread 3 ]                         │
│  TODAY                                         │
│  ● 🔒 New sign-in from Chrome on macOS    2m   │
│  ●  🎁 You earned 3 referral credits      1h   │  ← grouped
│  YESTERDAY                                     │
│     📣 Acme Coffee · Weekend 2-for-1      1d   │  ← tenant broadcast (ADR 073)
│ ───────────────────────────────────────────── │
│  View all notifications      ⚙ Preferences    │
└────────────────────────────────────────────────┘
```

**`/notifications`.** List with category and state filters (nuqs), virtualized infinite scroll, open
marks read, archive on hover, an empty state per filter, broadcasts rendered with the shared rich-text
renderer.

**Settings → Notifications** (inside `SettingsShell`):

```
                     In-app   Email   Push    SMS
Security               🔒       🔒     [x]    [ ]   "Security alerts are always sent in-app and by email"
Account               [x]      [x]     [x]    [ ]
Transactional         [x]      [x]     [x]    [ ]
Product updates       [x]      [ ]     [ ]     —
Marketing             [ ]      [ ]     [ ]     —    "Needs your consent" → per-tenant list below
Per business          Acme Coffee   [Customize] [Stop hearing from Acme]
Quiet hours   [ ] 22:00 – 07:00  Asia/Kuala_Lumpur   (security still comes through)
Email digest  ( ) Off  ( ) Daily 08:00  ( ) Weekly, Mondays 08:00
Devices       Pixel 9 Pro XL · Android · last seen 2m   [Remove]
```

Unavailable channels say why and link to fix it ("Verify your phone", "Install the app").

**Admin → Notifications.**
- *Deliveries*: every channel, filters (channel, status, reason, type, tenant, surface), masked
  recipient, detail sheet with attempts and provider response, **Retry** on `FAILED`.
- *Catalog*: every type with category, surfaces, channels, flags; per-channel preview; **Send test**
  to yourself.
- *Suppressions*: search by masked address, lift with a reason.
- *Providers*: FCM, APNs, Twilio, Mailpit/Resend status cards.
- *Broadcasts* and *Reports*: ADR 073.

**Merchant → Notifications.** The tenant's deliveries (no retry) and its broadcasts (ADR 073).

**Mobile.**
- Bell → **Notifications** screen: grouped by day, pull to refresh, swipe to archive, unread dot, tap
  follows the deep link (expo-router); broadcasts rendered natively, tables scroll sideways.
- **Permission primer** before the OS prompt, at the first moment worth a push or from Settings.
- **Settings → Notifications** mirrors the web matrix.
- A push in the foreground shows the existing toast and refreshes the inbox.
- The expo-boilerplate gets the same screens, components and tests with demo data and no API.

## Implementation notes (2026-10-31)

| Area | What was built | Note |
|---|---|---|
| Inbox | Web, merchant and admin `NotificationsInbox` (shared, `@workspace/client`) with a broadcast's rich body unfolded in place and a Report action; the mobile inbox at `/settings/notifications`, opened from the header bell and from a tapped push | The bell's old "coming soon" toast is gone |
| Settings | One shared `NotificationSettings` page (web `/dashboard/notifications/settings`, merchant `/t/:slug/notifications/settings`, admin `/notifications/settings`) and the mobile `/settings/notification-settings`: the category × channel matrix (locked and unavailable cells say why), quiet hours, digest, offers per store with leave, and phones | Every change is saved at once and re-validated by the API |
| Unsubscribe | Web `/unsubscribe?token=` | Asks before acting: mail scanners open links, so a visit alone never unsubscribes |
| Push | `expo-notifications` (SDK-matched); the app explains first (primer), then asks, then registers the native FCM/APNs token (`PUT /notifications/push-devices`); a tap reports `push-opened` and opens the inbox | Firebase config comes from the `GOOGLE_SERVICES_JSON` path (EAS file-secret convention); `apps/mobile/google-services.example.json` shows the shape and `/google-services.json` is git-ignored. Without it the build simply registers no device |
| Bell count | Web, merchant and admin bells show the unread count ("3", "99+"; `AppShellNotificationBell`). The mobile header bell does too (`CountBadge` in `@workspace/ui-native`, `useUnreadNotifications`): `GET /notifications/unread-count`, kept live by `GET /notifications/stream` (SSE over `expo/fetch` with the bearer token) while the app is in the foreground, polling every 60 s while the stream is down, and one reload whenever a stream opens again | The stream carries no content: each frame reloads the inbox and the count |
| Mobile feed | The mobile inbox reads like a social app's notifications (`NotificationRow` in `@workspace/ui-native`, `notifications-feed.tsx`): All / Unread pill chips, "New" (the last day) and "Earlier", a round picture per notice (the sender's initials or logo with the kind's glyph on its corner, or the glyph alone), the bold title running into the message, "25m"-style times, unread rows tinted. Tapping reads it and opens the full message in a sheet; a "…" menu marks it read, removes (archives) it, reports a broadcast or opens the settings; "See earlier notifications" asks for a page more | The expo-boilerplate has the same feed on its sample data |
| Operations alerts | `operations.alert` (category `operations`, surfaces admin + customer, in-app + email + push, `immediate`): the operations monitor (ADR 068) notifies every SuperAdmin (flag or role), Admin and Platform Developer when an alert opens and when it resolves, in the alert's own transaction (`ops-alert-notifier.ts`, dedupe key `ops-alert:<id>:<open|resolve>`). It reaches the admin panel's bell and the phone app's inbox, buzzes their phones at any hour (no quiet hours, no digest) and is emailed. The settings' extra addresses belong to no account and still get the `admin-alert` email alone. The settings matrix shows the Operations row only to those people, in-app and push locked on, email switchable | One migration adds the enum value; the monitor's system operation now also reads `UserRole` and `Role` and writes `Notification` (`db:apply-security`). Platform Developers now have the admin surface too: they work in the admin panel's operations console |
| Demo | `pnpm --filter @workspace/api notifications:demo [--email <address>]` (`scripts/dev.ts`): two new sign-ins and a test notification for one person (the only superadmin by default), through `notify()` and the fan-out queue | Development only; its own `notifications.demo` system operation (`User`, `Notification`) — apply it with `db:apply-security` |

## Implementation notes (2026-11-01)

| Area | What changed | Why |
|---|---|---|
| Settings | The category × channel grid became one row per kind of message (its symbol, what it is about, and where it reaches the person now — "In the app and by email" or "Off"); tapping a row opens its channels, one switch each (mobile `DisclosureRow`, web `Collapsible`). A locked switch names why ("Always on, to keep your account safe"), an unavailable one says what to do first, and a `not-offered` channel shows no switch. Leaving a store asks first. Same on web, merchant, admin, mobile and expo-boilerplate | Twenty-four "Security · In app" switches in a list read as noise; people think in kinds of message first, channels second |
| Switch | Four states that look different: on (filled, tick), off (hollow outlined track, small thumb), unavailable (faded, dashed) and the new `locked` (pale filled, lock glyph) — in `@workspace/ui` and `@workspace/ui-native` (identical in expo-boilerplate). The cell's state comes from `preferenceCellStateOf` / `isPreferenceCellOn` / `shownPreferenceCellsOf` in `@workspace/shared` | An off switch and a disabled one were both grey and differed only by opacity |
| Push | Android channels per kind (`NOTIFICATION_PUSH_CHANNEL_IDS`, created by the app at start; Security and Operations at high importance), the notice's time, the unread badge, grouping (`thread-id`) and the kind in the data. Operations alerts carry what, where, the limit, the reading and when (`subjectKind`, `subjectName`, `rule`, `thresholdValue`, `peakValue` on the payload), for push, email and the inbox | "Open the alerts page" told the person nothing on the lock screen |
| Web inbox | Each row shows the sender's initials or the kind's symbol, the kind, the sender, the time (exact on hover), the full message and an **Open** button; a kind filter (`?kind=`). A same-origin link opens in place | The page showed a title and a time only |

## Implementation notes (2026-11-02)

| Area | What changed | Why |
|---|---|---|
| Settings | "What reaches you" is a tree instead of rows that open to switches: each kind of message is a parent checkbox (all, some — a dash, "mixed" — or none of its channels), its channels hang under it on a guide line, indented, one checkbox each. A kind's checkbox changes only its switchable channels, in one save; locked channels show a lock and stay on. Always open. Same on web, merchant, admin, mobile and expo-boilerplate; the summary sentence ("In the app and by email") and the mobile `DisclosureRow` are gone, since the tree shows the same thing | A switch per channel hidden behind a row still read as a list of toggles; a tree shows a kind and its channels at once, and lets a person take or drop a whole kind in one tap |
| Kit | `TreeBranch` (new, `@workspace/ui` and `@workspace/ui-native`, identical in expo-boilerplate): a data-agnostic list that hangs its children from a vertical guide with an elbow to each child's middle, stopping after the last. `Checkbox` gained `locked` (pale, lock glyph, never faded) on both platforms, and `indeterminate` on mobile; on the web, the indeterminate box now shows a dash and is filled (it used to show nothing) | The tree needed a guide line both platforms draw the same way, and a kept-on channel must not look like a disabled one |

Risk accepted: an operations-alert delivery still queued when this ships carries the older payload
without the new fields and fails validation; it is a one-off at upgrade, and the alert itself stays in
the operations console.

## Considered options

| Option | Why not |
|---|---|
| Each context sends on its own | Duplicated preference, consent and cap logic; no single record of what a person received |
| Expo push service | Direct FCM and APNs chosen: no third party in the path |
| Hosted platform (Knock, Novu Cloud, Courier) | A second user and preference store outside our RLS, audit and design system |
| Keep `RewardNotification` beside a new inbox | Two unread counts, two routes, two schemas |
| Browser (web) push | Declined: the bell with live updates is enough on web |
| WebSockets for the live inbox | SSE already exists and the inbox is one-way |

## Possible extensions

- Time-based escalation (push not opened in N minutes → SMS): doubles SMS cost and needs open tracking.
- More locales.
- Browser push, if ever wanted.

## Phases

Part of the build order agreed for ADRs 070–073 and the compose plan (compose → rate limiting →
cache → **notifications** → broadcasts → mobile → boilerplate), each step ending green.

1. Catalog, recipients, `Notification`/`NotificationDelivery`/`InAppNotification`, `notify()`, fan-out,
   in-app channel, SSE, the `RewardNotification` move, bell and `/notifications`.
2. Preferences, consent, unsubscribe, suppressions, quiet hours, grouping, digests, Settings.
3. Email through the fan-out; admin Deliveries, Catalog, Suppressions, Providers.
4. Push: `PushDevice`, FCM, APNs, Mailpit sink, `google-services.example.json`, read sync.
5. SMS: Twilio, webhooks, allowlist, caps, Mailpit sink.
6. Retention jobs, docs and runbooks.

## Consequences

- Every new message is a catalog entry plus renderers and tests.
- **NOT VERIFIED until credentials exist:** Android push (needs your Firebase project's
  `google-services.json` and `FCM_SERVICE_ACCOUNT_JSON`; then the Pixel emulator verifies it end to
  end); iOS push (Apple developer account, `.p8` key and a device); real SMS (Twilio account and
  Messaging Service SID). Until then those channels are verified through the Mailpit sinks.

## The decision trail

| # | Question | Answer |
|---|---|---|
| — | Push transport | Direct FCM + APNs |
| — | SMS provider | Twilio |
| — | Local SMS | Into Mailpit (push too) |
| Q1 | Recipients without accounts | Contact points: email or SMS only, no inbox, preferences or push |
| Q2 | Preferences across tenants | Tenant override → platform preference → catalog default → mandatory lock |
| Q3 | Which app shows what | Types declare surfaces; mobile shows the signed-in role's surfaces; push follows |
| Q5 | Marketing consent, unsubscribe | Separate audited consent records; one-click unsubscribe on every non-mandatory email |
| Q6 | Grouping and digests | Yes; never for security or OTP |
| Q7 | Fallback | On "cannot deliver" only; time-based escalation recorded as an extension |
| Q8 | Read state | Push tap marks read; reading clears the tray by silent push; no email open tracking |
| Q9 | Sensitive content | Never stored, generic lock-screen text, no in-app row |
| Q10 | Languages | Locale-ready, English only |
| Q11 | Browser push | No; the bell only |
| Q12 | Impersonation | Read-only inbox, no device registration, audited |
| Q13 | Retention | 90 days read / 365 unread; deliveries 180; sensitive metadata 30 |
| Q33 | Destination changes | Resolved at send time; security types notify old and new address |
| Q34 | User or tenant goes away | Pending deliveries suppressed; tenant broadcasts cancelled; owner security notices still sent |
| Q35 | Suppression list | Yes, per channel; lifted only by re-verification |
| Q36 | Shared phones | Device bound to the session; at most 10, oldest revoked |
| Q37 | Defaults | Quiet hours off, digest off, product in-app only, marketing off, rest on |
| Q38 | Grouping window, digest time | 10 minutes; 08:00 local, daily or Mondays |
| Q55 | expo-boilerplate | UI only, identical code, tests and screens, no API |
| Q58 | Documents | 070 notifications, 073 broadcasts, 071 and 072 rewritten, compose plan in the local-infrastructure doc |
| Q59 | Build order | compose → rate limiting → cache → notifications → broadcasts → mobile → boilerplate; green after each |
| Q62 | Firebase | Not set up yet: ship a `google-services.json` template, filled in later |
