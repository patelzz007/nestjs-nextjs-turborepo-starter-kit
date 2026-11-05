---
title: "ADR 082: Outgoing Webhooks for Integrators"
tags: ["adr", "webhooks", "integrations", "outbox", "security", "merchant"]
description: "A tenant registers HTTPS endpoints and chooses events from a versioned public catalog. Events are written in the producing transaction, fanned out to one delivery per endpoint, signed with a timestamped HMAC, sent over the SSRF-guarded client outside any transaction, retried with back-off for about three hours, and an endpoint that keeps failing turns itself off and tells its owners."
author: "Platform Team"
lastUpdated: 1793836800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 82
---

# ADR 082: Outgoing Webhooks for Integrators

## Status

Accepted and built (2026-11-05), enhancement 5.7. The owner chose a new capability, `merchant:manage_webhooks`,
held by the Owner role by default.

## Context

Merchants run their own systems (an order system, a CRM, a spreadsheet robot) that want to know the moment a
reward goes live, a customer claims or redeems one, a till checks out a bill, or a payment settles. Polling the
API for that is slow and wasteful; the platform already knows when each happens.

## Decision

| Part | Decision |
|---|---|
| Who | Members with `merchant:manage_webhooks` (pairs `WEBHOOK.LIST/READ/CREATE/UPDATE/DELETE`, owner-only by default, like support access: they send the business's data outside the platform). API keys can never manage endpoints. Every handler checks the capability; RLS keeps each tenant's rows its own |
| Endpoints | At most 10 per tenant (an advisory lock holds the limit under races). HTTPS, no credentials in the URL, a public host: `checkOutboundUrl` refuses loopback, private, link-local and reserved addresses when the URL is set, and the guarded client checks every resolved address again at connection time (DNS rebinding). `WEBHOOK_ALLOW_LOOPBACK_URLS` lets `http://localhost` through for development and tests; production refuses it at boot |
| Catalog | `reward.published` (via review or schedule), `reward.rejected`, `claim.created`, `claim.redeemed`, `claim.expired`, `sale.completed`, `payment.succeeded`, `payment.failed`, `payment.refunded`, plus `webhook.test`. Versioned (`apiVersion` `2026-11-01`), described by shared Zod schemas, and every payload is re-validated before it is sent. Payloads carry ids and business facts only: never a customer's or payer's name, email or phone |
| Producing | Mechanism 1: an in-transaction handler appends the catalog event to `WebhookEvent` in the producer's own transaction, so an integrator never hears of a change that rolled back. The producer's session may only INSERT an event (no SELECT, no UPDATE: `rls/66-outbound-webhooks.sql`); `PaymentStatusChanged` is a new payments domain event, collected only when a settled status (paid, failed, refunded) is actually applied, so a repeated callback announces nothing |
| Fan-out | After the commit, `WebhookEventRecorded` fans the event out at once (one `WebhookDelivery` per active endpoint subscribed to its type; a unique key makes a second fan-out add nothing) and makes each first attempt. A sweeper on every instance, every 5 seconds, takes events that missed it (older than 30 s) and every due retry |
| Delivering | A delivery is claimed with a 60-second lease (one worker sends it), signed, POSTed outside any transaction (10-second deadline, no redirects, a 4 KiB answer excerpt), and its outcome recorded as a conditional transition: `SUCCEEDED` on 2xx, otherwise `FAILED` with the next attempt, `DEAD` after 10 attempts (30 s, then doubling to an hourly cap, ±20% jitter: about three hours). An endpoint switched off or removed meanwhile cancels the delivery |
| Signing | `Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, `Webhook-Id` (the delivery id, the same on every retry and redelivery, for de-duplication), `Webhook-Timestamp`. Receivers should refuse a time more than 300 s away. During a rotation's grace (default 24 h, up to 72 h, or 0 for a leaked secret) a second `v1=` signs with the previous secret |
| Secrets | `whsec_` + 32 random bytes, shown once (on create and on rotate), stored sealed with AES-256-GCM under `WEBHOOK_SECRET_ENCRYPTION_KEYS` (a versioned ring stored in the ciphertext), bound to the endpoint id. Without the ring, outgoing webhooks are off and creating an endpoint is refused |
| Endpoint health | A success resets the failure streak; a dead delivery extends it; at 5 in a row the endpoint turns itself off (`FAILING`) and its owners get an in-app notice and an email (`webhooks.endpoint-auto-disabled`). Switching it on again clears the streak |
| Member actions | Create, edit (address, note, events), switch off and on, rotate the secret, send a test event (exactly one delivery to that endpoint), redeliver a settled delivery (same `Webhook-Id`, from attempt one), remove (soft delete; the delivery log stays) |
| Retention | Events and their deliveries are purged after 30 days, daily, in bounded rounds |
| Operations | `webhooks.outbound.sweep` (a routine poller, logged at debug), `webhooks.outbound.deliver` and `webhooks.outbound.retention`, each allowlisted to its tables in the system-operation registry |

## Consequences

- **Merchant console:** Operations → Webhooks lists the endpoints and the delivery log, adds one (the secret is
  shown once), and shows a receiver example; each endpoint has a read-only page with its actions and its own log,
  and a separate edit page. The "turned off" notice links to the endpoint.
- **Delivery is at least once.** A receiver can get the same delivery twice (a lost answer, a redelivery): it
  must skip a `Webhook-Id` it already handled. Order is not guaranteed across events; each carries its time.
- **Local development** needs `WEBHOOK_SECRET_ENCRYPTION_KEYS` (`pnpm tools secrets:generate`) and, to call a
  receiver on your own machine, `WEBHOOK_ALLOW_LOOPBACK_URLS=true`. The guide is
  `docs/technical/api/outgoing-webhooks.md`.
- **Seed:** Brew & Bean KL has an active endpoint in a rotation's grace, one that turned itself off, a removed one,
  events of several types and a delivery in every status, all on `.invalid` hosts that never resolve.
- **Not built:** per-endpoint custom headers, mTLS, event filtering beyond the type, and a replay of a time range.
  The phone app has no webhook screens: webhooks are configured in the merchant web console.
