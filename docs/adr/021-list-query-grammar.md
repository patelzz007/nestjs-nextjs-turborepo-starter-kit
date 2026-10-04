---
title: "ADR 021: One List-Query Grammar (Sort Whitelist, Filter AST, Keyset Cursors)"
tags: ["adr", "api", "contracts", "pagination", "prisma"]
description: "Every paginated endpoint declares pagination, sort, filter and search once with defineListQuery; the API parses bracket filters into a typed AST and translates it to Prisma column by column, always with an id tie-breaker."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 21
---

# ADR 021: One List-Query Grammar (Sort Whitelist, Filter AST, Keyset Cursors)

## Status

Accepted (2026-10-01) — implemented in roadmap Phase C1. Guide: [List queries](../technical/api/list-queries.md).

## Context

The platform spec (§16, §18, §19) asks for consistent list queries end to end. Before C1 each
list endpoint invented its own shape: `sortBy` + `sortDirection` on two resources, a bare
`sort` string on geo, top-level `status` / `kybStatus` / `isActive` / `unreadOnly` flags
elsewhere, page sizes from 10 to 500, cursors that only worked with `id asc`, and orders without a
unique tie-breaker (rows with equal sort values could repeat or vanish between pages). Two
repositories built `orderBy` with a computed key from the request (`{ [sortBy]: dir }`), which
is only safe as long as a `Set` check is never forgotten.

## Decision

- **One declaration per resource.** `defineListQuery({ sortable, defaultSort, filter, params,
  defaultLimit? })` in `@workspace/shared` produces the ONE strict zod schema used by API
  validation, Swagger and the typed client. Names: `page` (1-indexed), `limit` (max 100),
  `cursor`, `sort`, `filter`, `search`.
- **Sort:** `sort=-createdAt,name` — comma list, `-` = descending, max 3 keys, whitelisted per
  resource. Unknown or repeated fields are a 400 that lists the allowed fields.
- **Filter AST:** `filter[field][op]=value` (`filter[field]=v` ⇒ `eq`). Each field picks a typed
  operator set with `listFilter.{string,number,epochMs,boolean,uuid,enumeration}`; values are
  coerced and validated; the parsed value is `{ field: { op: typedValue } }`.
- **Parsing is scoped and safe.** Fastify's query parser is left untouched. List endpoints use
  `@ZodListQuery`, which first nests bracket keys with `nestBracketQueryParams` (identifier-only
  names, capped key count, `Map` + `Object.fromEntries`, no prototype writes) and then parses with
  zod (not Ajv) so preprocess/refinements run and the handler gets the normalized AST.
- **Translation is explicit.** Repositories map every API field to its column (`SortColumns`
  record, `fieldWhere(toPrisma…Filter(filter?.x), (x) => ({ column: x }))`). No request string is
  ever used as a Prisma key. Tenant / owner / store scopes are separate builder arguments, never
  filters.
- **Stable pagination.** `buildListOrder` always appends a unique tie-breaker (`id`).
  `fetchListPage` implements offset pages and keyset cursors once; cursors are opaque base64url
  positions in the **default** order (`timestampIdKeyset`), re-validated with zod on decode, and
  only issued / accepted while the default order is in effect.
- **Client adapter.** `tableStateToListQuery` maps TanStack Table state (sorting, pagination,
  search, filters) to the list input, dropping non-whitelisted columns and cursor/sort conflicts.
- **Bounded catalogs stay whole.** Role and permission catalogs, an organization's reward
  catalog, member/invite rosters and similar small, fully-consumed sets are not paginated.

## Consequences

- Breaking change for API consumers: `sortBy` / `sortDirection` and top-level filter flags are
  gone (400 on unknown keys); the email log now returns standard `data` + `meta` pagination
  instead of `{ logs }`; organization API keys and the location-request queue are paginated.
- Adding a list endpoint is a checklist (guide §6), and its sort/filter surface is visible in one
  file and in Swagger.
- Filters on non-indexed columns are a performance risk; whitelisting a field is a deliberate
  decision that must consider indexes (rules/19).
- The bounded catalogs still read their full table; if one of them grows unbounded it must move
  onto the grammar (with a detail endpoint where the UI looks items up by id).
