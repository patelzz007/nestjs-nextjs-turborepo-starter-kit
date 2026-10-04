---
title: "List Queries — Pagination, Sort, Filter and Search"
tags: ["api", "contracts", "pagination", "prisma", "data-table"]
description: "The one list-query grammar every paginated endpoint speaks: how a resource declares it with defineListQuery, how the API parses and translates it to Prisma, and how tables build it on the client."
order: 15
author: "Platform Team"
lastUpdated: 1790899200000
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
> client, and drives the Prisma translation. See [ADR 021](../../adr/021-list-query-grammar.md) for
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

On a **cursor** page the position fields are derived, never invented: `total` counts the rows
matching the filters, the rows before the cursor are `total - (rows after the cursor)`,
`hasPrevious` is `true` only when that number is above zero, and `page` is the 1-based offset page
the slice starts on (`floor(rowsBefore / limit) + 1`, capped at `totalPages`). The paginated
contract requires these fields on every page, so a cursor page costs **two** `COUNT`s (offset
pages cost one). A malformed, tampered or stale cursor is `400 VALIDATION_ERROR` with issue code
`invalid_cursor`; a cursor on an offset-only resource is `400` with `cursor_unsupported`.

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

`BaseRepository` writes are race-safe by construction: `update` is one conditional
`UPDATE … RETURNING` on `buildUpdateWhere(id, input)` (the live row, plus the expected `version`
for an optimistically locked entity such as `Product`) — no match answers `404 NOT_FOUND` when the
row is gone and `409 CONFLICT` when it changed first; `delete` / `softDelete` are one conditional
statement on `buildLiveWhere(id)` (404 when nothing was live); `createMany` / `deleteMany` run in
ONE transaction (all or nothing, duplicates in `deleteMany` count once). A cascade's
`softDeleteParent` port must be conditional too and return the number of rows it changed.
Services return `toPaginatedServiceResult(mapListResult(result, toDto), query)` and the response
interceptor turns it into `data` + `meta`.

**Tenant / owner scope is never a filter.** `organizationId`, the signed-in `userId`, an
authorized `locationId` are passed to the `where` builder as separate arguments by the service —
the client can narrow inside its scope, never widen it. For merchant lists the store scope is a
`MerchantLocationScope` resolved by `MerchantContextService.resolveLocationScope` (rewards module):
an omitted `locationId` is the member's own stores (every store only for an `ALL_LOCATIONS` member)
or a store-scoped API key's store, and a store-limited scope also excludes organization-wide
(`location_id IS NULL`) rows.

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
const query = api.product.list.useQuery(
  tableStateToListQuery(productListQuery, {
    pagination: { page, limit, cursor },   // the table's page, page size and keyset cursor
    sorting,                               // TanStack SortingState
    search,
    filter: { isActive: eqFilter(parseBooleanFilterOption(isActiveSelect)) },
    // sortAliases: { countryCode: "iso2" }  // when a column id differs from the API field
  }),
  { placeholderData: keepPreviousData },
);
```

A table whose state lives in the URL (§7 — every admin table) uses the sibling
`listStateToListQuery(spec, { pagination, sort, search, filter })`, which takes the URL's
`sort` param instead of TanStack sorting and applies exactly the same rules.

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
8. A table for it: declare its URL state (`defineUrlState` + `listUrlParams`, §7) and a
   `to…ListQuery(state)` builder shared by the server page (prefetch) and the client table, with
   a parsing test next to it (`apps/admin/lib/url-state/url-states.test.ts`).

## 7. Table state in the URL

A list table's page, page size, sort, filters and search are **URL state**: shareable,
bookmarkable, refresh-safe and restored by back/forward ([ADR 023](../../adr/023-client-state-feature-stores.md),
rules/06 "Table state ownership"). They are never copied into `useState` or Zustand. The rows
stay in TanStack Query; column visibility and density stay in the DataTable's own preferences.

The URL speaks **the list grammar itself**, so a table URL maps 1:1 onto the request:

```text
/users?page=2&sort=-email&search=jane&filter[status]=locked
  → GET /api/v1/auth/admin/users?page=2&limit=20&sort=-email&search=jane&filter[status][eq]=locked
```

Defaults are omitted (`/users` is page 1, the default page size, the default order, no
filters), and `filter[…]` brackets are written unencoded so the address bar stays readable.

### Declaring a table's URL state

`@workspace/client/lib/url-state/*` (server-safe, except the two hooks):

```ts
// apps/admin/lib/url-state/users.ts — imported by the server page AND the client table
export const USERS_TABLE_URL_STATE = defineUrlState(
  {
    ...listUrlParams(adminUserListQuery, { pageSizes: [10, 20, 50, 100], defaultLimit: 20 }), // page, limit, cursor, sort
    search: listSearchParam(),
    status: optionalUrlParam(AdminUserStatusSchema),
  },
  { urlKeys: { status: listFilterKey("status") } },                                          // ?filter[status]=
);

export function toUsersListQuery(state: UsersTableUrlState): TableListQueryInput<UsersListFilter> {
  return listStateToListQuery(adminUserListQuery, { pagination: state, sort: state.sort, search: state.search, filter: { status: eqFilter(state.status) } });
}
```

| Helper | What it does |
| --- | --- |
| `defineUrlState(shape, { urlKeys })` | One zod schema per param. `parse(searchParams)` **never throws**: each missing or invalid param falls back to its own default, independently. `serialize(state, current)` omits defaults and keeps params it does not own. |
| `listUrlParams(listQuery, { pageSizes, defaultLimit })` | `page` (1…10 000), `limit` (one of the table's page sizes), `cursor`, `sort` (the resource's whitelist, normalized; the default order is dropped). |
| `listSearchParam()` / `listTextFilterParam()` | Trimmed, bounded text; blank is absent. |
| `optionalUrlParam(schema)` / `urlParamWithDefault(schema, value)` / `optionalBooleanUrlParam()` | Filter values and selections (`?key=`, `?organizationId=`), validated by the domain schema. |
| `listFilterKey(field, op?)` | `filter[field]` (eq shorthand) or `filter[field][op]` — the API's own key. |
| `listStateToListQuery(spec, state)` | URL state → list input (whitelist, default order, cursor rule re-applied). |
| `useUrlState(codec)` | `[state, update(patch, { history })]` from `useSearchParams()`. |
| `useUrlDraft(...)` (admin: `useTableTextDraft`) | The search box's in-progress text: local, committed to the URL after a debounce, reset when the URL changes from outside. |
| `listPagePatch(state, page, nextCursor)` | The `{ page, cursor }` patch for a page move: a sequential "next" in the default order reuses `meta.nextCursor`, anything else pages by offset. |
| `toPrefetchedQuery` / `prefetchedDataFor` (`lib/url-state/prefetched-query`) | Binds a server prefetch to the serialized URL state it was fetched for, and hands it back as `initialData` only for that state. |

### Server page: parse and prefetch the requested page

```tsx
export default async function UsersPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const urlState = USERS_TABLE_URL_STATE.parse(await searchParams);
  const [result] = await Promise.allSettled([createAdminServerCaller().auth.adminUsers.query(toUsersListQuery(urlState))]);
  return <UsersAllTable initialPage={toPrefetchedQuery(USERS_TABLE_URL_STATE.serialize(urlState), result)} />;
}
```

A reloaded or shared link therefore renders the requested page in the initial HTML. The
client table builds the same input from the same URL; it uses the prefetched envelope as
`initialData` only while its serialized state equals the one the server fetched
(`prefetchedDataFor`). A failed prefetch is dropped (`toPrefetchedQuery` returns `undefined`)
and the table fetches that page on the client.

A **tabbed** table prefetches only its active tab. `/geography` keeps `?tab=` in the same URL
state, so the state key already names the tab. Each tab returns its own row type, so the page
tags the response with its tab (`GeoTabPage`, `lib/url-state/geography`). Each tab's query takes
`initialData` only from a page tagged with its own tab:

```tsx
// page.tsx — one endpoint per tab, chosen by the URL
const [statsResult, pageResult] = await Promise.allSettled([server.geo.stats.query({}), fetchActiveTabPage(server, urlState)]);
return <GeoView initialStats={…} initialPage={toPrefetchedQuery(GEO_URL_STATE.serialize(urlState), pageResult)} />;

// geo-table.tsx
const prefetchedPage = prefetchedDataFor(initialPage, GEO_URL_STATE.serialize(urlState));
api.geo.states.useQuery(toStatesListQuery(urlState), { enabled: activeTab === "states", ...initialDataOption(prefetchedPage?.tab === "states" ? prefetchedPage.envelope : undefined) });
```

Switching tabs on the client fetches the new tab. Switching back, or pressing Back, to the state
the server rendered reads TanStack Query's cache. Nothing is refetched while that page is fresh.

### Client table: read the URL, write patches

```tsx
const [urlState, updateUrlState] = useUrlState(USERS_TABLE_URL_STATE);
const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, (value) =>
  updateUrlState({ search: toListSearch(value), page: 1, cursor: undefined }, { history: "replace" }));
const query = api.auth.adminUsers.useQuery(toUsersListQuery(urlState), { placeholderData: keepPreviousData });
const { pagination, sorting, handleSortingChange } = useUrlListPaging({ state: urlState, update: updateUrlState, sortSpec: adminUserListQuery, … });
```

Rules:

- **Any filter, search or sort change resets to page 1** (and drops the cursor).
- **push vs replace.** Discrete navigation — page, page size, sort, a filter select, an
  in-page selection — **pushes** a history entry, so Back undoes it. Continuous input — the
  debounced search box and free-text filters — **replaces** the current entry, so history
  is not flooded with one entry per keystroke.
- **Writes use the History API** (`history.pushState` / `replaceState`), which Next.js
  integrates with its router: `useSearchParams()` updates and back/forward restores the
  entry, **without** a server round trip. `router.push` would re-render the page's server
  components on every change (re-fetching the prefetched page, waiting for the RSC payload,
  showing `loading.tsx`). Use `router.push` only when the server must recompute something
  for the new URL — e.g. `/analytics/sales?weeks=`, whose period ends at request time.
- **Keyset cursor.** A sequential "next page" in the default order writes the response's
  `meta.nextCursor` as `?cursor=`; any other jump pages by offset.
- **Bad URLs never break a page.** An unknown sort field, an out-of-range page, a malformed
  id: each falls back to its default and the rest of the URL still applies.
- **A filter whose default is not "none"** (the MFA queue opens on `PENDING`) represents
  "every value" as `filter[status]=all`, translated to "no filter" before the API call.

### Store-scoped lists (merchant)

A merchant list is also filtered by the member's **store**, which is not URL state: it is owned
by the `tenant-context` feature store and its cookie ([Frontend routing](../frontend/routing.md#organization-and-store-context-merchant)).
The request is the URL's list keys plus `locationId`, and the server prefetch is bound to
**both**: `LocationScopedPrefetch<PrefetchedQuery<Envelope<…>>>`. The view seeds `initialData`
only when the store and the serialized URL state both match:

```tsx
const [urlState, updateUrlState] = useUrlState(REDEMPTIONS_URL_STATE);
const prefetchedPage = prefetchedDataFor(prefetchForLocation(initialRedemptions, locationId), REDEMPTIONS_URL_STATE.serialize(urlState));
const query = api.organizations.redemptions.useQuery(toRedemptionsQuery(orgSlug, locationId, urlState), initialDataOption(prefetchedPage));
```

### Which pages keep their state in the URL

| App | Page | URL state |
| --- | --- | --- |
| admin | `/users`, `/merchants`, `/catalog/products`, `/catalog/categories`, `/emails/log`, `/geography` (+ `?tab=`), `/users/mfa-recovery` | page, limit, cursor, sort, search, `filter[…]` |
| admin | `/merchants/verification`, `/emails/templates`, `/merchants/store-requests`, `/users/mfa-recovery` | the in-page selection (`?organizationId=`, `?key=`, `?requestId=`) |
| admin | `/analytics/sales` | `?weeks=` (written with `router.push`: the server computes the period) |
| web | `/rewardhub` and the public landing catalog `/` | page, cursor, `search` (committed on submit), `filter[city]`, `filter[category]` |
| merchant | `/orgs/[orgSlug]/redemptions` | page, cursor (the store stays in `tenant-context`) |
| merchant | `/orgs/[orgSlug]/api-keys` | `?status=revoked\|all` — a view filter over the loaded keys (the counts need every key), so not an API filter and not part of the prefetch |

Deliberately **not** URL state: the rewards grid/list layout (a per-device preference in the
`ui-preferences` feature store), the merchant's store (`tenant-context` + cookie), open dialogs
and confirmations, form drafts, the sidebar's impersonation user search (a shell widget on every
page, not the page's state), and the guide's example tabs on the API-keys page. Pages with no
list controls — the web wallet and activity pages, merchant rewards, team, locations, terminals,
analytics and verification — have nothing to move until they gain search, filters or paging.

A search box that commits on **submit** (the web catalog) keeps its unsubmitted text in
`useSubmittedUrlDraft` (apps/web/lib/url-state): local, and reset whenever the URL's value changes.
A submitted search is a discrete change, so it **pushes**.

In-page selection (`/merchants/verification?organizationId=`, `/emails/templates?key=`,
`?requestId=` on the review queues) uses the same `defineUrlState` / `useUrlState`: the
selected item is derived from the URL on every render, never mirrored into `useState`.

