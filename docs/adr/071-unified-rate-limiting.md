---
title: "ADR 071: Unified rate limiting — one atomic limiter, named policies, penalties and tenant overrides"
tags: ["adr", "rate-limiting", "security", "redis", "plan"]
description: "Replace four separate limiters with one RateLimiter port: atomic Redis scripts for sliding-window, token-bucket and concurrency limits; named policies over address, principal, tenant, API key and hashed destination; explicit fail modes; growing penalties on security policies; audited exemptions; tenant overrides; RateLimit headers for signed-in callers; one client behaviour on 429; and a Rate limits page in the admin panel."
author: "Platform Team"
lastUpdated: 1793404800000
coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&h=630&fit=crop"
order: 71
---

# ADR 071: Unified rate limiting — one atomic limiter, named policies, penalties and tenant overrides

## Status

**Accepted (2026-10-30); built (2026-10-31)** — see [Implementation notes](#implementation-notes-2026-10-31). The [decision trail](#the-decision-trail) records the
interview. Terms are in [`GLOSSARY.md`](../../GLOSSARY.md) under *Rate limiting*.

## Context

Four mechanisms limit requests today:

| Mechanism | Where | Store | Algorithm |
|---|---|---|---|
| `@fastify/rate-limit`, 300/min per IP + API version | `bootstrap/register-fastify-plugins.ts` (hardening only) | **Process memory** | Fixed window |
| `@nestjs/throttler` `strict`/`default`/`webhook`/`preAuth`, named policies | `platform/.../throttling/` | Redis, memory fallback | Fixed window |
| Per-recipient email limit | `notifications/.../email-recipient-rate-limiter.adapter.ts` | Redis, memory fallback | Fixed window |
| Analytics export limit | `reporting/.../analytics-export-rate-limit.guard.ts` | The throttler store | Fixed window |

Problems:

1. **A key can stay blocked forever (bug).** `RedisThrottlerStorage.increment` and the email limiter
   run `INCR`, then `PEXPIRE` only when the count is 1, as separate round trips. If the second call
   never happens (timeout, failover, process killed) the counter has no expiry and that subject is
   refused until someone deletes the key.
2. **Fixed windows allow double bursts** at the window edge.
3. **The outer limiter is per instance**: N API instances allow N times the limit, as does the memory
   fallback of the others during a Redis outage.
4. **No tenant dimension**: one tenant or one leaked API key can use everyone's capacity.
5. **Only refusals carry information**: clients cannot see how close they are.
6. **Limits are constants**: a change needs a deploy; nobody can see who is limited.
7. **Repeat offenders cost nothing**: a credential-stuffing script waits one minute and continues.
8. **Clients handle 429 differently**, and TanStack Query retries some of them.

## Decision

### One port, three algorithms

```ts
export interface RateLimiter {
	consume(policy: RateLimitPolicy, subject: RateLimitSubject, cost?: number): Promise<RateLimitDecision>;
	acquire(policy: ConcurrencyPolicy, subject: RateLimitSubject): Promise<ConcurrencyLease | RateLimitRefusal>;
	release(lease: ConcurrencyLease): Promise<void>;
}
```

The Redis adapter runs **one Lua script per decision** (`EVALSHA`, loaded at boot, reloaded on
`NOSCRIPT`), so counting and expiry are atomic and a key can never lose its expiry. Phase 1 fixes
problem 1 before anything else moves.

| Algorithm | For | How |
|---|---|---|
| Sliding window counter | Security policies (login, credential, OTP, refresh, pre-auth) | Current and previous window, previous weighted by overlap |
| Token bucket (GCRA) | API keys, tenant traffic, authenticated mutations, channel caps | One theoretical-arrival timestamp per key; declared burst, steady rate |
| Concurrency | Exports, reports, load tests | Sorted set of leases with expiry; released on completion, expired if the holder dies |

Policies may declare a **cost** (an analytics export costs 10 against the tenant bucket).

### Policies, subjects and fail modes

One registry (`RATE_LIMIT_POLICY`); every policy declares:

| Field | Values |
|---|---|
| `subject` | `ip`, `principal`, `tenant`, `apiKey`, `destination` (SHA-256 of a normalized email or E.164 phone) |
| `algorithm` | `sliding-window`, `token-bucket`, `concurrency` |
| `failMode` | `closed` — security policies: a bounded local limiter takes over and refuses when full. `open` — general traffic: a local limiter takes over with the limit divided by `RATE_LIMIT_EXPECTED_INSTANCES` |
| `penalty` | Security policies only (below) |
| `limit`/`windowMs` or `burst`/`ratePerSecond` | Defaults from config; tenant overrides on top |

A request passes the policies in order (pre-auth address → principal → tenant → API key); the first
refusal wins and names its policy in the log.

Consolidation: `@fastify/rate-limit` is removed and its global limit becomes the `preAuth` policy on
the shared store; the email limiter, the analytics export guard and the SMS and push caps of
[ADR 070](./070-multi-channel-notifications.md) become policies; `@nestjs/throttler` stays only as
the decorator and guard layer, storing through the new adapter.

### Penalties

Security policies escalate per subject: 3 refusals within an hour → **15 minutes**, again →
**1 hour**, again → **24 hours**; the step resets after 24 quiet hours. Penalties sit beside, never
replace, the existing account lockout (which is about one account, not one address).

### Exemptions

An audited, explicit list: the server agent's and instances' health traffic
([ADR 068](./068-platform-operations-console.md)), the Load Test tenant (already keyed by
`load-test-traffic-keys.ts`) and `RATE_LIMIT_EXEMPT_CIDRS` for monitoring. Exempt traffic is
**counted but never refused**, so the admin page still shows it.

### Tenant overrides

`TenantRateLimitOverride` (BaseModel, RLS platform staff only): tenant, policy, values, reason,
`expiresAt`, set by. There are no plans or tiers; a future billing ADR will drive these overrides.
Overrides are read through the cache of [ADR 072](./072-distributed-cache.md) and invalidated on
change, so they apply across instances within seconds. The broadcast weekly limit of
[ADR 073](./073-broadcasts-and-tenant-customers.md) uses the same overrides.

### Headers, errors and clients

- Authenticated callers and API keys receive the IETF `RateLimit-Policy` and `RateLimit` headers for
  the policy nearest its limit. **Pre-authentication routes send none**, so an attacker cannot read
  how many attempts remain.
- A refusal is the existing `RateLimitError` envelope with `Retry-After` (also during a penalty).
- **Web and mobile behave the same:** a toast with a live countdown from `Retry-After`, the submit
  control disabled until it ends, and TanStack Query never retrying a 429 (one shared `retry`
  predicate in `packages/client` and the mobile client).

### Observability and administration

- Each refusal logs `rate_limit.refused` (policy, subject kind, tenant — no address or destination) and
  increments a metric; a Redis stream keeps the last 10,000 refusals (`XADD … MAXLEN ~`).

**Admin → Operations → Rate limits.**

```
Policies                                          Last hour
LOGIN         sliding  ip         5 / 1 min   penalty ✓   refused 41   ▁▂▇▃▁
CREDENTIAL    sliding  ip         3 / 1 min   penalty ✓   refused 12   ▁▁▃▁▁
TENANT_API    bucket   tenant     50/s, burst 200          refused 0
EXPORT        concur.  principal  2 at once                refused 3

Top limited subjects     policy       refusals  penalty      last
tenant  Acme Coffee      TENANT_API        182  —            1m   [Override…]
ip      203.0.113.•      LOGIN              40  1 h (2nd)    3m   [Lift penalty]

Exemptions   Load Test tenant · server agent · 10.0.0.0/8 (monitoring)        counted 12,402
Tenant overrides   [ + Add override ]
Acme Coffee  TENANT_API  100/s burst 400   until 2026-11-30   "Black Friday" — Ops
```

`Lift penalty`, overrides and exemptions need `operations:manage-rate-limits` and are audited; only
masked subjects are shown.

## Implementation notes (2026-10-31)

| Area | What was built |
|---|---|
| Admin | `/operations/rate-limits`: every policy with its fail mode and last-hour refusals, the most-refused callers (masked) with Lift penalty, never-limited exemptions, and tenant overrides (list, remove, set — traffic as rate + burst, broadcasts per week, with an end date and an audited reason) |
| Clients | A 429 tells the person how long to wait: `rateLimitMessage` (`@workspace/api-client`, shared by web and mobile) reads `details.retryAfterSeconds`, falling back to the API's own message; every error resolver uses it (the web's `resolveAuthErrorMessage` behind sign-in and every form, merchant `userSafeErrorMessage`, admin `toastMutationError`, mobile `errorMessageOf`) — "Too many requests. Try again in 40 seconds." Queries never retry a 429 (only transport failures and 5xx are transient) |

## Considered options

| Option | Why not |
|---|---|
| Wrap `INCR` + `PEXPIRE` in `MULTI` | Fixes problem 1 only |
| `rate-limiter-flexible` | Fail modes, penalties, overrides and the refusal stream would sit on top anyway; its memory fallbacks are per instance |
| Limit at the load balancer only | Cannot see principals, tenants, API keys or destinations |
| Plans and tiers now | No billing yet; overrides are the hook billing will use |

## Phases

Step 2 of the agreed build order.

1. Port, Lua scripts, Redis and memory adapters, one contract suite run against both (including a
   simulated failure between calls).
2. Throttler storage, `preAuth`, email and analytics limits moved; `@fastify/rate-limit` removed.
3. Penalties and exemptions.
4. Headers, refusal log, metric and stream; the shared 429 client behaviour on web and mobile.
5. Tenant overrides (after ADR 072's module) and the admin page.

## Consequences

- One place to read and test every limit.
- Removing `@fastify/rate-limit` touches `apps/api/package.json`.
- Phase 5 waits for the cache module.

## The decision trail

| # | Question | Answer |
|---|---|---|
| Q14 | Plans | Per-tenant overrides only; plans belong to a future billing ADR |
| Q15 | Penalties | Yes, escalating, alongside account lockout |
| Q16 | Trusted bypass | Audited exemptions, counted but never refused |
| Q17 | Client behaviour on 429 | Countdown toast, submit disabled, no TanStack retry |
| Q39 | Penalty steps | 3 refusals/hour → 15 min → 1 h → 24 h; reset after 24 quiet hours |
| Q40 | Headers | Authenticated callers and API keys only, never before authentication |
| Q59 | Build order | Step 2, after compose; the stuck-key fix first |
