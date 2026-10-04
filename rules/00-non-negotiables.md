# 00 — Non-Negotiable TypeScript & Code Rules

If you read nothing else in this repository before writing code, read this file. Every other document in `rules/` assumes you already follow everything here. Violating a rule in this file is treated the same as code that fails to compile — it does not matter how urgent the task is, how small the change looks, or how confident you are that "just this once" is fine.

This document exists because of a simple, repeated failure pattern in codebases that don't have it written down: a developer under time pressure reaches for `any` "temporarily," a cast "just to get the build green," or a `typeof` check "because it's faster than writing a schema" — and six months later, twenty other places in the codebase have copied that shortcut, and nobody can tell anymore which parts of the type system are actually trustworthy. The rules below exist to make the type system something you can *trust completely*, so that when the compiler says a value is a `User`, it actually is one, everywhere, always.

## Why this matters more here than in a typical project

This is a multi-app monorepo (API, web, mobile) sharing contracts across all three. A silent type-safety gap in one app doesn't stay contained — because `packages/contracts` schemas are shared, a loosened type in the API can quietly propagate into the web app's assumptions, and from there into what a junior developer believes is "safe" to build on top of. Strictness at the boundaries is what lets three separate apps, built by people who don't all talk to each other every day, stay in sync without constant manual coordination.

## Forbidden constructs

```ts
any
unknown
never          // except exhaustiveness checks — see below, this is the ONE exception
z.any()
z.unknown()
z.never()

value as SomeType
value as const
```

These are forbidden **everywhere** — application code, test code, scripts, seed files, migration helpers, one-off tooling scripts under `tools/`. There is no "it's just a script, it doesn't matter" exception. Scripts get copy-pasted into real code more often than anyone expects.

### Why `any` is banned, not just discouraged

`any` doesn't just mean "I don't know the type" — it means "turn off type checking for this value, and for everything downstream that touches it." A single `any` at the top of a function can silently disable type checking for every line below it that uses that value, and the compiler will not warn you. This is different from every other TypeScript escape hatch, which is why it gets the strongest possible ban.

```ts
// ❌ DON'T — one `any` poisons everything downstream
function processOrder(payload: any) {
  const total = payload.total * 1.1;       // no error, even if `total` doesn't exist
  const email = payload.customer.emial;     // typo — no error, silently undefined at runtime
  return { total, email };
}

// ✅ DO — the shape is explicit, typos are caught at compile time
function processOrder(payload: Order): OrderSummary {
  const total = payload.total * 1.1;
  const email = payload.customer.email;
  return { total, email };
}
```

### Why `unknown` is also banned, not treated as "the safe version of `any`"

In general TypeScript guidance, `unknown` is often recommended as the safe alternative to `any`, because you're forced to narrow it before use. In this codebase, we go one step further: **the narrowing itself must happen through a zod schema**, not through ad hoc `typeof`/`in` checks. Allowing bare `unknown` as a resting type in function signatures creates the same problem as `any` one level removed — it becomes tempting to narrow it carelessly at the call site instead of at the actual boundary where the data entered the system.

```ts
// ❌ DON'T — unknown "resting" in a function signature, narrowed carelessly later
function handleWebhook(payload: unknown): void {
  const body = payload as { type: string; data: object }; // right back to a cast
  ...
}

// ✅ DO — parse immediately at the boundary, unknown never leaves this line
function handleWebhook(rawPayload: unknown): void {
  const payload = WebhookPayloadSchema.parse(rawPayload); // now fully typed, validated
  ...
}
```

Note the one place `unknown` is unavoidable and acceptable: the very edge of a boundary function's *input* parameter, where data has not yet been validated (as in the "DO" example above) — immediately followed by a `.parse()`/`.safeParse()` call on the same or next line. It should never persist past that point, and it should never appear as a type used inside business logic.

### The one sanctioned use of `never`

Exhaustiveness checking at the end of a discriminated-union `switch` — nowhere else:

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

type PaymentState =
  | { status: 'pending' }
  | { status: 'succeeded'; chargeId: string }
  | { status: 'failed'; reason: string };

function describe(state: PaymentState): string {
  switch (state.status) {
    case 'pending': return 'Payment is pending';
    case 'succeeded': return `Payment succeeded: ${state.chargeId}`;
    case 'failed': return `Payment failed: ${state.reason}`;
    default: return assertNever(state); // if a new status is ever added, THIS LINE fails to compile
  }
}
```

This is valuable precisely because it's rare: the moment someone adds a fourth `PaymentState` variant and forgets to handle it here, the build breaks instead of silently falling through. That safety only works if `never` is reserved for this exact pattern — if it's scattered elsewhere as a "todo" type or a lazy placeholder, the compiler can no longer tell you which `never` usages are load-bearing.

```ts
// ❌ DON'T — `never` used as a "this shouldn't happen" placeholder, not exhaustiveness checking
function getDiscount(tier: string): never | number {
  if (tier === 'gold') return 10;
  // "it should never be anything else" — but this isn't enforced by the compiler at all
}
```

### Why casting (`as`) and `as const` are banned

A cast is you telling the compiler "trust me," which is exactly the situation where the compiler is most likely to be right and you're most likely to be wrong — if you needed to cast, it's because the type you had didn't match the type you wanted, and casting doesn't fix that, it just hides it.

```ts
// ❌ DON'T
const user = rawResponse as User;             // rawResponse might not actually be a User
const config = { retries: 3, timeout: 5000 } as const;

// ✅ DO — validate, don't assert
const user = UserSchema.parse(rawResponse);   // throws if it isn't actually a User

// ✅ DO — typed tuple instead of `as const`
const RETRY_CONFIG: readonly [retries: number, timeoutMs: number] = [3, 5000];
```

If a tuple is what you need, type it as a tuple explicitly with the exact arity required — this preserves the "exactly N elements" guarantee that `as const` gives you, without the cast:

```ts
// ❌ DON'T
const ACTIONS = [Action.CREATE, Action.READ, Action.UPDATE] as const;

// ✅ DO
const ACTIONS: [Action, Action, Action] = [
  Action.CREATE,
  Action.READ,
  Action.UPDATE,
];
```

### The narrow, documented exception: `satisfies`

`satisfies` is allowed, and is not the same thing as `as`. `as` overrides the compiler's inferred type with a type you assert (and the compiler stops checking whether that assertion is true). `satisfies` checks that a value is *assignable to* a type, without changing the value's inferred type or lying about its shape — it's a validation, not an override.

```ts
// ✅ DO — satisfies checks the shape without widening or lying about it
const defaultValues = {
  customerId: '',
  items: [],
} satisfies Partial<CreateOrderDto>;
```

### Non-null assertion (`!`) — also a lint error

`!` is rejected by `@typescript-eslint/no-non-null-assertion` (set to `error`), and because the completion gate requires `pnpm run lint` to pass with zero errors and zero warnings, it cannot ship. Narrow instead:

```ts
// ❌ DON'T — lies to the compiler; fails lint
function getFirst(items: string[]): string {
  return items[0]!;
}

// ✅ DO — make absence part of the type
function getFirst(items: readonly string[]): string | undefined {
  return items.at(0);
}

// ✅ DO — or fail loudly with a typed error
function getFirstOrThrow(items: readonly string[]): string {
  const first = items.at(0);
  if (first === undefined) throw new EmptyListError();
  return first;
}
```

## Zod is the runtime contract — not just "a validation library we use sometimes"

Every boundary where data enters the system from outside your currently-executing function — HTTP request body/query/params/headers, webhook payloads, Kafka/RabbitMQ/BullMQ message payloads, environment variables, `JSON.parse()` output, a third-party API's response — is validated through a zod schema before that data is treated as trustworthy application data.

```ts
const UserIdSchema = z.uuid();
type UserId = z.infer<typeof UserIdSchema>;
```

### Do not hand-duplicate a schema's shape as a separate interface

```ts
// ❌ DON'T — two separate definitions of "what a User is," which WILL drift over time
interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}
const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(['admin', 'editor', 'viewer']),
});

// ✅ DO — one definition, the type is derived
const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(['admin', 'editor', 'viewer']),
});
type User = z.infer<typeof UserSchema>;
```

The failure mode the "DON'T" example invites is subtle and easy to miss in review: someone adds a field to `UserSchema` for a new feature, the runtime validation now accepts it, but the hand-written `interface User` doesn't have it — so TypeScript won't let you *use* the field anywhere, even though it's genuinely present at runtime. Or worse, the reverse: someone adds a field to the `interface` but not the schema, so the compiler thinks the field is always there, but at runtime it's `undefined` because nothing ever validated its presence. Full detail on zod as the API/contract layer: `05-contracts-zod-api.md`.

### Do not use `typeof` as a substitute for domain validation

```ts
// ❌ DON'T — ad hoc, incomplete, and invisible to anyone reading the type
function processPayment(input: object) {
  if (typeof (input as any).amount === 'number' && (input as any).amount > 0) {
    ...
  }
}

// ✅ DO — the schema is the validation AND the documentation of what's expected
const ChargeInputSchema = z.object({ amount: z.number().positive(), currency: z.enum(['usd', 'eur']) });
function processPayment(input: unknown): void {
  const charge = ChargeInputSchema.parse(input);
  ...
}
```

`typeof x === 'string'` inside a function that's just doing an internal, same-module implementation detail (not validating external/untrusted data) is fine — the rule is about not using `typeof` as your *validation strategy* for data crossing a boundary, not a blanket ban on the `typeof` operator existing anywhere in the codebase.

## Tuples instead of `as const`

Already covered above — repeating the core example here because it's one of the most common places this rule gets missed, specifically with enum-like constant arrays:

```ts
// ❌ DON'T
export const VALID_STATUSES = ['pending', 'shipped', 'delivered'] as const;

// ✅ DO — explicit tuple, exact arity, no cast
export const VALID_STATUSES: [OrderStatus, OrderStatus, OrderStatus] = [
  OrderStatus.PENDING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];
```

If the array's length genuinely isn't fixed/meaningful (e.g. a runtime-computed list), a tuple type is the wrong tool — use a regular typed array (`OrderStatus[]` or `readonly OrderStatus[]`) instead, and don't force a tuple onto something that isn't actually one.

## Explicit API surface — access modifiers and return types, always, no exceptions

```ts
// ❌ DON'T — no access modifiers, no return types, relies entirely on inference
export class UserService {
  constructor(private repository: UserRepository) {}
  findById(id: string) {
    return this.repository.findById(id);
  }
  mapToDomain(row) {
    return { ...row };
  }
}

// ✅ DO
export class UserService {
  public constructor(private readonly repository: UserRepository) {}

  public async findById(id: UserId): Promise<User | null> {
    return this.repository.findById(id);
  }

  private mapToDomain(row: UserRow): User {
    return UserSchema.parse(row);
  }
}
```

Why this is non-negotiable rather than "nice to have": inferred return types are a maintenance trap. If `findById`'s return type is left to inference and someone later adds a code path that can return `undefined` instead of `null`, every single call site silently gains a new possible value with zero compiler warning anywhere — the change looks "safe" locally and breaks assumptions everywhere else. An explicit `Promise<User | null>` return type means that same change is caught immediately, at the function definition, not discovered later at some unrelated call site three files away.

The same logic applies to access modifiers: a method with no explicit modifier is `public` by TypeScript's default, whether or not that was intended. Writing `public` explicitly is not decoration — it's you stating, on purpose, "yes, this is part of this class's intended external surface," as opposed to it becoming public by accident because nobody thought about it.

## Generics are priority 0 — reach for them first, but only where they're real

When you're about to write a function, hook, service method, or component that could reasonably be called with more than one shape of input, reach for a generic before you reach for a looser type or a near-duplicate overload.

```ts
// ❌ DON'T — widened parameter type loses all the caller's specific type information
function unwrap(result: { success: boolean; data: object; error: object }) {
  if (!result.success) throw result.error;
  return result.data; // typed as `object` — useless to the caller
}

// ✅ DO — generic preserves the actual shape end-to-end
function unwrap<TData, TError>(
  result: { success: true; data: TData } | { success: false; error: TError },
): TData {
  if (!result.success) throw result.error;
  return result.data; // typed exactly as TData — the caller gets real information back
}
```

### But generics are not a license to add complexity nobody asked for

```ts
// ❌ DON'T — generic parameter added for its own sake, never actually varies
class UserRepository<T = User> {
  findById(id: string): Promise<T | null> { ... }
}
// T is never anything but User anywhere in the codebase — this generic buys nothing
// and makes every signature harder to read for no benefit.

// ✅ DO — no generic needed here; UserRepository only ever deals in Users
class UserRepository {
  public async findById(id: UserId): Promise<User | null> { ... }
}

// ✅ DO — generic is earned because the SAME repository shape is genuinely reused
// across many different entities with real, distinct concrete types
interface Repository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
}
```

The test: does this generic parameter ever actually take on more than one real, concrete value somewhere in this codebase (today, not hypothetically)? If the answer is no, it's not a generic — it's decoration.

### Priority order when designing a type

**Generics → discriminated unions → conditional/mapped types → plain union types.** `any`/`unknown`/casting are never on this list, at any priority level, under any circumstance.

## Discriminated unions over boolean-flag soup

```ts
// ❌ DON'T — impossible states are representable: what does loading:true + error:set mean?
type OrderFetchState = {
  loading: boolean;
  error: string | null;
  data: Order | null;
};
// Nothing stops someone from constructing { loading: true, error: 'x', data: someOrder }
// all at once — a state that should never exist but the type system allows it.

// ✅ DO — impossible states are unrepresentable
type OrderFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: Order };
```

## Error handling — errors are typed application concepts

```ts
// ❌ DON'T — a bare string thrown, no way for a caller to distinguish failure types
function findUser(id: string) {
  const user = db.find(id);
  if (!user) throw 'user not found';
  return user;
}

// ❌ DON'T — silently swallowing an error the caller needed to know about
async function sendReceipt(order: Order): Promise<void> {
  try {
    await emailProvider.send(order.customerEmail, receiptTemplate(order));
  } catch {
    // nothing — the caller has no idea the receipt didn't send
  }
}

// ✅ DO — typed error, caller can branch on it meaningfully
export class UserNotFoundError extends Error {
  public constructor(public readonly userId: UserId) {
    super(`User not found: ${userId}`);
  }
}
function findUser(id: UserId): User {
  const user = db.find(id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

// ✅ DO — failure is surfaced, not swallowed
async function sendReceipt(order: Order): Promise<void> {
  try {
    await emailProvider.send(order.customerEmail, receiptTemplate(order));
  } catch (error) {
    throw new ReceiptDeliveryError(order.id, { cause: error });
  }
}
```

At infrastructure boundaries (Prisma, an HTTP client, a queue client, an S3/object-storage client), translate the provider's own error type into an application-level error before it propagates upward — a controller or a UI component should never need to know what a specific Prisma error code or a specific AWS SDK exception class means.

## No magic — name things

```ts
// ❌ DON'T
if (user.role === 'admin') { ... }
if (event.type === 'order.created') { ... }
router.get('/api/v2/internal/users', ...);

// ✅ DO
if (user.role === Role.ADMIN) { ... }
if (event.type === OrderEventType.CREATED) { ... }
router.get(Routes.Internal.Users, ...);
```

Avoid unexplained magic constants, duplicated status/permission strings scattered across many files, hardcoded route fragments, and hardcoded event/topic names. If the same literal string shows up in more than one file, it should be a shared, typed constant/enum/schema value instead — not because "DRY" is a rule for its own sake, but because a typo in one of the copies (`'admn'` instead of `'admin'`) is invisible to the compiler when it's a bare string, and impossible when it's a typed reference.

## No speculative abstractions

Three similar lines of code duplicated across two files is sometimes genuinely better than an abstraction that tries to unify them — an abstraction has an ongoing cost (someone has to understand it, and every future change has to consider whether it still fits every caller), and that cost isn't always worth paying.

Create an abstraction only when **all** of these are true:
- The behavior is genuinely reusable — not "might be reused someday," but actually called from 2+ real places today, or clearly and concretely about to be.
- The abstraction has a stable contract — its shape isn't going to need to change every time a new caller shows up with slightly different needs.
- Duplication would create real correctness risk — the same rule/logic living in two places and silently drifting apart over time as one gets updated and the other doesn't.
- The abstraction reduces cognitive load for the next reader — not adds an extra layer of indirection someone has to trace through to understand what's actually happening.

```ts
// ❌ DON'T — premature "just in case" abstraction with exactly one real caller
export abstract class BaseCrudService<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract create(input: unknown): Promise<T>;
  abstract update(id: string, input: unknown): Promise<T>;
  abstract delete(id: string): Promise<void>;
  // ...ends up needing feature-specific overrides for every real method anyway
}

// ✅ DO — a plain, specific service; introduce a shared abstraction later
// IF AND WHEN a second, genuinely similar service shows up
export class OrdersService {
  public async findById(id: OrderId): Promise<Order | null> { ... }
  public async create(dto: CreateOrderDto): Promise<Order> { ... }
}
```

Do not create `BaseService`, `BaseController`, `UniversalManager`, or `GenericHelper` unless the abstraction satisfies every criterion above with concrete, demonstrated evidence — not a hunch that it'll be useful later. (`BaseRepository` is treated as a narrower, specifically-justified case — see `21-oop-and-solid-principles.md` for exactly where the line sits and why it's different from `BaseService`.)

## Also non-negotiable, carried from the AI agent contract

- **No unused code.** Dead exports, unused imports, commented-out blocks left "just in case" — delete them. Git history is the place for old code, not a comment block.
- **No lint suppression without a stated, reviewed reason.** `// eslint-disable-next-line` is not a way to make a warning go away quietly — if you genuinely need one, the comment explains why, and it gets called out explicitly in the PR, not buried.
- **No duplicated server state.** If a value came from the API, TanStack Query owns it — it does not also get copied into a Zustand store "for convenience." See `06-tanstack-state-forms-tables.md`.

## Severity levels — how to weigh a violation

Not every issue in this document is equally severe, but none of them are optional. When you spot a violation — in your own work or in review — classify it so the response is proportionate:

- **Blocking (must fix before merge, no exceptions):** any use of `any`/`unknown`/`z.any()`/`z.unknown()`, any `as` cast, `as const`, a missing access modifier or return type on a class member/exported function, a validation boundary with no zod schema.
- **Blocking unless explicitly justified in the PR description with a linked follow-up:** the one sanctioned construct (`satisfies`). There is no sanctioned `as` cast and no sanctioned `!`: if a third-party library's types seem to force one, stop and raise it for human review (see `14-documentation.md`, "Documenting a deliberate exception").
- **Non-blocking but must be raised:** a speculative abstraction that doesn't yet meet the "when to abstract" bar — flag it, but reasonable people can disagree on borderline cases, so it's a discussion, not an automatic rejection.

If you're unsure which bucket something falls into, treat it as blocking. The cost of a false positive (a slightly-too-cautious review comment) is a two-minute conversation. The cost of a false negative (an `any` that ships) is a silent hole in the type system that someone else inherits without knowing it's there.

## How this gets caught in CI, not just in review

Relying on human reviewers to catch every instance of `any`/casts/missing return types does not scale and does not work reliably — people get tired, skim large diffs, and miss things. Every rule in this document that can be mechanically enforced, is:

The authoritative ESLint configuration is in `13-ci-cd-and-quality-gates.md` ("Reference ESLint configuration"). Two details matter:

- `@typescript-eslint/consistent-type-assertions` does **not** flag `as const` (const assertions are always allowed by that rule), so `as const` / `<const>` and `z.any()` / `z.unknown()` / `z.never()` are banned through explicit `no-restricted-syntax` selectors in `packages/eslint-config/base.js` §9. The `unknown` and `never` **type keywords** are banned by lint too, through `no-restricted-syntax` selectors in the same block. They have these exemptions and no others:
  - `unknown` is allowed only as the type of a `catch (error: unknown)` clause parameter, or as the first (error) parameter of a `.catch((error: unknown) => …)` callback.
  - `never` is allowed only in the parameter and return type of an exhaustiveness helper declared as `function assertNever…(value: never): never`.
  - **Pending a human decision:** `never` is currently also exempt as the value type of a key guard, `Record<Exclude<keyof X, keyof Y>, never>`. This is the signature zod's `.pick()` requires, and `packages/shared/src/schemas/api/list-query.ts` uses it. Until the decision is made, treat this exemption as provisional: do not add new uses of it.
- Every rule is `error`, never `warn`, and lint runs with `--max-warnings=0` — a warning is a failure here.

A PR cannot merge with a lint error — this is enforced at the CI gate level (`13-ci-cd-and-quality-gates.md`), not as a suggestion a developer can dismiss locally. If you find yourself reaching for `// eslint-disable-next-line @typescript-eslint/no-explicit-any` to get past this, stop — that is the exact moment this document asks you to fix the underlying type instead, not silence the tool that's correctly telling you something is wrong.

## Extended anti-pattern catalog

The patterns below come up often enough in real code that they deserve their own worked examples, beyond the core forbidden-constructs list above.

### Don't use `Object`, `Function`, `{}`, or `object` as types

```ts
// ❌ DON'T — these are all nearly as unsafe as `any`. `{}` in particular
// means "anything except null/undefined" — it does NOT mean "an empty
// object," which is the intuitive (and wrong) reading most people give it.
function process(data: object): void { ... }
function handler(callback: Function): void { ... }
function merge(a: {}, b: {}): {} { ... }

// ✅ DO — say what you actually mean
function process(data: OrderRecord): void { ... }
function handler(callback: (event: ClickEvent) => void): void { ... }
function merge<A extends object, B extends object>(a: A, b: B): A & B { ... }
```

### Don't use `Record<string, any>` as an escape hatch for "an object with unknown keys"

```ts
// ❌ DON'T
function applyFilters(filters: Record<string, any>): void { ... }

// ✅ DO — if the keys are genuinely dynamic but the value shape is known,
// say so. If the keys AND shape are both unknown, that's a sign the data
// hasn't been through a zod schema yet — fix that instead.
const FilterValueSchema = z.union([z.string(), z.number(), z.boolean()]);
function applyFilters(filters: Record<string, z.infer<typeof FilterValueSchema>>): void { ... }
```

### Don't use bare string/number types where a closed set of values exists

```ts
// ❌ DON'T — nothing stops a typo like 'publised' from compiling fine
function setStatus(status: string): void { ... }

// ✅ DO — the compiler catches the typo immediately
function setStatus(status: OrderStatus): void { ... } // OrderStatus is a zod enum, per 05-contracts-zod-api.md
```

### Don't use branded/nominal IDs as bare strings

A `UserId` and an `OrderId` are both, structurally, `string`. Without branding, nothing stops you from passing one where the other is expected — the compiler sees `string === string` and says nothing.

```ts
// ❌ DON'T — UserId and OrderId are interchangeable as far as the compiler
// is concerned, because they're both just `string`
function getOrder(orderId: string): Promise<Order> { ... }
getOrder(currentUser.id); // compiles! passing a UserId where an OrderId belongs — a real, silent bug

// ✅ DO — branded types make this a compile error
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function getOrder(orderId: OrderId): Promise<Order> { ... }
getOrder(currentUser.id); // ❌ compile error — UserId is not assignable to OrderId
```

Derive branded ID types from their zod schema (`z.uuid().brand<'OrderId'>()`) so the branding and the validation live in the same place, per `05-contracts-zod-api.md`.

### Don't reach for optional chaining/nullish coalescing to silently paper over a validation gap

```ts
// ❌ DON'T — `?.` and `??` are being used here to avoid a crash, which
// also means they're being used to avoid ever finding out that
// `order.customer` is unexpectedly missing — a real bug is being hidden,
// not handled
const email = order?.customer?.email ?? 'unknown@example.com';
sendReceipt(email); // silently sends to a fake address instead of surfacing that something is wrong

// ✅ DO — if `order.customer` should never be missing at this point in
// the flow, let it fail loudly and traceably; if it CAN legitimately be
// missing, handle that as a real, named case
if (!order.customer) throw new OrderMissingCustomerError(order.id);
sendReceipt(order.customer.email);
```

Optional chaining is a legitimate, useful tool — the anti-pattern is using it as a substitute for deciding what should happen when a value is actually absent, rather than as a deliberate choice after that decision has been made.

### Don't widen a discriminated union's discriminant to a bare string

```ts
// ❌ DON'T — `type: string` throws away the exhaustiveness-checking
// benefit of a discriminated union entirely
interface Event { type: string; payload: unknown; }

// ✅ DO — the discriminant is a closed, specific literal union
type Event =
  | { type: 'order.created'; payload: Order }
  | { type: 'order.cancelled'; payload: { orderId: OrderId; reason: string } };
```

### Don't use index signatures where a known, finite set of keys exists

```ts
// ❌ DON'T
interface Config {
  [key: string]: string; // any key at all is "valid," typos included
}

// ✅ DO
interface Config {
  apiUrl: string;
  timeoutMs: number;
  retries: number;
}
```

### Don't mutate function parameters

```ts
// ❌ DON'T — mutating a parameter is a common source of subtle bugs when
// the caller didn't expect their object to be changed out from under them
function applyDiscount(order: Order, percent: number): Order {
  order.total = order.total * (1 - percent / 100); // mutates the caller's object!
  return order;
}

// ✅ DO — return a new value, leave the input untouched
function applyDiscount(order: Order, percent: number): Order {
  return { ...order, total: order.total * (1 - percent / 100) };
}
```

### Don't use `Array.prototype.sort()`/similar mutating methods on data you don't own

```ts
// ❌ DON'T — .sort() mutates in place; if `orders` came from a cache or
// props, this silently corrupts state the caller still holds a reference to
function getSortedOrders(orders: Order[]): Order[] {
  return orders.sort((a, b) => a.total - b.total);
}

// ✅ DO
function getSortedOrders(orders: readonly Order[]): Order[] {
  return [...orders].sort((a, b) => a.total - b.total);
}
```

Prefer `readonly` parameter/array types wherever the function has no business mutating its input — this turns an entire class of these bugs into compile errors instead of runtime surprises.

## Utility types — use TypeScript's built-in vocabulary instead of reinventing it

```ts
// ❌ DON'T — hand-rolling what TypeScript's utility types already give you
interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: Role;
} // manually re-typed, duplicated from UserSchema, will drift

// ✅ DO — derive it
type UpdateUserDto = Partial<z.infer<typeof UserSchema>>;
```

Know and use `Pick<T, K>`, `Omit<T, K>`, `Partial<T>`, `Required<T>`, `Readonly<T>`, and `Record<K, V>` before reaching for a hand-written equivalent — reinventing one of these is both extra work and a fresh opportunity for the derived type to drift from the source.

```ts
// ✅ DO
type OrderSummary = Pick<Order, 'id' | 'total' | 'status'>;
type ImmutableConfig = Readonly<AppConfig>;
```

## Template literal types for structured string values

```ts
// ❌ DON'T — a bare `string` for a value that actually has real internal structure
function getRoute(path: string): void { ... }
getRoute('orders'); // missing the leading slash — compiles fine, breaks at runtime

// ✅ DO — a template literal type encodes the actual required structure
type Route = `/${string}`;
function getRoute(path: Route): void { ... }
getRoute('orders'); // ❌ compile error: 'orders' is not assignable to `/${string}`
getRoute('/orders'); // ✅
```

Don't overuse this — reach for it where a string genuinely has a structural contract worth enforcing (a route, a CSS-like value, an event name prefix), not for every plain string in the codebase.

## Readonly by default for data that shouldn't change after creation

```ts
// ❌ DON'T — a domain type with every field mutable, even fields that
// should never legitimately change after the entity is created
interface Order {
  id: string;
  createdAt: Date;
  total: number;
}
order.id = 'something-else'; // compiles fine, and is almost certainly a bug wherever it happens

// ✅ DO — mark fields that shouldn't change as readonly; let the compiler
// catch an accidental reassignment
interface Order {
  readonly id: OrderId;
  readonly createdAt: Date;
  total: number; // genuinely mutable over the entity's lifecycle — no readonly here
}
```

## Enums vs union-of-string-literals — which one, and why

```ts
// TypeScript `enum` has real runtime costs and some well-documented
// sharp edges (numeric enums allow any number to be assigned, reverse
// mappings add runtime overhead, and enums don't tree-shake as cleanly
// as plain object/union alternatives). Prefer a union of string literals
// backed by a zod z.enum() (05-contracts-zod-api.md) for most cases:

// ✅ DO — the default choice in this codebase
export const OrderStatusSchema = z.enum(['pending', 'shipped', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// ✅ ACCEPTABLE — a TypeScript enum specifically where NestJS's own
// ecosystem expects one (e.g. certain decorator metadata patterns) or
// where a genuinely large, stable, rarely-changing set of named
// constants benefits from the namespacing enum syntax provides (e.g.
// Permission identifiers in 10-security-auth-authorization.md, which
// are internal-only and never need to round-trip through zod/JSON in
// the same way a domain status does)
export enum Permission {
  USER_READ = 'USER.READ',
  USER_CREATE = 'USER.CREATE',
}
```

The deciding question: does this value need to be validated as external/API-boundary data (use a zod enum) or is it a purely internal, code-only constant set (either is fine, default to the zod enum pattern for consistency unless there's a concrete reason not to).

## Rapid-fire self-check before every commit

Read these as questions. Every "yes" is a defect to fix before you push.

```text
Types
- Did I write or leave behind `any`, `unknown`, `never`, `as`, `as const`, `!`, `Function`, `{}`, `object`?
- Is there a function/method without an explicit return type, or a class member without an access modifier?
- Is there a string/number literal that has a meaning (status, role, limit, timeout, retry count, port, size)?
- Did I hand-write a type that a zod schema could have produced?
- Did I use `typeof`/`in`/`Array.isArray` to validate data that came from outside this function?

Boundaries
- Does every place data enters the system parse it through a schema first?
- Did I trust anything the client sent for identity, role, organization, price, or ownership?
- Are all strings/arrays/numbers in my schemas bounded (`max`, `positive`, `int`)?

Structure
- Did I put logic in a controller / query in a component / fetch in a dumb component?
- Did I create an abstraction with fewer than two real callers?
- Did I import across an app boundary, or create a package cycle?

Data
- Did I hard-delete? Forget `isDeleted: false` on a read? Loop a query? Write read-then-write on shared state?
- Did I change the schema without updating `seed.ts`, the migration, and the indexes?

Quality
- Is every new function tested (allowed, denied, edge, failure)?
- Did I update the docs, the permission mapping, and the audit coverage?
- Is there any shortcut here I have not called out in the PR description?
```

## Naming conventions

```text
Files:            kebab-case.ts            (create-order.service.ts, orders-table.tsx)
Classes/Types:    PascalCase               (OrdersService, OrderStatus)
Functions/vars:   camelCase                (calculateTotal, isEligible)
Constants:        SCREAMING_SNAKE_CASE     (MAX_LOGIN_ATTEMPTS, ONE_DAY_MS) — units in the name
Zod schemas:      PascalCase + "Schema"    (CreateOrderSchema); inferred type drops the suffix (CreateOrderDto/Order)
Booleans:         is/has/can/should prefix (isDeleted, hasAccess, canPublish)
Event names:      dotted + versioned       (order.created.v1)
Permissions:      DOMAIN.ACTION            (REWARD.PUBLISH)
Env vars:         SCREAMING_SNAKE_CASE, prefixed by concern (DATABASE_URL, STRIPE_WEBHOOK_SECRET)
```

```ts
// ❌ ambiguous, unit-less, negated booleans
const timeout = 5000;  const notDisabled = true;  const data2 = ...;  const tmp = ...;
// ✅ intention-revealing
const REQUEST_TIMEOUT_MS = 5000;  const isEnabled = true;  const pendingOrders = ...;
```

## Function size and shape

```text
❌ A 200-line function with five levels of nesting and three unrelated jobs.
✅ Small, named steps that read like the use case; early returns instead of deep nesting;
   one level of abstraction per function.
```

```ts
// ❌ pyramid of doom
if (user) { if (user.isActive) { if (order) { if (order.status === 'pending') { ... } } } }
// ✅ guard clauses
if (!user) throw new UserNotFoundError(id);
if (!user.isActive) throw new UserInactiveError(user.id);
if (!order) throw new OrderNotFoundError(orderId);
if (order.status !== 'pending') throw new OrderNotEligibleError(order.id);
```

## Imports and module hygiene

```ts
// ❌ deep relative climbs and reaching into another package's internals
import { helper } from '../../../../packages/shared/src/internal/helper';
// ✅ the package's public entrypoint only
import { helper } from '@repo/shared';
```

Import from a package's public API only; if something you need isn't exported, add it deliberately (a public-surface decision) rather than reaching past the boundary. Use `import type` for type-only imports. Keep side-effect-free modules — importing a file should never open a connection or read the environment as a side effect.

## Async correctness

```ts
// ❌ sequential awaits for independent work (slow)
const a = await getA(); const b = await getB();
// ✅ parallel — but BOUNDED (see 19: unbounded Promise.all can exhaust a connection pool)
const [a, b] = await Promise.all([getA(), getB()]);

// ❌ forEach with async callback (not awaited — errors lost, ordering broken)
items.forEach(async (i) => { await process(i); });
// ✅ for...of for sequential, or bounded concurrency helper for parallel
for (const i of items) { await process(i); }
```

Every promise is awaited, returned, or deliberately handled. A floating promise is a silent failure. Enable `@typescript-eslint/no-floating-promises`.

## Dates and time

```text
❌ new Date() sprinkled in business logic (untestable), local-time math, string dates.
✅ Inject a Clock (or pass `now` as a parameter) so time is controllable in tests;
   store UTC (epoch ms / ISO 8601); convert to local only at the display edge.
```

```ts
export interface Clock { nowEpochMs(): number }
export class SystemClock implements Clock { public nowEpochMs(): number { return Date.now(); } }
```
