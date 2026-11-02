---
title: "Rate limits and the cache"
description: "How the API limits traffic (one limiter, three algorithms, fail modes, penalties, exemptions, tenant overrides, what a refused client sees) and how the distributed cache works, plus the admin screens that show and manage both."
order: 9
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["operations", "rate-limiting", "cache", "redis", "admin"]
---

# Rate limits and the cache

Both live on the one Redis the API already uses for queues. Decision records:
[ADR 071](../../adr/071-unified-rate-limiting.md) (rate limiting) and
[ADR 072](../../adr/072-distributed-cache.md) (cache).

## Rate limits

### One limiter, three algorithms

Every limit goes through one `RateLimiter` port. The Redis adapter runs one Lua script per decision,
so counting and expiry are atomic.

| Algorithm | For | How |
| --- | --- | --- |
| Sliding window | Security: sign-in, credentials, codes, refresh, pre-authentication | Current window plus the previous one weighted by overlap |
| Token bucket (GCRA) | API keys, tenant traffic, signed-in changes, channel caps | A steady rate and a declared burst |
| Concurrency | Exports, reports, load tests | Leases with expiry, released on completion |

A request passes the policies in order — address before sign-in → person → tenant → API key — and the
first refusal wins.

### Fail modes

| Mode | Policies | When Redis is down |
| --- | --- | --- |
| `closed` | Security | A bounded in-process limiter takes over and refuses new subjects when full (`SECURITY_COUNTER_MAX_KEYS`) |
| `open` | General traffic | An in-process limiter takes over with the limit divided by `RATE_LIMIT_EXPECTED_INSTANCES` |

### Penalties, exemptions, overrides

- **Penalties** (security policies only): 3 refusals within an hour → 15 minutes, again → 1 hour, again
  → 24 hours; the step resets after 24 quiet hours. Separate from the account lockout.
- **Exemptions** are counted but never refused: the Load Test tenant, the server agent and instances'
  health traffic, and `RATE_LIMIT_EXEMPT_CIDRS` (uptime monitors).
- **Tenant overrides** replace a tenant's defaults until an end date, with an audited reason:
  `TENANT_TRAFFIC` (all of a tenant's members and keys, default 50/s burst 200),
  `API_KEY_TRAFFIC` (one key, default 20/s burst 100) and `TENANT_BROADCASTS` (per week, default 5 —
  [broadcasts](../notifications/broadcasts.md)). They are cached and apply across instances within
  seconds.

### What a refused client sees

- `429` with the standard error envelope, `Retry-After`, and `details.retryAfterSeconds`.
- Signed-in callers and API keys get the IETF `RateLimit-Policy` / `RateLimit` headers; **routes before
  sign-in send none**, so an attacker can't read how many attempts remain.
- Every app says the same thing: **"Too many requests. Try again in 40 seconds."** —
  `rateLimitMessage` in `@workspace/api-client`, used by the web's `resolveAuthErrorMessage`, merchant
  `userSafeErrorMessage`, admin `toastMutationError` and mobile `errorMessageOf`. Queries never retry a 429.

### Admin → Operations → Rate limits

| Section | What it shows and does |
| --- | --- |
| Policies | Each policy, its algorithm, subject, fail mode and refusals in the last hour |
| Refused most | The most-refused callers, **masked**, with any penalty; **Lift penalty** (a reason of 10+ characters) |
| Exemptions | What is never refused, with how much it was counted |
| Tenant overrides | List, **Set** (traffic as rate + burst, or broadcasts per week, with an end date and reason) and **Remove** |

Changing anything needs the rate-limit management permission and is audited.

## The cache

### What is cached

Whatever is read often and changes rarely: the signed-in person (`/me`), authorization decisions,
access-token state, GitHub responses, tenant settings and tenancy lookups, reference data, the
permission registry, notification preferences and consent, and tenant rate-limit overrides. **Never**
secrets or tokens in clear, denials beyond the authorization TTL, or answers to changes.

### How a cache is declared

Each cache is declared once (`defineCache`): a name and version, a zod schema (every read from Redis is
re-checked), a scope (`tenant`, `user`, `platform`), a tier, a TTL and a stale window, whether it holds
personal data, a size budget and invalidation tags. Keys are built only by the module:
`<namespace>:cache:<name>:v<version>[:k<keyVersion>]:<scope>:<id>` — a tenant cache cannot be written
without a tenant id.

| Tier | Where | For |
| --- | --- | --- |
| `local` | In the process | Tiny, hot data briefly allowed to differ |
| `shared` | Redis | Must agree across instances (`/me`) |
| `two-tier` | Local in front of Redis | Read-heavy, rarely changed |

### Rules it keeps

- **Invalidate after commit**, explicitly; the TTL only bounds a missed invalidation. Invalidations go
  over Redis pub/sub, so every instance drops its local copy.
- **Single flight** per key; **stale-while-revalidate**; a failed load serves the stale value if there
  is one.
- **Personal data** (`/me`, preferences) is encrypted inside Redis with `CACHE_ENCRYPTION_KEYS`; the key
  version is part of the key, so a rotation just causes misses. Without the keys those caches stay in
  each process.
- **Redis is shared with queues** and never evicts (`noeviction`): every key has a TTL, each cache has a
  budget, a refused write is "not cached", and health turns *degraded* at `CACHE_MEMORY_ALERT_PERCENT`
  (default 80 %) of `maxmemory`.
- **Redis down:** `two-tier` falls back to local only; `shared` reads straight from the database behind
  a circuit breaker. Pages keep working.

### Admin → Operations → Cache

| Shows | Does |
| --- | --- |
| Each cache: tier, scope, TTL, hit ratio, entries, failures | **Flush** one cache |
| Redis memory against the alert line; whether the policy is `noeviction` | **Flush one tenant** (an audited reason) |
| A warning while the circuit to Redis is open | — |

It refreshes itself every 15 seconds.

## Try it

| What | How |
| --- | --- |
| A refusal | Sign in with a wrong password repeatedly: the form says "Too many requests. Try again in N seconds." The admin page shows the policy's refusals and your (masked) address with **Penalised**; **Lift penalty** lets you in again |
| A tenant override | Admin → Rate limits → set `TENANT_TRAFFIC` for KL Brew & Bean to 1/s burst 2, click around the merchant portal quickly, then remove it |
| The cache | Browse the web marketplace, then Admin → Cache: hits and entries rise. **Flush** one; stop Redis (`docker compose stop redis`) and the page says Redis isn't answering while the apps keep working |

## Where things are

| Piece | Path |
| --- | --- |
| Limiter, scripts, penalties, exemptions | `apps/api/src/platform/infrastructure/rate-limiting/` |
| Policies and guards | `apps/api/src/platform/presentation/http/security/throttling/` |
| Cache module | `apps/api/src/platform/infrastructure/cache/` (`tiered-app-cache.ts`, `cache-keys.ts`, `cache-cipher.ts`, `cache-invalidation-bus.ts`) |
| Shared contracts | `packages/shared/src/contexts/operations/schemas/traffic-and-cache.ts` |
| Admin screens | `apps/admin` — `/operations/rate-limits`, `/operations/cache` |
| Settings | [API environment](../configuration/api.md) (`RATE_LIMIT_*`, `THROTTLE_*`, `CACHE_*`) |
