---
title: "ADR 059: Selective CQRS and Three Event Mechanisms"
tags: ["adr", "cqrs", "events", "performance"]
description: "Commands and queries are used where a use case has a real state change or a read model. Domain events, integration events and the outbox stay three different mechanisms. Boot work is lazy and is not cached."
author: "Platform Team"
lastUpdated: 1792281600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 59
---

# ADR 059: Selective CQRS and Three Event Mechanisms

## Status

Accepted (2026-10-18).

## Context

Not every endpoint needs a command bus. A CRUD read that validates input and returns one query is an application service. A state change with invariants, a concurrency token and domain events is a command. Treating both the same either buries the important use cases in a service class or wraps every `GET` in a ceremony that does not pay for itself.

Events were also one word for three different things: something that happened inside an aggregate, something another context in this process must react to, and something that must survive a crash and reach another process.

Startup time was being spent on work the first request does not need (fonts, Swagger, Cedar). Adding caches to hide that cost was rejected: a cache is another source of truth.

## Decision

1. Use a command when the use case changes state, enforces an invariant, or emits a domain event. Use a query when the read model is not the aggregate. Use an application service for a straightforward CRUD use case that does not need either.
2. Three mechanisms, not one:
   - A domain event is collected inside the aggregate and published in the same database transaction.
   - An in-process integration event is dispatched after commit to other contexts in this process.
   - The transactional outbox (ADR 015) is the cross-process path.
3. Jobs and cron enter through `SystemCommandDispatcher`. They do not call `CommandBus` directly.
4. Boot work that is not needed to serve traffic is loaded on first use: report fonts on each export, the Swagger document on each `/docs` request, Cedar's WASM on first authorization that needs it. None of those results is stored in a cache we own. Node keeping an imported module is the runtime, not a cache we add. A PDF export pays the font parse every time; the existing export rate limit bounds how often that happens.
5. Development builds of the API use `cheap-module-source-map`. Production builds keep `source-map`.
6. A list endpoint must issue the same number of SQL statements for a 1-row page and a 25-row page. `expectNoNPlusOne` is the check. There is no CI gate on startup time.

## Consequences

- Controllers that still call a service are not wrong when the use case is CRUD. They are unfinished when the use case is a lifecycle change that already has an aggregate. The gaps file names those.
- Adding a cache to hit a startup number is a rejected shortcut, even if a measured phase misses the 5 second warm target.
- ADR 015 still describes the outbox. This record says when to use it and when not to.
