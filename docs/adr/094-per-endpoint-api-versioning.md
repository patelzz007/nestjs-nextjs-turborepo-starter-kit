---
title: "ADR 094: Per-Endpoint API Versioning with Inheritance"
tags: ["adr", "api", "versioning", "contracts"]
description: "A version belongs to one endpoint, and a newer API version inherits every route it does not replace: @ApiController serves each handler at the literal /api/<version> paths of its range, a client pins one version and may override it per call (Accept-version, logged), and Swagger serves one document per version."
author: "Platform Team"
category: "Architecture decisions"
date: 1795046400000
lastUpdated: 1795046400000
editedAt: 1795046400000
coverImage: "/images/covers/adr/094-per-endpoint-api-versioning.webp"
order: 94
---

# ADR 094: Per-Endpoint API Versioning with Inheritance

## Status

Accepted (2026-11-19). The server side and the client pin are built; per-version contract schemas are the open
follow-up (see "Not built yet"). Replaces the versioning part of [the architecture overview §6](../technical/architecture.md#6-api-versioning).

## Context

Every business controller was mounted at one version: `@Controller(apiPath("/claims"))` → `/api/v1/claims`. That made
a v2 of a single endpoint awkward:

| Where | Before | The problem |
|---|---|---|
| Server | The version sat on the whole controller. | A v2 of one endpoint needed a second controller, or the whole controller moved. |
| URL | `/api/v2/...` existed only for routes registered under v2. | A client on v2 got a 404 for every endpoint that had no v2. |
| Contract | A leaf had one optional `version`. | Two versions of one endpoint needed two keys, so the client function name changed too. |
| `Accept-version` | An `onRequest` hook rewrote `request.raw.url`. | Fastify matches the route before `onRequest` runs, so the rewrite never rerouted anything. |

## Decision

**A version belongs to one endpoint, and a newer version inherits what it does not replace.** A client asks for one
version of the whole API; each endpoint answers with its newest handler that is not newer than that version.

```ts
@ApiController("/claims")
export class ConsumerClaimsController {
	@Get(":id")                 // v1, and every later version until something replaces it
	public get(...): Promise<Claim> { ... }

	@Get(":id")
	@SinceApiVersion("v2")      // replaces it from v2 on
	public getV2(...): Promise<ClaimV2> { ... }

	@Get()                      // never changed: answers on v1 and v2
	public list(...): Promise<Page<Claim>> { ... }
}
```

| Request | Handler |
|---|---|
| `GET /api/v1/claims/:id` | `get` |
| `GET /api/v2/claims/:id` | `getV2` |
| `GET /api/v2/claims` | `list` (inherited from v1) |

### How it works

| Part | Rule |
|---|---|
| Versions | `API_VERSIONS` (`@workspace/shared`, oldest first) is every served version. `API_VERSION` is the one a build defaults to. |
| Server routing | `enableApiVersioning(app)` turns on Nest's URI versioning with the prefix `api/`, so each version is a literal path (`/api/v1/claims`, `/api/v2/claims`). No URL rewriting: audit URLs, rate-limit keys and metric route templates stay as they were. Every app that mounts business controllers calls it (bootstrap, the e2e app). |
| `@ApiController(path)` | A class decorator. It runs after every method decorator, groups the handlers by HTTP method and path, and gives each one the versions from its `@SinceApiVersion` (or the first version) up to the version a newer handler of the same route starts at. Two handlers of one route starting at the same version fail at startup (`ConflictingApiVersionsError`). |
| Unversioned routes | `GET /`, `/health`, `/version` and `POST /notifications/email-webhook` keep a plain `@Controller`; the lint rule `api/no-unversioned-controller` allows `@Controller` for those only. |
| Rate limits | Buckets are keyed by the caller (address or principal) and the policy, never by the URL, so the same caller on v1 and v2 shares one budget. |
| Client pin | `ApiClientConfig.apiVersion` (and `ApiRequestContext.apiVersion`) is the version every call of a client goes to; omitted, it is the build's `API_VERSION`. The mobile token refresh goes to the pin too. |
| Per-call override | `ProcedureCallOptions.apiVersion` sends one direct call elsewhere and names it in `Accept-version` (`API_VERSION_OVERRIDE_HEADER`). The URL still decides the handler; the API's access line marks the call `(override)`. A cached query keeps the pin. |
| `GET /version` | Lists every served version (with a deprecated one's `sunsetAt`). |
| OpenAPI | One document per version: `buildOpenApiDocument(app, version)` lists that version's paths (inherited routes included) and the unversioned ones; Swagger serves `/v1/docs`, `/v2/docs`, …, and the docs gate covers every one of them. `operationId` stays `Controller_method` (Nest's default would append `_v1`). |

### Names

| Layer | Rule |
|---|---|
| URL | Same path; only the `/vN` part differs. |
| Controller | Same class. The new handler carries the suffix (`getV2`); the old one is untouched. |
| Schemas | The new shape carries the suffix (`ClaimV2Schema`). |
| Handlers and services | Usually one. Both controller methods call the same use case, and the older method maps the result down to its shape. |
| Removal | Deleting a version deletes its handlers and schemas, and the suffix is dropped from the survivor in the same change. URLs do not change. |

## Not built yet

| Item | Why it waits |
|---|---|
| Per-version contract schemas (a leaf with a `versions` map, its types following the client's pin) | The client router is typed once, at module load, from each leaf's schemas. Typing it by the pinned version is a change to every procedure type in `@workspace/api-client`; it lands with the first endpoint that really needs a v2 shape. Until then every leaf has one shape, which is correct for every pin because every route is inherited. |
| A worked v2 endpoint | Waits for the item above, so the example covers the contract as well as the controller. `api-controller.decorator.spec.ts` shows the server half with a real Fastify app. |
| `410 Gone` (`API_VERSION_REMOVED`) for a removed version | No version has been removed. A removed version answers 404 until then. |
| Overrides counted in the operations console | The access line records each override; a counter on the console's traffic view is a follow-up. |

## Consequences

- Every business route is served under every version in `API_VERSIONS`. Today that is v1 and v2, both identical.
- A controller is `@ApiController(path)`; `apiPath()` stays as the URL builder for clients and scripts.
- Tests read a controller's served path with `servedPathOf()` (`apps/api/e2e/support/route-metadata.ts`), not its raw path metadata.
- Contract leaves no longer carry `version`, `deprecatedSince` or `sunsetAt`. Nothing set or read them, and their
  documentation promised a per-endpoint `Sunset` header that did not exist.
