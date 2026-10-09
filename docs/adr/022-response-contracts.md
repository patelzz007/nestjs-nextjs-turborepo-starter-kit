---
title: "ADR 022: Response Contracts for Every Endpoint"
tags: ["adr", "api", "contracts", "openapi", "zod"]
description: "Every endpoint declares its response with one shared zod schema that documents it in Swagger, is enforced (stripped and validated) by the API, type-checks the handler, and is parsed by the typed client; the OpenAPI document is exported as a committed artifact."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 22
---

# ADR 022: Response Contracts for Every Endpoint

## Status

Accepted (2026-10-01) — implemented in roadmap Phase C2 + C3. Guide:
[Response contracts](../technical/api/response-contracts.md).

## Context

After C1 every request input was validated and documented from one zod schema, but responses were
not contracts at all:

- Swagger showed `@ApiOkResponse({ description })` with no schema on most routes, or a hand-built
  `createWrappedDto(...)` class on some — nothing tied either to what the handler returned.
- `ResponseInterceptor` guessed the envelope by shape (a recursive `DataValueSchema` parse, then a
  "looks paginated?" parse, then a "looks pre-wrapped?" parse) and passed whatever the handler
  returned straight to the wire. A Prisma row with an internal column (a hash, a cost price, a
  token) would have been serialized as is; `geo.controller.ts` returned Prisma model types.
- The typed client re-declared every response envelope locally (`envelope(...)` /
  `listEnvelope(...)` in `endpoints.ts`), so client and server could drift silently; a mismatch
  surfaced as a raw `ZodError` with status `0`.
- There was no exported OpenAPI artifact, so an API change had no reviewable diff outside the code.

## Decision

1. **The contract leaf owns the response.** `defineContract({ method, path, input, response })` in
   `@workspace/shared` now requires `response: singleResponse(Schema)` or
   `paginatedResponse(ItemSchema)`. There are exactly two success envelopes, built by the shared
   factories `createApiSuccessEnvelopeSchema` and `createApiPaginatedEnvelopeSchema`; the duplicate
   envelope helpers (`PaginatedResponseSchema`, `createApiSuccessArrayEnvelopeSchema`, the client's
   local `envelope` / `listEnvelope`) are gone.
2. **One decorator per handler** (`apps/api/src/common/decorators/zod-response.decorators.ts`):
   `@ZodResponse(Schema, { status?, description? })`, `@ZodPaginatedResponse(ItemSchema, …)`,
   `@ZodRawResponse(Schema, …)` (no envelope — only for consumers outside the typed client). It
   - documents the success status with the full envelope (same converter as requests, `io: "output"`)
     and `4XX` / `5XX` as the ADR 016 error envelope;
   - sets `HttpCode(status)`, so the documented and the sent status cannot differ;
   - registers the contract the global `ResponseInterceptor` enforces — as Nest metadata
     (`ResponseContract = Reflector.createDecorator()`), read with `Reflector`. Never key it by
     function identity: instrumentation such as `@nestjs/observe` (on by default in production)
     hands Nest a traced wrapper per handler and copies only reflect-metadata across, so an
     identity-keyed registry misses on every route (regression test:
     `zod-response.observe.spec.ts`);
   - type-checks the handler: its return type must be assignable to the schema's input (read-only
     tolerant), so returning a Prisma row with `bigint` / `Date` fields does not compile.
3. **Runtime enforcement, single pass.** The interceptor parses the handler result once with the
   contract schema (for lists: the service page schema with the item schema inside). Unknown keys
   are **stripped**. A mismatch throws `ResponseContractViolationError` — deliberately not an
   `AppError` — so the global filter answers `500 INTERNAL_ERROR` and logs the route and failing
   paths (never the values). A JSON route with no contract fails the same way **before** its
   handler runs. Only `@Sse()` streams and `@SkipEnvelope()` routes that write their own reply
   pass through.
4. **Response schemas are open.** They are never `.strict()`: the server strips extra keys instead
   of failing, and a client tolerates fields the API adds later (rules/05 change-safety matrix).
   The OpenAPI converter drops zod's `additionalProperties: false` for output schemas; request
   schemas keep it. Union responses use discriminated unions (a strip-mode `z.union` would let an
   earlier option swallow a later one).
5. **The client validates in one place.** `defineQuery` / `defineMutation` take the envelope from
   the contract leaf; `parseResponseContract` (`packages/api-client/src/response-contract.ts`)
   is the only response parser — used by the browser transport and the SSR pipeline — and turns a
   mismatch into a typed `ApiResponseContractError` (method, URL, real HTTP status, bounded issue
   list).
6. **Drift is a test failure.** `test/openapi-document.e2e-spec.ts` fails for a route without a
   contract, a status mismatch, missing success / `4XX` / `5XX` docs, a closed response schema, or
   an `apiContract` leaf whose handler uses a different schema reference or envelope kind.
7. **Exported artifact (C3).** `docs/generated/openapi.json` is the committed document, serialized
   deterministically (sorted keys, two-space indent, trailing newline).
   `pnpm openapi:export` regenerates it; `test/openapi-artifact.e2e-spec.ts` fails while it is
   stale.

## Alternatives considered

- **`nestjs-zod` `createZodDto` response classes + `@ApiOkResponse({ type })`.** Documents a shape
  but enforces nothing and needs a class per endpoint; the existing `createWrappedDto` helpers were
  exactly this and had drifted. Rejected.
- **Validate in development only.** Cheaper, but the bugs this catches (a new column leaking, a
  service returning the wrong variant) are precisely the ones that reach production unnoticed.
  One zod parse per response is cheap next to the database round trip; kept on everywhere.
- **Strict response schemas (reject unknown keys).** Would turn an extra internal field into a 500
  instead of a strip, and break every deployed client the day the API adds a field. Rejected.
- **Fastify response schemas (`fast-json-stringify`).** Faster serialization and it drops unknown
  keys, but it would be a second schema language beside zod and does not give the handler-level
  compile-time check. Revisit only if serialization shows up in profiles.
- **Separate exporter script (`tsx scripts/export-openapi.ts`).** `tsx` (esbuild) cannot emit
  decorator metadata, so the Nest graph cannot boot under it; the exporter is the artifact spec run
  with `vitest --update`, which uses the same e2e bootstrap as every other API test.

## Consequences

### Positive
- What Swagger shows, what the API sends and what the client parses are the same schema — and a
  test proves it per endpoint.
- Internal fields cannot leak through a forgotten mapping; Prisma types cannot reach a controller's
  return type.
- A response drift shows up as a typed client error with the real status, not a `ZodError` at
  status `0`.
- Every API change has a reviewable diff in `docs/generated/openapi.json`.

### Wire changes shipped with C2 (consumers must know)
- `GET /version` is sent **raw** (`ApiVersionManifest`, no envelope). It was enveloped by accident,
  so the client's 404 version negotiation, which parses the raw manifest, never worked.
- Geo: detail / create / update answered raw Prisma rows — `Decimal` coordinates as strings and
  `BigInt` population that could not be serialized. They now send numbers, like the lists did.
- Geo `createdAt` / `updatedAt` are **epoch milliseconds** (were ISO strings), the API-wide time format.
- `GET /geo/export` is documented as what it always returned: city rows (`format=csv` never
  produced CSV).
- Every success status is unchanged (POSTs that answered `201` still do); unknown keys a handler
  returned beyond its contract are no longer sent.

### Negative
- Every new endpoint needs a named, non-strict shared response schema and a contract leaf.
- The artifact must be regenerated (with Postgres + Redis available, like `test:e2e`) whenever an
  API surface changes; the e2e suite fails until it is.
- A handler that returns a shape its contract does not allow now fails loudly (500) instead of
  "working" — intended, but it will surface latent bugs.

### Follow-ups
- Normalize action `POST`s that still answer `201 Created` (status preserved in C2 to avoid a wire
  change) to `200` / `204` in a versioned change.
- Generate a typed client for external consumers from `docs/generated/openapi.json` if one appears.
- Wire `openapi:export` drift into CI once CI runs the e2e suite (no workflow change in C2).
- Teach the `@darraghor/nestjs-typed/api-method-should-specify-api-response` lint rule the response
  decorators (`additionalCustomApiResponseDecorators`) — pending a human decision on the ESLint
  config.
- Shrink `docs/generated/openapi.json` (≈1.5 MB, schemas are inlined per operation) by registering
  reused response schemas as named components (`.meta({ id })`).

## References

- [Response contracts guide](../technical/api/response-contracts.md)
- [API routes §9](../technical/api/routes.md#9-api-docs-swagger)
- [ADR 016 — Standard error envelope](./016-standard-error-envelope.md)
- [ADR 021 — List-query grammar](./021-list-query-grammar.md)
- `rules/05-contracts-zod-api.md` → "Response validation"
