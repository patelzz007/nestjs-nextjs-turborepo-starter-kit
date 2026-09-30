# 11 — Testing Standards — Vitest

## Tests are non-negotiable — including for "simple" functions

There is no function too small or too obvious to test. This is stated explicitly because "it's trivial, it doesn't need a test" is one of the most common and most expensive rationalizations in software — the functions everyone considers too simple to break are exactly the ones that get modified carelessly later, precisely *because* nobody thinks they need to be careful.

```ts
// ❌ DON'T reason: "this is a one-line function, testing it is a waste of time"
export function calculateDiscount(price: number, percent: number): number {
  return price - price * (percent / 100);
}
// six months later, someone "simplifies" this to price * (1 - percent) and
// silently breaks every caller that passes percent as 10 instead of 0.10
// — with no test to catch it.

// ✅ DO — even a one-line function gets a test. It costs almost nothing
// to write and it's exactly what catches the "simplification" above.
describe('calculateDiscount', () => {
  it('subtracts the percentage discount from the price', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });
  it('returns the full price when the discount is 0', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });
});
```

A PR that adds new logic — of any size — without a corresponding test is incomplete, full stop. This applies equally to a new utility function, a new zod schema refinement, a new policy check, and a new endpoint. See `18-definition-of-done.md`.

## Test pyramid

```text
        E2E / system
       /            \
 integration       contract
      /               \
           unit
```

Most business logic should live in fast unit tests, not at the top of the pyramid — a test suite that's mostly slow E2E tests is expensive to run, slow to give feedback, and hard to debug when it fails (you often can't tell *which* layer broke).

## Unit tests

Test domain rules, transformations, policies, validation, pure functions, and application services with mocked ports. Don't test framework internals (Nest's DI container working correctly is not your test's job — trust the framework for that).

```ts
// ❌ DON'T — a test that doesn't actually test the business rule, just
// confirms the mock was called (this passes even if the underlying logic
// is completely wrong)
it('calls the repository', async () => {
  const repo = { save: vi.fn() };
  const service = new OrdersService(repo);
  await service.create(validDto);
  expect(repo.save).toHaveBeenCalled(); // ...called with WHAT? this proves almost nothing
});

// ✅ DO — asserts on the actual behavior/outcome that matters
it('rejects placing an order when the customer is suspended', async () => {
  const repo = createMockOrdersRepository();
  const customers = createMockCustomersRepository({ status: 'suspended' });
  const service = new OrdersService(repo, customers, new OrderEligibilityPolicy());
  await expect(service.create(validDto, suspendedCustomerId)).rejects.toThrow(CustomerSuspendedError);
  expect(repo.save).not.toHaveBeenCalled(); // and confirms the SIDE EFFECT that matters didn't happen
});
```

## Integration tests

Use for Prisma repositories, database constraints, transaction behavior, messaging adapters, and authentication/authorization boundaries — run against real (test-scoped) infrastructure via Testcontainers where feasible, not a fully mocked client, so schema drift and query bugs are actually caught.

```ts
// ❌ DON'T — mocking Prisma so heavily that the test can't catch a real
// schema mismatch, a missing index causing a slow query, or a broken
// unique constraint
it('creates an order', async () => {
  const mockPrisma = { order: { create: vi.fn().mockResolvedValue(fakeOrder) } };
  // this test passes even if the real database schema no longer matches `fakeOrder`'s shape

// ✅ DO — a real (test-scoped, via Testcontainers) Postgres instance,
// exercising the actual Prisma client and the actual schema
it('rejects a duplicate promo code at the database level', async () => {
  await prisma.promoRedemption.create({ data: { code: 'SAVE10', userId: user1.id } });
  await expect(
    prisma.promoRedemption.create({ data: { code: 'SAVE10', userId: user2.id } }),
  ).rejects.toThrow(); // the UNIQUE CONSTRAINT actually fires — this can only be caught against a real DB
});
```

## Contract tests

Test API schemas and message schemas directly — valid input succeeds, invalid input fails, required fields are enforced, response shape stays stable (`05-contracts-zod-api.md`).

## Security tests

For every authorization rule, test: the allowed case, the denied case, the wrong-tenant case, the wrong-role case, the wrong-relationship (ReBAC) case, and the missing-authentication case.

```ts
// ❌ DON'T — only the happy path is tested; the permission check itself
// is never actually verified to DENY anything
it('allows an admin to publish a reward', async () => { ... }); // that's it — no denial test at all

// ✅ DO — every meaningfully different authorization outcome is tested
describe('publish reward authorization', () => {
  it('allows a user with REWARD.PUBLISH permission', async () => { ... });
  it('denies a user without REWARD.PUBLISH permission', async () => { ... });
  it('denies a user from a different tenant, even with the permission', async () => { ... });
  it('denies an unauthenticated request', async () => { ... });
});
```

A permission check with only a happy-path test is, in a meaningful sense, unverified — you've proven it doesn't break the allowed case, but you've proven nothing about whether it actually blocks anything.

## Async tests

Test successful processing, duplicate delivery, retryable error, permanent error, the dead-letter path, and idempotency specifically for anything payment-related (`09-messaging-and-jobs.md`).

```ts
it('does not send a second confirmation email when the same event is delivered twice', async () => {
  await handleOrderShipped(shippedEvent);
  await handleOrderShipped(shippedEvent); // simulate at-least-once redelivery
  expect(emailProvider.send).toHaveBeenCalledTimes(1); // not 2
});
```

## Database tests

Verify unique constraints, foreign keys, transaction rollback, tenant isolation, and RLS policies where enabled.

## UI tests

Test behavior, not implementation details:

```tsx
// ❌ DON'T
it('renders 7 div elements', () => {
  const { container } = render(<OrdersTable rows={mockRows} />);
  expect(container.querySelectorAll('div')).toHaveLength(7); // meaningless, breaks on any unrelated markup change
});

// ✅ DO
it('shows an empty state when there are no orders', () => {
  render(<OrdersTable rows={[]} />);
  expect(screen.getByText('No orders yet')).toBeInTheDocument();
});
it('calls onRowClick with the clicked order when a row is clicked', async () => {
  const onRowClick = vi.fn();
  render(<OrdersTable rows={[mockOrder]} onRowClick={onRowClick} />);
  await userEvent.click(screen.getByText(mockOrder.id));
  expect(onRowClick).toHaveBeenCalledWith(mockOrder);
});
```

## Test naming

A test name should explain the behavior under test in a sentence a non-programmer could roughly follow: `should reject publishing a reward when the user lacks permission`, not `test1` or `works`.

## Avoid flaky tests

Don't rely on real (uncontrolled) time, random uncontrolled IDs, network availability, execution ordering, or shared mutable global state between tests.

```ts
// ❌ DON'T
it('marks an order as expired after 30 minutes', async () => {
  await new Promise((r) => setTimeout(r, 30 * 60 * 1000)); // the test suite now takes 30 real minutes, and is fragile to timing drift
});

// ✅ DO — control time explicitly
it('marks an order as expired after 30 minutes', () => {
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  const order = createOrder();
  vi.setSystemTime(new Date('2026-01-01T00:31:00Z'));
  expect(isExpired(order)).toBe(true);
});
```

## Test data — factories/builders, not copy-pasted fixtures

```ts
// ❌ DON'T — a giant, hand-written fixture object copy-pasted into every
// test file that needs "an order," with each copy slightly diverging
// over time as different tests tweak different fields
const testOrder = { id: '123', status: 'pending', customerId: 'abc', total: 100, items: [...], createdAt: new Date('2024-01-01'), /* 15 more fields */ };
// used, copy-pasted with minor edits, in 40 different test files

// ✅ DO — a builder/factory function with sensible defaults, letting
// each test override only what it actually cares about
function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    customerId: crypto.randomUUID(),
    total: 100,
    items: [],
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}
// in a test:
const suspendedCustomerOrder = buildOrder({ status: 'cancelled' }); // only the relevant field is visible, everything else is a sensible, irrelevant default
```

This makes tests easier to write (less boilerplate), easier to read (the override tells you exactly what's relevant to THIS test), and easier to maintain (a new required field on `Order` means updating the builder once, not forty fixture objects).

## Snapshot testing — use sparingly, and know why

```text
❌ DON'T — reach for `expect(x).toMatchSnapshot()` as a default way to
   test a component or a complex object, because it's less work to write
   than real assertions. A snapshot test doesn't encode WHAT should be
   true — it just freezes whatever the output happened to be at the
   moment the snapshot was recorded, and gets "fixed" by a developer
   reflexively running --update-snapshots without actually reading the
   diff, the moment it fails.

✅ DO — write explicit assertions about the specific behavior that
   matters (11's core UI testing guidance above). Reserve snapshot
   testing for the narrow cases where a snapshot's blunt "did ANYTHING
   change" signal is genuinely the right tool — e.g. guarding a
   generated output format (an OpenAPI spec, a compiled config file)
   against unintended changes, where a human reviewing every snapshot
   diff in a PR is a deliberate, expected part of the review process,
   not something anyone will thoughtlessly auto-approve.
```

## Mocking strategy

```text
❌ DON'T mock everything by default "to keep tests fast and isolated" —
   over-mocking produces tests that pass even when the real integration
   between two pieces is broken, because the mock silently papers over
   exactly the boundary that broke.

✅ DO mock deliberately, at the boundary that's appropriate for the
   test's LAYER (11's test pyramid above): a unit test mocks out the
   repository/external dependency so it's testing ONLY the business
   logic in isolation; an integration test does NOT mock the database —
   that's the entire point of an integration test.
```

A useful check: if you're mocking something in what's meant to be an integration test, ask why it isn't a unit test instead — and if you're NOT mocking anything in what's meant to be a fast unit test, ask whether it's secretly an integration test wearing the wrong label (and probably running too slowly as a result).

## Testing custom hooks

```tsx
// ✅ DO — test a custom hook's behavior via @testing-library/react's
// renderHook, asserting on its returned state/behavior directly, not by
// indirectly rendering some unrelated component that happens to use it
const { result } = renderHook(() => useDebounce('initial', 300));
expect(result.current).toBe('initial');
act(() => { vi.advanceTimersByTime(300); });
expect(result.current).toBe('initial'); // unchanged since the input never changed
```

## Testing Zustand stores

```ts
// ✅ DO — test a store's actions and resulting state directly, without
// needing to render any component at all
describe('useOrdersUiStore', () => {
  it('toggles the filter panel', () => {
    const store = createOrdersUiStore(); // a fresh instance per test — see 06's SSR guidance on store factories
    expect(store.getState().isFilterPanelOpen).toBe(false);
    store.getState().toggleFilterPanel();
    expect(store.getState().isFilterPanelOpen).toBe(true);
  });
});
```

## Coverage targets — a floor, not a goal in itself

A coverage percentage is a useful floor to catch obviously-untested code, not a target to optimize for its own sake — 100% coverage with weak assertions (tests that execute a line without actually checking its behavior) is worse than useful because it creates false confidence. Set a sensible minimum threshold enforced in CI (e.g. business-logic-heavy packages held to a higher bar than UI packages, per this document's coverage guidance), and treat a coverage number that's technically high but backed by weak tests as its own kind of review finding, not a pass.

## End-to-end testing

Unit and integration tests (the bulk of this document's guidance) verify pieces in isolation or near-isolation; a small number of true end-to-end tests (via Playwright or the project's chosen E2E tool), covering only the handful of genuinely critical user journeys (sign up, place an order, complete checkout), verify that the WHOLE assembled system — real browser, real frontend, real API, real database — actually works together. Keep this suite deliberately small and focused on what truly matters: E2E tests are slow, comparatively expensive to maintain, and prone to flakiness (per the pyramid shape described earlier in this document) — they are not where the bulk of coverage should live, but the handful that exist are what catch the class of bug that only shows up from real integration across every layer at once.

```text
❌ DON'T — try to E2E-test every edge case and validation rule; that's
   what the unit/integration/contract layers below it are for, and doing
   it at the E2E layer instead makes the suite slow and brittle for no
   corresponding benefit.

✅ DO — E2E-test the critical path start to finish, and lean on the
   lower, faster layers for exhaustive edge-case coverage.
```

## Visual regression testing

For a design system/component library (`packages/ui`) where a subtle, unintended visual change (a shifted padding, a wrong color token) is a real, recurring risk, visual regression testing (screenshot-diffing tooling, e.g. Chromatic or a Playwright-based equivalent) catches exactly the class of bug that behavioral tests (which don't look at pixels) cannot. Use it specifically for shared, widely-reused UI primitives where a regression has broad blast radius — not as a blanket requirement for every one-off feature-specific component, where the maintenance cost of reviewing screenshot diffs outweighs the benefit.

## Test environment setup and teardown — isolation between tests

```ts
// ❌ DON'T — tests that share mutable state (a module-level array, a
// shared test-database row) with no cleanup between them, so test
// order suddenly matters and a failure in one test can cause a
// confusing, unrelated-looking failure in a LATER test
let sharedOrders: Order[] = [];
it('creates an order', () => { sharedOrders.push(newOrder); expect(sharedOrders).toHaveLength(1); });
it('creates another order', () => { sharedOrders.push(anotherOrder); expect(sharedOrders).toHaveLength(1); }); // fails, or passes, depending on execution order — a flaky test by construction

// ✅ DO — every test starts from a clean, known state; for integration
// tests against a real database, wrap each test in a transaction that's
// rolled back afterward (or truncate/reseed between tests), so tests
// can run in ANY order, including fully in parallel, with identical results
beforeEach(async () => { await resetTestDatabase(); });
```

## Testing async/scheduled behavior deterministically

Covered briefly above (avoid real uncontrolled time) — worth restating with the explicit connection to this project's async infrastructure: a BullMQ processor's retry/backoff behavior, a Kafka consumer's redelivery handling, and a scheduled job's trigger timing should all be tested with fake timers / a controlled clock, never by actually waiting out a real delay in the test suite. A test suite that takes real wall-clock minutes to run because of un-mocked delays will, predictably, train developers to run it less often — which defeats the entire purpose of having fast, cheap feedback from tests in the first place.

## Testing error paths as rigorously as success paths

```ts
// ❌ DON'T — a test suite that's 90% happy-path coverage and treats
// error handling as an afterthought, tested (if at all) with one vague
// "it throws" assertion
it('handles errors', async () => {
  await expect(service.charge(invalidInput)).rejects.toThrow(); // throws WHAT, exactly? any error at all would pass this
});

// ✅ DO — assert on the SPECIFIC error, so a future change that
// accidentally starts throwing a DIFFERENT, wrong error is caught
it('throws InsufficientFundsError when the account balance is too low', async () => {
  await expect(service.charge(lowBalanceAccount, largeAmount)).rejects.toThrow(InsufficientFundsError);
});
it('does not modify the account balance when the charge fails', async () => {
  await expect(service.charge(lowBalanceAccount, largeAmount)).rejects.toThrow();
  const account = await repository.findById(lowBalanceAccount.id);
  expect(account.balance).toBe(lowBalanceAccount.balance); // confirms the failed charge had NO partial side effect
});
```

## Property-based / fuzz testing for critical logic

For genuinely critical, math-heavy, or invariant-sensitive logic (pricing calculations, anything financial, anything with a real correctness invariant like "the sum of line items must always equal the total"), consider property-based testing (e.g. via `fast-check`) alongside example-based tests — rather than hand-picking a handful of example inputs, a property-based test generates a large number of random/edge-case inputs and asserts an invariant holds for ALL of them, which catches edge cases a human wouldn't have thought to write by hand.

```ts
// ✅ DO — for the specific, high-value case of a core invariant
import fc from 'fast-check';
it('order total always equals the sum of its line items', () => {
  fc.assert(
    fc.property(fc.array(lineItemArbitrary), (items) => {
      const order = buildOrderFromItems(items);
      expect(order.total).toBe(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
    }),
  );
});
```

This is a targeted tool for the specific cases where it earns its complexity (per this document's own recurring theme: use a powerful tool where the problem genuinely calls for it, not everywhere by default) — not a blanket replacement for the example-based tests that make up the bulk of this document's guidance.

## Testing middleware and interceptors in isolation

```ts
// ✅ DO — test a NestJS interceptor/middleware (e.g. the audit-log
// interceptor from 10-security-auth-authorization.md) directly, with a
// mocked ExecutionContext, rather than only ever exercising it
// indirectly through a full end-to-end request — this makes it possible
// to test its edge cases (what happens if the handler throws? what
// happens if request.user is unexpectedly missing?) precisely and fast
it('records a failed request with the correct status code', async () => {
  const context = createMockExecutionContext({ user: mockUser });
  const next = { handle: () => throwError(() => new ForbiddenException()) };
  await firstValueFrom(interceptor.intercept(context, next)).catch(() => {});
  expect(auditLogService.write).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 403 }));
});
```

## Test file template

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CancelOrderService', () => {
  let repository: FakeOrdersRepository;
  let events: FakeEventPublisher;
  let service: CancelOrderService;

  beforeEach(() => {
    repository = new FakeOrdersRepository();      // fresh state per test
    events = new FakeEventPublisher();
    service = new CancelOrderService(repository, new OrderCancellationPolicy(), events);
  });

  describe('when the order is cancellable', () => {
    it('marks the order cancelled and records the reason', async (): Promise<void> => { /* arrange / act / assert */ });
    it('publishes exactly one order.cancelled event', async (): Promise<void> => { /* ... */ });
  });

  describe('when the order is not cancellable', () => {
    const NON_CANCELLABLE_STATUSES: [OrderStatus, OrderStatus] = ['delivered', 'cancelled'];
    it.each(NON_CANCELLABLE_STATUSES)('rejects a %s order', async (status: OrderStatus): Promise<void> => { /* ... */ });
  });

  describe('authorization boundaries', () => {
    it('does not reveal or modify an order from another organization', async (): Promise<void> => { /* ... */ });
  });
});
```

Prefer hand-written **fakes** (small in-memory implementations of the interface) over deeply nested mock chains: fakes exercise real behavior, survive refactors, and read like documentation. Use `vi.fn()` for simple call assertions, not for reimplementing a repository.

## What to test for each kind of code

| Code | Must-have tests |
|---|---|
| Pure function / util | typical, boundary, empty, invalid, and (for math) property-based invariants |
| Zod schema | valid, each invalid rule, each bound edge, unknown-key behavior |
| Domain policy | every branch and every rejection reason |
| Application service | happy path, each policy rejection, dependency failure, absence of side effects on failure, event emission |
| Repository (integration) | real DB: constraints, tenant scoping, soft-delete filtering, race condition (parallel calls), rollback |
| Controller / guard | 401, 403, wrong-tenant, validation 400, happy path, audit entry |
| Consumer / processor | success, duplicate delivery, transient failure → retry, permanent failure → dead letter |
| React dumb component | each variant/size/state, event callbacks, loading/empty/error, keyboard, a11y name |
| Smart component / hook | data → props mapping, mutation success/error, URL state |
| Zustand store | each action, derived selectors, fresh instance per test |

## Concurrency test — proving the race is closed

```ts
it('sells at most the available stock when many buyers race', async (): Promise<void> => {
  await seedStock({ sku: 'SKU-1', quantity: 10 });
  type Outcome = 'ok' | 'rejected';
  const attempts = Array.from({ length: 50 }, (): Promise<Outcome> => purchase('SKU-1', 1).then((): Outcome => 'ok', (): Outcome => 'rejected'));
  const results = await Promise.all(attempts);
  expect(results.filter((r) => r === 'ok')).toHaveLength(10);
  expect(await readStock('SKU-1')).toBe(0);            // never negative
});
```

If you wrote race-sensitive code and can't write this test, you don't yet know it is safe.
