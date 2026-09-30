# 23 — Quick Reference & Decision Trees

The other documents in `rules/` explain *why*. This one is for the moment you're mid-task and need a fast answer to "which way do I go?" Every tree below links to the full document that justifies it — if the tree's answer surprises you, read that document before overriding it.

## Where does this code go?

```text
Does it handle HTTP, auth, or request/response shaping?
  YES → apps/api/src/modules/<feature>/presentation/http   (02-backend-nestjs.md)
  NO  ↓
Is it a business rule ("can this order be cancelled?")?
  YES → apps/api/src/modules/<feature>/domain/policies      (02-backend-nestjs.md)
  NO  ↓
Does it orchestrate a use case across policies + repositories?
  YES → apps/api/src/modules/<feature>/application/services (02-backend-nestjs.md)
  NO  ↓
Does it talk to Prisma / Kafka / S3 / Redis?
  YES → .../infrastructure/ (behind an interface)           (21-oop-and-solid-principles.md)
  NO  ↓
Is it a zod schema used by more than one app?
  YES → packages/contracts                                   (05-contracts-zod-api.md)
  NO  ↓
Is it a pure, framework-agnostic function used by 2+ apps?
  YES → packages/shared                                      (01-repository-architecture.md)
  NO  ↓
Is it a web UI component used by 2+ features?
  YES → packages/ui   NO → co-locate with its route          (07-ui-system.md)
```

## Which async primitive?

```text
Need an immediate answer to the caller?
  YES → synchronous HTTP call.
  NO  ↓
Do MULTIPLE independent consumers need this event, or does replay/history matter?
  YES → Kafka                                                (09-messaging-and-jobs.md)
  NO  ↓
Is it a background job for ONE worker (email, PDF, image resize, scheduled work)?
  YES → BullMQ
  NO  ↓
Is it a command/task needing routing (topic/direct/fanout) between services?
  YES → RabbitMQ
  NO  ↓
Is it just a cache, lock, or rate-limit counter?
  YES → Redis (never as the source of truth)
```

## Which locking strategy for a concurrent write?

```text
Is it a single, simple "decrement/increment if enough" operation?
  YES → atomic conditional update (updateMany with a WHERE guard)   (08-database-prisma.md)
  NO  ↓
Is a user editing a multi-field record and you must detect "someone else changed it"?
  YES → optimistic locking (version column)
  NO  ↓
Is it a critical multi-step financial/inventory operation needing exclusive access?
  YES → pessimistic lock (SELECT ... FOR UPDATE inside a short transaction)
```

## Where does this piece of state live?

```text
Did it come from the API/database?            → TanStack Query
Is it a form field's value or validation?     → TanStack Form + zod
Should it survive refresh / be shareable?     → URL search params
Is it purely client-owned UI state?           → Zustand (or useState if not shared)
Can it be computed from other state?          → compute it; store nothing
```

## Which validation, where?

```text
Frontend  → the shared zod schema, for user experience (instant feedback).
Backend   → the SAME shared zod schema, for correctness and security. ALWAYS.
             Never skipped because "the frontend already checked."  (05-contracts-zod-api.md)
Money/price/permission/ownership → recomputed or looked up server-side; the
             client-supplied value is ignored entirely.             (10-security-auth-authorization.md)
```

## Do I need an abstraction here?

```text
Are there 2+ REAL implementations or callers today (not hypothetical)?
  NO  → don't abstract. Write the plain code.                (00-non-negotiables.md)
  YES ↓
Is the contract stable and narrow?
  NO  → don't abstract yet.
  YES ↓
Would the duplication create correctness risk, or does the abstraction reduce reading effort?
  NO  → don't abstract.
  YES → abstract. Prefer an interface + composition over inheritance.  (21-oop-and-solid-principles.md)
```

## "I'm tempted to..." — the instant-answer table

| I'm tempted to... | Do this instead | Read |
|---|---|---|
| Use `any` / `unknown` | Write a zod schema, infer the type | `00`, `05` |
| Cast with `as` | Validate with `.parse()`, or fix the upstream type | `00` |
| Use `as const` | Typed tuple, or `z.enum([...])` | `00` |
| Hardcode a number/string | Named typed constant | `00` |
| Skip a test: "it's trivial" | Write the test | `11` |
| Skip server validation: "frontend checks it" | Validate on the server, always | `05`, `10` |
| Hard-delete a row | Soft delete: `isDeleted`, `deletedAt`, `deletedBy` | `08` |
| Read-then-write a shared counter | Atomic conditional update | `08` |
| Loop with a query per row | `include`/`select`, or batch | `08`, `19` |
| Put logic in a controller | Move to service / policy | `02` |
| Fetch data inside a dumb component | Fetch in the page, pass props | `03`, `07` |
| Copy server data into Zustand | Let TanStack Query own it | `06` |
| Call the payment API without an idempotency key | Generate the key at user intent | `09` |
| Upload a large file in one request | Multipart, retry only failed chunks | `20` |
| Add an endpoint without guards "for now" | Map permission + ownership + tenant now | `10` |
| Add a column without touching `seed.ts` | Update the seed in the same PR | `08` |
| `forwardRef()` a circular import | Redesign: event or narrow port | `01`, `02` |
| Make an external call with no timeout | Timeout + fallback decision | `12` |
| "Temporary hack, clean up later" | Do it properly, or flag it explicitly | `15` |
| Silence a lint error with a comment or config change | Fix the root cause; ask a human if the rule seems wrong | `AGENTS.md`, `13` |
| Say "done" after one lint/test run, then keep editing | Re-run `pnpm run lint` and `pnpm run test` after the last edit | `AGENTS.md`, `18` |
