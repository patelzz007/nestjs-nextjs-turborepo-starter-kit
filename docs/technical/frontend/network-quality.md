---
title: "Connection quality indicator"
tags: ["network", "ping", "ui", "mobile", "status"]
description: "The connection pill in every app shell (admin, web, merchant, mobile): a speedtest-style ping, jitter and packet-loss test against the API's GET /health/ping, graded green / yellow / red."
order: 27
author: "Platform Team"
lastUpdated: 1792972800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Connection quality indicator

Every app shell shows how good the connection to the API is, the way speedtest.net shows its
ping: a pill with signal bars and the round trip (`26 ms`), coloured by strength, which opens a
read-out of the last test with a **Test again** button.

| Strength | Colour | Ping | Jitter | Packet loss |
| --- | --- | --- | --- | --- |
| Strong | green | ≤ 100 ms | ≤ 30 ms | none |
| Moderate | yellow | ≤ 300 ms | ≤ 100 ms | under 50 % |
| Weak | red | above 300 ms | above 100 ms | 50 % or more |

The worst of the three decides: a 40 ms ping that loses a request is moderate. Offline (the
device says so) and "No response" (online, but no request reached the API) are red too. Colour
is never the only signal: the bars, the words and the panel's headline say the same thing.

**Why these limits.** About 100 ms is the classic limit for a reaction to feel instant. ITU-T
G.114 puts the one-way limit for interactive use at 150 ms, which is 300 ms there and back. Any
packet loss means retransmissions.

## How a test works

`packages/shared` → `lib/network-quality` holds all of it, framework-free:

1. **One test** (`measureNetworkQuality`) sends a warm-up request, then four timed ones, one
   after another, to `GET /health/ping`. The warm-up is not counted: after a minute idle the
   connection has usually been closed, so that request also pays for DNS, TCP and TLS. A
   request unanswered after 5 s is lost.
2. **Ping** is the median of the answered round trips, **jitter** the mean change between
   consecutive ones, and **packet loss** the share lost (`summarizeLatency`, `networkStrengthOf`).
3. **The schedule** (`NetworkQualityMonitor`): test at once, every 60 s while the app is in view,
   when it comes back into view with an older result, when the device comes back online, and on
   **Test again**. Never while out of view (a hidden tab, a backgrounded app), and never two
   tests at once. Going offline cancels the running test and forgets the last result.

Each test is five tiny requests, so an open app costs five requests a minute.

## The API route

`GET /health/ping` (`HealthController.getPing`) answers `{ timestamp }` in the standard envelope
and never touches the database. It is:

- **public** (`@Public()`); the apps send it without cookies;
- **never cached** (`Cache-Control: no-store`): a cached answer would time the cache;
- **not audited**: it is one of the probe routes in `probe-routes.ts`, like `/health/live`;
- **outside the per-route `strict` and per-principal `default` throttlers.** The strict limit of
  30 a minute per IP would be used up by a handful of tabs behind one office IP, and the pill
  would turn red for a reason that has nothing to do with the network. The per-IP `preAuth`
  flood limit still counts it.

`/health/live` is not reused, because its job is the load balancer's restart policy and it stays
under the strict limit.

## Where it shows

| App | Where | Code |
| --- | --- | --- |
| admin, web, merchant | The sidebar's status row, above the account. Clicking opens a popover with ping, jitter, packet loss and **Test again**. | `NetworkQualityIndicator` (`@workspace/ui`, presentational, copy in the `networkQuality` label family) fed by `useNetworkQuality` / `NetworkQualityStatus` (`@workspace/client`) |
| mobile | The page header (compact: bars + `26 ms`) and the app drawer (in full: "Strong, 26 ms"). Tapping either opens a bottom sheet with the same read-out. | `AppStatusProvider` (`src/features/app-status/facade.tsx`), `network-indicators.ts`, `network-sheet.tsx` |

The browser reads online / offline from `navigator.onLine` and its `online` / `offline` events,
and visibility from `visibilitychange`. The phone reads them from `expo-network` and `AppState`.
On the server and at hydration the web pill reads "Measuring…", so the server-rendered shell and
the first client render agree.

## What it is not

A status display, not offline support: nothing here queues writes or changes how queries behave.
It also measures latency only, with no download or upload throughput: the pill answers "will
the app feel quick?", not "how fast is my line?".
