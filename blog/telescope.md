---
title: "Telescope: A Local Observability Console for NestJS"
description: "We built a Laravel-Telescope-style debugging dashboard for the NestJS API — requests, SQL, exceptions, mail, jobs and schedules, with a live SSE feed. Here is how it works and how we use it."
author: "Acme Inc."
date: 1786838400000
category: "Engineering"
---

# Telescope: A Local Observability Console for NestJS

Every Node team ends up with the same frankenstein setup: `console.log`,
a `debug.ts` file that grows to 400 lines, and logs piped to a file you
`tail -f`. Laravel developers have had better for years — Telescope gives them
one beautiful dashboard for requests, queries, jobs, exceptions and mail.

So we built the NestJS equivalent into our own admin app.

## What it captures

Telescope keeps an in-memory ring buffer (no database required) of:

- **Requests** — method, path, status, duration, and a per-request timeline
  broken down by middleware, auth and Prisma queries
- **SQL** — every Prisma query with its duration, correlated to the request
- **Exceptions** — stack traces with the request context that caused them
- **Mail** — every email sent through the API, with delivery status
- **Jobs & schedules** — automatic captures from auth sessions, token
  refreshes, and our queue runner
- **Logs** — the app's structured log stream, browsable in the UI

## Why it works for us

The killer feature is the **timeline visualization**: when a request is slow
you see *why* — an N+1 Prisma query here, a double token refresh there — not
just that it *was* slow. Everything is correlated by request ID, and the admin
dashboard is a few clicks away on `localhost:3001/telescope`.

## The live feed

The whole thing streams over SSE through the Next.js proxy, so the dashboard
updates in real time — no page refreshes, no CORS headaches, same-origin
requests only.

Building it took the same shape as the original Laravel Telescope: capture
layer, storage, REST API, then a UI. The instrumentation came first; the UI is
a thin wrapper — but a very satisfying one.
