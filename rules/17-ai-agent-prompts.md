# 17 — AI Agent Prompt Contract

Paste the following as the high-level instruction for Claude/Cursor/Codex/Copilot. (This is the canonical version — `AGENTS.md` at the repo root is the live, load-bearing copy; keep them in sync if either changes.)

---

You are working on a production-grade NestJS + Next.js + Expo Turborepo monorepo. **This is a starter kit that other real products are built on top of. There is no such thing as an acceptable shortcut here — do everything the proper way, every time, even under time pressure, even for something that looks small.**

Before writing code:

1. Read `AGENTS.md`.
2. Read every relevant document under `rules/` for this task — use `AGENTS.md`'s routing table rather than loading everything.
3. Inspect existing code and reuse established patterns.
4. Do not invent architecture when an existing pattern already exists.
5. Create a concise implementation plan.
6. Identify affected packages and boundaries.
7. Identify security and authorization requirements — map them explicitly per endpoint if this touches the API.
8. Identify database consequences: does this need a migration, a `seed.ts` update, soft-delete fields, an index, or a concurrency-safe write pattern?
9. Identify whether this touches money/inventory/anything with limited quantity, in which case idempotency and race-condition safety are mandatory, not optional.
10. Implement incrementally.
11. Write tests for everything you write, including small helper functions — there is no function too simple to test.
12. Run the completion gate from `AGENTS.md`: `pnpm run lint` (zero errors and warnings) and `pnpm run test`, after your last edit. Fix root causes and re-run both until both pass. Never suppress a rule, relax the config, or skip/weaken a test to get green. If you cannot run them, report NOT VERIFIED.
13. Update documentation.

Non-negotiable:

- no `any`, `unknown`, `never` (outside exhaustiveness checks), `z.any()`, `z.unknown()`, `z.never()`
- no casts, no `as const`, no magic numbers/unexplained literal constants
- avoid `typeof` domain narrowing — zod is the runtime boundary source of truth, and the same zod schema drives request validation, response types, frontend types, and Swagger/OpenAPI — never three hand-maintained copies
- validate on the server independently, always — never assume the frontend already checked something, because the frontend is not a security boundary and can be bypassed entirely; validate on the client too, for user experience, using the same shared schema
- generic reusable infrastructure is priority 0, but a generic abstraction must have a real, demonstrated, reusable contract — see the non-negotiables doc's "no speculative abstractions" and the OOP doc's base-repository guidance before introducing a `Base*`/`Universal*` class
- explicit return types, explicit access modifiers
- no unused code, no lint suppression without a stated reason
- no duplicated server state (TanStack Query owns server state; Zustand never mirrors it)
- server-side authorization is mandatory and explicitly mapped per endpoint (permission, ownership, tenant, ReBAC, RLS where applicable)
- every state-changing request produces a complete audit log entry (org/tenant/user/timestamp-epoch/endpoint/request/response/IP/device — see `10-security-auth-authorization.md`)
- every business entity uses soft delete (`isDeleted`, `deletedAt`, `deletedBy`) — never a hard `DELETE`
- every endpoint should be fast by default: no N+1, bounded pagination, indexes matched to real access patterns
- any concurrent write path is explicitly protected against race conditions (atomic conditional update, optimistic locking, or pessimistic locking — see `08-database-prisma.md`)
- no new circular dependency, package-level or module-level
- no single point of failure introduced without an explicit, deliberate fallback/degradation decision (`12-observability-and-operations.md`)
- large file uploads to S3/Firebase use multipart upload so only failed chunks are retried, never the whole file (`20-object-storage.md`)
- low-level UI is data-agnostic, stateless, controlled, accessible, responsive, themeable, ref-forwarding, with a standard `onChange`/`onBlur`/`onFocus` event contract and CVA-based `variant`/`size`/`state`
- smart components own data and domain transformations; low-level components render what they're given
- use design tokens, never hardcoded colors/spacing in reusable components
- payment-related operations are idempotent by construction, keyed on an explicit idempotency key
- SOLID principles apply to any new class/interface design — see `21-oop-and-solid-principles.md`
- tests are written for everything, including small/simple functions — no exceptions for perceived triviality
- update documentation, including `seed.ts` for any schema change

When changing UI, do not redesign existing layouts unless explicitly requested.

When changing data access, do not leak Prisma models into public contracts.

When adding async behavior, first determine whether the correct primitive is HTTP, Kafka, RabbitMQ, BullMQ, or Redis — see the decision matrix in `09-messaging-and-jobs.md`.

When adding file/media handling, use the object-storage conventions in `20-object-storage.md` (signed URLs, multipart upload) rather than ad hoc SDK calls.

When changing a public contract, identify all consumers (web, mobile, any external integrations) before editing.

When uncertain about security, data integrity, financial state, or authorization, do not guess — ask, or flag the uncertainty explicitly rather than proceeding on an assumption.

At the end, report: implementation summary, files changed, tests/checks run, architecture decisions, documentation updated, remaining risks.

## Self-verification — before declaring a task complete

Before reporting a task as done, run through this internal check — silently, as part of your own process, not as something you necessarily narrate in full to the user:

```text
1. Did I re-read the specific rules/*.md files this task touched, or am
   I working from a stale memory of them from earlier in a long
   conversation? Files can change between sessions.
2. Did I actually search for an existing pattern before writing a new
   one, or did I assume none existed because I didn't look?
3. For every new function I wrote — including "simple" ones — did I
   write a test?
4. For every new/changed endpoint — did I explicitly map its
   authorization (permission, ownership, tenant), or did I copy a
   neighboring endpoint's guards without checking they're actually
   correct for THIS endpoint's specific rule?
5. Does anything I wrote touch money, inventory, or any other
   limited/contended resource? If so, did I explicitly address race
   conditions and idempotency, or did I write the "obvious" version and
   move on?
6. Did I update seed.ts, if I touched the Prisma schema?
7. Did I introduce a hard delete anywhere a soft delete belongs?
8. Is there a shortcut anywhere in what I wrote that I haven't called
   out explicitly? If yes, call it out now, in the report — don't let a
   reviewer discover it unannounced.
9. Did I update documentation, or just the code?
```

If the honest answer to any of these is "no, and I'm not sure why not," go back and address it before reporting completion — a task report that says "done" when one of these is quietly unaddressed is a false report, and the gap becomes someone else's undiagnosed problem later.

## Escalation triggers — when to stop and ask rather than proceed

Some situations are explicitly NOT yours to resolve by best guess, no matter how confident the guess feels:

```text
- A request that would require weakening a security or authorization
  control ("just skip the permission check for now") — flag it, don't comply.
- A request that's ambiguous about which of two genuinely different
  architectures to use, where guessing wrong means significant rework
  (e.g. "should this be a Kafka event or a BullMQ job?" when the request
  doesn't make the semantics clear) — ask, using 09-messaging-and-jobs.md's
  decision matrix to frame the question concretely.
- Anything touching real financial state, real user data deletion, or
  real production credentials, where a wrong guess isn't just extra
  rework but actual, possibly irreversible harm.
- A task that seems to require breaking a rule in 00-non-negotiables.md
  to accomplish at all — this is a strong signal the task itself is
  underspecified or the surrounding architecture needs a real design
  conversation, not a workaround.
```

Asking one focused, well-framed question that unblocks the whole task is better than either guessing wrong and doing the whole task twice, or silently taking the path of least resistance and leaving a landmine for later.

## What "no acceptable shortcut" means in practice, for an AI agent specifically

An AI agent under an ambiguous or time-pressured request has a specific, well-documented failure mode: reaching for the fastest thing that makes an error go away (a cast, a skipped test, a `// TODO: handle this properly later`) because it produces a working-looking result quickly. This project's entire rule set exists specifically to prevent that failure mode. If you notice yourself about to do this, that is the signal to stop and do it the documented way instead — not a sign the documented way is too slow for this particular case.

## Templated task breakdowns for common request types

When a request matches one of these common shapes, use the corresponding breakdown as a starting checklist — not a rigid script to follow blindly, but a way to make sure nothing load-bearing gets skipped under the pressure of "just get this done."

### "Add a new API endpoint"

```text
1. Define/locate the zod schema for request + response in packages/contracts
   (05-contracts-zod-api.md) — check if one already exists before writing a new one.
2. Write the controller method: guards, permission decorator, ownership/
   tenant checks explicitly mapped (10-security-auth-authorization.md).
3. Write the application service method (business logic), with a
   corresponding domain/policy class if a non-trivial rule is involved
   (02-backend-nestjs.md).
4. Write the repository method if new persistence access is needed,
   checking for N+1/missing indexes (08-database-prisma.md, 19-performance-...).
5. If this creates/updates/deletes data: confirm the audit-log
   interceptor covers it, confirm delete (if any) is a soft delete.
6. Write unit tests for the service/policy logic (including denial
   cases), integration tests for the repository if new query patterns
   were introduced.
7. Update Swagger via the zod-driven DTO — no hand-written @ApiProperty().
8. Update the endpoint's permission mapping doc (10-security-auth-authorization.md).
```

### "Add a new database table/column"

```text
1. Update the Prisma schema, including isDeleted/deletedAt/deletedBy if
   it's a business entity (08-database-prisma.md).
2. Write the migration.
3. Update seed.ts in the SAME change (08-database-prisma.md) — do not
   defer this to a follow-up.
4. Add indexes matching the query patterns this table/column will
   actually be used with (08-database-prisma.md, 19-performance-...).
5. Update the corresponding zod schema in packages/contracts if this
   table's data is exposed via the API.
6. Consider: does this table hold PII? Does it need audit-log-adjacent
   redaction handling anywhere it's logged?
```

### "Fix a bug"

```text
1. Write a failing test that reproduces the bug BEFORE fixing it — this
   both confirms you've actually understood the bug and prevents a
   regression later (11-testing-vitest.md).
2. Fix the root cause, not just the symptom — if the bug is a race
   condition or a validation gap, check 08-database-prisma.md/
   05-contracts-zod-api.md for the correct underlying pattern rather
   than patching around the specific failure you observed.
3. Check whether the same class of bug exists elsewhere in the codebase
   (the same unguarded race condition pattern copy-pasted into a
   different service, for instance) — a bug found once is often present
   more than once.
```

### "Refactor existing code"

```text
1. Confirm test coverage exists FOR THE CURRENT BEHAVIOR before
   refactoring — if it doesn't, write it first, so the refactor has a
   safety net proving behavior didn't change.
2. Refactor in small, individually-reviewable steps where possible,
   rather than one enormous diff that's hard to review meaningfully.
3. Don't mix a refactor with a behavior change in the same commit/PR —
   keep "this looks different" and "this now DOES something different"
   separable, so a regression can be bisected to one or the other cleanly.
```

## Handling long-running or multi-session tasks

For a task large enough to span multiple sessions/conversations (a significant feature, a large refactor), don't assume context from an earlier session is still accurate — files change, rules documents get updated, and other work may have landed in the meantime. At the start of resuming such a task: re-read the current state of any `rules/*.md` files the task touches (they may have changed since you last read them), re-check the current state of the code you're building on (it may have been modified by someone/something else), and re-confirm the plan is still the right one given anything that's changed, rather than blindly continuing from a stale mental model.

## What "propose the compliant alternative" looks like in practice

When a request conflicts with a non-negotiable, don't just refuse — offer the version that actually accomplishes what the person is trying to do, within the rules.

```text
❌ DON'T — a bare refusal with no path forward:
   "I can't use `any` here, that violates the project's rules."

✅ DO — acknowledge the underlying need, then solve it correctly:
   "I can't type this as `any` — per 00-non-negotiables.md that's a hard
   rule here. What I think you're actually trying to express is 'this
   webhook payload's shape varies by event type' — that's a textbook
   case for a zod discriminated union (05-contracts-zod-api.md), which
   gives you full type safety AND runtime validation. Here's that
   version instead: [...]"
```

This is a better outcome for everyone: the person gets unblocked, the codebase stays clean, and the next person reading the code sees the correct pattern rather than a shortcut with a comment explaining why it was "necessary."

## A note on applying judgment vs applying rules mechanically

This entire rule set is written with real reasoning behind every rule — not as arbitrary constraints to satisfy mechanically. When a genuinely novel situation arises that isn't explicitly covered by any existing `rules/*.md` file, the right response is not to freeze or guess randomly — it's to reason from the underlying PRINCIPLES this document set consistently applies (never trust unvalidated input, keep layers separated by responsibility, make invariants impossible to violate rather than merely discouraged, prefer explicit over implicit, no silent shortcuts) and propose a solution consistent with them, while flagging clearly that this is a new situation worth a human confirming the approach for, rather than an established, pre-approved pattern.

## Failure modes AI agents commonly exhibit here — and the correct behavior

| Tempting behavior | Why it's wrong here | Do this |
|---|---|---|
| Fix a type error by adding `as X` or `any` | Hides the bug; violates `00` | Fix the model / add a zod parse at the boundary |
| Copy the nearest similar file, including its violations | Older code may predate a rule | Match `24-golden-reference-implementations.md`, not just neighbors |
| Add validation only in the frontend form | Frontend isn't a boundary | Add/verify server-side validation with the same schema |
| Add an endpoint and copy neighbor guards unchanged | May grant wrong/insufficient access | Map permission + ownership + tenant for THIS endpoint; test denial |
| Write `prisma.x.delete` | Violates soft-delete rule | `update` with `isDeleted/deletedAt/deletedBy` |
| Add a column, forget `seed.ts` | CI/seed breaks; drifts | Update seed in the same change |
| Write read-then-write on a counter/status | Race condition | Atomic conditional update / lock + concurrency test |
| Call an external API inside `$transaction` | Holds locks; inconsistent on failure | Outbox / after-commit |
| Skip tests for "simple" helpers | Non-negotiable | Write them |
| Invent a new util/base class | Speculative abstraction | Reuse or keep it local until 2 real callers |
| Say "done" without running `pnpm run lint` and `pnpm run test` | Unverified; the completion gate exists for exactly this | Run both after the last edit; report results honestly |
| Make lint pass with `eslint-disable`, `@ts-ignore`, config edits, or `.skip` | Hides the defect and defeats the gate | Fix the root cause; if the rule seems wrong, stop and ask a human |
| Run lint once, then make more edits | The earlier green run no longer counts | Re-run lint and tests after the final edit |
| Quietly leave a TODO/workaround | Hidden shortcut | Do it properly or flag it explicitly in the report |
| Restyle UI while fixing logic | Violates layout preservation | Change only what was asked |
| Invent a fact about the repo | Wrong changes | Read the code; ask when unsure |

## Reporting template (end of task)

```markdown
### Summary
<what changed and why, in 2–4 sentences>

### Files changed
<list, grouped by package>

### Rule-set compliance
- Types / validation / authorization / audit / DB (migration + seed + soft delete) / concurrency / idempotency / tests / docs: <each addressed or N/A with reason>

### Completion gate
`pnpm run lint`: <pass/fail + summary> · `pnpm run test`: <pass/fail + summary> (or NOT VERIFIED, with the reason)

### Other checks run
<exact commands and results>

### Decisions & trade-offs
<architecture choices; alternatives rejected>

### Shortcuts or exceptions
<none | explicit list with follow-up>

### Risks / follow-ups
<anything a reviewer or operator should watch>
```
