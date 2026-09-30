# 18 — Definition of Done

A feature is done only when every applicable item below is satisfied. "It works when I click through it" is the start of this checklist, not the end of it.

## The completion gate (first, and non-negotiable)

Before anything else on this list can count, run in the repo root, **after your last edit**:

```bash
pnpm run lint    # zero errors, zero warnings
pnpm run test    # all green
```

If either fails, fix the cause and re-run both. Suppression comments, config relaxation, skipped tests, and weakened assertions are not fixes. Full rules and the reporting requirement are in `AGENTS.md` ("Completion gate"). An agent that cannot run the commands reports NOT VERIFIED, never "done".

## Code

- [ ] Correct architectural layer
- [ ] Existing patterns reused
- [ ] Type-safe (no forbidden constructs — `00-non-negotiables.md`)
- [ ] No magic numbers or unexplained constants
- [ ] No dead code
- [ ] Explicit public API
- [ ] No new circular dependency
- [ ] SOLID principles respected for any new class/interface design
- [ ] No unreviewed shortcut or hack — this is a starter kit, not a prototype (`15-feature-development-process.md`)

## API

- [ ] Request validation (zod, shared with Swagger — `05-contracts-zod-api.md`)
- [ ] Server-side validation is independent and complete — not assumed to be "already handled" by frontend validation
- [ ] Response contract
- [ ] Stable error codes
- [ ] Authentication
- [ ] Authorization explicitly mapped (permission, ownership, tenant, ReBAC, RLS — `10-security-auth-authorization.md`)
- [ ] Rate limits considered
- [ ] Pagination/filter/sort bounded and allowlisted
- [ ] No N+1 introduced; endpoint verified fast under a realistic dataset size
- [ ] Any concurrent-write path is race-condition safe
- [ ] Audit log entry produced for every state-changing call, with full metadata

## Database

- [ ] Prisma schema updated
- [ ] Migration created
- [ ] `seed.ts` updated to match
- [ ] Soft-delete fields present on new business-entity models; deletes use them, not a hard `DELETE`
- [ ] Constraints reviewed
- [ ] Indexes reviewed against actual access patterns
- [ ] Tenant isolation reviewed
- [ ] Transaction boundary reviewed

## Async

- [ ] Correct transport chosen (HTTP/Kafka/RabbitMQ/BullMQ)
- [ ] Payload schema defined
- [ ] Idempotency handled — mandatory if payment-related
- [ ] Retry policy defined
- [ ] Dead-letter behavior defined
- [ ] Observability (correlation IDs) wired through
- [ ] No new single point of failure introduced

## Object storage (if applicable)

- [ ] Upload validation (type/size) enforced
- [ ] Large uploads use multipart upload with per-chunk retry
- [ ] Access URLs signed/scoped appropriately
- [ ] No storage credentials exposed to the client

## Web

- [ ] SSR/client boundary justified
- [ ] TanStack Query used appropriately, no duplicated server state in Zustand
- [ ] Client-side validation uses the same shared schema as the backend
- [ ] Loading/error/empty states
- [ ] Responsive
- [ ] Accessible
- [ ] Light/dark
- [ ] No low-level business logic

## Mobile

- [ ] Expo runtime safe (no Node/DOM-only imports)
- [ ] Secure storage reviewed for any sensitive data
- [ ] Accessibility reviewed
- [ ] Loading/error states
- [ ] Network failure considered

## Tests

- [ ] Unit tests — including for every new function, regardless of size
- [ ] Integration tests where a boundary changed
- [ ] Contract tests where API/event changed
- [ ] Authorization denial test
- [ ] Tenant isolation test
- [ ] Async duplicate/retry behavior, idempotency for payment flows

## Operations

- [ ] Logs (structured, no sensitive data)
- [ ] Metrics
- [ ] Tracing/correlation
- [ ] Health/readiness unaffected or updated
- [ ] Failure behavior for every new external dependency

## Documentation

- [ ] README/package docs
- [ ] ADR if architecture changed
- [ ] Runbook if operations changed
- [ ] Endpoint permission mapping recorded

## Verification

- [ ] `pnpm run lint` — zero errors, zero warnings, run after the last edit
- [ ] typecheck
- [ ] `pnpm run test` — all green, run after the last edit
- [ ] typecheck
- [ ] build
- [ ] migration validation

## What "done" is not

```text
❌ "It works when I click through it myself" is not done — it hasn't
   been tested against the cases a real, adversarial, or simply unlucky
   user will hit.

❌ "The happy path has a test" is not done — the denial/error/edge cases
   are where the real risk lives (11-testing-vitest.md).

❌ "I'll add the audit logging/tests/docs in a follow-up PR" is not done
   — per 15-feature-development-process.md, this is exactly the kind of
   silent shortcut this project does not accept. If a follow-up is
   genuinely, deliberately agreed as the right sequencing (rare), it's
   an explicit, tracked ticket referenced in THIS PR, not an
   unaccountable good intention.

❌ "CI is green" alone is not done if the change needed a human judgment
   call this checklist calls for (an ADR, a runbook, a migration
   rollout plan) that no automated check can verify.
```

## Done means

Every applicable box above is checked, honestly — not glanced at and assumed. A PR description that walks through this checklist explicitly (or references it) gives a reviewer a real starting point instead of a blank diff to reverse-engineer intent from.

## Definition of Done vs Definition of Ready — where each applies

`15-feature-development-process.md` introduces Definition of Ready as the bookend BEFORE work starts; this document is the bookend AFTER. A feature that was never properly Ready often can't cleanly reach Done either — scope that was ambiguous at the start tends to surface as an incomplete or contested checklist at the end, when it's far more expensive to renegotiate. If you find yourself unable to check off items on this list because the requirement was never actually clear, that's a signal to trace the gap back to a missed Definition-of-Ready step, not to quietly lower this document's bar to match what got built.

## Worked example — applying the full checklist to one PR

Continuing the "download invoice PDF" example from `15-feature-development-process.md`:

```text
Code: ✅ correct layer, ✅ type-safe, ✅ no magic numbers (PDF page
  margins pulled from a named constant, not bare numbers), ✅ no dead code.

API: ✅ request validation (order ID is a validated UUID param),
  ✅ authorization explicitly mapped (ownership check: only the order's
  own customer or an admin), ✅ rate limiting added (PDF generation is
  CPU-expensive — capped at 10/minute per user).

Database: N/A — no schema change for this feature.

Async: the PDF is generated synchronously for now (small orders, proven
  fast enough in testing) — documented explicitly as a deliberate choice,
  with a noted follow-up trigger ("if p99 generation time exceeds 3s,
  revisit as a queued BullMQ job") rather than left as an unstated assumption.

Object storage: ✅ generated PDF uploaded with a short-lived (5 minute)
  signed download URL, ✅ not publicly readable.

Web: ✅ loading state while generating, ✅ error state if generation
  fails, ✅ responsive, ✅ accessible (download link has a clear
  accessible name, not just a bare icon).

Tests: ✅ unit test for the ownership-denial case, ✅ unit test for the
  happy path, ✅ integration test confirming the signed URL actually
  works against a test storage bucket.

Operations: ✅ generation duration logged as a metric, so the "revisit
  as async" trigger above is actually measurable, not just a comment.

Documentation: ✅ endpoint documented in the orders module README,
  ✅ permission mapping recorded per 10-security-auth-authorization.md.

Verification: ✅ lint, ✅ typecheck, ✅ tests, ✅ build all green in CI.
```

This is what "every applicable box, checked honestly" looks like for one small, real feature — not a rubber stamp, but a genuine walk through each relevant concern with a specific, verifiable answer for each one.

## Done checklist by artifact (quick view)

```text
Endpoint done      = contract + guards mapped + service/policy + repo (race-safe, tenant-scoped, soft-delete aware)
                     + audit covered + Swagger from zod + rate limit + tests (allowed/denied/tenant/unauth/edge) + docs
Table/column done  = schema + migration + seed.ts + indexes + soft-delete fields + contract updated + backfill plan if needed
Job/consumer done  = schema versioned + idempotent + retry classified + dead-letter path + metrics + correlation + tests (duplicate/retry)
UI component done  = props generic + CVA variants + ref + events + tokens + a11y + light/dark + responsive + states + tests + docs
Page/screen done   = smart owns data + URL state + loading/empty/error + validation shared with server + layout unchanged + verified on devices
Upload flow done   = multipart + per-chunk retry + resume + validation + signed short-lived URLs + scoped creds + scan + cleanup policy
Migration done     = safe on large tables + expand/contract if breaking + tested on production-shaped data + rollback/forward plan
Bugfix done        = failing test first + root cause fixed + same-class bugs searched + regression test kept
```
