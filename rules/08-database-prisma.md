# 08 — Database & Prisma Standards

## Database is a consistency boundary

Enforce business invariants as close to the database as practical: foreign keys, unique constraints, check constraints where appropriate, indexes, transactions. Don't rely solely on application code for invariants the database can safely enforce — application code can have bugs, can be bypassed by a script run directly against the DB, and runs on multiple server instances concurrently where a purely in-memory check can race.

```ts
// ❌ DON'T — relying entirely on an application-level check to prevent
// two users from claiming the same promo code, with no database-level
// backstop. Under concurrent requests, this check can pass for BOTH
// requests before either one has written its row — see "Race conditions" below.
const existing = await prisma.promoRedemption.findFirst({ where: { code } });
if (existing) throw new AlreadyRedeemedError();
await prisma.promoRedemption.create({ data: { code, userId } });

// ✅ DO — a unique constraint in the schema makes the invariant
// impossible to violate, regardless of how many concurrent requests hit it
model PromoRedemption {
  code String @unique
  ...
}
// the application-level check above is still nice for a fast, friendly
// error message, but the UNIQUE CONSTRAINT is what actually guarantees
// correctness under concurrency
```

## Naming

Consistent naming for tables, columns, indexes, constraints, enum values. Model names: `PascalCase` singular (`Order`, not `Orders`). Field names: `camelCase`. Document exceptions where the convention is deliberately broken.

## Indexes

Create indexes based on real access patterns: tenant/org scope, foreign keys, unique lookups, common filters, ordering, composite query patterns.

```prisma
// ❌ DON'T — no index on a column that's filtered on in every single
// list-orders query; this becomes a full table scan as the table grows
model Order {
  id         String @id
  tenantId   String
  status     String
}

// ✅ DO — a composite index matching the actual query pattern
// (WHERE tenantId = ? AND status = ? ORDER BY createdAt DESC)
model Order {
  id         String   @id
  tenantId   String
  status     String
  createdAt  DateTime @default(now())

  @@index([tenantId, status, createdAt])
}
```

Don't index every column — each index has a real write-cost trade-off (every insert/update has to maintain every index on that table). Full detail on catching missing indexes before they ship: `19-performance-and-scalability.md`.

## Multi-tenancy

Tenant/org scoping must be explicit — a query for tenant-owned data should make the tenant boundary obvious in the code, not rely on a convention someone has to remember every single time.

```ts
// ❌ DON'T — the tenant boundary is invisible; nothing stops a future
// change from accidentally dropping the `where` clause and leaking data
// across tenants
async function getOrders(tenantId: string) {
  return prisma.order.findMany(); // ❌ tenantId parameter is unused!
}

// ✅ DO — every query explicitly, visibly scoped
async function getOrders(tenantId: TenantId): Promise<Order[]> {
  return prisma.order.findMany({ where: { tenantId } });
}
```

Never rely on the UI to hide another tenant's data. Where PostgreSQL RLS is used, it's defense-in-depth, not a replacement for application-level authorization (`10-security-auth-authorization.md`).

## Transactions and race conditions

### Transactions

Short, deterministic, limited to database work where possible. Avoid network calls inside a transaction — see `02-backend-nestjs.md`.

### Race conditions — a category of bug this project takes seriously

A race condition happens when two concurrent requests both read some state, both decide (independently) that an action is safe based on that stale read, and both proceed to write — resulting in a final state neither request individually intended. These bugs are especially dangerous because they're rare, hard to reproduce locally (your laptop, running one request at a time, will never show you the bug), and often only show up in production under real concurrent load — frequently around money, inventory, or anything with a limited quantity.

```ts
// ❌ DON'T — classic check-then-act race condition. Two concurrent
// requests to purchase the last unit of inventory can both read
// quantity=1, both decide "there's stock," and both decrement — resulting
// in quantity = -1 and two customers charged for one physical item.
async function purchase(sku: string, qty: number) {
  const item = await prisma.inventory.findUnique({ where: { sku } });
  if (item.quantity < qty) throw new OutOfStockError();
  await prisma.inventory.update({ where: { sku }, data: { quantity: item.quantity - qty } });
}

// ✅ DO (option A — atomic conditional update, preferred for simple
// decrement-if-enough operations): let the database enforce the
// invariant atomically in one statement, and check whether it actually
// applied.
async function purchase(sku: string, qty: number): Promise<void> {
  const result = await prisma.inventory.updateMany({
    where: { sku, quantity: { gte: qty } }, // condition checked AT UPDATE TIME, atomically
    data: { quantity: { decrement: qty } },
  });
  if (result.count === 0) throw new OutOfStockError();
}

// ✅ DO (option B — optimistic locking with a version column, for more
// complex multi-field updates where option A's single-statement approach
// doesn't fit): read a version, write conditioned on that version not
// having changed, retry on conflict.
model Order {
  id      String @id
  version Int    @default(0)
}
async function updateOrder(id: string, expectedVersion: number, data: OrderUpdateInput): Promise<void> {
  const result = await prisma.order.updateMany({
    where: { id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count === 0) throw new ConcurrentModificationError(id); // someone else updated it first — caller retries or surfaces a conflict to the user
}

// ✅ DO (option C — pessimistic locking, for critical multi-step
// financial operations where you genuinely need exclusive access for
// the duration of several statements): use a `SELECT ... FOR UPDATE`
// inside a transaction, via Prisma's `$queryRaw` or `$transaction` with
// a raw locking query, so a concurrent request blocks until the first
// one commits, rather than racing.
await prisma.$transaction(async (tx) => {
  const [account] = await tx.$queryRaw<Account[]>`SELECT * FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
  if (account.balance < amount) throw new InsufficientFundsError();
  await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
});
```

Which option to use: prefer A (atomic conditional update) whenever the operation is a single, simple state transition — it's the cheapest and scales the best. Reach for B (optimistic locking) when a user is editing a multi-field record and you want to detect "someone else changed this since you loaded it" without holding a lock. Reach for C (pessimistic locking) only for genuinely critical, multi-step financial/inventory operations where correctness matters more than throughput, and keep the locked transaction as short as possible.

This connects directly to idempotency (`09-messaging-and-jobs.md`) — an idempotency key prevents the *same* request from being double-applied on retry; a race-condition-safe write pattern like the ones above prevents *two different concurrent* requests from corrupting shared state. Both are required; they solve different problems.

## Soft deletion — mandatory for every business entity

Every business-entity model (anything representing a real domain concept a user creates, edits, or could ask to delete — orders, users, rewards, invoices, etc.) uses soft deletion, not a hard `DELETE`. This is a deliberate, standing project convention: it exists so that data is always recoverable, so that audit trails (`10-security-auth-authorization.md`'s audit logging section) remain meaningful even after a record is "deleted," and so that "delete" never means "gone forever and unrecoverable by accident."

Every soft-deletable model includes exactly these three fields:

```prisma
model Order {
  id        String    @id @default(uuid())
  // ...business fields...
  isDeleted Boolean   @default(false)
  deletedAt DateTime?
  deletedBy String?   // the user ID who performed the delete

  @@index([isDeleted]) // every "list" query filters on this — it needs an index
}
```

```ts
// ❌ DON'T — a real, permanent DELETE on a business entity
await prisma.order.delete({ where: { id } });

// ✅ DO — soft delete: mark it, don't remove it
await prisma.order.update({
  where: { id },
  data: { isDeleted: true, deletedAt: new Date(), deletedBy: currentUser.id },
});
```

Every query that lists or searches soft-deletable entities must filter out deleted rows explicitly — this is exactly the kind of "easy to forget once, and now deleted data quietly reappears" bug that needs a consistent, enforced pattern rather than remembering it ad hoc in every query:

```ts
// ✅ DO — a shared query helper/Prisma middleware ensures every read
// automatically excludes soft-deleted rows unless explicitly asked not to
async function findActiveOrders(tenantId: TenantId): Promise<Order[]> {
  return prisma.order.findMany({ where: { tenantId, isDeleted: false } });
}
```

Purely transient/junction/log-table data (e.g. a rate-limit counter, a short-lived session record) does not need this pattern — use judgment, but the default for anything a user would recognize as "a thing I created" is soft delete, always.

## Prisma client

Keep Prisma imports isolated to `packages/database` and the API app — never import Prisma types into mobile code, and never expose Prisma-generated types as the public API contract (map to the zod-derived domain type instead, per `02-backend-nestjs.md` and `05-contracts-zod-api.md`).

## Query efficiency — avoiding N+1

```ts
// ❌ DON'T — N+1: one query to get the list, then ONE ADDITIONAL QUERY
// PER ROW to get each order's customer. 100 orders = 101 queries.
const orders = await prisma.order.findMany();
for (const order of orders) {
  order.customer = await prisma.customer.findUnique({ where: { id: order.customerId } });
}

// ✅ DO — one query, relation loaded up front
const orders = await prisma.order.findMany({ include: { customer: true } });
```

Use explicit `select` when it materially reduces payload or clarifies intent. For list endpoints with per-row relations that can't be solved with a single `include` (e.g. aggregated counts from a different service), use a dataloader/batching pattern rather than a per-row query. Full checklist: `19-performance-and-scalability.md`.

## Migrations

Every schema change needs: a migration, a test/verification step, a deployment consideration (is this backward-compatible with the currently-deployed code? — see `13-ci-cd-and-quality-gates.md`'s expand/contract pattern), and a rollback/recovery plan for risky changes.

## Seed data — mandatory on every schema change

`packages/database/prisma/seed.ts` must be updated in the **same PR** as any migration that adds or changes a table or column:

```ts
// ❌ DON'T — a migration adds a required `taxRate` column to Order, but
// seed.ts still creates Order records without it. `prisma db seed` now
// fails for every developer and every CI run.

// ✅ DO — seed.ts updated in the same PR
await prisma.order.create({
  data: {
    id: FIXED_ORDER_ID_1, // deterministic, not a random UUID
    customerId: FIXED_CUSTOMER_ID_1,
    taxRate: 0.08, // the new required field, given a real value
    isDeleted: false,
  },
});
```

- A new required column needs a value supplied for every existing seed record that creates that model.
- A new table that other seeded entities relate to gets its own seed data, or an explicit comment explaining why it's intentionally left empty for now.
- Seed data stays deterministic: fixed IDs/UUIDs and fixed timestamps, not `Math.random()`/`new Date()` at seed time, so `prisma db seed` produces an identical local/test dataset on every run.
- Treat a migration PR that doesn't touch `seed.ts` when it should as equivalent to a migration PR with no migration file — flag it in review (`16-code-review-checklist.md`).

## Connection pooling

```text
❌ DON'T — let every NestJS instance (and every serverless function
   invocation, if any part of this stack runs serverless) create its own
   unbounded Prisma client with no connection limit, and no shared
   pooler in front of Postgres. Under real concurrent load, this exhausts
   Postgres's own max_connections and takes the database down for
   EVERYONE, not just the offending service.

✅ DO — run a connection pooler (PgBouncer, or the managed equivalent
   your Postgres provider offers) in front of the database in any
   environment with more than a trivial number of concurrent connections,
   and set Prisma's own connection_limit deliberately per service based
   on real capacity planning, not the default.
```

## Read replicas

If read replicas are introduced for scaling read-heavy workloads, be explicit and deliberate about which queries are allowed to read from a replica (tolerant of the replica's replication lag) versus which must read from the primary (anything that needs the absolute latest, just-written state — e.g. reading back a record immediately after writing it in the same request). Don't let this decision be made implicitly by whichever Prisma client instance happens to be injected — make it visible in the code (e.g. a distinctly-named `readReplicaPrisma` vs `primaryPrisma` provider) so a reviewer can see which guarantee a given query is relying on.

## JSON columns — used deliberately, not as an escape hatch from modeling

```ts
// ❌ DON'T — reach for a JSON column to avoid the work of properly
// modeling a relation, because it's faster to ship right now
model Order {
  id       String @id
  metadata Json   // contains: customer info, line items, discounts, shipping address, ALL as an unstructured blob
}
// this defeats indexing, foreign-key integrity, and query-ability for
// everything crammed into the blob, and re-introduces exactly the kind
// of untyped, unvalidated data 00-non-negotiables.md and
// 05-contracts-zod-api.md exist to prevent

// ✅ DO — model genuine relations as real columns/tables with real
// constraints. Reserve a JSON column for data that is GENUINELY
// unstructured/schema-less by nature (e.g. a flexible "custom fields"
// bag a customer configures themselves) — and even then, validate its
// shape through a zod schema at the application boundary before it's
// written, per 05-contracts-zod-api.md, rather than trusting whatever
// shape happens to be in the column.
model Order {
  id         String  @id
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
  customFields Json?  // genuinely user-defined, validated via a zod schema at the app layer
}
```

## Enum vs lookup table

```text
❌ DON'T reflexively reach for a Prisma `enum` for every closed set of
   values — an enum requires a MIGRATION to add a new value, which is
   fine for a truly stable set (order status: pending/shipped/delivered)
   but painful for a set that changes with some regularity (a growing
   list of supported currencies, or admin-configurable categories).

✅ DO use a Prisma enum for values that are part of the CODE's logic
   (something application code branches on, like order status — where a
   new value genuinely requires new code anyway, so a migration isn't
   extra friction). Use a real lookup TABLE (with a foreign key) for
   values that are more like DATA than code (a list of product
   categories an admin might want to add to without a deploy).
```

## Full-text search

For anything beyond a trivial `contains` filter, use Postgres's native full-text search (`tsvector`/`tsquery` with a `GIN` index) rather than layering `ILIKE '%term%'` filters, which cannot use a standard B-tree index and degrade to a full table scan as data grows (`19-performance-and-scalability.md`). For search needs beyond what Postgres full-text search comfortably handles (fuzzy matching at scale, faceted search, relevance tuning), that's a signal to bring in a dedicated search engine (e.g. Elasticsearch/Meilisearch) rather than forcing Postgres further — but that's a real infrastructure decision, worth its own ADR (`14-documentation.md`), not something to reach for by default.

## Database documentation via schema comments

```prisma
// ✅ DO — a non-obvious business rule embedded directly in the schema,
// where the next person touching this model will actually see it
model Order {
  /// Total INCLUDES tax and shipping. See OrderPricingService for the
  /// calculation. Do not read this field to get a pre-tax subtotal —
  /// use `subtotal` instead.
  total Decimal
  subtotal Decimal
}
```

Prisma schema comments (`///`) are exported into the generated client's TypeScript types as JSDoc, so this documentation shows up directly in editor autocomplete/hover — a uniquely high-leverage place to put a gotcha a future developer needs to know, right where they'll actually see it.

## Decimal vs Float for money

```prisma
// ❌ DON'T — floating-point for money. Floating-point arithmetic has
// well-documented rounding errors (0.1 + 0.2 !== 0.3 in IEEE 754) that
// are unacceptable for financial values.
model Order {
  total Float
}

// ✅ DO — Prisma's Decimal type, backed by Postgres's NUMERIC, for any
// monetary value
model Order {
  total Decimal @db.Decimal(10, 2)
}
```

## Composite unique constraints

```prisma
// ❌ DON'T — enforce "one vote per user per poll" purely in application
// code with a check-then-act pattern, which is exactly the race
// condition this document already warns about above
model Vote {
  id     String @id
  userId String
  pollId String
}

// ✅ DO — a composite unique constraint makes the invariant
// database-enforced and race-condition-proof, matching this document's
// earlier "let the database enforce it atomically" guidance
model Vote {
  id     String @id
  userId String
  pollId String

  @@unique([userId, pollId])
}
```

## Cascading delete behavior — decided explicitly, never left as an accident

```prisma
// ❌ DON'T — leave onDelete behavior at Prisma's default (which
// requires you to handle the referenced row manually, or which — if
// misconfigured — can cascade-delete far more than intended) without a
// deliberate decision per relation
model OrderItem {
  orderId String
  order   Order @relation(fields: [orderId], references: [id])
}

// ✅ DO — an explicit decision, matching the business rule: deleting an
// order SHOULD cascade to its line items (they have no independent
// existence), but should NOT cascade to the customer record (a customer
// obviously outlives any one of their orders)
model OrderItem {
  orderId String
  order   Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
model Order {
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
}
```

Remember this project's mandatory soft-delete convention (above): a hard `onDelete: Cascade` at the database level only ever fires when a row is ACTUALLY hard-deleted — which, per this document, should essentially never happen for a business entity. Configure cascade behavior correctly anyway, as defense-in-depth for the rare legitimate hard-delete path (e.g. a retention-expiry purge job under Malaysia's PDPA retention principle, covered in `10-security-auth-authorization.md`'s PII section) — don't leave it undefined just because the normal application path uses soft delete.

## Prisma middleware/extensions for cross-cutting concerns

```ts
// ✅ DO — use a Prisma Client Extension to enforce the soft-delete
// filtering convention (already required by this document) AUTOMATICALLY,
// rather than trusting every individual query to remember `isDeleted: false`
const prisma = new PrismaClient().$extends({
  query: {
    order: {
      async findMany({ args, query }) {
        args.where = { ...args.where, isDeleted: false };
        return query(args);
      },
    },
  },
});
```

This is exactly the kind of narrow, high-value, genuinely-reusable abstraction `00-non-negotiables.md` and `21-oop-and-solid-principles.md` endorse — it removes an entire category of "forgot to filter deleted rows" bugs at the source, for every query, without anyone needing to remember it per call site. Provide an explicit, clearly-named escape hatch (e.g. a separate `prismaIncludingDeleted` client) for the rare legitimate case that needs to see soft-deleted rows (an admin "restore" feature), rather than working around the extension ad hoc.

## Database backup and restore

Automated backups (point-in-time recovery where the provider supports it) are a baseline operational requirement, not an afterthought — and a backup that has never been test-restored is not a verified backup, it's an assumption. Periodically verify the restore process actually works end to end (this belongs in a runbook, `14-documentation.md`), because the worst time to discover a backup is corrupt or incomplete is during a real incident that needs it.

## A full worked race-condition scenario, start to finish

To make the abstract "race condition" danger fully concrete: imagine a flash-sale feature where 500 users simultaneously try to buy the last 10 units of a product the moment a sale goes live.

```text
❌ DON'T — the naive implementation:
   1. Read current stock (e.g. 10).
   2. Check if requested quantity (1) <= stock (10). Yes.
   3. Write stock - 1 = 9.

   Under 500 truly concurrent requests, a large number of them can all
   complete step 1 (reading stock=10) BEFORE any of them reach step 3.
   Every one of those requests independently "sees" enough stock and
   proceeds — resulting in far more than 10 successful purchases against
   only 10 actual units, and a negative or wildly incorrect final stock
   count. This is not a hypothetical — this exact bug pattern is one of
   the most common real-world causes of overselling in e-commerce systems.

✅ DO — per this document's race-condition guidance above, the atomic
   conditional update pattern closes this completely:
   UPDATE inventory SET stock = stock - 1 WHERE sku = ? AND stock >= 1
   Each of the 500 concurrent requests either successfully decrements
   (if stock was still available at the exact moment ITS update ran) or
   the WHERE clause fails to match (stock already at 0) and the query
   affects zero rows — checked via Prisma's updateMany() result count,
   exactly as shown in this document's earlier example. The database's
   own row-level locking during the UPDATE makes this genuinely atomic
   — there is no window where two concurrent requests can both "see"
   the same stock value and both proceed incorrectly, because the
   check and the write are the SAME database operation, not two
   separate steps with a gap between them.
```

This is the single most important pattern in this entire document to internalize deeply, because it's the exact shape of bug that: passes code review easily (the naive version reads as obviously correct), never shows up in local development (one request at a time, no concurrency), never shows up in a typical staging smoke test (low traffic), and then causes a real, embarrassing, costly incident the first time real concurrent load hits it in production — often during exactly the highest-stakes moment (a launch, a sale) when the business most needed it to work.

## Query timeout configuration

```text
❌ DON'T — leave database queries with no explicit statement timeout, so
   a single pathological query (an accidental unbounded join, a query
   against a table that's missing an index it needs) can run
   indefinitely, holding a connection and potentially locks the whole time.

✅ DO — configure a sensible statement timeout (at the connection-pool
   or database level) so a runaway query fails fast and visibly rather
   than silently consuming a connection slot forever — this is a
   concrete instance of 12-observability-and-operations.md's "never let
   a dependency hang a request indefinitely" resilience principle,
   applied at the database layer specifically.
```

## Row-Level Security — a concrete example

```sql
-- Enable RLS and force it even for the table owner
ALTER TABLE "Reward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reward" FORCE ROW LEVEL SECURITY;

-- Policy: a session may only see/modify rows for its own organization
CREATE POLICY reward_org_isolation ON "Reward"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
```

```ts
// Set the tenant context per request/transaction — NEVER from client input,
// always from the authenticated session
await this.prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_org_id', ${user.organizationId}, true)`; // true = local to this transaction
  return tx.reward.findMany({ where: { isDeleted: false } });
});
```

```text
❌ DON'T set the session variable on a pooled connection with is_local=false —
   with PgBouncer in transaction-pooling mode, the setting can leak to the
   NEXT request that receives that connection: a cross-tenant data leak.
✅ DO use transaction-local settings (set_config(..., true)) inside an explicit
   transaction, and test the DENIED case: a session with org A must get zero
   rows for org B, and a session with NO org set must get zero rows at all.
```

RLS remains defense-in-depth: the application still filters by `organizationId` explicitly (so the tenant boundary is visible in code and RLS is the safety net when someone forgets).

## Migration safety patterns

```text
❌ Adding a NOT NULL column with no default to a large table
   (locks/fails on existing rows).
✅ Expand/contract: add nullable → backfill in batches → add NOT NULL
   constraint in a later migration once every row is populated.

❌ CREATE INDEX on a big production table inside a normal migration
   (blocks writes).
✅ CREATE INDEX CONCURRENTLY (Prisma: hand-edit the migration SQL,
   and note why in a comment — this is a documented, reviewed exception
   to "never hand-edit migrations", applied BEFORE the migration is applied).

❌ Renaming a column in one step.
✅ Add new → dual-write → backfill → switch reads → drop old (13's expand/contract).

❌ Dropping a column/table the same release that stops using it.
✅ Stop using it → deploy → wait a full release cycle (rollback safety) → drop.
```

## Backfills

A backfill is production code: it is idempotent (safe to re-run), batched (bounded transaction size), resumable (records progress), observable (logs progress and rate), and tested against realistic volume. It lives in `tools/scripts` or a migration-adjacent job and is documented in a runbook. A one-off `UPDATE` pasted into a production console is exactly the "hack" `15-feature-development-process.md` forbids.

```ts
export async function backfillRewardVersions(prisma: PrismaService, batchSize: number): Promise<void> {
  let processed = 0;
  for (;;) {
    const batch = await prisma.reward.findMany({ where: { version: { equals: null } }, select: { id: true }, take: batchSize });
    if (batch.length === 0) break;
    await prisma.reward.updateMany({ where: { id: { in: batch.map((r) => r.id) } }, data: { version: 0 } });
    processed += batch.length;
    logger.info({ event: 'backfill.progress', name: 'reward-version', processed });
  }
}
```

## Database do / don't quick pairs

```text
❌ Storing derived totals without a source of truth          ✅ Store facts; derive totals (or store with a reconciliation check)
❌ Nullable columns "just in case"                            ✅ NOT NULL by default; nullable only when absence is meaningful
❌ Free-text status columns                                   ✅ enum / lookup table with constraints
❌ Timestamps as strings / local time                         ✅ timestamptz (UTC)
❌ Business logic in triggers nobody remembers                ✅ constraints in the DB; logic in code (documented)
❌ Storing files/blobs in Postgres rows                       ✅ object storage + key reference
❌ Sequential integer IDs exposed publicly                    ✅ UUIDs (still authorize — unguessable ≠ authorized)
❌ Ad-hoc SQL against production                              ✅ reviewed migration/backfill scripts with a runbook
❌ Testing against SQLite when production is Postgres         ✅ test against Postgres (Testcontainers)
```

## Tenant-scoped uniqueness

```prisma
// ❌ globally unique slug — two organizations cannot both have "summer-sale"
model Campaign { slug String @unique }
// ✅ unique within the tenant
model Campaign { organizationId String  slug String  @@unique([organizationId, slug]) }
```

If soft delete exists, decide explicitly whether a soft-deleted row still occupies the unique key (usually: use a partial unique index `WHERE "isDeleted" = false`) and document it.
