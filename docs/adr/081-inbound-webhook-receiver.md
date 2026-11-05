---
title: "ADR 081: One Receiver for Inbound Webhooks"
tags: ["adr", "webhooks", "integrations", "security", "idempotency"]
description: "Every webhook a provider sends the platform takes one path: verify the signature with the provider's keyed scheme, claim the provider's delivery id once, hand it to the owning context, and record the outcome in one received-webhook log that admins can read."
author: "Platform Team"
lastUpdated: 1793836800000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop"
order: 81
---

# ADR 081: One Receiver for Inbound Webhooks

## Status

Accepted (2026-11-04). Built for GitHub and the payment gateways (Billplz, CHIP, the fake gateway). Resend's delivery
webhook and Twilio's status and inbound callbacks moved onto it on 2026-11-05 (`NotificationWebhookReception` in the
notifications context): every provider now takes the one path, and their routes, URLs and answers are unchanged.

## Context

GitHub, the payment gateways, Resend and Twilio each call the API. Each route had grown its own signature check,
its own replay handling and its own logging, so a bug fixed in one stayed in the others, and nobody could answer
"what did GitHub send us at 3 am, and what did we do with it?".

## Decision

| Part | Decision |
|---|---|
| One path | `InboundWebhookReceiverPort.receive` (the `webhooks/inbound` context): verify → claim `(provider, delivery id)` → hand to the owning context's handler → record the outcome. A receiving context keeps its route, its HTTP answers and its handler |
| Verification | One keyed verifier per signature scheme (HMAC-SHA256 header, Standard Webhooks, RSA-SHA256, Billplz's X-Signature, Twilio's request signature), keyed by the receiving context with its own secret. No key configured: `NOT_CONFIGURED`, answered 503 so the provider retries |
| Idempotency | A delivery id is claimed once; a redelivery answers the provider's usual 2xx without reaching the handler and counts as a duplicate |
| The log | `ReceivedWebhook` keeps the provider, delivery id, event type, verification, outcome (`PROCESSING`, `RECORDED`, `DUPLICATE`, `IGNORED`, `REJECTED`, `FAILED`), HTTP status, a SHA-256 and size of the body (never the body), only the allowlisted headers (`domain/kept-headers.ts`: a header is kept only when named, each value cut to a budget), and timings. Admins read it on the admin app's Webhooks → Received page; a retention job purges old rows |

## Consequences

- A new provider is a profile, a verifier and a handler: no new route plumbing.
- Bodies are not stored, so a payload cannot be replayed from the log; the owning context keeps what it needs.
- The outgoing direction is ADR 082.
