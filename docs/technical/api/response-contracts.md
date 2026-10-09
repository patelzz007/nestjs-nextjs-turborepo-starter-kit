---
title: "Response Contracts — Documented, Enforced, Parsed"
tags: ["api", "contracts", "openapi", "zod", "client"]
description: "How every endpoint declares its response once in @workspace/shared, how the API documents and enforces it, how the typed client parses it, and how the committed OpenAPI artifact stays in sync."
order: 16
author: "Platform Team"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Response Contracts — Documented, Enforced, Parsed

Every endpoint's response is ONE named zod schema in `@workspace/shared`. That schema is:

```text
packages/shared  ──  apiContract leaf: response: singleResponse(ProductSchema)
      │
      ├── apps/api     @ZodResponse(ProductSchema)  → Swagger (success + 4XX/5XX)
      │                                             → HttpCode(status)
      │                                             → ResponseInterceptor: parse, strip, 500 on mismatch
      │                                             → compile error if the handler returns another shape
      │
      ├── packages/client  defineQuery(apiContract.product.detail) → parseResponseContract(envelope)
      │                                             → typed ApiResponseContractError on mismatch
      │
      └── docs/generated/openapi.json  (committed, deterministic; e2e fails when stale)
```

Decision record: [ADR 022](../../adr/022-response-contracts.md). Request-side counterpart:
[API routes §9](./routes.md#9-api-docs-swagger).

## 1. The two envelopes

| Kind | Contract leaf | API decorator | Wire body |
|---|---|---|---|
| single | `singleResponse(Schema)` | `@ZodResponse(Schema)` | `{ success: true, data, meta: { correlationId, timestamp } }` |
| paginated | `paginatedResponse(ItemSchema)` | `@ZodPaginatedResponse(ItemSchema)` | `{ success: true, data: Item[], meta: { limit, total, page, totalPages, nextCursor, hasNext, hasPrevious, correlationId, timestamp } }` |

Paginated is for list-grammar endpoints ([List queries](./list-queries.md)): the handler returns a
`PaginatedServiceResult` (`items` + pagination fields) and the interceptor moves the fields into
`meta`. Bounded catalogs returned whole are `single` with a named array schema
(`RewardResponseListSchema = z.array(RewardResponseSchema)`).

**File downloads** (the analytics exports) are a third, non-JSON kind: the contract leaf is
`defineFileContract({ …, response: fileResponse([<media types>]) })`, the handler carries
`@ZodFileResponse(leaf.response)` (it documents the 200 as one binary body per media type, plus
the 4XX / 5XX envelope, and satisfies the "every route declares its response" lint rule) and
writes the file itself through `@Res()` (`Content-Type` of the format,
`Content-Disposition: attachment`, `Cache-Control: no-store`). The interceptor passes the reply
through; errors still use the error envelope. The client fetches it with `fetchDownload` /
`api.download(apiDownloads.…)` (`packages/client/src/lib/api/download.ts`) — a `Blob` plus the
server's file name, or a typed `ApiDownloadError` — never as a query. The OpenAPI e2e test holds
the handler's media types to the leaf's and pins the list of file routes.
[Analytics API](./analytics.md#exports) is the worked example.

`@ZodRawResponse(Schema)` sends the value without an envelope. Use it only for consumers outside the
typed client that expect a fixed shape (the unversioned `GET /version` manifest, which the client
transport's 404 negotiation parses with `ApiVersionManifestSchema`); it is parsed and stripped like
every other route. The health probes (`GET /health*`) are NOT raw: load balancers and uptime
monitors key on the HTTP status only, so they keep the standard envelope. Errors always use the
[error envelope](./errors.md).

## 2. Adding (or changing) an endpoint's response

1. **Schema** — a named export in the domain's schema file in `packages/shared`, exported from
   `schemas/index.ts`. Plain `z.object(...)`, **not** `.strict()` (see §4). Times are epoch-ms
   numbers (`EpochMsSchema`), never `Date`.
2. **Contract leaf** — `response: singleResponse(XSchema)` / `paginatedResponse(XSchema)` in
   `packages/shared/src/contracts/index.ts`. The client router picks it up automatically.
3. **Handler** — exactly one decorator, same schema reference:

   ```ts
   @RequirePermission("CREATE", "PRODUCT")
   @Post()
   @ApiOperation({ summary: "Create Product" })
   @ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Created product" })
   public create(@ZodBody(CreateProductSchema) body: CreateProductInput): Promise<Product> {
   	return this.service.create(body);
   }
   ```

   `status` (default `200`) is sent and documented — do not add `@HttpCode`. Keep specific error
   docs if they help a reader (`@ApiResponse({ status: 409, type: ApiErrorResponseDto, description })`).
4. **Map in the service, not the controller.** The decorator only compiles when the handler's return
   type fits the schema's input. A Prisma row with `bigint` epochs, `Date`, `Decimal` or `Json`
   columns is mapped to the DTO in the repository / service (`epochMs(Number(row.createdAt))`).
   Never cast to make it compile.
5. **Artifact** — `pnpm openapi:export` and commit `docs/generated/openapi.json` with the change.

## 3. What the API enforces at runtime

`ResponseInterceptor` parses every handler result with its contract, once:

- **Unknown keys are stripped.** Whatever the service returned beyond the schema — a password hash,
  a token, a supplier price — never reaches the wire. `test/response-contracts.e2e-spec.ts` proves
  it on the real app.
- **A mismatch is a server bug** → `500 INTERNAL_ERROR` with the generic message, and one `error`
  log line naming the route and the failing paths (`ResponseContractViolationError`, values are
  never logged). Fix the mapping or the schema; never loosen the schema to make a bug "pass".
- **No contract → no response.** A JSON route without a response decorator answers 500 before its
  handler runs (`MissingResponseContractError`); the OpenAPI e2e test stops that from merging.
- **Pass-through by design:** `@Sse()` streams and `@SkipEnvelope()` routes that write their own
  reply — today `EmailLogController.stream` and the two local-storage transfer routes — plus the
  declared file downloads (`@ZodFileResponse`: the analytics exports). The e2e test pins both
  lists; extending either is a reviewed decision.

## 4. Why response schemas are never `.strict()`

| | `.strict()` response | open (strip) response |
|---|---|---|
| Service returns an extra internal field | 500 for every caller | field silently removed — never leaks |
| API adds a field, old client deployed | old client's parse fails | old client ignores it |

So response objects (and objects nested in them) are plain `z.object`. Request schemas stay
`.strict()`; if a response schema is the base of a request schema, split them or apply `.strict()`
on the request side. The OpenAPI document mirrors this: request bodies say
`additionalProperties: false`, responses never do. The e2e test fails on a closed response schema.

**Unions:** with strip-mode objects a plain `z.union` returns the first option that parses — an
earlier `{ user }` option would swallow a later `{ requiresEnrollment, user? }` variant and strip
its discriminator. Use `z.discriminatedUnion`, or order options most-specific-first with a unit
test per variant.

## 5. The client side

`defineQuery` / `defineMutation` (`packages/api-client/src/router.ts`) take
`contract.response.envelope`; `parseResponseContract` (`response-contract.ts`) is the only place a
response body is parsed — for the browser transport (`api-request.ts`) and the SSR pipeline
(`server-request.ts`). On a mismatch:

```ts
const result = await api.product.detail.fetch({ id });
switch (result.kind) {
	case "success":
		return result.data;
	case "contract":
		// API/client version drift or an API bug — not a user error. result.status is the real HTTP status;
		// for JSON, result.error is an ApiResponseContractError whose .issues lists the failing paths (no values).
		break;
	case "httpError":
	case "network":
	case "aborted":
	case "sessionUnavailable":
	case "unauthorized":
		break;
}
```

Every transport result is an `ApiResponse<T>`: a discriminated union on `kind`, built with
`ToDiscoUnion` (`@workspace/shared`). `ok`, `status`, `data` and `error` keep their meaning, so
`if (result.ok)` still narrows; `kind` names the case:

| `kind` | `ok` | `status` | `error` |
| --- | --- | --- | --- |
| `success` | `true` | the 2xx status | — (`data` is the parsed envelope) |
| `httpError` | `false` | the non-2xx status | the API's error body (`ApiError`) or its text |
| `contract` | `false` | the real status | `ApiResponseContractError` (JSON) / `ApiDownloadError` (file of the wrong type) |
| `network` | `false` | `0` | the thrown error |
| `aborted` | `false` | `0` | `"aborted"` |
| `sessionUnavailable` | `false` | `401` | `SessionRefreshUnavailableError` — the refresh got no verdict; the session stands |
| `unauthorized` | `false` | `401` | `"Unauthorized"` — the session ended and `onUnauthorized` ran |

SSR prefetches classify it as `{ kind: "schema", message: "<path>: <issue>" }`.

## 6. The committed OpenAPI artifact

`docs/generated/openapi.json` is the exact document served at `/v1/docs-json`, serialized with
sorted keys, two-space indent and a trailing newline — byte-for-byte reproducible.

```bash
pnpm openapi:export   # turbo run openapi:export --filter=@workspace/api — needs Postgres + Redis, like test:e2e
```

`test/openapi-artifact.e2e-spec.ts` (in `pnpm --filter @workspace/api test:e2e`) fails while the
committed file differs from what the API builds; `openapi:export` is that spec with `--update`.

## 7. Checklist

- [ ] Named, non-strict response schema in `packages/shared`, exported from `schemas/index.ts`
- [ ] Contract leaf has `response: singleResponse(...)` / `paginatedResponse(...)`
- [ ] Handler has exactly one `@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse` with the same schema and the right `status`
- [ ] No Prisma types, `bigint` or `Date` in the handler's return type; no casts
- [ ] `pnpm openapi:export` run and `docs/generated/openapi.json` committed
- [ ] `pnpm --filter @workspace/api test:e2e` green (OpenAPI + artifact + response-contract specs)
