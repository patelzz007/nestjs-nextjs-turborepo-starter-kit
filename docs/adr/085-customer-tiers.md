---
title: "ADR 085: Customer Tiers"
tags: ["adr", "rewards", "tiers", "claims"]
description: "A customer's tier (Bronze, Silver, Gold, Diamond) is platform-wide, earned only by counted redemptions inside a rolling tier window, capped per merchant, and protected by a tier hold. Rewards may name a minimum tier."
author: "Platform Team"
category: "Architecture decisions"
date: 1794528000000
lastUpdated: 1794873600000
editedAt: 1794873600000
coverImage: "/images/covers/adr/085-customer-tiers.webp"
order: 85
---

# ADR 085: Customer Tiers

## Status

Accepted (2026-11-17). Agreed in a design session on 2026-11-13 and built on 2026-11-17 for the API, web, merchant and admin apps. The mobile app is unchanged.

Terms used below (**tier**, **counted redemption**, **tier window**, **minimum tier**, **locked reward**, **promotion**, **tier hold**, **demotion**, **tier history**) are defined in `GLOSSARY.md`.

## Decision

A customer's **tier** belongs to the customer across the whole platform, not to a customer-and-merchant pair. It is earned only by **counted redemptions** inside a rolling **tier window**; claims never count, because a claim costs nothing and can be hoarded. A merchant may give a consumer reward a **minimum tier**; customers at that tier or above may claim it, and the server enforces this on every claim.

Defaults, all editable by platform staff in the admin app and audited:

| Rule | Default |
|---|---|
| Silver / Gold / Diamond | 10 / 25 / 50 counted redemptions in the tier window |
| Tier window | 12 months, rolling |
| Counted redemptions from one merchant per window | 20 |
| Tier hold after a promotion | 90 days |
| Demotion warning | 14 days before |

- A new `tiers` context owns tiers, tier history, the settings and the nightly run. It reacts to pos's `SaleCheckedOut` with an after-commit handler (mechanism 2, ADR 059) that dispatches `EvaluateCustomerTier` through the `SystemCommandDispatcher`, so tier rules can never fail a till checkout. The tier snapshot on a redemption is the only tier data written inside the redemption itself. An after-commit handler can be lost if the process dies at the wrong moment; the nightly run also evaluates everyone who redeemed in the last 2 days, so a missed promotion lands at most a night late. This is why an outbox is not needed here.
- No other context imports `tiers`. Rewards, claims and a merchant's customer list read tiers through the platform port `CUSTOMER_TIER_ACCESS`. Pos's checkout writes the snapshot through the `CUSTOMER_TIER_SNAPSHOT_FACTORY` it declares. The global `TiersAccessModule` provides both, so the context graph stays acyclic.
- **Promotion** happens within seconds of the redemption that crosses a threshold. A promotion during a tier hold starts a fresh hold. **Demotion**, demotion warnings and changed settings are applied by one nightly run (03:00 Malaysia time). A demotion drops straight to the earned tier, never during a tier hold, and always after a warning. The warning comes 14 days before the hold ends, or, once past the hold, 14 days before redemptions leaving the window take the customer below their tier.
- A merchant's ban on a customer has no effect on that customer's tier.
- A redemption at a store where the customer was a member *at that moment* is never counted.
- Each redemption keeps a snapshot of the customer's tier at that moment, so analytics by tier don't shift later.
- A claim made while the customer was eligible stays redeemable after a demotion or a raised minimum tier. Changing a published reward's minimum tier needs no re-review.
- A minimum tier applies only to `EVERYONE` consumer rewards that have referrals turned off. `SELECTED_CUSTOMERS` rewards and referrer rewards ignore tiers. A referred newcomer starts at Bronze and could never claim the reward they were referred to.
- Signed-out visitors count as Bronze. The web app shows **locked rewards** with progress toward unlocking them. The reward feed leaves locked rewards out unless the client asks for them (`includeLocked=true`), so today's mobile app, which this change doesn't touch, never shows a Claim button that would fail.
- With `includeLocked=true` the feed lists the rewards the viewer can claim first, then the locked ones, each group in the requested order, on every page. Such a list pages by `page` only: a cursor cannot say which group it is in, so none is handed out and one sent is refused. Viewers who hide locked rewards (`?hideLocked=true` on the web) get the plain feed back, cursor included.
- `GET /tiers/availability` (public, optional sign-in, never cached) says whether tiers are on and, while they are, the caller's tier. The web app reads it with the page to decide which rewards are locked. A failed read renders the page as with tiers off, which is safe because the API's own tier filter still applies.
- There is no manual tier override. A tier is always what its rules give.
- Tiers sit behind a feature flag. With the flag off, everyone is Bronze, the minimum tier is hidden and no tier jobs run.

## Considered options

- **A tier per merchant.** Rejected. The product promise is a status the customer carries across RewardHub. Each store already has its own customer list (`TenantCustomer`) for store-level loyalty.
- **A lifetime tier that never falls.** Rejected in favour of a rolling window, so that a tier reflects current activity. The tier hold and the warning keep the window from feeling punitive.
- **Counting paid bills or spend instead of redemptions.** Rejected. It's harder to explain to a customer than "4 more redemptions to Gold".

## Consequences

- A platform-wide tier lets one merchant's activity unlock another merchant's rewards. The member exclusion and the per-merchant cap are what stop a merchant from manufacturing Diamonds. With the defaults, one store can take a customer to Silver at most: Gold needs 2 merchants and Diamond needs 3. Raising the cap above Gold's threshold weakens this, so do it deliberately.
- Merchants see a customer's tier but nothing behind it: no counts and no other merchants.
- The development seed has no Diamond customer: its history spans two merchants, and Diamond needs three under the defaults. Bronze, Silver and Gold customers, a customer with a pending demotion warning and one already demoted are seeded.

## Where it shows

| Surface | What it shows |
|---|---|
| Web | Locked rewards in the feed (claimable first, "Hide locked" filter), a lock badge, the detail page's unlock progress in place of the Claim button, the tier in the header, and the "My tier" page |
| Merchant | The minimum tier in the reward editor (for everyone, while tiers are on), a change on a live reward without re-review, each customer's tier in the customer picker, and redemptions by tier in analytics |
| Admin | The tier rules under Settings (changed with a reason), a customer's tier and history on their page (read-only), and customers by tier on Analytics |
| Till (POS API) | `customerTier` on the redemption preview |
