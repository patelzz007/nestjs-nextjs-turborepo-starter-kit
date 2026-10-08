# 28 — Runtime validation (Zod trust zones)

## Why this exists

TypeScript only checks at **compile time**. Anything that crosses a **trust boundary** (network, queue, disk, another process, browser storage) can be wrong at runtime even when the type says otherwise.

If you already validated with Zod at the boundary, **`typeof x === "string"` inside business logic is a second, ad hoc type system** — it drifts from the shared schema, duplicates rules, and trains juniors to stop trusting `z.infer<>`.

**Zod is the runtime contract.** TypeScript is the in-memory contract **after** a successful parse.

## The trust-zone model (read this first)

```text
Untrusted wire ──► .parse() / .safeParse() once ──► typed value ──► services/repos/UI
                         ▲                              │
                         │                              │ no typeof / Array.isArray
                         │                              │ for *shape* here
                   shared schema                  same process, same trust zone
                   (packages/shared)
```

### Parse **once per boundary**, not once per module

| Layer | Parse again? | Why |
|--------|----------------|-----|
| HTTP controller / RPC handler | **Yes** — request body, query, params | First time data enters the API process |
| Service called from that handler | **No** — take `z.infer<typeof Schema>` | Same request, already validated |
| Repository (Prisma) | **No** for row shape — map to DTO | DB driver + Prisma types are the boundary |
| Kafka / outbox consumer | **Yes** — event payload schema | New message = new boundary |
| `localStorage` / cookie / URL hydrate | **Yes** — shared client schema | Browser storage is untrusted |
| Unit test building literals | **No** — construct typed fixtures | You own the test data |

**Do not** re-parse on every function entry — that is wasteful and implies you do not trust your own types.

**Do** re-parse when data crosses **another** untrusted or versioned boundary (new message, file on disk, env var read, third-party webhook).

## What juniors should do (happy path)

1. **Define or import** the schema from `packages/shared` (same schema on API, web, mobile, Swagger).
2. At the **handler / listener / loader** edge:

   ```ts
   const body = CreateOrderSchema.parse(rawBody);
   await ordersService.create(body); // body is CreateOrder — not unknown, not "maybe string"
   ```

3. **Pass inferred types inward** — services, repos, dumb UI components receive `CreateOrder`, not `unknown` and not `Record<string, unknown>`.

4. **Client forms** — `safeParse` for UX; server still `parse`s independently (see `rules/05-contracts-zod-api.md`).

5. **When something is optional in the schema** — use `z.optional` / `.nullable()` and `z.infer<>`; do not re-check with `typeof` or `=== undefined` for *shape*.

## Shared guards (when you are *not* on a wire boundary)

Sometimes TypeScript already gives you a **union** (`string | string[]` select value, `bigint | number` column, JSON node, React ref) and you only need to pick a branch — not re-validate data from the network. Use the **zod-backed guards** in `@workspace/shared` (`packages/shared/src/lib/runtime-narrowing.ts`). Each one is a hoisted zod schema's `safeParse`, and narrows to the matching members of *your* union (`Extract<T, string>`), so no type is lost or invented:

| Guard | Narrows to | Use when |
|--------|-----------|----------|
| `isStringPrimitive(v)` | `Extract<T, string>` | `string \| string[]`, `Error \| string`, `RouteTree` leaf vs branch |
| `isNumberPrimitive(v)` | `Extract<T, number>` | Any JS number, `NaN` / `±Infinity` included |
| `isBooleanPrimitive(v)` / `isBigIntPrimitive(v)` | `Extract<T, boolean>` / `Extract<T, bigint>` | `bigint \| number` money columns, flags |
| `isJsonPrimitive(v)` | `Extract<T, string \| number \| boolean \| null>` | Walking a `JsonValue` / `DataValue` tree: primitives → arrays → objects |
| `isArrayValue(v)` | The array members of the union, element type kept (`number \| (string \| number)[]` → `(string \| number)[]`) | Single-or-many values (combobox, query params, header values), attribute values |
| `isFunctionValue(v)` | `boolean` (wrap in a local guard naming the exact callable type) | React refs, route handlers inside `z.custom` predicates |

Runtime environment (`packages/shared/src/lib/global-runtime.ts`):

| Helper | Use instead of |
|--------|----------------|
| `isBrowserRuntime()` | `typeof window !== "undefined"` (SSR checks) |
| `hasGlobalValue("document")` | `typeof document`, `typeof navigator` |
| `hasGlobalConstructor("BroadcastChannel")` | `typeof BroadcastChannel === "undefined"` — also sees `vi.stubGlobal(name, undefined)` stubs |

When the value is a real *shape* (an object with fields), do not chain guards — write the zod schema: `z.object({ orgSlug: z.string() }).safeParse(request.params)`.

## Forbidden everywhere (ESLint, every TypeScript file)

Enforced by `no-restricted-syntax` (`packages/eslint-config/restricted-syntax-rules.js`, wired in `packages/eslint-config/base.js`). There is **no** exemption — schema files, tests and environment probes included:

| Pattern | Why | Do instead |
|---------|-----|------------|
| The runtime `typeof` operator in any form (`typeof x === "string"`, `typeof x.y`, `switch (typeof x)`, `typeof window`) | A second, ad hoc runtime type system next to zod | Zod at the boundary; the guards above for typed unions |
| `Array.isArray(x)` | Same | `z.array(SubSchema)` at the boundary; `isArrayValue` for typed unions |
| `Object.prototype.toString.call(x)` tag sniffing | `typeof` under another name | A zod schema |
| Validating wire JSON with `in` / manual property checks | Duplicated contract | One object schema with `.strict()` where appropriate |

Type-position `typeof` (`z.infer<typeof Schema>`, `ReturnType<typeof fn>`) is a different construct and stays allowed.

### Still allowed (control flow, not type checking)

| Pattern | When |
|---------|------|
| `value === undefined` / `value === null` / `value == null` | Checking a **value** of an already-typed optional — not a type check |
| `x instanceof SomeError` | Branching on a class you own or a platform error |
| `assertNever(x)` / discriminated `switch` | Control flow on **already typed** unions |

## Where schemas live

- **Contracts**: `packages/shared/src/schemas/**` (and related exports).
- **Do not** invent parallel validation in `apps/api` or `apps/web` for the same payload.
- OpenAPI/Swagger samples come from the same schemas (`ZodValidationPipe`, zod-openapi helpers).

## Mapping layers without re-parsing

```text
Prisma row  ──► toUserResponse(row) ──► UserResponse (typed mapper)
                      │
                      └── not UserResponseSchema.parse(row) on every field
```

Use **typed mappers** when the DB shape is already trusted. Use **response schema validation** at the HTTP boundary when the contract must be guaranteed for external clients (existing decorators/pipes).

## Anti-patterns (common mistakes)

```ts
// ❌ DON'T — API already parsed; service re-checks with typeof
function applyDiscount(order: Order, code: string) {
  if (typeof code !== "string") throw new BadRequestException();
}

// ✅ DO — Order and code are already correct types from the controller + schema
function applyDiscount(order: Order, code: string): void { ... }
```

```ts
// ❌ DON'T — manual JSON shape check
function handleWebhook(body: unknown) {
  if (typeof body !== "object" || body === null || !("type" in body)) return;
}

// ✅ DO
function handleWebhook(raw: unknown): void {
  const body = WebhookSchema.parse(raw);
}
```

```ts
// ❌ DON'T — union branch with typeof
if (typeof node === "string") return [node];

// ✅ DO — zod-backed guard narrows the RouteTree union
if (isStringPrimitive(node)) return [node];
```

## ESLint & rollout

- Config: `packages/eslint-config/restricted-syntax-rules.js` → `restrictedSyntaxRules` in `packages/eslint-config/base.js` (section 9). Selector tests: `packages/eslint-config/tests/configs.test.js`.
- If lint points at your file: parse at the boundary with a zod schema, or use a shared guard for a union you already hold.

## Related docs

- `00-non-negotiables.md` — no `any`, no casts, zod-first
- `05-contracts-zod-api.md` — never trust the frontend; shared schemas
- `27-array-index-readability.md` — same “no hand-rolled shortcut” spirit for list positions

## Review checklist

- [ ] Wire input parsed exactly once at the boundary with the shared schema
- [ ] Inner functions take `z.infer<typeof …>`, not `unknown` / loose `Record`
- [ ] No runtime `typeof` / `Array.isArray` anywhere — zod schemas or the shared zod-backed guards
- [ ] Client + server both use the same schema for the same payload
