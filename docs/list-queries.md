---
title: "List Queries — Pagination, Sort, Filter and Search"
tags: ["api", "contracts", "pagination", "prisma", "data-table"]
description: "The one list-query grammar every paginated endpoint speaks: how a resource declares it with defineListQuery, how the API parses and translates it to Prisma, and how tables build it on the client."
order: 15
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# List Queries — Pagination, Sort, Filter and Search

> [!NOTE]
> **TL;DR.** Every paginated list endpoint takes the same query string:
>
> ```text
> GET /api/v1/product?page=2&limit=25&sort=-price,name&search=shoe
>                    &filter[isActive]=true&filter[price][gte]=10&filter[price][lte]=99
>                    &filter[categoryId][in]=<uuid>,<uuid>
> ```
>
> The resource declares what is allowed **once**, with `defineListQuery()` in `@workspace/shared`.
> That one declaration validates the request on the server, documents it in Swagger, types the
> client, and drives the Prisma translation. See [ADR 021](./adr/021-list-query-grammar.md) for
> why it is built this way.

## 1. The grammar

| Parameter | Example | Meaning |
| --- | --- | --- |
| `page` | `page=2` | Offset page, 1-indexed (default `1`, max `10 000`). |
| `limit` | `limit=25` | Page size (resource default, max `100`). |
| `cursor` | `cursor=eyJhd…` | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the **default** order. |
| `sort` | `sort=-createdAt,name` | Comma list (max 3 keys); `-` prefix = descending. Only whitelisted fields. |
| `search` | `search=john` | Case-insensitive free text over the resource's search columns (resources that declare it). |
| `filter[field]` | `filter[status]=ACTIVE` | Shorthand for `filter[status][eq]=ACTIVE`. |
| `filter[field][op]` | `filter[price][gte]=10` | Operator form. Only whitelisted fields, and per field only its whitelisted operators. |

Operators, by field type:

| Field type (`listFilter.*`) | Operators it can allow |
| --- | --- |
| `string` | `eq`, `ne`, `in`, `nin`, `contains`, `startsWith`, `isNull` — all case-insensitive |
| `number`, `epochMs` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `isNull` |
| `uuid`, `enumeration(Schema)` | `eq`, `ne`, `in`, `nin`, `isNull` |
| `boolean` | `eq`, `isNull` |

`in` / `nin` take a comma list (`filter[status][in]=ACTIVE,LOCKED`, max 100 values).
`isNull=true` matches `NULL`, `isNull=false` matches `NOT NULL`. Values are coerced to their real
type (numbers, booleans, epoch ms) and validated (UUIDs, enum members, text length).

Every list response uses the standard envelope; pagination lives in `meta`:

```json
{
  "success": true,
  "data": [ … ],
  "meta": { "limit": 25, "total": 156, "page": 2, "totalPages": 7, "nextCursor": "eyJhdCI6…", "hasNext": true, "hasPrevious": true, "correlationId": "…", "timestamp": 1790812800000 }
}
```

`meta.nextCursor` is only set while the request uses the resource's default order — the only
order a keyset cursor can continue. A custom `sort` pages with `page`.

### What gets rejected (always `400 VALIDATION_ERROR`)

- an unknown top-level parameter (including the removed `sortBy` / `sortDirection` / bare
  `status=…` style parameters);
- a sort field or filter field that is not whitelisted — the message lists what is allowed;
- an operator the field does not allow — the message lists the allowed operators;
- a value of the wrong type, an over-long text value or list, `limit > 100`;
- a `cursor` combined with a non-default `sort`, or a malformed / tampered cursor;
- more than 50 `filter[...]` keys, a repeated operator, or a non-identifier field name
  (`filter[__proto__]`, `filter[a.b]`).

## 2. Declaring a resource's list query (shared)

```ts
// packages/shared/src/schemas/domain/catalog/product.ts
export const productListQuery = defineListQuery({
  sortable: ["name", "price", "compareAtPrice", "sku", "slug", "stockQuantity", "createdAt"],
  defaultSort: [{ field: "createdAt", direction: "desc" }],
  filter: {
    isActive: listFilter.boolean({ eq: true }),
    categoryId: listFilter.uuid({ eq: true, in: true }),
    brand: listFilter.string({ eq: true, contains: true, isNull: true }),
    price: listFilter.number({ gte: true, lte: true }),
  },
  params: { search: ListSearchSchema },
  // defaultLimit: 50,   // optional, defaults to 20
});
export const ProductListQuerySchema = productListQuery.schema;
export type ProductListQuery = z.output<typeof ProductListQuerySchema>;
export type ProductListSortField = (typeof productListQuery.sortable)[number];
```

- `sortable` / `filter` use **API names**, never column names; the repository maps them.
- `params` holds resource-specific, non-grammar keys: `search`, or an authorization **scope**
  such as `locationId` (which the service must still check against the caller's access).
  `params` may not reuse `page` / `limit` / `cursor` / `sort` / `filter`.
- The parsed `filter` is a typed AST: `{ price: { gte: 10, lte: 99 }, categoryId: { in: [...] } }`.
  A disallowed operator is a **compile error** in typed client code and a 400 at runtime.

## 3. API: controller, repository, translator

Controllers take the query with `@ZodListQuery` (`apps/api/src/common/decorators/zod-request.decorators.ts`):

```ts
@Get()
@RequirePermission("LIST", "PRODUCT")
public list(@ZodListQuery(ProductListQuerySchema) query: ProductListQuery): ReturnType<ProductService["list"]> {
  return this.service.list(query);
}
```

`@ZodListQuery` runs two pipes:

1. **`BracketQueryPipe`** — Fastify keeps `filter[status][in]` as a literal key. The pipe turns the
   flat keys into the nested `filter` object with `nestBracketQueryParams` (shared). It is safe by
   construction: field and operator names must match a strict identifier pattern, the number of
   filter keys is capped, results are built with `Map` + `Object.fromEntries` (own data properties
   only, no prototype writes) and anything unrecognised is passed through for the strict schema to
   reject by name. It is scoped to list endpoints — no global query-parser change.
2. **`ZodValidationPipe` (zod engine)** — parses with the shared schema (preprocess + refinements),
   so the handler receives the normalized filter AST. Swagger documents every key from the same
   schema.

The repository maps the AST to Prisma with the helpers in
`apps/api/src/platform/persistence/list-query/`, **one explicit column per whitelisted field**:

```ts
// apps/api/src/modules/product/product.repository.ts
const PRODUCT_SORT_COLUMNS: SortColumns<ProductListSortField, Prisma.ProductOrderByWithRelationInput> = {
  name: (direction) => ({ name: direction }),
  price: (direction) => ({ price: direction }),
  // … every sortable field, or it does not compile
};

export function buildProductListWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const filter = query.filter;
  return {
    AND: [
      { deletedAt: null },
      ...fieldWhere(toPrismaNullableBooleanFilter(filter?.isActive), (isActive) => ({ isActive })),
      ...fieldWhere(toPrismaEqualityFilter(filter?.categoryId), (categoryId) => ({ categoryId })),
      ...fieldWhere(toPrismaComparableFilter(filter?.price), (price) => ({ price })),
      ...(query.search !== undefined ? [buildSearchWhere(query.search)] : []),
    ],
  };
}

export function buildProductListOrder(query: ProductListQuery): ListOrder<Prisma.ProductOrderByWithRelationInput> {
  return buildListOrder(productListQuery.resolveSort(query.sort), {
    columns: PRODUCT_SORT_COLUMNS,
    tieBreaker: (direction) => ({ id: direction }), // always appended → stable pages
  });
}

/** Keyset for the default order (`createdAt desc, id desc`). */
const PRODUCT_LIST_KEYSET = timestampIdKeyset<ProductRow, Prisma.ProductWhereInput>(
  (row) => ({ at: Number(row.createdAt), id: row.id }),
  ({ at, id }) => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);
```

| Helper | Purpose |
| --- | --- |
| `toPrisma{Comparable,Equality,String,Boolean}Filter` | Operator object → Prisma scalar filter for a **non-nullable** column (`isNull` rejected at the type level). |
| `toPrismaNullable…Filter` | Same for nullable columns; `isNull` → `equals: null` / `not: null`. |
| `fieldWhere(filter, toWhere)` | `[]` when the field was not filtered, `[toWhere(filter)]` otherwise — spread into `AND`. |
| `buildListOrder(sort, { columns, tieBreaker, uniqueField? })` | Requested (or default) sort → `orderBy[]`, unique tie-breaker appended in the last term's direction. |
| `timestampIdKeyset` / `defineKeyset` | Opaque base64url keyset cursor for the default order; decoded positions are re-validated with zod. |
| `fetchListPage(query, spec)` | The one offset + keyset implementation: `count`, `findMany`, `meta`, cursor rules. |

Repositories built on `BaseRepository` provide `buildListWhere`, `buildListOrder`, `listKeyset`
and `andWhere` ports and get `list()` for free; custom repositories call `fetchListPage` directly.
Services return `toPaginatedServiceResult(mapListResult(result, toDto), query)` and the response
interceptor turns it into `data` + `meta`.

**Tenant / owner scope is never a filter.** `organizationId`, the signed-in `userId`, an
authorized `locationId` are passed to the `where` builder as separate arguments by the service —
the client can narrow inside its scope, never widen it.

## 4. Client: typed calls and DataTable adapter

The typed client validates the input with the same schema and serializes nested objects back to
bracket keys (`flattenQueryParams`, the inverse of `nestBracketQueryParams`):

```ts
api.product.list.useQuery({ page: 1, limit: 20, sort: "-price", filter: { isActive: { eq: true } } });
// → GET /api/v1/product?page=1&limit=20&sort=-price&filter[isActive][eq]=true
```

Server-side DataTables build that input from table state with
`tableStateToListQuery` (`@workspace/client/lib/api/list-query`):

```ts
const listFilter = useMemo(() => ({ isActive: eqFilter(parseBooleanFilterOption(isActiveSelect)) }), [isActiveSelect]);

const query = api.product.list.useQuery(
  tableStateToListQuery(productListQuery, {
    pagination: paginationQuery,   // useManualHybridPagination → { page, limit, cursor? }
    sorting,                       // TanStack SortingState
    search: debouncedSearch,
    filter: listFilter,
    // sortAliases: { countryCode: "iso2" }  // when a column id differs from the API field
  }),
  { placeholderData: keepPreviousData },
);
```

The adapter never trusts the table: sort columns outside the whitelist are dropped (a UI-only
column never produces a 400), the default order is sent as "no sort", a keyset `cursor` is only
kept while the default order is in effect, blank search and empty filters are omitted (so the
react-query key only changes when the request does). `parseFilterOption(value, Schema)` and
`parseBooleanFilterOption(value)` turn select values into typed filter values; `"all"` and blank
mean "no filter".

## 5. Endpoints on the grammar

| Endpoint | Sortable | Filterable | Search | Default order |
| --- | --- | --- | --- | --- |
| `GET /product` | name, price, compareAtPrice, sku, slug, stockQuantity, createdAt | isActive, isFeatured, categoryId, brand, price, stockQuantity, createdAt | ✓ | `-createdAt` |
| `GET /sample-category` | name, slug, sortOrder, createdAt | isActive, createdAt | ✓ | `-createdAt` |
| `GET /geo/regions` | id, name | id, flag | ✓ (fuzzy) | `id` |
| `GET /geo/subregions` | id, name | id, regionId, flag | ✓ (fuzzy) | `id` |
| `GET /geo/countries` | id, name, iso2 | id, iso2, regionId, subregionId, flag | ✓ (fuzzy) | `id` |
| `GET /geo/states` | id, name, countryCode, iso2 | id, countryId, countryCode, flag | ✓ (fuzzy) | `id` |
| `GET /geo/cities` | id, name, countryCode, stateCode | id, stateId, countryId, countryCode, stateCode, flag | ✓ (fuzzy) | `id` |
| `GET /auth/admin/users` | fullName, email, createdAt | status (`active`/`inactive`/`locked`), role | ✓ | `-createdAt` |
| `GET /auth/admin/mfa/recovery/requests` | requestedAt, createdAt | status, userId | — | `-requestedAt` |
| `GET /admin/audit` | createdAt | action, actorId, targetUserId, targetRoleId, createdAt | — | `-createdAt` |
| `GET /notifications/email-log` | createdAt, subject, to, status | status, templateKey, createdAt | ✓ | `-createdAt` |
| `GET /rewards` (marketplace) | createdAt, expiryDate, title | category, city | ✓ | `-createdAt` |
| `GET /claims` (own claims) | claimedAt, createdAt | status | — | `-claimedAt` |
| `GET /reward-notifications` | createdAt | readAt (`isNull` = unread) | — | `-createdAt` |
| `GET /orgs/:orgSlug/redemptions` | redeemedAt | — (`locationId` scope) | — | `-redeemedAt` |
| `GET /orgs/:orgSlug/api-keys` | createdAt, name | revokedAt (`isNull` = active) (`locationId` scope) | — | `-createdAt` |
| `GET /orgs/:orgSlug/terminals` | createdAt, name | — (`locationId` scope) | — | `-createdAt` |
| `GET /admin/merchants` | createdAt, displayName | city, kybStatus, status | ✓ | `-createdAt` |
| `GET /admin/location-requests` | createdAt, name | status | — | `createdAt` (oldest first) |

`GET /reward-notifications` returns a feed page (`{ items, unreadCount, nextCursor, hasNext }`)
instead of `meta` pagination because it carries the unread badge count.

Not on the grammar (bounded catalogs consumed whole — see ADR 021): `GET /admin/roles`,
`GET /admin/permissions`, `GET /orgs/:orgSlug/rewards`, organization members / invites /
memberships, `GET /admin/rewards/pending`, the capability catalog and email previews.

## 6. Adding a list endpoint — checklist

1. `defineListQuery` in the resource's shared schema file; export the schema, the query type and
   the `…ListSortField` type.
2. Contract leaf: `input: XListQuerySchema` (intersect with the path-param schema for nested routes).
3. Repository: `SortColumns` map, `build…ListWhere` (scope + filter AST + search),
   `build…ListOrder` (tie-breaker), a keyset for the default order, then `fetchListPage`.
4. Controller: `@ZodListQuery(XListQuerySchema)`; service returns `toPaginatedServiceResult`.
5. Client router: `response: listEnvelope(ItemSchema)`, `queryKey: (input) => listQueryKey([...], input)`.
6. Tests: translator spec (`apps/api/src/modules/*.list-query.spec.ts`), and for anything
   non-trivial a real-Postgres case in `apps/api/test/list-query.e2e-spec.ts`.
7. Add the row to the table in §5 and check that the columns you sort/filter on are indexed
   (rules/19-performance-and-scalability.md).
