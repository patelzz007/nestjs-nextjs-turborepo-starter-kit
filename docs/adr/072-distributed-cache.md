---
title: "ADR 072: Distributed cache — one typed, tenant-safe, encrypted, two-tier cache on one Redis"
tags: ["adr", "cache", "redis", "performance", "multi-tenancy", "plan"]
description: "One cache module for every rarely-changing thing the API reads: declared namespaces with zod schemas and versions, local, shared or two-tier storage, tenant-scoped keys by construction, encryption of personal data with the key version in the key, single flight and leases, stale-while-revalidate, explicit after-commit invalidation broadcast to every instance with a TTL safety net, per-namespace budgets on one noeviction Redis, and a Cache page in the admin panel."
author: "Platform Team"
lastUpdated: 1793404800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 72
---

# ADR 072: Distributed cache — one typed, tenant-safe, encrypted, two-tier cache on one Redis

## Status

**Accepted (2026-10-30); built (2026-10-31)** — see [Implementation notes](#implementation-notes-2026-10-31). The [decision trail](#the-decision-trail) records the
interview.

## Context

The API caches four things, each with its own code:

| Cache | Where | Storage | Invalidation |
|---|---|---|---|
| Authorization state per user | `authorization/.../authorization-cache.service.ts` | `BoundedTtlCache` per process | Redis pub/sub broadcast |
| `/me` and session permissions | `identity/.../redis-user-session-cache.service.ts` | Redis or memory (`USER_SESSION_CACHE_BACKEND`) | Key delete |
| Access-token state | `identity/.../access-token-state.service.ts` | Process memory | Expiry |
| GitHub responses | `integrations-github/.../github-response.cache.ts` | Process memory, single flight, stale on failure | Per-instance `invalidate()` |

Each re-solves naming, serialization, fallbacks and invalidation; none protects against a stampede
across instances; nothing stops a new cache from leaving the tenant out of its key (a cross-tenant
leak, [ADR 062](./062-tenancy-modes-and-isolation.md)); `/me` sits in Redis in clear, with email and
phone; and Redis has no memory limit at all.

**Scope.** The API's server-side data cache only. HTTP caching (ETag, `Cache-Control`, CDN) and the
Next.js data cache have their own owners and are out of scope.

## Decision

### What is cached

The rule: **whatever is read often and changes rarely.** On day one, besides the four existing
caches: reference data, tenant settings and tenancy-mode lookups, the permission registry,
notification preferences and consent (read by every fan-out, ADR 070) and rate-limit tenant overrides
(ADR 071).

**Never cached:** authorization denials beyond the authorization TTL, secrets or tokens in clear,
responses to state-changing requests.

### Declared caches

```ts
export const TENANT_SETTINGS_CACHE = defineCache({
	name: "tenancy.settings",       // key segment and metric label
	version: 3,                     // bump on a schema change: old entries are never read
	schema: TenantSettingsSchema,   // zod, checked on every read from Redis
	scope: "tenant",                // "tenant" | "user" | "platform"
	tier: "two-tier",               // "local" | "shared" | "two-tier"
	ttlMs: 15 * MS_PER_MINUTE,      // safety net; changes invalidate explicitly
	staleMs: 10 * MS_PER_MINUTE,
	containsPersonalData: false,
	budget: { localMaxEntries: 5_000, sharedMaxKeys: 50_000 },
	tags: (value) => [`tenant:${value.tenantId}`],
});

const settings = await cache.getOrLoad(TENANT_SETTINGS_CACHE, tenantScope(actor), "settings", () => repo.load(…));
await cache.invalidateTag(TENANT_SETTINGS_CACHE, `tenant:${tenantId}`);
```

**Keys** are built only by the module:
`<REDIS_NAMESPACE>:cache:<name>:v<version>[:k<keyVersion>]:<scope>:<id>`. A tenant-scoped cache takes
the tenant id as a required typed argument, so a key without one cannot be written. A test asserts
that every declared cache whose schema holds a `tenantId` is `scope: "tenant"`.

### Tiers

| Tier | Storage | Use |
|---|---|---|
| `local` | `BoundedTtlCache` in the process | Tiny, hot, briefly allowed to differ (access-token state) |
| `shared` | Redis | Must agree across instances (`/me`) |
| `two-tier` | Local in front of Redis | Read-heavy, rarely changed (authorization, settings, reference data, overrides) |

### Personal data

Caches marked `containsPersonalData` (`/me`, preferences) are encrypted **inside Redis** with AES-GCM
through the existing encryption key service. The API decrypts on read and returns ordinary JSON to the
authorized caller — web, merchant and admin see `GET /me` exactly as today; only someone reading Redis
directly sees ciphertext. The **key version is part of the cache key**: after a rotation old entries
are simply never read (a miss), with no decrypt failures and no flush. Production config validation
also requires Redis TLS and AUTH.

### Correctness rules

- **Explicit invalidation, TTL as safety net.** The code that changes a cached thing invalidates it in
  an **after-commit** handler (never before commit, so no reader caches the old row in between). The
  TTL (default 15 minutes for rarely-changing data) only bounds a missed invalidation.
- **Broadcast.** Delete and tag invalidation remove the Redis entries, then publish on
  `<namespace>:cache:invalidate`; every instance drops its local copies. Tags are Redis sets with the
  TTL of their longest member.
- **Single flight** per key per process; a **distributed lease** (`SET NX PX`) for misses whose loader
  declares `leaseMs`; waiters serve stale or wait briefly; a dead holder's lease expires.
- **Stale-while-revalidate** within `staleMs`; when the loader fails and a stale value exists, it is
  served and the failure logged.
- **Redis is a trust boundary.** Every value is parsed with its schema; a failed parse (or failed
  decrypt) is a miss plus a warning.
- **Redis down.** `two-tier` → local only; `shared` → loader pass-through behind a circuit breaker;
  health shows *degraded*.

### One Redis

Queues and cache share **one Redis** everywhere (laptop, CI, production), configured
`maxmemory-policy noeviction` because an evicted BullMQ key is a lost job. Consequences handled by the
module:

- Every cache key has a TTL.
- Each namespace has a key budget; at its budget new entries are not written (served from the loader).
- A refused write (`OOM`) is treated as "not cached", never as an error to the caller.
- Health alerts at **80 %** of `maxmemory`.

A large fork can later add a second Redis for cache data; the module takes its client from one token.

### Migrating the existing caches

Access-token state, `/me`, authorization and GitHub move onto the module with their behaviour kept
(GitHub's stale-on-failure becomes `staleMs`; the authorization broadcast becomes the module's).
`AUTHORIZATION_CACHE_BACKEND` and `USER_SESSION_CACHE_BACKEND` are replaced by each cache's declared
tier.

### Admin → Operations → Cache

```
Namespace              Tier      Scope     Hit (1h)  Local   Redis keys / budget   Stale  Encrypted
authorization.state    two-tier  user       98.7 %   1,204    1,310 / 50,000          0      —
identity.me            shared    user       91.2 %       —      842 / 50,000          2      ✓
github.responses       local     platform   88.0 %      64        —                  11      —
tenancy.settings       two-tier  tenant     99.4 %      37       37 / 50,000          0      —
                                            [Flush namespace…]  [Flush tenant…]
Redis   used 53 MB of 512 MB (10 %) · policy noeviction ✓ · refused cache writes (1h) 0
```

Flushing needs `operations:manage-cache`, asks for a reason, is audited and goes through the
broadcast.

## Implementation notes (2026-10-31)

| Area | What was built |
|---|---|
| Admin | `/operations/cache`: each cache's tier, scope, TTL, hit ratio, entries and failures with Flush; Redis memory against its alert line and whether the policy is `noeviction`; an open-circuit warning; Flush one tenant (an audited reason) |

## Considered options

| Option | Why not |
|---|---|
| `@nestjs/cache-manager` + Keyv | Untyped values, no tenant-scoped keys, tags, leases or stale serving |
| Redis only | A round trip on every authorization check |
| Client-side caching (`CLIENT TRACKING`) | Ties correctness to one Redis feature and connection mode |
| Two Redis servers (queue `noeviction`, cache `allkeys-lru`) | Declined: one Redis everywhere, no drift; budgets and the alert cover the risk |
| Short TTLs only | Stale reads for the whole TTL after every change |

## Phases

Step 3 of the agreed build order.

1. The module: `defineCache`, tiers, keys, encryption, single flight, lease, stale serving, tags,
   broadcast, budgets; memory and Redis adapters with one contract suite.
2. Redis `maxmemory` and `noeviction` in `compose.yml` and CI; the 80 % alert; production TLS/AUTH
   validation.
3. Access-token state, `/me`, authorization and GitHub moved.
4. The new day-one caches.
5. Metrics and the admin page.

## Consequences

- New caches are one declaration and one call, tenant-safe and encrypted when they hold personal data.
- On one Redis, a full memory means fewer cache hits, never lost jobs.

## The decision trail

| # | Question | Answer |
|---|---|---|
| Q18 | Scope | API server-side data cache only |
| Q19 | What is cached | Reference data, tenant settings, permission registry, preferences, overrides — anything that rarely changes |
| Q20 | Personal data in Redis | Encrypted, plus TLS and AUTH in production |
| Q20b | Can `/me` still be read | Yes: decrypted by the API, returned normally |
| Q21b | One Redis or two | One Redis, `noeviction`, TTL on every key, budgets, 80 % alert |
| Q41 | Changes | Explicit after-commit invalidation plus a 15-minute TTL safety net |
| Q61 | Key rotation | Key version in the cache key: old entries become misses |
