---
title: "ADR 027: Fastify as the API's HTTP Adapter"
tags: ["adr", "fastify", "nestjs", "http", "performance"]
description: "The NestJS API runs on @nestjs/platform-fastify instead of the default Express adapter; Express and its middleware stack were removed."
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 27
---

# ADR 027: Fastify as the API's HTTP Adapter

## Status

Accepted (migration completed 2026-08-16). Current configuration: [HTTP server (Fastify)](../technical/api/http-server.md).

## Context

The API started on NestJS's default Express adapter. Its traffic profile favours a faster HTTP
layer: JSON on every route, a guard and interceptor chain on every request, a public
signature-verified webhook that must stay cheap under abuse, and long-lived Server-Sent Events
streams with many idle connections. NestJS abstracts the HTTP adapter, so the switch touches only
the code that imports adapter types (cookies, raw request/response access, middleware, e2e tests).

## Decision

Run the API on `@nestjs/platform-fastify` (Fastify 5) and remove Express entirely
(`@nestjs/platform-express`, `cookie-parser`, `supertest` and their types).

- Cross-cutting HTTP concerns use Fastify plugins and hooks: `@fastify/cookie`, CORS, `@fastify/multipart`,
  `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/under-pressure`, `@fastify/compress`,
  `@fastify/etag`; access and error logging, version headers and `bigint` serialization run as hooks.
- The request id **is** the correlation id (`genReqId`), and pino with central redaction is the
  request logger.
- `rawBody: true` keeps the exact bytes for webhook signature verification.
- API e2e tests use `app.inject()` instead of supertest.
- Request validation compiles the shared zod schemas to Ajv validators once, instead of parsing with
  zod alone per request; zod remains the contract.

## Alternatives considered

- **Stay on Express** — rejected: lower throughput on this workload, and the middleware stack
  (cookie-parser, helmet, pino-http) duplicated what Fastify provides natively.
- **Leave NestJS for a bare Fastify app** — rejected: the module system, DI, guards and pipes are the
  structure every feature in this kit is built on.

## Consequences

- Nest middleware runs during Fastify's `onRequest`, **before** body parsing — middleware may read
  headers only; body-dependent logic belongs in guards, pipes or interceptors.
- Fastify's query-string parser is flat: bracket filters (`filter[status][in]`) are nested by
  `BracketQueryPipe` on list endpoints rather than by a global parser.
- Code must use `FastifyRequest` / `FastifyReply` (or raw `IncomingMessage` / `ServerResponse` in
  middleware); Express types and Express-only libraries are not available.
- Streaming routes need `requestTimeout: 0` (applied by the `onRoute` hook) or the server ends them.
