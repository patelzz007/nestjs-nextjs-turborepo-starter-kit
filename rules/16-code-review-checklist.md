# 16 — Code Review Checklist

Use this as a literal, item-by-item checklist on every PR — not a vague "does this feel okay" pass. Most real bugs this project cares about are caught here, not in production.

## Completion gate

- [ ] Author confirms `pnpm run lint` (zero errors and warnings) and `pnpm run test` passed after the final commit; CI agrees
- [ ] No new `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `.skip`, or `.only` anywhere in the diff; no ESLint config or ignore-list changes unless that is the PR's stated purpose

## Architecture

- [ ] Correct package/layer (`01-repository-architecture.md`, `02-backend-nestjs.md`)
- [ ] No infrastructure leakage into business logic
- [ ] No unnecessary abstraction (and no `BaseRepository`/base class quietly accumulating feature-specific methods — `21-oop-and-solid-principles.md`)
- [ ] Existing patterns reused, not duplicated
- [ ] No new circular dependency (package-level or NestJS module-level — `01-repository-architecture.md`)
- [ ] SOLID principles respected where a class/interface boundary was added or changed (`21-oop-and-solid-principles.md`)
- [ ] No shortcut, hack, or "temporary" workaround left silent — if one genuinely exists, it's called out explicitly in the PR description (`15-feature-development-process.md`)

## Type safety

- [ ] No `any`, `unknown`, `never` (outside exhaustiveness), no casts, no `as const`
- [ ] No `typeof` domain-type workaround
- [ ] No magic numbers or unexplained literal constants — named, typed constants instead (`00-non-negotiables.md`)
- [ ] Zod schemas define boundary types, and the same schema drives request validation, response typing, and Swagger — not three separate definitions (`05-contracts-zod-api.md`)
- [ ] Generics used where they preserve reusable type information, not added for their own sake
- [ ] Explicit return types
- [ ] Explicit access modifiers

## Backend

- [ ] Authentication enforced
- [ ] Authorization enforced, and explicitly mapped for every new/changed endpoint (permission, ownership, tenant, ReBAC, RLS — `10-security-auth-authorization.md`)
- [ ] Server-side validation exists independently of any frontend validation — never assumed to already be "covered" by the client (`05-contracts-zod-api.md`)
- [ ] Tenant/org boundary enforced
- [ ] Input validated
- [ ] Pagination bounded
- [ ] Sort fields allowlisted
- [ ] Transaction boundaries correct — no external I/O inside a DB transaction
- [ ] No N+1 query introduced (`08-database-prisma.md`, `19-performance-and-scalability.md`)
- [ ] Any concurrent-write code path protected against race conditions (atomic update, optimistic lock, or pessimistic lock as appropriate — `08-database-prisma.md`)
- [ ] Events/jobs idempotent; payment-related flows idempotent by construction (`09-messaging-and-jobs.md`)
- [ ] Errors mapped safely to stable error codes
- [ ] State-changing endpoints produce a correct, complete audit log entry (`10-security-auth-authorization.md`)

## Database

- [ ] Migration included
- [ ] `seed.ts` updated to match the schema change, or explicitly noted as not needed (`08-database-prisma.md`)
- [ ] Soft delete fields (`isDeleted`, `deletedAt`, `deletedBy`) present on any new business-entity model, and deletes go through them rather than a hard `DELETE` (`08-database-prisma.md`)
- [ ] Every list/search query for a soft-deletable entity filters `isDeleted: false`
- [ ] Constraints considered
- [ ] Indexes justified by an actual access pattern
- [ ] N+1 avoided
- [ ] No unbounded query
- [ ] Tenant isolation verified

## Frontend

- [ ] Server/client boundary intentional
- [ ] TanStack Query owns server state
- [ ] Zustand only owns genuinely client state
- [ ] URL state used where appropriate
- [ ] Smart/dumb separation preserved — no domain logic in low-level components
- [ ] Client-side validation present for UX, using the SAME shared zod schema as the backend (`05-contracts-zod-api.md`)
- [ ] Loading/error/empty states present
- [ ] Mobile responsive
- [ ] Dark/light theme correct
- [ ] Accessibility checked

## Object storage (if applicable)

- [ ] Uploads validated (type, size) before/at the storage boundary
- [ ] Large file uploads use multipart upload with per-chunk retry, not whole-file retry (`20-object-storage.md`)
- [ ] URLs are signed/short-lived where the content isn't meant to be public
- [ ] No secret storage credentials shipped to a client bundle

## Messaging

- [ ] Correct transport selected for the semantics needed
- [ ] Schema versioned
- [ ] Duplicate delivery considered
- [ ] Retry policy defined
- [ ] Dead-letter path defined
- [ ] Correlation context preserved
- [ ] No new single point of failure introduced by this change (`12-observability-and-operations.md`)

## Testing

- [ ] Unit tests — including for small/simple new functions, not just "complex" ones (`11-testing-vitest.md`)
- [ ] Integration tests where a boundary changed
- [ ] Authorization denial test
- [ ] Tenant isolation test
- [ ] Failure/retry tests for async work
- [ ] Contract tests where API/event changed

## Documentation

- [ ] README/package docs updated
- [ ] ADR added when appropriate
- [ ] Runbook updated for operational behavior changes

## How to use this checklist — and how to write a review comment that actually helps

Running through the checklist mechanically is necessary but not sufficient — a checkbox ticked without genuine scrutiny is worse than useless, because it creates false confidence that the change was actually reviewed. For each item, ask yourself "did I actually verify this, or did I assume it because the PR author seems competent?" The second answer is not a real review.

### What a good review comment looks like

```text
❌ DON'T — vague, unactionable feedback that forces the author to guess
   what you actually mean and burns a whole review round-trip on
   clarification:
   "this doesn't look right"
   "can you clean this up?"
   "are you sure about this approach?"

✅ DO — specific, actionable, and (where relevant) pointing at the exact
   rule/doc that applies, so the author can fix it AND learn the
   underlying principle for next time:
   "This query fetches `include: { items: true, customer: true, customer.orders: true }`
   but the endpoint only ever renders `items` and `customer.name` — per
   08-database-prisma.md's query-efficiency section, trim this to an
   explicit `select` so we're not pulling every historical order for
   every customer on every single order lookup."
```

### Severity in review comments

Distinguish, explicitly, in how you phrase a comment: a **blocking** issue (references `00-non-negotiables.md` or a security/data-integrity concern — this must be fixed before merge, say so plainly: "blocking:"), versus a **non-blocking suggestion** (a genuine improvement, but not worth holding the PR for — say so too: "non-blocking, could be a follow-up:"). Leaving this ambiguous forces the author to guess whether they need to address something now or can reasonably defer it, which wastes everyone's time either way.

## Example: a filled-out review, for calibration

```text
PR: "Add reward publishing endpoint"

Architecture: ✅ Correct layer, follows existing rewards module structure.

Type safety: ❌ BLOCKING — publish-reward.dto.ts has `metadata: any` on line 12.
  Per 00-non-negotiables.md, this needs a real zod schema even if the
  metadata shape is loosely defined — see the z.record() pattern in
  05-contracts-zod-api.md's "No z.any()" example.

Backend: ❌ BLOCKING — no @RequirePermission decorator on the publish
  endpoint at all. Per 10-security-auth-authorization.md, every endpoint
  needs its authorization explicitly mapped — right now ANY authenticated
  user can publish ANY reward.

Backend: ⚠️ non-blocking, follow-up ticket filed — the eligibility check
  does two separate DB round trips that could be one query. Not a
  correctness issue, just a minor N+1-adjacent inefficiency, worth
  revisiting but not blocking this PR.

Database: ✅ Migration present, seed.ts updated, soft-delete fields present.

Testing: ❌ BLOCKING — no test for the "user lacks permission" denial
  case. Per 11-testing-vitest.md, every authorization rule needs both
  the allowed AND denied case tested.

Overall: 3 blocking items above, please address and I'll re-review.
```

This is what "using the checklist" looks like in practice — not a silent checkbox pass, but specific findings tied to specific rules, each one clearly marked as blocking or not.

## Requesting changes vs approving with comments

```text
❌ DON'T — approve a PR with unresolved BLOCKING findings (per this
   document's severity guidance above) "to unblock the author," with a
   comment saying "please fix before merging" — this relies entirely on
   the author's memory and good faith to actually address it, with no
   structural gate ensuring they do, and it's exactly how a "temporary"
   shortcut becomes permanent (15-feature-development-process.md).

✅ DO — use "Request Changes" (not "Approve with comments") for anything
   blocking, so the PR structurally cannot merge until it's re-reviewed
   and the blocking items are actually resolved. Reserve "Approve" (with
   or without non-blocking comments) for a PR with zero outstanding
   blocking findings.
```

## Review turnaround

A PR sitting unreviewed for days creates real cost: context decays for the author, the PR drifts further from `main` (increasing merge-conflict risk), and it creates pressure to rush the eventual review once it finally happens. Treat a reasonably-sized PR's first review as owed within one business day where at all possible — and if a genuinely thorough review can't happen that fast, an initial pass flagging obvious blocking issues plus an honest ETA for the full review is better than silence.

## Reviewing your own AI agent's work — the same standard applies

If an AI coding agent produced the diff under review, it does not get a lighter review standard because "the AI probably followed the rules" — every item on this checklist applies exactly as rigorously as it would to human-written code, arguably more so early in adopting agent-assisted workflows, specifically because an agent can produce a large, plausible-looking diff quickly, and a large, plausible-looking diff is exactly the kind of thing that's easiest to under-review. If a rule from `00-non-negotiables.md` was violated, it doesn't matter whether a human or an AI agent wrote the offending line — it's still blocking.

## Common false-pass patterns to watch for specifically

```text
- A test that executes a line of code without asserting anything
  meaningful about it (11-testing-vitest.md's mocking/assertion guidance)
  — "there's a test" is not the same as "the behavior is verified."
- A permission guard added to an endpoint, but pointing at the WRONG
  permission (copy-pasted from a neighboring endpoint and not updated)
  — check that the specific permission named actually matches what the
  endpoint does, don't just check that A guard is present.
- A zod schema that validates SHAPE but not the actual business
  constraint that matters (e.g. validates `quantity: z.number()` but not
  `.positive()`, silently allowing a zero or negative quantity through).
- Soft-delete fields added to a model, but a list query elsewhere in the
  SAME PR that doesn't filter isDeleted: false — the fields existing
  doesn't mean they're actually being used correctly everywhere yet.
```

## Review by change type — extra focus areas

| PR touches… | Reviewer must specifically verify |
|---|---|
| A new endpoint | permission **named correctly**, ownership + tenant in the query, server validation, rate limit, audit coverage, denial tests |
| A Prisma schema change | migration safety (locks, defaults), `seed.ts`, soft-delete fields, indexes vs real queries, cascade rules, expand/contract if breaking |
| A list/search query | bounded, allowlisted sort/filter, index used, no N+1, `isDeleted: false`, tenant scope |
| Money / inventory / anything scarce | atomic or locked write, idempotency key, concurrency test, reconciliation path |
| A queue/event consumer | idempotency, retry classification, dead-letter path, schema version, correlation ids |
| File upload/download | multipart for large files, size/type limits, signed short-lived URLs, scoped credentials, scan-before-serve |
| Auth/session/token code | token lifetimes, rotation/revocation, no secrets in client, enumeration-safe responses, MFA step-up |
| A shared contract (`packages/contracts`) | change safety matrix (`05`), every consumer identified, mobile version lag considered |
| A reusable UI component | component API checklist (`07`), no data/business logic, tokens only, a11y, light/dark, responsive |
| A page / smart component | data ownership at the page, URL state, loading/empty/error, client boundary as small as possible |
| Dependencies | necessity, bundle/size impact, maintenance health, license, audit result |
| Config / infra / CI | no secrets committed, env separation, no new SPOF, failure behavior defined |

## Review anti-patterns (reviewer side)

```text
❌ Rubber-stamping large diffs ("LGTM") because they look tidy.
✅ Ask for the PR to be split when it can't be reviewed properly.

❌ Style nitpicks while missing the missing-authorization bug.
✅ Review in priority order: security & data integrity → correctness → architecture → tests → readability → style.

❌ "Can you clean this up?" (unspecified).
✅ Say what, where, why, and which rule.

❌ Reviewing only the diff.
✅ Also read the surrounding code the diff interacts with — the bug is often in what the change assumes.

❌ Approving because the author is senior (or because an AI wrote it, and "it usually gets it right").
✅ The same standard for everyone and everything.
```
