---
title: "ADR 074: A reward's free item, and its offer in the till's answers"
tags: ["adr", "rewards", "pos", "integration", "contracts"]
description: "Free item and buy one, get one rewards name the item they give (a name for the receipt and the merchant's SKU for the POS), both required; the till's validate and checkout answers carry the reward's offer as a typed block per reward type, plus its description and terms."
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop"
order: 74
---

# ADR 074: A reward's free item, and its offer in the till's answers

## Status

**Accepted and built (2026-10-31).**

## Context

A merchant creates a reward with a type (`DISCOUNT`, `FREE_ITEM`, `CASHBACK`, `POINTS`, `BOGO`) and
one number, `rewardValue`: the percent off, the cashback in whole ringgit, the points, or how many
items are given. When the till scanned a customer's code, `POST /integration/redemptions/validate`
answered with the title, the type, the expiry and the minimum bill — **not the value**. Checkout
answered with the title only. A POS could not apply a discount it was not told the size of, and a
free item was known only by the reward's title ("Free latte"), which no POS can match to a product.

## Decision

1. **A free item is named.** A `FREE_ITEM` or `BOGO` reward has `freeItem: { name, sku }`; **both are
   required** for those two types and **refused** for every other type. `name` (1–200 characters) is
   what the receipt prints; `sku` (1–64 letters and digits, with `.`, `_`, `-`, `/` between them) is
   the merchant's own product code, so a POS matches it to its catalog. The shared contract checks it
   (`refineRewardFreeItem`), and the Reward aggregate enforces it on create and on every edit
   (`RewardFreeItemInvalidError`, `400 REWARD_FREE_ITEM_INVALID`). An edit that changes the type to one
   without an item drops the item; an edit to a type with an item must name one. The referrer bonus
   copies it with the rest of the offer.
2. **Two nullable columns**, `Reward.freeItemName` and `Reward.freeItemSku`, folded into the
   pre-release init migration (`20261031091039_init`, see `migrations-baseline.json`). Both-or-neither
   by type is a domain rule, not a database constraint (the schema is generated, and Prisma cannot
   express it).
3. **The till's answers carry the offer.** Validate now returns `rewardId`, `rewardDescription`,
   `offer` and `termsConditions` besides what it returned; each checkout redemption returns
   `rewardType` and `offer`. `offer` is a union told apart by `type`:
   `DISCOUNT { percentOff }`, `CASHBACK { amountMinor, currency }`, `POINTS { points }`,
   `FREE_ITEM { quantity, item }`, `BOGO { freeQuantity, item }`. Cashback is reported in integer minor
   units of the sale currency, like every amount the till sends and receives. All additions are
   additive to an open response schema (ADR 022): an existing POS keeps working.
4. **A free-item reward stored without its item is corrupt.** The till answer refuses it
   (`CORRUPT_AGGREGATE_STATE`, 500) rather than report a free item the POS cannot apply.
5. **The request stays as it is.** The till sends the code it read (the claim's redemption token, or
   its backup code); the API key and terminal id say who and where. What a reward gives comes from the
   API's records, never from the till.

## Alternatives considered

- **Expose only what was stored** (type and value, no item). Rejected: a free item would be known by
  its title only, so no POS could ring it up or print it reliably.
- **Name and SKU optional.** Rejected by the product owner: a POS integration needs both.
- **A `metadata` JSON field for item details.** Rejected: untyped, unvalidated, and invisible to the
  editor and the contract.
- **Flat `freeItemName` / `freeItemSku` in the API.** Rejected for a nested `freeItem`: the pair is one
  value, set and cleared together.

## Consequences

- The merchant reward editor asks for the item and its SKU when the type is Free item or Buy one, get
  one; the reward page and the admin review page show them.
- The mobile till shows what the reward gives (with the item and SKU) before redeeming, and on the
  receipt.
- Seeds name an item for every free item and buy one, get one reward; e2e fixtures that write rewards
  directly do the same.
- Integrators: `docs/technical/pos-integration.md` documents the offer block per type.
