---
title: "ADR 073: Broadcasts and tenant customers — person-written notifications with consent, limits and review"
tags: ["adr", "notifications", "broadcasts", "consent", "rich-text", "plan"]
description: "A tenant customer link created by claims; broadcasts written by tenant owners and managers to their tenant customers and by platform staff to users, in-app, by email and by push; a Tiptap-based rich-text editor (editorcn) stored as validated JSON and rendered per channel; per-recipient scheduling, weekly limits, link checks, four-eyes approval, results, recipient reports and automatic pauses."
author: "Platform Team"
lastUpdated: 1793404800000
coverImage: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=1200&h=630&fit=crop"
order: 73
---

# ADR 073: Broadcasts and tenant customers — person-written notifications with consent, limits and review

## Status

**Accepted (2026-10-30); built (2026-10-31)** — see [Implementation notes](#implementation-notes-2026-10-31). Agreed in the same design interview as
[ADR 070](./070-multi-channel-notifications.md); the [decision trail](#the-decision-trail) records it.
Terms are in [`GLOSSARY.md`](../../GLOSSARY.md) under *Notifications*.

## Context

ADR 070 sends notifications the platform's own code decides on. Tenants also need to tell their
customers about offers, and platform staff need to announce maintenance or incidents. A customer is
linked to a tenant today only indirectly (claim → reward → tenant) plus the tenant's customer-ban list,
so there is no audience to send to.

Letting tenants write to people is the riskiest thing in the notifications design: it is the path for
spam, phishing links and unconsented marketing. Every rule below exists for one of those.

## Decision

### Tenant customers

`TenantCustomer` (BaseModel, RLS: the user and that tenant's admins) links a user to a tenant:

| Field | Meaning |
|---|---|
| `firstClaimedAt`, `lastClaimedAt`, `claimCount` | Updated by the claims context's claim event |
| `lastRedeemedAt` | Updated by the redemption event |
| `leftAt` | Set when the customer leaves the tenant; cleared by their next claim |

- Created by the person's **first claim** of that tenant's reward; never by a POS sale (a sale has no
  user). No backfill: the table ships before any shared or deployed database holds claims (the
  pre-release baseline is regenerated and re-seeded), and the seed writes the links of the claims it
  creates. A fork that adopts this on live data adds a one-off backfill then.
- Kept for good. A banned customer keeps the link and is always left out of audiences. The tenant's
  own staff are never its tenant customers.
- **Leaving a tenant** ("Stop hearing from Acme") sets `leftAt` and withdraws that tenant's
  marketing consent (ADR 070 consent source `leave-tenant`).
- The first claim from a tenant asks for that tenant's marketing consent with an **unticked**
  checkbox showing the current wording version.

### Audiences

| Sender | Audience |
|---|---|
| Tenant owner or manager | Its tenant customers, minus banned, left, own staff, and anyone without a current consent for that tenant. Filters: claimed within N days (default **60**, 7–365), redeemed or not, location |
| Platform staff | All users, or a filter by surface (customers, merchant staff, admins), tenant lifecycle state, signup date |

The audience count updates live as filters change (a debounced count query). The audience is
**frozen** when sending starts: a person who becomes eligible later is not added, and anyone who
withdraws consent, is banned or is deleted before their own delivery runs is suppressed at send time
(ADR 070).

### Channels

In-app, email and push only — **never SMS**, for tenants or platform staff. Each recipient gets each
channel their preferences, consent, suppressions and devices allow (ADR 070's fan-out, category
`marketing` for tenant broadcasts, `product` or `account` for platform notices chosen by staff).

### Content: editorcn, stored as validated JSON

- The editor is [editorcn](https://github.com/shadcn-labs/editorcn) (Tiptap/ProseMirror, MIT),
  installed through the shadcn CLI into `packages/ui` as a shared **RichTextEditor**, with a
  component-gallery entry and tests; the composers use TanStack Form.
- The body is stored as **ProseMirror JSON**, never HTML. A zod schema allows only:

  | Allowed | Turned off |
  |---|---|
  | Paragraph, heading (H2, H3), bold, italic, underline, strike, bullet and numbered list, blockquote, horizontal rule, link (https), one image from Files, one call-to-action button, **table** (≤ 6 columns × 50 rows, one header row, no merged cells), **code block** (no highlighting) | Embeds and iframes, text colours, font sizes, raw HTML, any other node or mark |

  The server **rejects** a body with any unknown node or mark (422 with the path), never drops it.
- Rendered three ways by the server or a shared renderer:

  | Channel | Rendering |
  |---|---|
  | Email | Safe HTML in the React email layout; real tables with a styled header; code in a monospace box; the link's real domain shown beside the CTA |
  | In-app (web, mobile) | A JSON-driven renderer (shared on web; native on mobile); tables scroll sideways; code blocks with a Copy button |
  | Push | Plain text: formatting stripped, tables flattened to `Column: value` lines, fences dropped, truncated to 240 |

- Images are uploaded through Files, malware-scanned, and referenced by file id; a broadcast cannot
  send while its image is unscanned or failed.

### Links

Every link and the CTA are checked **on save and again on send**: https only, not a known URL
shortener, not on `BROADCAST_BLOCKED_LINK_DOMAINS`. A failing link blocks scheduling with the exact
link named.

### Scheduling, limits and approval

- Lifecycle: `DRAFT → PENDING_APPROVAL (platform all-users only) → SCHEDULED → SENDING → SENT`, or
  `CANCELLED` (any time before `SENDING`), `PAUSED` (by reports), `FAILED`.
- Send at one instant, or at a local time **in each recipient's time zone** (sending spreads over up
  to 26 hours). Quiet hours always apply: a broadcast is never urgent.
- **Limit:** 5 tenant broadcasts per tenant per week, counted in the week sending starts; cancelled and
  failed-before-sending ones do not count; a tenant override (ADR 071) can raise it.
- **Four eyes:** a platform broadcast to all users needs a second staff member's approval; the author
  cannot approve their own.
- Sending is throttled through the queue so a large audience never floods providers.
- Tenant lifecycle: a tenant that leaves `ACTIVE` has its scheduled broadcasts cancelled (ADR 070).

### Sender identity

A tenant broadcast shows the tenant's name and logo in the bell, as the push title and as the email
display name; the email address stays the platform's (SPF/DKIM aligned). Platform notices show the
platform brand.

### Results

Per channel: targeted, delivered, suppressed by reason, failed, push opened, in-app read. No email
opens (no tracking pixels).

### Reports and pauses

- Every broadcast in the inbox has **Report** ("Spam", "Offensive", "Scam or phishing").
- Reports reach **Admin → Notifications → Reports**. At 10 reports or 1% of the audience, whichever
  comes first, the broadcast and that tenant's other scheduled broadcasts are **paused**.
- Staff **dismiss** (resume), **uphold** (keeps it stopped, records a strike) or **resume**. Three
  upheld strikes in 90 days turn off that tenant's broadcasting until staff turn it on again.

### Permissions and audit

- Tenant: `notifications:manage-tenant-broadcasts` on the Owner and Manager role templates, not
  Cashier.
- Platform: `notifications:manage-platform-broadcasts`, `notifications:approve-platform-broadcasts`,
  `notifications:review-broadcast-reports`.
- Every create, edit, schedule, approve, cancel, pause, resume and report decision is audited.

### UI design

**Merchant → Broadcasts.** A list (status chips, scheduled time, audience, results), and a composer:

```
┌ New broadcast ───────────────────────────────────────────────────────────────┐
│ Title    [ Weekend 2-for-1 on all lattes                         ]          │
│ Message  ┌ B I U S │ H2 H3 │ • 1. ❝ ― │ 🔗 🖼 ▦ </> │ [Button] ─────────┐ │
│          │ Bring a friend this Saturday…                                  │ │
│          └────────────────────────────────────────────────────────────────┘ │
│ Audience  Claimed within [ 60 ] days · Redeemed [Any ▾] · Location [All ▾]  │
│           ≈ 1,284 tenant customers with consent  (3,902 linked · 2,618 left out ▾)
│ Channels  [x] In-app  [x] Email  [x] Push                                  │
│ When      ( ) Now  (•) Sat 1 Nov, 10:00 in each customer's time zone        │
│ Preview   [ In-app ] [ Email ] [ Push ]   ← renders exactly what is sent    │
│ This week 2 of 5 broadcasts used                [Save draft] [Schedule]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

"Left out" expands to counts per reason (no consent, banned, left, staff), never names.

**Admin → Notifications → Broadcasts** (the same composer with platform audiences, plus
*Awaiting approval*) and **Reports** (queue with the reported broadcast rendered, report reasons,
tenant strike history, Dismiss / Uphold / Resume).

**Customer side (web and mobile).** Broadcasts in the inbox with the tenant's logo, **Report** and
**Stop hearing from {tenant}** in the row menu; Settings → Notifications → *Per business* lists every
tenant with consent and leave controls.

## Implementation notes (2026-10-31)

| Area | What was built | Deviation, and why |
|---|---|---|
| Editor | `RichTextEditor` in `packages/ui` with editorcn's compound API (`RichTextEditor`, `.Toolbar`, `.ControlsGroup`, controls, `.Content`, `.Footer`) on Tiptap 3, a `CallToAction` node, tables whose cells hold paragraphs only, and a gallery entry | **Ported, not installed through the shadcn CLI.** editorcn's registry item is ~180 KB of files built around features this ADR turns off (colours, highlight, YouTube/Twitter embeds, alignment, its own button/popover/tooltip copies). The port keeps its architecture, uses the kit's own primitives, and registers only the allowed nodes and marks — so the editor cannot produce anything the schema rejects |
| Rendering | `RichTextView` on web (`packages/ui`) and natively (`packages/ui-native`, identical in expo-boilerplate): tables scroll sideways, code blocks copy, the call-to-action shows its real domain | — |
| Merchant composer | `/t/:slug/broadcasts` (list + weekly allowance), `/new`, `/:id`, `/:id/edit` — title, message, who (all customers filtered by claimed-within days and redeemed, or picked by name: one person or a group), channels, timing (now, a set time in the store's zone, or a set time in each customer's own zone), live audience count with who is left out and why, preview, Save draft / Send | The composer keeps its values in React state, not TanStack Form: the form's path types cannot expand the recursive document type (TS2589). Validation is still the shared `BroadcastDraftSchema` |
| Customer picker | Shared `CustomerPicker` (merchant `components/merchant-ui`), used by broadcasts and reward audiences: names and masked emails only; a customer who cannot be reached is shown disabled with the reason | Editing a draft names its picked people from the largest page of customers; anyone beyond it shows as "Customer" until found by search (no by-id lookup endpoint) |
| Admin | `/emails/broadcasts`: every broadcast with Read message, Approve (four eyes) and Cancel; open reports with Dismiss, Resume broadcast and Uphold. Since 2026-11-01 also **New broadcast** → `/emails/broadcasts/new`, `/:id`, `/:id/edit` for SuperAdmins and Admins: the platform audience (apps, store state, signed-up-after date), the kind (Product news or Account notice), a live count and a note when it needs a second approval | The composer form (title, message, channels, timing, preview) moved to `@workspace/client` (`features/broadcasts/`) with the audience as a slot, so merchant and admin share it. Platform Developers do not broadcast |
| Reward audiences | "Who can claim" on the reward editor (Everyone / Chosen customers) and on the reward page; "Just for you" on web | — |

## Considered options

| Option | Why not |
|---|---|
| Store HTML from the editor | Sanitizing HTML for email, web and native is three attack surfaces; JSON with an allowlist is one |
| Tenant broadcasts by SMS | Cost per message and the highest abuse risk |
| Platform review of every tenant broadcast | Does not scale; limits, link checks, reports and pauses catch abuse instead |
| Audience = every user who ever touched a tenant (including POS) | A sale has no user, and consent is asked at claim time |

## Phases

Step 5 of the agreed build order (after ADR 070):

1. `TenantCustomer`, claim and redemption events, backfill, consent at first claim, leave tenant.
2. `RichTextEditor` (editorcn) in `packages/ui`, the JSON schema, the three renderers.
3. `Broadcast` aggregate, audiences, scheduling, limits, link checks, sending, results.
4. Merchant and admin composers and lists; approval.
5. Reports, pauses, strikes; customer-side controls on web and mobile.

## Consequences

- Tenants get a powerful channel to their customers, bounded by consent, limits and review.
- The editor is a new shared UI component and a new dependency set (Tiptap) in `packages/ui`.
- The mobile app needs a native renderer for the same JSON; the expo-boilerplate gets the same
  renderer and screens with demo data.

## The decision trail

| # | Question | Answer |
|---|---|---|
| Q4 | Human-authored broadcasts | Yes, platform staff and tenants — **in the first build, not a later phase** |
| Q27 | Tenant's audience | Build the customer-to-tenant link; audience = claimed at least one reward, minus banned and unconsented; filter by claimed in the last 60 days |
| Q28 | Consent per tenant | Yes; withdrawing for one tenant leaves the others |
| Q29 | Broadcast channels | In-app, email and push only |
| Q30 | Review | No review for tenants within limits; four eyes for platform all-users; **5 per tenant per week** |
| Q31 | Scheduling | Per-recipient local time or one instant; quiet hours apply |
| Q32 | Editor | shadcn-labs editorcn (rtecn.space), not in the codebase yet |
| Q42 | What creates the link | A claim: whoever claimed a reward is that tenant's customer |
| Q43 | Naming | "Tenant customer", distinct from the glossary's "Customer" |
| Q44 | Does the link end | Kept for good; banned excluded; customers can leave until they claim again |
| Q45 | The 60 days | Default 60, adjustable 7–365, audience count updates live |
| Q46 | Stored format | ProseMirror JSON with a zod allowlist; unknown nodes rejected |
| Q47 | Editor features | Tables and code blocks allowed; embeds, colours, font sizes, raw HTML off |
| Q48 | Where the editor lives | `packages/ui` RichTextEditor, gallery entry, TanStack Form |
| Q49 | Links | https only, no shorteners, blocklist; checked on save and send; real domain shown |
| Q50 | Who may send | Tenant owners and managers; platform staff with a new permission |
| Q51 | Weekly count | Week sending starts; cancelled don't count; overrides can raise it |
| Q52 | Sender identity | Tenant name and logo; platform email address |
| Q53 | Results | Per channel; no email opens |
| Q54 | Reports | Yes, with automatic pause at 10 reports or 1% |
| Q57 | Tables and code per channel | As tabled above; no syntax highlighting |
| Q60 | Report review | Admin → Notifications → Reports; 3 strikes in 90 days turn broadcasting off |
