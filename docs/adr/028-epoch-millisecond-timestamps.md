---
title: "ADR 028: Epoch-Millisecond Timestamps Everywhere"
tags: ["adr", "database", "prisma", "time", "contracts"]
description: "Every timestamp is an integer of milliseconds since the Unix epoch — BigInt in PostgreSQL, a number in JSON and TypeScript — instead of DateTime / timestamptz and ISO strings."
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 28
---

# ADR 028: Epoch-Millisecond Timestamps Everywhere

## Status

Accepted. Recorded on 2026-10-04 for a convention the repository already followed; confirmed against
the reference specification, which asks for UTC timestamps (epoch milliseconds are UTC by
construction). Rule: [`rules/08-database-prisma.md`](../../rules/08-database-prisma.md); schema details:
[Database](../technical/database.md#schema-conventions-that-keep-drift-at-zero).

## Context

Timestamps cross four boundaries — PostgreSQL, Prisma, the zod contract and the browser. Mixed
representations (`Date` objects, ISO strings with and without offsets, `timestamptz`) cause time-zone
bugs, lossy serialization and schemas that cannot be shared between client and server without
transforms on both sides.

## Decision

- Every timestamp column is `BigInt` holding epoch milliseconds, with the database default
  `dbgenerated("((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint")` written in exactly that
  canonical form (any other spelling creates migration drift).
- Contracts use `EpochMsSchema` (branded `EpochMs`) and code stamps time with `nowEpochMs()`; JSON
  carries plain numbers (the Fastify `preSerialization` hook converts Prisma `bigint`).
- Time zones exist only at the edge: the UI formats with the `@workspace/ui` date helpers (`lib/format/`, see `packages/ui/README.md`), never with raw
  `toLocale*` or ISO slicing.
- One documented exception: the vendored geography tables keep the source dataset's `DateTime`
  columns. New tables never copy that shape.

## Alternatives considered

- **`timestamptz` + ISO-8601 strings** — rejected: two representations in every layer, parsing and
  time-zone handling at every boundary, and zod schemas that need transforms to be shared.
- **`DateTime` in Prisma, numbers only in JSON** — rejected: the conversion would live in every
  repository and mapper.

## Consequences

- One representation from database to browser; comparisons and arithmetic are integer operations.
- Values are not human-readable in raw SQL (`to_timestamp(col / 1000.0)` when inspecting).
- JavaScript numbers are exact up to 2^53, far beyond any realistic epoch-ms value.
