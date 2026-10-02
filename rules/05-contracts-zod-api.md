# 05 — Contracts, Zod & API Design

## Principle

Zod is the **single** runtime boundary contract — not one of several sources of truth. A schema defined once in `packages/contracts` drives, in order: request validation on the API, response typing on the API, the frontend's TanStack Query/TanStack Form types, and the published Swagger/OpenAPI documentation.

```text
packages/contracts/*.schema.ts   (zod schema — the one source of truth)
       ↓                              ↓                        ↓
  apps/api                       apps/web / apps/mobile     Swagger/OpenAPI docs
  (request validation,           (z.infer<> types,           (generated from the
   response validation,           form validation,             same schema — never
   DTO types)                     TanStack Query types)         hand-written separately)
```

## Never trust the frontend — this is the most important sentence in this document

The frontend is not a security boundary. It is a convenience layer for the user, running on a device you do not control, that can be intercepted, modified, or bypassed entirely (a request can be sent directly with `curl`, Postman, or a modified build of your own app — nobody needs your UI to talk to your API). Every rule in this document downstream of this one exists because of this single fact.

```text
❌ DON'T reason like this: "the web app already validates that `quantity`
   is a positive integer in the form, so the API doesn't need to check
   again — that would be redundant."

   This reasoning is wrong because "the web app" is not the only thing
   that can send a request to this endpoint. A malicious user (or just a
   curious one with devtools open) can send `{ "quantity": -999999 }`
   directly to the API, completely bypassing your form's validation,
   your form's disabled-submit-button, and your form's error messages.
   None of that client-side logic exists once the request leaves the browser.

✅ DO validate independently and completely on the server, every time,
   regardless of what validation already happened on the client. The
   client-side validation exists to give the user fast, friendly feedback
   — it is never a substitute for server-side enforcement.
```

## Validate on both FE and BE — for different reasons, both mandatory

This is not a contradiction of "never trust the frontend" — it's two different jobs done by two different layers:

- **Frontend validation** exists for *user experience*: instant feedback as someone types, disabling a submit button before a doomed request goes out, showing a friendly inline error instead of a raw API error after a round trip. It makes the product feel good to use.
- **Backend validation** exists for *correctness and security*: it is the only validation that actually determines whether bad data enters the system, because it's the only validation that can't be bypassed.

```text
❌ DON'T — validation only on the frontend
   (fast for the user, but a direct API call bypasses it entirely — a
   security and data-integrity hole)

❌ DON'T — validation only on the backend, none on the frontend
   (secure, but the user experience is bad: every mistake requires a
   full round trip to the server before they find out something's wrong)

✅ DO — both, using the SAME zod schema so they can never drift apart:
```

```ts
// packages/contracts/src/orders.ts — the one schema, imported by both sides
export const CreateOrderSchema = z.object({
  customerId: z.uuid(),
  quantity: z.number().int().positive().max(1000),
});
```

```tsx
// apps/web — client-side validation, for UX, using the shared schema
const form = useForm({ validators: { onChange: CreateOrderSchema } });
```

```ts
// apps/api — server-side validation, for correctness/security, using the SAME schema
@Post()
public async create(@ZodBody(CreateOrderSchema) dto: CreateOrderDto) { ... }
```

If you ever find yourself writing two different validation rules for the same field on the frontend and backend, that's a bug waiting to happen — go back to a single shared schema in `packages/contracts` instead.

## Never hand-maintain a second source of truth

- Do not hand-write a `CreateOrderDto` class with `class-validator` decorators *and* a separate `createOrderSchema` zod schema that's supposed to match it — pick zod, once, and derive everything else.
- Do not hand-write Swagger/OpenAPI annotations (`@ApiProperty()` describing fields by hand) that duplicate what the zod schema already says. Generate the OpenAPI schema **from** the zod schema so the request validator, the response type, and the published API docs cannot drift from each other. In `apps/api` that means declaring every request input with `@ZodBody` / `@ZodQuery` / `@ZodParams` / `@ZodParam` (`common/decorators/zod-request.decorators.ts`) — they validate with `ZodValidationPipe` and document the same schema (see `docs/api-routes.md` §13) — and every response with exactly one `@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse` (`common/decorators/zod-response.decorators.ts`) — they document the response, set its status, enforce it at runtime and type-check the handler (see "Response validation" below, ADR 022). Put field descriptions and examples on the schema (`.describe()` / `.meta({ description, example })`), never in a parallel `@ApiQuery` / `@ApiBody`.
- The frontend imports the **same** schema from `packages/contracts` for its TanStack Query response typing and its TanStack Form validation — it does not redeclare the shape.

```ts
// packages/contracts/src/orders.ts — the one definition
export const OrderSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  total: z.number().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = OrderSchema.omit({ id: true, status: true });
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
```

```ts
// apps/api — request validation + Swagger requestBody, response docs + enforcement, all from shared schemas
@Post()
@ZodResponse(OrderSchema, { status: HttpStatus.CREATED })
public async create(@ZodBody(CreateOrderSchema) dto: CreateOrderDto): Promise<Order> { ... }
```

```ts
// apps/web — same schemas: the contract leaf's response envelope is parsed by the fetch layer,
// the request schema drives the form
const order = await api.orders.create.mutate(input); // parsed with apiContract.orders.create.response
const form = useForm({ validators: { onChange: CreateOrderSchema } });
```

```text
❌ DON'T:
  apps/api/src/dto/create-order.dto.ts     — hand-written class-validator DTO
  apps/web/src/types/order.ts               — hand-written interface Order
  apps/api's Swagger annotations              — hand-written @ApiProperty() calls
  → THREE separate definitions of "what an order is." The day someone adds
    a field to one and forgets the other two, something breaks silently.

✅ DO:
  packages/contracts/src/orders.ts   — ONE zod schema, everything else derives from it
```

## Shared contracts package

`packages/contracts` holds schemas consumed by web/mobile/api alike, and must remain runtime-safe for all three (`01-repository-architecture.md`).

## Request validation — every external input, no exceptions

Every externally supplied value is untrusted: HTTP body, query params, route params, headers, webhook payloads, message payloads, Kafka events, RabbitMQ messages, job payloads. Validate before application logic runs — never after, never "just this once because it's an internal admin tool."

```text
❌ DON'T — "this endpoint is only called by our own internal admin panel,
   so I'll skip validation, it's basically trusted input."

   Internal tools get compromised too, get misused by mistake, and get
   called by future code that wasn't the original internal panel. There
   is no such thing as trusted input crossing a network boundary.

✅ DO — validate every request the exact same way, regardless of who
   you believe the caller is.
```

## Response validation

Validating the response catches version drift, incorrect adapters, malformed provider responses, and accidental breaking changes before they reach a consumer, instead of the consumer discovering the mismatch through a confusing runtime crash three layers downstream. In this repository it is not optional — every endpoint has a response contract (ADR 022, `docs/response-contracts.md`):

- **One schema, declared on the contract leaf.** `defineContract({ …, response: singleResponse(XSchema) })` or `paginatedResponse(ItemSchema)` for list-grammar endpoints. Two envelopes only: `{ success, data, meta }` and `{ success, data: Item[], meta: { …pagination } }`.
- **The API documents AND enforces it.** The handler carries `@ZodResponse(XSchema)` / `@ZodPaginatedResponse(ItemSchema)` with the same schema reference. The global `ResponseInterceptor` parses the result once: unknown keys are stripped (an internal field can never leak), a mismatch is a logged `500 INTERNAL_ERROR`. The decorator also refuses to compile on a handler whose return type does not fit the schema — so a controller can never return a Prisma model (`bigint`, `Date`, internal columns); map to the DTO in the service.
- **The client parses with the same envelope**, in one place (`parseResponseContract`); a mismatch is a typed `ApiResponseContractError`, never silently passed on.
- **Response schemas are open** (no `.strict()`), so the server strips instead of failing and clients ignore fields added later. Request schemas stay strict.
- **Public routes say so on the leaf.** `defineContract({ …, access: "public" })` exactly when the handler is `@Public()` (omitted = `"authenticated"`). The SSR caller (`fetchServerQuery`) then fetches it for a visitor with no session — anonymously, no cookie, no refresh — instead of skipping it, so guests get server-rendered public data. `test/openapi-document.e2e-spec.ts` fails when a leaf's `access` and its handler's `@Public()` disagree.

```ts
// ❌ DON'T — documents nothing, enforces nothing, leaks whatever the row contains
@Get(':id')
@ApiOkResponse({ description: 'Order' })
public findOne(@ZodParam('id', OrderIdSchema) id: OrderId): Promise<PrismaOrder> { return this.prisma.order.findUniqueOrThrow({ where: { id } }); }

// ✅ DO — the shared schema is the documentation, the runtime filter and the compile-time check
@Get(':id')
@ZodResponse(OrderSchema)
public findOne(@ZodParam('id', OrderIdSchema) id: OrderId): Promise<Order> { return this.orders.getById(id); }
```

`docs/generated/openapi.json` is the committed export of the resulting document; regenerate it with `pnpm openapi:export` whenever a request or response contract changes (the e2e suite fails while it is stale).

## REST conventions

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
DELETE /users/:id
```

Don't invent a new verb per action. Action endpoints are fine when the operation isn't naturally CRUD:

```text
POST /rewards/:id/publish
POST /orders/:id/cancel
```

## Pagination

Never expose arbitrary database pagination internals. Define a stable pagination contract in `packages/contracts`. Cursor pagination is often safer for large/changing datasets; offset pagination is acceptable for admin tables when product requirements call for it.

## Sorting and filtering

```ts
// ❌ DON'T — client controls the sort column directly, which means a client
// could sort by an internal column that was never meant to be exposed,
// or inject something into a raw SQL fragment
const orders = await prisma.$queryRawUnsafe(`SELECT * FROM orders ORDER BY ${req.query.sort}`);

// ✅ DO — sort fields are allowlisted in the schema itself
const SortFieldSchema = z.enum(['createdAt', 'total', 'status']);
```

Filters are schema-defined; avoid a generic "anything query" param that could accidentally expose internal columns.

Every paginated list endpoint uses the one list grammar — `defineListQuery({ sortable, defaultSort, filter, params })` in `@workspace/shared`, `@ZodListQuery` on the controller, explicit per-field Prisma translation with an `id` tie-breaker in the repository, `tableStateToListQuery` on the client. Do not invent per-endpoint `sortBy` / `sortDirection` / top-level filter flags. See `docs/list-queries.md` and ADR 021.

## Versioning

Breaking public API changes need an explicit migration strategy — don't silently rename a field or change its semantics under an existing schema version.

## Contract tests

Every important contract needs tests proving: valid input succeeds, invalid input fails, required fields are enforced, enum values are constrained, and the response shape stays stable across changes. See `11-testing-vitest.md`.

## Nullable vs optional — say precisely which one you mean

`z.string().optional()` (the key may be absent) and `z.string().nullable()` (the key is present but its value may be `null`) are different contracts, and conflating them produces confusing, hard-to-debug API behavior.

```ts
// ❌ DON'T — using .optional() when the field is ALWAYS present in the
// response but can legitimately be empty; a consumer checking `'middleName' in order`
// will get inconsistent results depending on whether the API happens to
// omit the key or send it as undefined via JSON serialization quirks
const CustomerSchema = z.object({
  middleName: z.string().optional(), // is the key sometimes just... not there?
});

// ✅ DO — if the field is always present but can be empty, it's nullable,
// not optional; if it can genuinely be entirely absent from the payload
// (e.g. a field added in a later API version that older records don't have), it's optional
const CustomerSchema = z.object({
  middleName: z.string().nullable(), // always present; value is either a string or null
});
```

Be equally deliberate on the frontend: `middleName: string | null` and `middleName?: string` communicate different things to the next developer reading the type, and TanStack Form/table rendering code often needs to handle them differently (a `null` needs an explicit fallback in a template string; an absent key might need an existence check first).

## Schema composition patterns

```ts
// ❌ DON'T — copy-pasting the same set of fields across several schemas,
// so a change to one (like tightening the email regex) has to be
// remembered and applied in every copy
const CreateUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });
const UpdateUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });
const InviteUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });

// ✅ DO — compose from a shared base with .extend()/.pick()/.omit()/.partial()
const UserBaseSchema = z.object({ email: z.email(), name: z.string().min(1) });
const CreateUserSchema = UserBaseSchema;
const UpdateUserSchema = UserBaseSchema.partial(); // every field becomes optional for a PATCH
const InviteUserSchema = UserBaseSchema.extend({ invitedBy: z.uuid() });
```

## Refinements and transforms — where the logic goes, and where it doesn't

```ts
// ❌ DON'T — a cross-field validation rule reimplemented separately in
// the frontend form AND the backend controller, because "it's just an
// if-statement, not worth putting in the schema"
// frontend: if (form.startDate > form.endDate) setError('End date must be after start date');
// backend:  if (dto.startDate > dto.endDate) throw new BadRequestException('...');

// ✅ DO — the rule lives in the schema, ONCE, via .refine(), and both
// sides inherit it automatically
const DateRangeSchema = z.object({ startDate: z.iso.date(), endDate: z.iso.date() })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });
```

Use `.transform()` sparingly and only for genuinely lossless, unambiguous normalization (trimming whitespace, lowercasing an email) — not for anything that silently changes the meaning of the data in a way the caller might not expect. A transform that changes semantics belongs as an explicit, named step in application code, not hidden inside a schema someone might not read closely.

## Custom, actionable error messages

```ts
// ❌ DON'T — zod's default message for a failed constraint, surfaced
// directly to an end user with no context ("Invalid input")
const OrderSchema = z.object({ quantity: z.number().int().positive() });
// a user sees: "quantity: Invalid input" — unhelpful

// ✅ DO — a message written for the person who will actually read it
const OrderSchema = z.object({
  quantity: z.number().int().positive({ message: 'Quantity must be at least 1' }),
});
```

## Schema testing patterns

Beyond the contract-test basics already covered, test the EDGES of a schema deliberately, not just one valid and one invalid case:

```ts
describe('CreateOrderSchema', () => {
  it('accepts the minimum valid quantity', () => {
    expect(CreateOrderSchema.safeParse({ ...valid, quantity: 1 }).success).toBe(true);
  });
  it('rejects a zero quantity', () => {
    expect(CreateOrderSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
  });
  it('rejects a negative quantity', () => {
    expect(CreateOrderSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(false);
  });
  it('rejects a non-integer quantity', () => {
    expect(CreateOrderSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(false);
  });
  it('rejects an extra, unexpected field when the schema is strict', () => {
    expect(CreateOrderSchema.strict().safeParse({ ...valid, unexpectedField: 'x' }).success).toBe(false);
  });
});
```

## `.strict()` vs the default "strip unknown keys" behavior

```ts
// By default, zod object schemas silently STRIP unrecognized keys rather
// than rejecting them. This is usually fine and even desirable (forward
// compatibility with clients sending extra fields) — but for anything
// security-sensitive, be deliberate about which behavior you want.

// ❌ DON'T assume unexpected fields are harmless by default in EVERY case
// — e.g. a request schema for updating a user's OWN profile that silently
// strips an unexpected `role: 'admin'` field is fine; but a schema for an
// internal admin action might specifically want to REJECT (not silently
// drop) an unexpected field as a signal something is wrong with the caller.

// ✅ DO — choose deliberately per schema:
const PublicUpdateProfileSchema = z.object({ name: z.string() }); // strips unknowns, fine for public use
const AdminActionSchema = z.object({ userId: z.uuid() }).strict(); // rejects unknowns — surfaces a caller bug immediately
```

## Coercion — `z.coerce` used deliberately, not everywhere

```ts
// ❌ DON'T — reach for z.coerce.number() by default on every numeric
// field, including a JSON body field that should ALREADY be a real
// number if the client is behaving correctly — coercion silently
// accepts and "fixes" malformed input instead of rejecting it, which
// can mask a real client-side bug
const CreateOrderSchema = z.object({ quantity: z.coerce.number() }); // "5" the string silently becomes 5 the number

// ✅ DO — reserve z.coerce specifically for inputs that are ALWAYS
// strings by the nature of their transport (URL query params, route
// params, form-encoded fields, environment variables) — there, coercion
// is correct and necessary, not a workaround
const OrderQuerySchema = z.object({ page: z.coerce.number().int().positive() }); // query params are always strings on the wire
// for a JSON body, expect the real type and reject if it's wrong:
const CreateOrderSchema = z.object({ quantity: z.number().int().positive() }); // a string here is a real client bug worth surfacing, not silently fixing
```

## Dates — always UTC epoch or ISO 8601 at the boundary

```ts
// ❌ DON'T — accept/emit a locale-formatted or ambiguous date string
// ("01/02/2026" — is that January 2nd or February 1st?) anywhere near an API boundary
const EventSchema = z.object({ date: z.string() }); // no format constraint at all

// ✅ DO — an explicit, unambiguous format, validated as such
const EventSchema = z.object({ occurredAt: z.iso.datetime() }); // ISO 8601, unambiguous
// for anything compared/sorted/stored, prefer epoch milliseconds
// (matches the audit-logging convention in 10-security-auth-authorization.md)
const EventSchema = z.object({ occurredAtEpochMs: z.number().int().positive() });
```

## File upload validation in DTOs

```ts
// ❌ DON'T — accept a file upload with no validation of size/type
// before it's processed or forwarded to storage
@Post('avatar')
async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
  await this.storage.upload({ key, body: file.buffer, contentType: file.mimetype }); // file.mimetype is CLIENT-DECLARED — never independently verified
}

// ✅ DO — validate size and type at the DTO/schema boundary, exactly
// like any other input, and re-verify the actual content server-side
// (20-object-storage.md) rather than trusting the client-declared mimetype
const AvatarUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024), // 5MB
});
```

## API error response catalog

Beyond the stable-error-code pattern already covered, maintain an actual CATALOG of error codes (in `packages/contracts`, alongside the schemas) so "what error codes can this endpoint return" is a documented, discoverable fact — not something a frontend developer has to reverse-engineer by reading backend source or triggering every failure case manually.

```ts
// ❌ DON'T reach for `as const` here either, even though it's a common
// pattern in other codebases for exactly this kind of lookup object —
// the ban in 00-non-negotiables.md has no "just this once" exception
export const ErrorCode = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ORDER_NOT_ELIGIBLE: 'ORDER_NOT_ELIGIBLE',
} as const;

// ✅ DO — a zod enum gives you the same closed, literal-typed set, PLUS
// a runtime-checkable schema, with no cast anywhere
export const ErrorCodeSchema = z.enum([
  'USER_NOT_FOUND',
  'ORDER_NOT_ELIGIBLE',
  'CREDIT_LIMIT_EXCEEDED',
  'DUPLICATE_PROMO_CODE',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
```

## Discriminated unions at the API boundary — a full worked example

```ts
// ❌ DON'T — a single "flat" response shape with a bunch of optional
// fields that only make sense in SOME cases, leaving the consumer to
// guess which fields are relevant based on some other field's value,
// with no compiler help
const PaymentResultSchema = z.object({
  status: z.string(),
  chargeId: z.string().optional(),     // only present if succeeded
  failureReason: z.string().optional(), // only present if failed
  retryAfterSeconds: z.number().optional(), // only present if rate-limited
});
// consuming code has to remember, by convention, which fields go together — nothing enforces it

// ✅ DO — a discriminated union makes the valid combinations explicit
// and compiler-enforced, both in the schema and in the derived type
const PaymentResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('succeeded'), chargeId: z.uuid() }),
  z.object({ status: z.literal('failed'), failureReason: z.string() }),
  z.object({ status: z.literal('rate_limited'), retryAfterSeconds: z.number().positive() }),
]);
// consuming code, after a switch on `status`, gets full autocomplete and
// type-narrowing on exactly the fields that are ACTUALLY present for that case
```

## Zod schemas for query/route params specifically

```ts
// ❌ DON'T — treat query/route params as an afterthought validated
// loosely or not at all, just because they "look like" simple strings
@Get(':id')
async findOne(@Param('id') id: string) { ... } // any string at all is accepted here, including something that isn't even a valid UUID

// ✅ DO — validate route/query params with the same rigor as a request
// body, via the Zod request decorators from 02-backend-nestjs.md (they also document the param)
@Get(':id')
async findOne(@ZodParam('id', OrderIdSchema) id: OrderId) { ... }
```

## Cross-app schema reuse — a worked example across all three apps

```ts
// packages/contracts/src/orders.ts — written ONCE
export const OrderSchema = z.object({ id: z.uuid(), total: z.number().nonnegative(), status: OrderStatusSchema });
export type Order = z.infer<typeof OrderSchema>;

// apps/api/src/modules/orders/orders.controller.ts — documented + enforced + type-checked
@Get(':id') @ZodResponse(OrderSchema) public async findOne(...): Promise<Order> { ... }

// apps/web/src/app/orders/[id]/page.tsx — the fetch layer parses with the contract leaf's envelope
const { data: order } = await api.orders.detail.fetchOrThrow({ id }); // same schema, validated on the client

// apps/mobile/src/app/orders/[id].tsx
const order = OrderSchema.parse(await res.json()); // identical validation, identical type, zero duplication
```

Three apps, one schema, one place a field ever gets added/changed/removed — this is the concrete payoff of everything this document argues for, made visible end to end.

## Contract change safety matrix

| Change | Safe? | What to do |
|---|---|---|
| Add an optional response field | Yes | Ship; consumers ignore it |
| Add a required response field | Usually yes for consumers, **no** if you also validate responses strictly on old clients | Deploy API first, consumers after; mobile may lag |
| Add a required request field | **No** — breaks existing clients | Make optional with a default first, or version the endpoint |
| Remove a response field | **No** | Deprecate, wait for consumers to stop reading, then remove |
| Change a field's type or meaning | **No** | New field or new version; never reuse a name with new semantics |
| Tighten validation (e.g. new `max`) | Risky | Check existing data and clients first; log-only mode before enforcing |
| Loosen validation | Usually yes | Confirm downstream code handles the wider range |
| Rename a field | **No** | Add new, dual-write/read, migrate, remove old |
| Add an enum value | **Risky for consumers with exhaustive switches** | Consumers must handle unknown values gracefully (`assertNever` will fail their build — coordinate) |

## Response envelope consistency

```text
❌ Some endpoints return a bare array, others { items }, others { data, total }.
✅ One envelope shape per kind: single → { success, data, meta }, list → { success, data: Item[], meta: { …pagination } } (createApiSuccessEnvelopeSchema / createApiPaginatedEnvelopeSchema), error → the shared ApiErrorResponseSchema (docs/error-model.md). Never invent a third.
```

## Documenting an endpoint's contract completely

For each endpoint, the contract package (and therefore Swagger) should answer: input shape and bounds, output shape, every possible error code, the required permission, whether it is idempotent, its rate limit, and its pagination/sorting/filter allowlist. If a frontend developer has to read backend source to learn any of these, the contract is incomplete.
