---
title: "7. Referrals"
description: "How a referral earns the referrer a reward when the referred customer redeems, and what is not built yet."
order: 8
author: "Product & Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop"
tags: ["user-guide", "referrals", "rewards"]
---

# 7. Referrals

A merchant can let a reward pay its **referrers**: when a customer who was referred redeems the
reward, the customer who referred them receives a reward of their own (the **referrer reward**),
taken from a limited **referral pool**.

```mermaid
flowchart TD
    A[Merchant creates reward:<br/>referrals on, pool size,<br/>referrer reward title] --> B[Referral recorded:<br/>referrer → referee, PENDING]
    B --> C[Referee claims the reward]
    C --> D[Referee redeems at the POS checkout]
    D --> E{Pool has room and<br/>referrer reward in stock?}
    E -- yes --> F[Same transaction as the bill:<br/>referral CREDITED, pool −1,<br/>credit claim for the referrer,<br/>in-app notification]
    F --> G[Email to the referrer<br/>retried every minute until sent]
    E -- no --> H[Nothing credited,<br/>referral stays PENDING]
```

## For the merchant

When creating a reward ([Rewards](./04-rewards.md)) set **Referrals enabled**, the **referral
pool** (how many referrers can be paid) and the **referrer reward title**. Referrals are on by
default for new rewards.

## For the referrer

When a referred friend redeems, you get a new claim in **My Wallet** (valid for the normal claim
period) plus a notification and an email. A referral is credited at most once, even if your
friend redeems several times or at several tills at the same moment.

## Statuses

| Status | Meaning |
| --- | --- |
| `PENDING` | Recorded, waiting for the referee's redemption (or the pool / referrer reward ran out) |
| `CREDITED` | The referrer received the credit claim |
| `BLOCKED` | Not eligible for credit |

## Signup referrals (platform)

Separate from merchant **reward** referrals above: every Reward Hub member gets a rotating
**signup referral code** to share when someone creates a **consumer web** account. Open
**Earn More → Referrals** in the sidebar (or go to `/rewardhub/referrals`) to copy your code and
see who registered with it. There is no payout to the referrer; status updates when they redeem
their first reward at checkout, and you get one in-app notification naming them. Optional code
field on web signup only (the mobile app and merchant staff creation do not ask for one). A code
lasts 30 days; a new one is issued within the hour after it expires, and the screen shows the old
code as **Code expired** until then. Admins see the referrer and referral status on the user list
and profile, and can filter the list with **Referred by** and **Referral status**. Detail:
[ADR 035](../adr/035-signup-referrals.md).

> [!IMPORTANT]
> **Reward referrals — not built yet:** the API has no endpoint for a customer to *create* a
> reward-scoped referral (invite link or attribution token). Sub-pages under Referrals (Invite
> Friends, My Referrals, Earnings) stay disabled. Crediting reward referrals at checkout is
> implemented. See [known gaps](../technical/README.md#known-gaps).

Technical detail: [POS integration → Referrals](../technical/pos-integration.md#checkout).
