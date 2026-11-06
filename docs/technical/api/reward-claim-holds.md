---
title: "Reward claim holds"
description: "How the last unit of a reward is held for a customer while they enter their claim code, and given back when they don't finish."
author: "Platform Team"
lastUpdated: 1793923200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
order: 30
tags: ["rewards", "claims", "concurrency"]
---

# Reward claim holds

A hold works like a seat held at a cinema. When a customer asks for a claim code, one unit is taken from stock and
kept for them while they type it. Everyone sees the count drop by one, because the count on the server really did.

## The life of a hold

| Step | What happens | Stock |
|---|---|---|
| `POST /claims/otp` | The code is emailed and a `RewardClaimHold` starts, `ACTIVE` | `quantityRemaining` −1, `quantityReserved` +1 |
| `POST /claims` in time | The hold becomes `CONVERTED` and turns into the claim | `claimCount` +1, no second unit is taken |
| Time runs out | `claims.expire-holds`, every minute, marks it `EXPIRED` | `quantityRemaining` +1, `quantityReserved` −1 |

A hold lasts as long as the code does (`CLAIM_HOLD_TTL_MS`, 5 minutes), so a code never outlives its hold. The response
carries `holdExpiresAt`, which the web app shows as a countdown.

A customer whose phone is already verified needs no code, so they take no hold: their claim takes the unit directly.

## Why two customers can't get the same unit

| Protection | Where |
|---|---|
| The reward row is locked `FOR UPDATE` before any stock changes | `getForInventory` |
| One customer's own requests run one at a time, on their user row lock | `lockForClaim` |
| A hold moves out of `ACTIVE` once, by compare-and-set | `saveIfUnchanged` |

The customer who loses the last unit gets `REWARD_OUT_OF_STOCK` ("This reward just sold out") before they are asked for
a code, not after. If the expiry job and a late claim meet, one of them wins the compare-and-set: a claim that loses
takes a unit from stock like any other, if one is left.

## Limits against tying up stock

| Limit | Value | Error |
|---|---|---|
| Units one customer holds at once, across all rewards | `MAX_LIVE_CLAIM_HOLDS`, 3 | `CLAIM_HOLD_LIMIT_REACHED` (429) |
| Holds of one reward per customer per hour | `MAX_REWARD_HOLDS_PER_WINDOW`, 3 | `CLAIM_HOLD_LIMIT_REACHED` (429) |
| Asking for another code | Keeps the same hold and never extends it | — |
| Banned customers, closed merchants, and customers at their claim limit | Refused before a hold starts | As for a claim |

## In the web app

The claim flow stays open for the customer holding the last unit, even though the reward now reads as sold out to
everyone else. When the countdown ends the flow goes back to the start and the page refetches the count. The count can
lag by up to a minute, until the expiry job runs.
