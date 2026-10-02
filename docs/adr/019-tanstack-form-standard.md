---
title: "ADR 019: TanStack Form Is the Form Standard"
tags: ["adr", "frontend", "forms", "tanstack"]
description: "New and migrated forms use @tanstack/react-form behind generic, data-agnostic Form primitives; react-hook-form and hand-rolled useState forms are migrated."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 19
---

# ADR 019: TanStack Form Is the Form Standard

## Status

Accepted (2026-10-01) — implementation scheduled for roadmap Phase G.

## Context

The platform spec (§48) calls for TanStack Form behind generic primitives (`Form`, `Field`,
`FieldLabel`, `FieldError`, `FormActions`). Today `react-hook-form` is used in six files (merchant
reward forms, admin showcases) and most forms (auth, onboarding, KYB) are hand-rolled `useState`
with `FormShell`. `packages/ui` already ships data-agnostic `Field*` primitives.

## Decision

- `@tanstack/react-form` is the single form library, alongside the TanStack Query / Table stack
  already in use.
- `packages/ui` gains generic `Form` and `FormActions` primitives bound to TanStack Form and the
  existing `Field*` components; they stay data-agnostic (the feature owns schema, values and
  submit logic).
- Validation uses the shared zod contracts from `packages/shared` — the same schema the API uses.
- Existing `react-hook-form` and `useState` forms are migrated; `react-hook-form` is removed once
  the last one moves.

## Consequences

- One mental model and one set of primitives for every form; client and server validate with the
  same schema.
- The `packages/ui` README's react-hook-form guidance is superseded once the migration lands.
- Migration touches auth, onboarding, KYB and reward forms, so it ships with Phase G's frontend
  error-policy work and is covered by the existing form tests plus new ones.
