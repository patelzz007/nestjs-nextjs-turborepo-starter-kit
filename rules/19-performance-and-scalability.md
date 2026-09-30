# 19 — Performance & Scalability

"Blazingly fast" is a design constraint, not a hope. Every endpoint should be fast because of how it was built, not because traffic happens to be low today and nobody has noticed yet.

## Baseline expectations for every endpoint

- A single-resource `GET` (`/orders/:id`) should be a single, indexed query (plus authorization checks) — no incidental extra round trips.
- A list `GET` (`/orders`) is paginated (bounded page size, enforced server-side, not just requested by the client), uses an index matching its filter/sort, and avoids N+1 on any per-row relation.
- A write (`POST`/`PATCH`) does the minimum DB work needed inside its transaction and defers anything non-essential (sending an email, publishing an event) to after commit or to a queue — see `09-messaging-and-jobs.md`.

## N+1 — the most common regression

```ts
// ❌ DON'T — N+1: one query per order
const orders = await prisma.order.findMany();
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}

// ✅ DO — one query, relation loaded eagerly
const orders = await prisma.order.findMany({ include: { items: true } });
```

For GraphQL-style or composed REST responses where a naive `include` isn't practical (e.g. a computed aggregate per row from a different service), use a batching/dataloader pattern so N rows still cost O(1) extra queries, not O(N).

```ts
// ❌ DON'T — a per-row call to a different service inside a map, for every row
const orders = await getOrders();
const withReviewCounts = await Promise.all(
  orders.map(async (o) => ({ ...o, reviewCount: await reviewsService.countFor(o.id) })), // N calls
);

// ✅ DO — one batched call for all rows at once
const orders = await getOrders();
const reviewCounts = await reviewsService.countForMany(orders.map((o) => o.id)); // 1 call
const withReviewCounts = orders.map((o) => ({ ...o, reviewCount: reviewCounts[o.id] ?? 0 }));
```

Catch these before they ship: enable Prisma query logging in development/test and watch for repeated near-identical queries in a single request; consider a lightweight assertion in integration tests that a given endpoint issues no more than a fixed number of queries for a given input size.

## Indexing discipline

Every new query pattern (a new filter, a new sort field, a new foreign-key lookup) gets checked against existing indexes before shipping — see `08-database-prisma.md`. A slow endpoint discovered in production is usually a missing index discovered late; catch it at review time by asking "what index does this query use?" for any new `WHERE`/`ORDER BY`.

## Caching

Cache deliberately, not defensively. A read becomes a caching candidate when it's demonstrably hot (called frequently, relatively expensive, and tolerant of slight staleness) — not "just in case." When you do cache:

```text
❌ DON'T — cache a value with no defined invalidation strategy: "I'll
   just cache this for now, it should be fine." Six months later, someone
   is debugging why a user's profile update "isn't showing up," with no
   idea a stale cache is the reason, because nobody documented what
   invalidates it.

✅ DO — define the invalidation path in the SAME change that adds the
   cache: "this cache key is busted by the updateUser mutation, here's
   the explicit call that does it."
```

- Set an explicit TTL.
- Define the invalidation path (what write operations must bust this cache key) up front, before shipping the cache.
- Key by every input that affects the result (tenant, filters, pagination) the same way TanStack Query keys are scoped (`06-tanstack-state-forms-tables.md`).

## Payload size

Return only the fields the consumer needs (`select` over blanket `include`s — `08-database-prisma.md`). A response that's 10x larger than necessary is slow for reasons that have nothing to do with the database — serialization time, network transfer, and client-side parsing all scale with payload size.

## Concurrency, connection pressure, and race conditions

Be deliberate about how many concurrent DB connections a burst of requests can create — long-running transactions, unbounded parallel queries inside one request handler, and connection-pool exhaustion under load are all real failure modes worth designing against, not just reacting to after an incident.

```ts
// ❌ DON'T — an unbounded Promise.all firing off a query per item in a
// large array, which can exhaust the connection pool under a large enough input
await Promise.all(orderIds.map((id) => prisma.order.findUnique({ where: { id } })));

// ✅ DO — one batched query
await prisma.order.findMany({ where: { id: { in: orderIds } } });
```

This connects directly to `08-database-prisma.md`'s race-condition guidance: high concurrency isn't just a raw-speed problem, it's the exact condition under which check-then-act race conditions actually manifest in production (and almost never manifest in a quiet local dev environment). Performance-sensitive code and concurrency-safe code are the same code, reviewed from two different angles.

## When "fast enough" needs measuring, not guessing

For a genuinely performance-sensitive endpoint, verify with a realistic dataset size (not 10 rows in local dev) before calling it done — this is part of `18-definition-of-done.md`'s API checklist.

## Bundle size budgets (web)

```text
❌ DON'T — add a new dependency to apps/web without checking its size
   impact, because "it's just one more import." A seemingly small
   library can pull in a large, unexpected dependency tree, and these
   additions compound silently over the life of a project until the
   app's initial load is noticeably slow with no single obvious culprit.

✅ DO — check the actual bundle-size impact of a new dependency before
   adding it (via the framework's built-in bundle analyzer), prefer a
   smaller/tree-shakeable alternative where one exists and meets the
   need, and set an enforced bundle-size budget in CI so a regression is
   caught at review time, not discovered months later as "the app feels
   slow now, not sure why."
```

## Code splitting and lazy loading

```tsx
// ❌ DON'T — import a large, rarely-used component (e.g. a rich text
// editor, a complex charting library) eagerly at the top of a file,
// forcing every visitor to download its full weight even if they never
// interact with the feature it powers
import { RichTextEditor } from 'heavy-editor-library';

// ✅ DO — lazy-load anything large and conditionally-rendered
const RichTextEditor = lazy(() => import('heavy-editor-library').then((m) => ({ default: m.RichTextEditor })));
<Suspense fallback={<EditorSkeleton />}><RichTextEditor /></Suspense>
```

## Image and asset optimization

Beyond `next/image`'s automatic handling (`03-web-nextjs.md`), be deliberate about source image size/format for anything not passing through that pipeline (mobile app assets, emails, generated PDFs) — an unnecessarily large source asset costs real bandwidth and load time for every single user, multiplied across however many times it's served.

## Load testing

For any endpoint identified as genuinely high-traffic or business-critical, verify its behavior under realistic concurrent load (via a load-testing tool) before it ships, not after a production incident reveals it can't handle real traffic. This is where the race-condition guidance (`08-database-prisma.md`) and this document's N+1/indexing guidance actually get validated for real — a query pattern that looks fine with ten sequential manual clicks in local dev can behave completely differently under two hundred genuinely concurrent requests.

## Database connection limits under load

Tie this back explicitly to `08-database-prisma.md`'s connection pooling guidance: a load test that reveals connection-pool exhaustion under realistic concurrency is exactly the kind of finding this document exists to surface before production does. Include "does this stay healthy under the connection limits we've actually provisioned" as an explicit pass/fail criterion for load-testing a new high-traffic endpoint, not just raw request throughput/latency.

## In-memory caching vs Redis — choosing correctly

```text
❌ DON'T default to Redis for every cache, including data that's small,
   cheap to recompute, and only ever needed within a single process —
   this adds an unnecessary network hop for no real benefit.

❌ DON'T default to in-memory (per-process) caching for data that needs
   to be consistent ACROSS multiple running instances of a service — an
   in-memory cache is invisible to every OTHER instance, so one
   instance's cache invalidation doesn't help the others, and different
   users can see different, inconsistent cached results depending on
   which instance handled their request.

✅ DO choose based on the actual requirement: in-memory for small,
   cheap-to-recompute, per-process-fine data (e.g. a compiled config
   object); Redis for anything that needs to be shared/consistent across
   multiple instances (which is the common case for anything user-facing
   in a horizontally-scaled deployment).
```

## Batching with a dataloader pattern — beyond the basic N+1 fix

For a case where naive `include` genuinely isn't sufficient (fetching a per-row value from a completely separate service or data source, not resolvable in one Prisma query), use a request-scoped dataloader that automatically batches and deduplicates individual lookups issued within the same tick into one bulk call — rather than either accepting N+1 or hand-rolling ad hoc batching logic per endpoint.

```ts
// ✅ DO — a dataloader batches every .load(id) call issued during the
// same request into ONE underlying bulk call, automatically
const reviewCountLoader = new DataLoader<OrderId, number>(async (orderIds) => {
  const counts = await reviewsService.countForMany(orderIds); // one call, however many .load()s were issued
  return orderIds.map((id) => counts[id] ?? 0);
});
// elsewhere in the same request, called once per row, but batched under the hood:
const count = await reviewCountLoader.load(order.id);
```

## Rate limiting math — setting a real, deliberate limit

```text
❌ DON'T pick a rate limit arbitrarily ("100 requests per minute sounds
   about right") with no grounding in the endpoint's actual cost or a
   legitimate user's actual expected usage pattern.

✅ DO derive the limit from something real: what does a legitimate,
   heaviest-real-user usage pattern actually look like for this
   endpoint, with headroom — and separately, what request rate would
   meaningfully strain the backing resource (a database, an expensive
   downstream API with its own rate limit) if left unbounded? Set the
   limit to comfortably clear legitimate usage while still meaningfully
   constraining abuse, and document the reasoning next to the limit's
   configuration so a future change isn't made blind.
```

## Web Vitals and perceived performance

Beyond backend/database performance, measure and hold a standard for the metrics that reflect what a real user actually experiences on web: Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift. A backend that responds in 50ms behind a frontend that ships an oversized JS bundle and shows a layout-shifting, janky page is not, in any way a user experiences, "fast" — performance is the whole pipeline end to end, and this document's earlier sections (indexing, N+1, caching) only cover half of what a user actually perceives.

```text
❌ DON'T treat frontend performance as a separate, lower-priority
   concern from backend performance just because it's "just the UI."

✅ DO hold web performance to the same explicit-budget discipline as
   backend latency (12-observability-and-operations.md's SLO section) —
   track Core Web Vitals in production (real-user monitoring, not just
   synthetic lab tests), and treat a regression the same as a backend
   latency regression: something to investigate and fix, not a vague
   feeling that "the site seems a bit slower lately."
```

## Debouncing and throttling expensive client-side operations

```tsx
// ❌ DON'T — fire a network request (or a heavy client-side computation)
// on every single keystroke of a search input
<input onChange={(e) => searchOrders(e.target.value)} />

// ✅ DO — debounce anything triggered by rapid, repeated user input
const debouncedSearch = useMemo(() => debounce(searchOrders, 300), []);
<input onChange={(e) => debouncedSearch(e.target.value)} />
```

## Server-side computation vs client-side computation

For anything computationally non-trivial applied to a dataset (aggregating totals across hundreds of rows, complex filtering/sorting logic), prefer doing it server-side, in the database query itself where possible, rather than fetching raw rows and computing client-side — this is both faster in the vast majority of cases (a database is built for exactly this kind of set-based computation) and reduces the payload size sent over the network in the first place, compounding with this document's payload-size guidance above.

## Performance review checklist for a new endpoint

- [ ] Query count for a typical request is constant (not proportional to result size)
- [ ] `EXPLAIN` (or equivalent) shows an index is used for the filter and sort
- [ ] Page size bounded and enforced server-side
- [ ] Response contains only needed fields; large blobs are not inlined
- [ ] No synchronous heavy work (PDF, image, report) on the request path without a queue decision
- [ ] External calls have timeouts and (where safe) bounded retries
- [ ] Hot reads considered for caching (with tenant-scoped keys, TTL, invalidation)
- [ ] Connection use bounded (no unbounded `Promise.all` over DB calls)
- [ ] Verified with a realistic data volume, not a handful of rows
- [ ] p95/p99 latency and error rate instrumented

## Do / Don't quick pairs

```ts
// ❌ counting by loading everything
const all = await prisma.order.findMany({ where }); const n = all.length;
// ✅ count in the database
const n = await prisma.order.count({ where });

// ❌ OFFSET pagination on a huge, hot table (cost grows with offset)
findMany({ skip: 1_000_000, take: 20 })
// ✅ cursor/keyset pagination
findMany({ where: { id: { gt: lastId } }, orderBy: { id: 'asc' }, take: 20 })

// ❌ SELECT * of wide rows when 3 columns are needed
// ✅ select only what the response uses

// ❌ JSON.stringify/parse of huge objects on the hot path
// ✅ stream or paginate
```
