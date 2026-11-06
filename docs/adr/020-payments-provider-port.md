---
title: "ADR 020: Payments as a Provider-Neutral Port (No Real Provider Yet)"
tags: ["adr", "payments", "billing", "adapters"]
description: "Payments and billing are modelled as a provider-neutral port with domain types and a fake adapter; no real provider (Stripe etc.) is integrated until the product needs one."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 20
---

# ADR 020: Payments as a Provider-Neutral Port (No Real Provider Yet)

## Status

Accepted (2026-10-01). **Phase A built (2026-11-03):** the port and the Billplz, CHIP and fake adapters (see [Implementation notes](#implementation-notes-2026-11-03)). **Phase B built (2026-11-03):** persistence, endpoints, signed callbacks, reconciliation and the merchant portal's payment screens. (The "roadmap" this ADR originally referenced was retired.)

## Context

The platform spec (§33, §60) requires provider-neutral payment and billing concepts
(`PaymentIntent`, capture, refund; `Plan`, `Subscription`, `Entitlement`, usage) with providers
behind adapters, and warns against spreading provider SDK types through the domain. The repo has
no payment code — only `Plan`, `OrganizationEntitlement` and `OrganizationQuota` tables.

## Decision

- Build the `PaymentProvider` port (intent, capture, refund, webhook verification) and the
  provider-neutral domain types, following the existing object-storage port/adapter pattern
  (DI tokens, adapters under the module).
- Model `Plan`, `Subscription` and `Entitlement` explicitly and evaluate entitlements instead of
  `if (plan === "PRO")` checks.
- Ship a deterministic **fake adapter** for tests and local development. No real provider (Stripe,
  PayPal) is integrated until a product needs one.
- Payment operations are idempotent by construction (`Idempotency-Key`, see
  [Error model](../technical/api/errors.md) and ADR 016).

## Consequences

- Products built on the starter plug in a real provider by writing one adapter, without touching
  domain code.
- No provider credentials, webhooks or PCI scope in the starter itself.
- The fake adapter must be kept honest by contract tests that a real adapter will also run.

## Implementation notes (2026-11-03)

The owner chose the first gateways: **Billplz** and **CHIP** (Malaysia).

| Piece | Where |
|---|---|
| Vocabulary | `packages/shared/src/contexts/payments/schemas/payments.ts`: `PaymentProviderName` (BILLPLZ, CHIP, FAKE), `PaymentStatus` (PENDING, PAID, FAILED, CANCELLED, REFUNDED), MYR, amount limits |
| Domain | `apps/api/src/contexts/payments/domain/`: `PaymentIntent` and `paymentStatusChange` (repeats are no-ops; news that would move a payment backwards is ignored, so retried and reordered callbacks are safe) |
| Port | `application/ports/payment-provider.port.ts`: `createCheckout`, `fetchStatus`, `refund` (refunded / pending / unsupported), `readCallback` (signature first; `null` = refuse) |
| Billplz | `infrastructure/providers/billplz.provider.ts`: Bills v3, Basic auth, `x_signature` HMAC-SHA256 over sorted `key+value` pairs joined with `|`; no refund API |
| CHIP | `infrastructure/providers/chip.provider.ts`: Purchases API v1, Bearer auth, `X-Signature` RSA PKCS#1 v1.5 / SHA-256 over the raw body with the company public key; refunds through the API |
| Fake | `infrastructure/providers/fake.provider.ts`: in memory, HMAC-signed callbacks |
| Contract tests | `infrastructure/providers/__tests__/payment-provider.contract.spec.ts`: every adapter runs the same cases |

### Phase B (2026-11-03)

| Piece | Where |
|---|---|
| Tables | `PaymentIntent` (never deleted; unique `tenantId + idempotencyKey` and `provider + providerPaymentId`) and `PaymentEvent` (append-only: one row per checkout, callback, reconciliation and refund). In the single init migration (`20261103083410_init`, the twelfth pre-release reset) |
| RLS | Tenant members read their tenant's rows; every write runs as a system operation: `payments.intent.create`, `payments.callback.apply`, `payments.reconcile`, `payments.refund` |
| Capability | `merchant:manage_payments` (owners and managers), checked in the service before any gateway call |
| Service | `application/services/payments.service.ts`: `create`, `list`, `get`, `refund`, `applyCallback`, `reconcile` |
| Tenant API | `GET/POST /tenants/:tenantSlug/payments`, `GET …/providers` (the gateways set up here, and whether each refunds), `GET …/:paymentId`, `POST …/:paymentId/refund` |
| Callbacks | `POST /payments/callbacks/{billplz,chip,fake}`: public, rate-limited, verified over the raw body; a bad signature answers 401 and changes nothing |
| Reconciliation | `presentation/jobs/payment-reconciliation.cron.ts`: every 10 minutes, asks the gateway about payments open past `RECONCILE_AFTER_MS` (lost callbacks) |
| Config | `BILLPLZ_*`, `CHIP_*`, `PAYMENTS_FAKE_SECRET` (`apps/api/.env.example`). A gateway is on only when all its settings are set; a half-set gateway, Billplz's sandbox on deployed production, and the fake gateway in production are refused at boot |
| Refunds | `PAYMENT_PROVIDER_REFUNDS` in `@workspace/shared` says which gateways refund through their API (CHIP, fake: yes; Billplz: no). The API's `refundable` and the merchant screens both read it |
| Merchant portal | `apps/merchant/contexts/payments/`: `/t/:slug/payments` (list), `/payments/new` (choose a configured gateway, amount in ringgit, customer), `/payments/:id` (status, checkout link to copy or open, refund behind a confirmation). Gated by `merchant:manage_payments`; "Payments" in the sidebar under Operations |
| Tests | `payments.service.spec.ts` (in-memory repository plus the fake gateway), config rules, `e2e/payments.e2e-spec.ts` over HTTP against a real database |

**Idempotency.** `POST` is `@Idempotent({ required: true })`, the platform's rule (8–128 characters; a concurrent duplicate waits for the first and replays it), and the key is also stored on the payment (unique per tenant) as the final guard. Retrying with the same key and the same request returns the same payment. The same key with a different request is refused (409 `IDEMPOTENCY_KEY_REUSED`). The checkout is opened at the gateway *outside* the database transaction; if the gateway refuses, the payment is closed as CANCELLED, so no half-made payment stays open.

**Safety rules.** A payer is only ever sent back to one of the platform's own apps (`returnUrl` origin checked). A callback whose amount differs from the payment is recorded as IGNORED and never marks it paid. A verified callback for an unknown payment is acknowledged (200) so the gateway stops retrying, and logged.
