---
title: "Service Levels and Capacity"
tags: ["operations", "slo", "capacity", "reliability"]
description: "What 'working' means for each surface (objectives, error budgets, burn-rate alerts), and how big a server to start with, with how to measure your own numbers."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"
order: 3
---

# Service Levels and Capacity

## Service-level objectives

A starting point for a product on this kit. Each objective is measured over a rolling **28 days**; the
**error budget** is what the objective leaves (99.9 % of 28 days ≈ 40 minutes).

| Surface | Indicator (what is measured) | Objective | Budget / 28 days |
|---|---|---|---|
| API availability | Share of requests answered without a 5xx (probes excluded) | 99.9 % | ≈ 40 min of errors |
| API latency | p95 of `GET` requests | < 300 ms | 5 % of requests may be slower |
| API latency (writes) | p95 of `POST`/`PATCH`/`DELETE` | < 800 ms | |
| Sign-in | Share of credential checks answered (any status but 5xx) | 99.95 % | ≈ 20 min |
| Web, admin, merchant | Share of page loads answered below 500 | 99.9 % | ≈ 40 min |
| Notifications | In-app notification visible within 10 s of the event | 99 % | |
| Push and email | Handed to the provider within 2 min (quiet hours excluded) | 99 % | |
| Till (POS) | Validate and checkout p95 | < 500 ms | |

Where the numbers come from today: the API's request audit (status and duration per request), the health
probes, the notifications delivery log and the Operations console's server metrics. ADR 069 (in-house
observability) turns these into dashboards.

### Alerting on burn rate

Alert on how fast the budget is being spent, not on single errors:

| Alert | Condition | Means | Action |
|---|---|---|---|
| **Page** | 14× burn over 1 hour (and over 5 min) | 2 % of the monthly budget gone in an hour | Someone looks now |
| **Ticket** | 6× burn over 6 hours (and over 30 min) | 5 % gone in 6 hours | Look today |
| **Ticket** | 1× burn over 3 days | On track to miss the month | Plan reliability work |

### Using the budget

- Budget left: ship as usual.
- Budget spent: freeze risky changes for the surface (schema changes, dependency majors) until it recovers,
  and fix the cause first.
- A planned maintenance window announced in advance doesn't count.

## Capacity: how big a server to start with

These are **starting points, not measurements**: confirm them with the load runner (below) before relying
on them, and record your own numbers here.

| Stage | Monthly active users | Droplet (API + 3 web apps) | PostgreSQL | Redis |
|---|---|---|---|---|
| Launch | up to ~1,000 | 4 GB / 2 vCPU | On the Droplet (Docker) | On the Droplet (Docker) |
| Growing | ~10,000 | 8 GB / 4 vCPU | Managed, 2 GB, with a standby | On the Droplet, or managed 1 GB |
| Busy | ~100,000 | 2× 8 GB behind a load balancer (API and web apps split) | Managed, 8 GB + read replica | Managed, 2 GB |

Signs it is time for the next stage: CPU above 70 % for long stretches, memory above 85 %, swap in use,
API p95 above its objective, or database connections near `DB_POOL_MAX`.

### Measuring your own numbers

1. Deploy to a staging Droplet the same size as production, seeded with the development data.
2. Run the load runner's scenarios (`apps/load-runner`; operator guide in the Operations console) at
   rising rates until the API's p95 crosses its objective or errors appear.
3. Record, per scenario: the rate it held, CPU and memory at that rate, and the first thing that failed.
4. Divide the rate by your expected peak requests per user to get the users one server carries.

Known memory floors: each Next.js app takes about 250–400 MB at rest, the API 300–500 MB, PostgreSQL and
Redis grow with data; `next build` of the three apps needs about 3 GB, which is why the guide's smallest
Droplet is 4 GB.
