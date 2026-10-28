---
title: "11. Operations console"
description: "Watch the platform's servers, instances and dependencies, read their history, act on alerts, back up the database and load test the platform."
order: 12
author: "Product & Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["user-guide", "operations", "monitoring", "backups", "load-testing"]
---

# 11. Operations console

**Admin panel → Platform → Operations.** Everything that keeps the platform running, in one place.
SuperAdmins see all of it; Platform Developers see servers, alerts and load tests; Admins see
servers and alerts.

Try it with the demo data: sign in as `superadmin@example.com` (everything) or
`developer@example.com` / `Developer@123` (a Platform Developer).

## Servers

Every machine the platform runs on, refreshed every 10 seconds. Each card shows:

- where it runs, with the provider's logo (DigitalOcean, Linode, Vultr, Hetzner, this computer);
- its **spec** in one line: CPU model, cores, RAM and storage;
- **rings** for CPU, memory and the fullest disk. Hover a ring for its figure. A ring turns amber
  at 75% and red at 90%;
- a **sparkline** of CPU and memory over the last hour. Hover it for any minute.

Below the servers: every API **instance** (CPU, memory, requests, latency, errors, uptime) in a
searchable, sortable table, and every **dependency** (PostgreSQL, Redis, job queues, Kafka,
RabbitMQ, public endpoints) with its latest check.

### Registering a server (SuperAdmin)

1. **Register server**, give it a name and choose where it runs. For a cloud server, add its id at
   the provider (the droplet id on DigitalOcean) to see the provider's own view as well.
2. Copy the **token** and the **start command**. They are shown once.
3. Run the command on the server. It reports within 10 seconds.

Lost the token? Open the server and **Rotate agent token**: the old one stops working at once.
**Remove server** stops monitoring it.

## A server's page

- **Machine**: what it is (CPU, cores, uptime, operating system) and, for RAM, swap, storage and
  each disk, its size, how much is used and how much is free.
- **Now**: CPU by core (hover a bar), memory and disks as rings, and the busiest processes.
- **History**: CPU, memory, disk, network and disk I/O over 1 hour, 6 hours, 24 hours, 7 days,
  30 days or a year.
- The provider's view (plan, region, size, public IP), when its API token is configured.

## Alerts

An alert opens when a server's CPU stays high, its memory or disk fills, a server or instance stops
reporting, a dependency or address goes down, or a TLS certificate is about to expire. It resolves
by itself when the condition clears. Both are emailed to every SuperAdmin and the extra recipients.
SuperAdmins set the thresholds and extra recipients at the bottom of the page.

## Backups (SuperAdmin)

- **Back up now** takes a full copy of the database. A daily backup also runs at the hour you set,
  and backups older than the retention are removed unless they are **pinned**.
- Each backup's menu offers **Download**, **Pin or unpin** and **Delete**. Downloading needs a
  recent sign-in with your authenticator.
- There is no restore button, on purpose: a restore is done by an engineer following the runbook.

## Load tests

1. Choose what to test (one scenario, the whole platform as a traffic mix, or one read endpoint),
   the shape (ramp, constant, spike, soak), virtual users, requests per second, minutes, and when
   it passes (p95 latency and error share).
2. **Start load test**. Its page shows requests, errors and latency second by second, the servers'
   CPU over the same window, and every step slowest first. **Abort** stops it.
3. Tick two runs in the list and **Compare** to see them side by side.

Load tests only act as test users of the separate Load Test tenant, never as real customers or
merchants. Only one runs at a time, and a run stops itself if errors or server CPU stay too high.
SuperAdmins set the caps and can **purge** what load tests created.
