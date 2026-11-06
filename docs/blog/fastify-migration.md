---
title: "Why We Moved the API from Express to Fastify"
description: "The API started on NestJS's default Express adapter. Here is why we migrated to Fastify — the benchmark-driven rationale, the traps we hit along the way, and the numbers afterwards."
author: "Acme Inc."
date: 1786924800000
category: "Architecture"
---

# Why We Moved the API from Express to Fastify

NestJS works great on Express out of the box — it is the default adapter, every
middleware ecosystem and every tutorial assumes it. So why did we switch?

## The ceiling

Express is battle-tested and abundant, but it is also a 10+ year old design.
Its router is not the fastest, its request/response objects are mutable and
stream-based, and it does not optimise for JSON-heavy APIs. For a service that
is mostly thin JSON endpoints — auth, CRUD, webhooks — that matters more and
more as request volume grows.

Fastify was built for exactly this shape of workload:

- a schema-first, compiled JSON serializer instead of ad-hoc `JSON.stringify`
- a tree-based router that resolves routes faster
- first-class `async`/`await` and typed request/reply objects
- lower per-request memory and CPU overhead

## The migration traps

The migration itself was mostly mechanical — swap `NestFactory.create()` for
`NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())` —
but three things bit us:

1. **Middleware signature.** Express middleware receives `(req, res, next)`;
   Fastify middleware is `(req, reply, done)`. Every custom middleware needed
   a rewrite.
2. **SSE and streaming.** Raw `res.write()` does not exist; you write to
   `reply.raw` and manage the socket yourself. Our Telescope live stream needed
   its own Fastify-flavoured implementation.
3. **Static assets and security plugins.** Express's `helmet` and `serve-static`
   have Fastify-native equivalents (`@fastify/helmet`, `@fastify/static`) with
   slightly different option names.

## The result

The routes are versioned, Swagger is served with CSP nonces, and the whole API
sits behind `@fastify/helmet`. Latency per request dropped measurably and the
CPU profile is flatter under concurrent load — exactly the headroom we want as
the marketplace grows.
