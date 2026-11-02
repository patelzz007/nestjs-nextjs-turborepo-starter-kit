---
title: "Broadcasts: how they work"
description: "Tenants and platform staff messaging people: tenant customers and consent, audiences, the rich-text body and its three renderings, links, scheduling, the weekly limit, approval, reports and strikes, permissions, and where the code lives."
order: 49
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["notifications", "broadcasts", "rich-text", "tenant-customers"]
---

# Broadcasts: how they work

A **broadcast** is a message a business (tenant) sends its own customers, or platform staff send to
users. It is delivered through the notifications system ([how notifications work](./overview.md)) as
the `broadcasts.message` type: one `notify()` per recipient, so preferences, consent, quiet hours,
suppressions and devices all apply. Decision record: [ADR 073](../../adr/073-broadcasts-and-tenant-customers.md).
The person-facing guide: [Notifications and broadcasts](../../user-guide/12-notifications-and-broadcasts.md).

## Who a tenant can reach: tenant customers

`TenantCustomer` links a user to a tenant. It is created by the person's **first claim** of that
tenant's reward (never by a POS sale, which has no user) and updated by claim and redemption events
(`firstClaimedAt`, `lastClaimedAt`, `claimCount`, `lastRedeemedAt`). **Leave store** sets `leftAt` and
withdraws the tenant's marketing consent; the person's next claim clears it.

A tenant's audience is its tenant customers **minus** banned customers, people who left, its own staff,
and anyone without a current marketing consent for that tenant. The first claim from a tenant asks for
that consent with an unticked box and the current wording version.

## Audiences

| Sender | Audience | Filters |
| --- | --- | --- |
| Tenant (owner, manager) | All its eligible customers, or **picked** ones (one or a group, via `CustomerPicker`) | Claimed within N days (default 60, 7–365), redeemed or not |
| Platform staff (SuperAdmin, Admin) | People by the app they use (customers, merchant staff, admins), in the admin panel's composer | Signed up on or after a date; for merchant staff, only active or only restricted stores; the kind (Product news or Account) |

The composer's count is a debounced count query, with the left-out reasons (counts only). The audience
is **frozen** when sending starts; anyone who withdraws consent, is banned or deleted before their own
delivery is suppressed at send time.

## The message

| | |
| --- | --- |
| Editor | `RichTextEditor` (`packages/ui`, Tiptap 3, editorcn's API, ported) — registers only the allowed nodes and marks |
| Stored as | ProseMirror JSON, validated by `RichTextDocumentSchema` (`@workspace/shared`): paragraph, H2/H3, bold, italic, underline, strike, lists, blockquote, rule, `https` link, one image, one call-to-action button, a table (≤ 6 × 50, one header row, cells hold paragraphs only), a code block. Anything else is **rejected** (422 with the path), never dropped |
| In app | `RichTextView` — web (`packages/ui`) and native (`packages/ui-native`, identical in expo-boilerplate): tables scroll sideways, code blocks copy, the button shows its real domain |
| Email | Safe HTML in the email layout; the link's domain beside the button |
| Push | Plain text, tables flattened to `Column: value`, cut to 240 characters |

**Links** (and the button) are checked on save and again on send: `https` only, no known shorteners,
nothing on `BROADCAST_BLOCKED_LINK_DOMAINS`.

## Lifecycle, limits and approval

```
DRAFT → PENDING_APPROVAL (platform, all users) → SCHEDULED → SENDING → SENT
                                     └─ CANCELLED (before sending) · PAUSED (reports) · FAILED
```

- **When:** now, a set time, or a set local time in **each recipient's time zone** (spread over up to
  26 hours). Quiet hours always apply — a broadcast is never urgent.
- **Weekly limit:** 5 tenant broadcasts per tenant per week (counted in the week sending starts;
  cancelled ones don't count). A tenant override raises it ([Rate limits and cache](../operations/rate-limits-and-cache.md)).
- **Four eyes:** a platform broadcast to all users needs a second staff member's approval — all three apps
  with no sign-up date and no store-state filter (`needsSecondApproval`). The composer says so before
  sending; the broadcast's page shows **Approve** to anyone else allowed to approve.
- **Sending** is throttled through the queue; a tenant leaving `ACTIVE` cancels its scheduled ones.
- **Sender:** the tenant's name and logo in the bell, the push title and the email display name; the
  email address stays the platform's.
- **Results:** per channel — targeted, delivered, suppressed by reason, failed, push opened, in-app read.
  No email opens (no tracking pixels).

## Reports and strikes

Every broadcast in an inbox has **Report** (spam, offensive, scam). At **10 reports or 1 % of the
audience**, whichever comes first, the broadcast and the tenant's other scheduled broadcasts are
**paused**. Staff **Dismiss** (resume), **Resume** or **Uphold** (keeps it stopped and records a strike).
**Three upheld strikes in 90 days** turn the tenant's broadcasting off until staff turn it back on.

## Permissions

| Who | Capability |
| --- | --- |
| Tenant: draft, edit, schedule | `merchant:manage_broadcasts` (Owner, Manager templates; not Cashier) |
| Tenant: send / approve | `merchant:publish_broadcasts` |
| Platform staff | `NOTIFICATION` / `BROADCAST` / `BROADCAST_REPORT` permissions on the Admin role (create, approve, review reports) |

Every create, edit, schedule, approve, cancel, pause, resume and report decision is audited.

## Where things are

| Piece | Path |
| --- | --- |
| Service, policy, audience | `apps/api/src/contexts/notifications/application/services/broadcast-service.ts`, `domain/broadcasts/` |
| Tenant API | `presentation/http/tenant-broadcasts.controller.ts` (`/tenants/:slug/broadcasts…`) |
| Admin API | `presentation/http/broadcasts-admin.controller.ts`, `broadcast-reports-admin.controller.ts` |
| Report | `presentation/http/broadcast-report.controller.ts` (`POST /broadcasts/:id/report`) |
| Merchant UI | `apps/merchant` — `/t/:slug/broadcasts`, `/new`, `/:id`, `/:id/edit`; `components/merchant-ui/customer-picker.tsx` |
| Admin UI | `apps/admin` — `/emails/broadcasts` (list, reports), `/emails/broadcasts/new`, `/emails/broadcasts/:id`, `/emails/broadcasts/:id/edit` (`contexts/notifications/components/platform-broadcast-*.tsx`) |
| Shared composer | `packages/client/src/lib/features/broadcasts/` — `broadcast-composer-form.tsx` (title, message, channels, timing, preview; the audience is a slot each app fills) and `broadcast-draft.ts` (timing and draft rules), used by merchant and admin |
| Editor and viewers | `packages/ui/src/components/rich-text-editor.tsx`, `rich-text-view.tsx`; `packages/ui-native/src/components/rich-text-view.tsx` |
| API reference | [Notifications API](../api-reference/notifications.md) |
