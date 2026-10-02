---
title: "POS Integration"
tags: ["pos", "redemptions", "checkout", "api-keys", "terminals", "pairing", "sales"]
description: "How a merchant's point-of-sale checks customers' reward QR codes and deducts rewards after payment."
author: "Backend Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop"
---

# POS integration

A merchant's till (POS) talks to three endpoints. All of them are machine-to-machine: they authenticate with a **merchant API key**, never a cookie.

| Step | Call | When |
|------|------|------|
| 1 | `POST /api/v1/pos/terminals/pair` | **Once per till**: pair it with the code from the merchant console's **POS terminals** page. The till receives its own API key. |
| 2 | `POST /api/v1/redemptions/validate` | The customer shows their QR code (or reads out the 8-character backup code), **before** payment. |
| 3 | `POST /api/v1/redemptions/checkout` | **After** payment: report the bill and every reward redeemed on it. |

`POST /api/v1/redemptions/confirm` (one reward, no bill) still works for older integrations. It records **no sale**, so the bill never reaches sales analytics. Prefer checkout.

## Pairing a till

1. In the merchant console, open **POS terminals** → **Add terminal** and choose the store. Only owners and admins can do this; it uses the same permission as API keys (`merchant:manage_api_keys`). The console shows a one-time **pairing code**, 8 characters, valid for 15 minutes.
2. The till sends the code once. It needs no credential yet:

```bash
curl -X POST https://api.example.com/api/v1/pos/terminals/pair \
  -H "Content-Type: application/json" -d '{"pairingCode": "ABCD2345"}'
```

```json
{ "apiKey": "mk_live_…", "terminalId": "TERM-7F3K9QX2", "terminalName": "Front counter",
  "organization": { "slug": "brew-bean-kl", "displayName": "Brew & Bean KL" }, "location": { "id": "…", "name": "Bangsar" } }
```

3. Store `apiKey` securely on the till. It is shown only this once and belongs to this terminal and its store. Every later call sends it as `X-API-Key`.

Rules:

- **Single use.** A code works once and expires after 15 minutes.
- **No hints.** Unknown, expired and already-used codes all return the same `404 PAIRING_CODE_INVALID`.
- **Rate limited.** Pairing is limited per client IP.
- **Re-pairing** (a replaced till, or a key that may have leaked): use **Re-pair** in the console (**New pairing code** for a till that never finished pairing). When the till pairs with the new code, its previous key stops working.
- **Removing** a terminal revokes its key immediately.

The console shows each till's status (awaiting pairing, active, unpaired) and when it was last seen.

**Manually created keys** from the **POS API keys** page remain available for server-to-server integrations. They are not tied to a terminal, so they must send `X-Terminal-Id`.

## Headers

| Header | Required | Meaning |
|--------|----------|---------|
| `X-API-Key: <key>` (or `Authorization: Bearer <key>`) | yes | The credential. A paired till has its own key; removing the terminal in the console locks it out at once. |
| `X-Terminal-Id: <id>` | paired key: **no**; manual key: **yes** | A paired key already identifies its terminal. If it sends the header anyway, the value must be that terminal's id (`403 TERMINAL_KEY_MISMATCH` otherwise). A manual key sends a device label such as `KL-REGISTER-01`: letters, digits, `.`, `_`, `:`, `-`, up to 100 characters. The id **identifies** the till; it does not authenticate it. |
| `Content-Type: application/json` | yes | |

**Which store a call comes from** (used for store-only rewards and per-store sales):

1. A paired key → its terminal's store.
2. A manual key created for one store → that store.
3. Otherwise, a registered terminal id → that terminal's store.
4. Otherwise → unknown. Store-only rewards are not refused, because there is nothing to compare against.

A store key used from a terminal registered to a *different* store is refused with `403 TERMINAL_LOCATION_MISMATCH`.

**Only allow registered terminals.** This switch on the console's **POS terminals** page is off by default. When it is on, a manual key sending an `X-Terminal-Id` that isn't a registered terminal is refused with `401 TERMINAL_NOT_REGISTERED`. Paired keys are always registered.

Every call from a registered terminal updates its **last seen** time in the console.

These endpoints are exempt from the browser CSRF check (`X-Mutation-Intent`). They accept no cookies, so there is no ambient credential to forge.

## Validate

```bash
curl -X POST https://api.example.com/api/v1/redemptions/validate \
  -H "X-API-Key: <key>" -H "X-Terminal-Id: FRONT-COUNTER-01" -H "Content-Type: application/json" \
  -d '{"token": "<QR token>"}'      # or {"backupCode": "ABCD2345"}
```

```json
{ "claimId": "…", "rewardTitle": "Free latte", "rewardType": "FREE_ITEM", "claimExpiresAt": 1790000000000,
  "valid": true, "invalidReason": null, "minSpendMinor": 2000 }
```

- `invalidReason` is one of `ALREADY_REDEEMED`, `EXPIRED`, `BACKUP_LOCKED`, `NOT_VALID_AT_STORE`.
- `minSpendMinor` is the reward's minimum bill in sen (`null` = none). Checkout refuses a smaller bill.

Validate changes nothing except the audit log (`merchant.scan_qr`).

## Checkout

```json
{
  "idempotencyKey": "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a",
  "billTotalMinor": 2500,
  "currency": "MYR",
  "codes": [{ "token": "<QR token>" }, { "backupCode": "ABCD2345" }]
}
```

- **Money is integer minor units**: `2500` = RM 25.00. The largest accepted bill is RM 1,000,000.00, which catches ringgit sent as sen.
- **1–10 codes**, all belonging to **one customer**, each a different reward claim.
- **All-or-nothing.** Every code is checked first (exists, belongs to this merchant, redeemable here, bill ≥ its minimum spend). Then the bill and all redemptions are written in one transaction, and each claim moves `PENDING → REDEEMED` through a conditional update. If any claim is redeemed concurrently, nothing is written.
- **Idempotent.** Generate a new UUID per bill. Retrying with the same key **and the same body** returns the original result (same `saleId`) and never deducts twice. The same key with a different body is refused with `409 IDEMPOTENCY_KEY_REUSED`.

Response (`201`):

```json
{ "saleId": "…", "billTotalMinor": 2500, "currency": "MYR", "paidAt": 1790000000000, "idempotencyKey": "…",
  "redemptions": [{ "redemptionId": "…", "claimId": "…", "rewardId": "…", "rewardTitle": "Free latte" }] }
```

Each paid bill becomes one `reward_sales` row. It is the source of merchant sales, the customer's "where / what I spent", and the admin's platform sales (`GET /api/v1/admin/analytics/sales`, permission `ANALYTICS:READ`). One `merchant.redeem_reward` event is written to the transactional outbox in the same transaction.

The customer sees their bills on the web **My Activity** page (`/rewardhub/activity`), under **Your spending**: total spent and shop visits (each against the previous period), the top five shops by amount ("Where you spent the most"), and spend by merchant business category ("What you spent on" — a donut plus a list with amounts and share; merchants without a category read "Other"). The data is the `spending` block of `GET /api/v1/claims/analytics`. It is shaped in `apps/web/lib/rewards/spending-insights.ts` and rendered by `apps/web/components/rewardhub/shared/spending-section.tsx`. Amounts go through `formatMinorUnits` (`@workspace/ui/lib/format/money`). Until the customer has a paid bill in the period, the section shows guidance instead of the breakdowns.

The merchant sees the same bills first on **Analytics** (`/orgs/[orgSlug]/analytics`), in the **Sales** section: total sales, bills and average bill (each against the previous period) and weekly sales — the `sales` block of `GET /api/v1/orgs/:orgSlug/analytics`, rendered by `apps/merchant/components/analytics/merchant-sales-section.tsx`. Until the POS has reported a bill (none this period or the previous one), the section explains the checkout API and links members who may manage API keys to the API keys page.

Platform admins with `ANALYTICS:READ` see **Analytics → Sales** (`/analytics/sales`, period `?weeks=4|8|12`, default 8): the four headline cards (plus active merchants), weekly sales, and the top ten merchants with category and share of sales. The same four cards head the admin **Overview**.

## Errors

| Status | `error.code` | Meaning |
|--------|--------------|---------|
| 400 | `TERMINAL_ID_INVALID` | Malformed `X-Terminal-Id`. |
| 401 | `MERCHANT_API_KEY_REQUIRED` / `MERCHANT_API_KEY_INVALID` / `TERMINAL_ID_REQUIRED` | Missing or revoked key, or a manual key without a terminal id. |
| 401 | `TERMINAL_NOT_REGISTERED` | "Only allow registered terminals" is on and the manual key's terminal id isn't registered. |
| 403 | `TERMINAL_LOCATION_MISMATCH` | Store key used on another store's terminal. |
| 403 | `TERMINAL_KEY_MISMATCH` | A paired key sent another terminal's id. |
| 404 | `PAIRING_CODE_INVALID` | Pairing code unknown, expired or already used. |
| 404 | `REDEMPTION_TOKEN_INVALID` | Unknown QR token or backup code. |
| 409 | `ALREADY_REDEEMED` | A claim was already used (`claimId` in the error). |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key, different bill. |
| 422 | `WRONG_MERCHANT`, `CLAIM_EXPIRED`, `BACKUP_LOCKED`, `REWARD_NOT_VALID_AT_STORE` | The code can't be used here or now. |
| 422 | `MIN_SPEND_NOT_MET` | Bill below a reward's minimum (`minSpendMinor` in the error). |
| 422 | `MULTIPLE_CUSTOMERS`, `DUPLICATE_REWARD_CODE` | Codes from different customers, or the same claim twice. |

## Known gaps

- **Backup-code brute force.** `BACKUP_LOCKED` exists on the claim, but a wrong backup code matches *no* claim, so there is nothing to count failures against. Brute-force protection for backup codes needs per-key or per-terminal rate limiting.
