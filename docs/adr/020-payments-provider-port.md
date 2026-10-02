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

Accepted (2026-10-01) — implementation scheduled for roadmap Phase F.

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
  [Error model](../error-model.md) and ADR 016).

## Consequences

- Products built on the starter plug in a real provider by writing one adapter, without touching
  domain code.
- No provider credentials, webhooks or PCI scope in the starter itself.
- The fake adapter must be kept honest by contract tests that a real adapter will also run.
