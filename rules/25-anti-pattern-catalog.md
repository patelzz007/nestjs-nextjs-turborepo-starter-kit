# 25 — Anti-Pattern Catalog (Do / Don't, Rapid-Fire)

Short, scannable ❌/✅ pairs grouped by area. Each entry names the failure mode. Use this as a pre-commit self-review: scan the sections relevant to your change and ask "did I do any of the ❌ things?" Full explanations live in the numbered documents referenced in each heading.

---

## TypeScript (`00`)

```ts
// ❌ implicit any via untyped parameter
function total(items) { return items.reduce((s, i) => s + i.price, 0); }
// ✅
function total(items: readonly LineItem[]): number { return items.reduce((s, i) => s + i.price, 0); }
```

```ts
// ❌ non-exhaustive switch silently returns undefined for new cases
function label(s: OrderStatus): string { switch (s) { case 'pending': return 'Pending'; case 'shipped': return 'Shipped'; } }
// ✅ exhaustive with assertNever
function label(s: OrderStatus): string {
  switch (s) { case 'pending': return 'Pending'; case 'shipped': return 'Shipped'; case 'delivered': return 'Delivered'; case 'cancelled': return 'Cancelled'; default: return assertNever(s); }
}
```

```ts
// ❌ Promise result ignored (unhandled rejection, lost errors)
sendEmail(order);
// ✅ awaited (or explicitly voided with a handled catch, when fire-and-forget is intended)
await sendEmail(order);
```

```ts
// ❌ catching and swallowing
try { await charge(order); } catch (e) { console.log(e); }
// ✅ translate + rethrow so the caller can act
try { await charge(order); } catch (e) { throw new ChargeFailedError(order.id, { cause: e }); }
```

```ts
// ❌ boolean parameter soup: what does `true, false, true` mean?
createUser(input, true, false, true);
// ✅ named options object with a typed shape
createUser(input, { sendWelcomeEmail: true, requireMfa: false, isInternal: true });
```

```ts
// ❌ magic number
if (attempts > 3) lock();
// ✅
const MAX_LOGIN_ATTEMPTS = 3;
if (attempts > MAX_LOGIN_ATTEMPTS) lock();
```

```ts
// ❌ Date math with raw milliseconds
const expires = Date.now() + 86400000;
// ✅ named constant with units in the name
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const expiresAtEpochMs = Date.now() + ONE_DAY_MS;
```

```ts
// ❌ stringly-typed event names
emitter.emit('order-created', order);
// ✅ typed constant / discriminated event
emitter.emit(OrderEventType.CREATED, order);
```

```ts
// ❌ floating point money
const total = 0.1 + 0.2; // 0.30000000000000004
// ✅ integer minor units or Decimal
const totalCents = 10 + 20;
```

---

## Zod & contracts (`05`)

```ts
// ❌ z.string() for an email / uuid / url
z.object({ email: z.string(), id: z.string() });
// ✅ real validators
z.object({ email: z.email(), id: z.uuid() });
```

```ts
// ❌ unbounded string / array / number
z.object({ comment: z.string(), tags: z.array(z.string()), qty: z.number() });
// ✅ bounded (a 50MB "comment" is an attack, not input)
z.object({ comment: z.string().max(2000), tags: z.array(z.string().max(50)).max(20), qty: z.number().int().positive().max(1000) });
```

```ts
// ❌ .parse() result thrown away, original input used afterwards
UserSchema.parse(input); save(input);
// ✅ use the parsed value
const user = UserSchema.parse(input); save(user);
```

```ts
// ❌ .safeParse() success ignored
const r = Schema.safeParse(x); use(r.data);
// ✅
const r = Schema.safeParse(x); if (!r.success) throw new ValidationError(r.error); use(r.data);
```

```ts
// ❌ separate DTO class + separate zod schema + hand-written Swagger
// ✅ one schema in packages/contracts feeding validation, types, and OpenAPI
```

```ts
// ❌ returning the persistence row from an endpoint
return this.prisma.user.findUnique({ where: { id } });   // leaks passwordHash, internal flags
// ✅ map to a response schema
return UserResponseSchema.parse(toDomain(row));
```

---

## NestJS backend (`02`, `10`)

```ts
// ❌ business logic in the controller
@Post() create(@Body() b: any) { if (b.total > 10000) throw ...; return this.prisma.order.create({ data: b }); }
// ✅ controller delegates
@Post() create(@Body(pipe) dto: CreateOrderDto, @CurrentUser() u: AuthUser): Promise<OrderResponseDto> { return this.service.create(dto, u); }
```

```ts
// ❌ endpoint with no guard
@Delete(':id') remove(@Param('id') id: string) {}
// ✅ permission + ownership explicit
@Delete(':id') @UseGuards(AuthGuard, PermissionGuard(Permission.ORDER_DELETE), OwnershipGuard('order','organization')) remove(...) {}
```

```ts
// ❌ organizationId taken from the request body
const orgId = dto.organizationId;
// ✅ from the authenticated session
const orgId = user.organizationId;
```

```ts
// ❌ process.env.X scattered everywhere
// ✅ one zod-parsed env object, parsed at boot; app refuses to start on invalid config
```

```ts
// ❌ unbounded list endpoint
findMany({ where })
// ✅ bounded, allowlisted sorting
findMany({ where, take: query.pageSize, skip, orderBy })
```

```ts
// ❌ error text used as the contract
throw new BadRequestException('Order not found for user');
// ✅ stable code + message + safe details
throw new AppError({ code: 'ORDER_NOT_FOUND', message: '...', details: { orderId } });
```

```ts
// ❌ leaking internals
catch (e) { throw new InternalServerErrorException(e.message); } // may contain SQL / paths
// ✅ log full detail server-side (redacted); return a generic message + requestId
```

```ts
// ❌ log line with a token
logger.log({ headers: req.headers });
// ✅ redact
logger.log({ headers: redactSensitiveFields(req.headers) });
```

---

## Prisma & database (`08`)

```ts
// ❌ hard delete on a business entity
prisma.order.delete({ where: { id } });
// ✅ soft delete with actor
prisma.order.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), deletedBy: user.id } });
```

```ts
// ❌ list query forgets the soft-delete filter
prisma.order.findMany({ where: { tenantId } });
// ✅
prisma.order.findMany({ where: { tenantId, isDeleted: false } });
```

```ts
// ❌ read-check-write
const s = await prisma.stock.findUnique(...); if (s.qty >= n) await prisma.stock.update(... qty: s.qty - n);
// ✅ atomic
const r = await prisma.stock.updateMany({ where: { sku, qty: { gte: n } }, data: { qty: { decrement: n } } }); if (r.count === 0) throw new OutOfStockError();
```

```ts
// ❌ query in a loop
for (const o of orders) o.customer = await prisma.customer.findUnique({ where: { id: o.customerId } });
// ✅ one query
prisma.order.findMany({ include: { customer: true } });
```

```ts
// ❌ external call inside a transaction
await prisma.$transaction(async tx => { await tx.order.create(...); await email.send(...); });
// ✅ transaction = DB work only; side effects via outbox
```

```ts
// ❌ migration without seed.ts update
// ✅ same PR updates prisma/seed.ts with deterministic fixed IDs
```

```ts
// ❌ Float for money      ✅ Decimal @db.Decimal(10, 2)
// ❌ Json for relations   ✅ real columns / tables
// ❌ index every column   ✅ index the real access patterns
```

---

## Messaging & jobs (`09`)

```ts
// ❌ enqueue the whole object     ✅ enqueue the id, re-read fresh state in the processor
// ❌ no idempotency on consumers  ✅ processed-event ledger / idempotency key
// ❌ charge without idempotency key ✅ key generated at user intent, passed to the gateway
// ❌ retry a malformed payload forever ✅ bounded retries → dead letter → alert
// ❌ same Kafka groupId on unrelated consumers ✅ one group per logical consumer
// ❌ assume global ordering across partitions ✅ partition key = entity id when order matters
// ❌ treat a timeout as "payment failed" ✅ reconcile via provider lookup using the idempotency key
```

---

## Web (`03`, `06`, `07`)

```tsx
// ❌ 'use client' at page level for one button   ✅ small client leaf
// ❌ dumb component calls useQuery                ✅ page fetches, passes props
// ❌ Zustand mirrors query data                   ✅ TanStack Query only
// ❌ filter state in useState only                ✅ URL search params (shareable, refresh-safe)
// ❌ no loading/empty/error states                ✅ all three, deliberately designed
// ❌ <img> / hand-rolled font link                ✅ next/image / next/font
// ❌ bg-[#1a1a1a] text-[14px]                     ✅ bg-background text-sm (tokens)
// ❌ boolean prop per visual permutation          ✅ CVA variant / size / state
// ❌ icon-only button with no name                ✅ aria-label
// ❌ placeholder as the only label                ✅ real <label>
// ❌ animation ignoring reduced motion            ✅ motion-safe:
// ❌ redesigning the layout during a bug fix      ✅ change only what was asked
```

```tsx
// ❌ inline object/array/function on a hot path
<Table config={{ dense: true }} onRow={() => select(id)} />
// ✅ hoisted / memoized
const CONFIG = { dense: true } satisfies TableConfig;  // module-level
const onRow = useCallback(() => select(id), [id]);
```

---

## Mobile (`04`)

```tsx
// ❌ AsyncStorage for tokens        ✅ SecureStore
// ❌ Node/DOM imports in shared code ✅ RN-safe only
// ❌ unvalidated deep-link params    ✅ zod-parse before navigating
// ❌ ask for every permission at launch ✅ ask in context, handle denial
// ❌ poll while backgrounded         ✅ respect AppState
// ❌ test only on the simulator      ✅ verify on a real device, on iOS AND Android
// ❌ assume everyone is on the latest build ✅ versioned API + minimum-version gate
```

---

## Security (`10`)

```text
❌ hide the button, skip the server check      ✅ server authorizes every request
❌ trust client-computed price / role / org    ✅ server recomputes / looks up
❌ same response whether the account exists    ✅ identical response + timing (no enumeration)
❌ long-lived JWT, no revocation               ✅ short access token + revocable rotating refresh token
❌ CORS origin '*' with credentials            ✅ explicit origin allowlist
❌ fast hash (SHA-256) for passwords           ✅ argon2id
❌ webhook processed before signature verified ✅ verify signature on the RAW body first
❌ presigned URL from broad credentials        ✅ narrowly scoped credentials / key prefix
❌ secret in NEXT_PUBLIC_* / EXPO_PUBLIC_*     ✅ server-side only
❌ audit log written by hand per endpoint      ✅ global interceptor; denied requests logged too
```

---

## Testing (`11`)

```text
❌ "trivial, no test"                          ✅ test it
❌ assert only that a mock was called          ✅ assert the outcome and the absent side effects
❌ .rejects.toThrow() with no type              ✅ .rejects.toThrow(SpecificError)
❌ only the happy path                          ✅ allowed + denied + wrong-tenant + unauthenticated
❌ real timers / real sleeps                    ✅ fake timers
❌ shared mutable state between tests           ✅ reset per test; any order, any parallelism
❌ snapshot as a default                        ✅ explicit behavioral assertions
❌ mock the DB in an integration test           ✅ real test database (Testcontainers)
```

---

## Process (`15`, `16`, `17`, `18`)

```text
❌ "temporary hack"                             ✅ do it properly or flag it explicitly in the PR
❌ ship the spike                               ✅ rewrite against this rule set
❌ finish without `pnpm run lint` + `pnpm run test`   ✅ run both after the last edit; fix root causes until both pass
❌ eslint-disable / @ts-ignore / config edit / .skip to go green ✅ fix the cause, or stop and ask a human
❌ mix refactor + behavior change               ✅ separate commits / PRs
❌ approve with unresolved blocking comments    ✅ request changes
❌ "docs in a follow-up"                        ✅ docs in the same PR
❌ guess on ambiguous security / money / data   ✅ stop and ask
❌ assume the AI followed the rules             ✅ review AI diffs at full rigor
```
