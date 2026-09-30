# 15 — Feature Development Process

## This is a starter kit — do it properly, every time

This repository is the foundation other products get built on top of. A shortcut taken here doesn't stay contained to one feature — it gets copied as "the pattern" into every product that starts from this starter kit. Because of that, **"just make it work" / "we'll clean it up later" / "it's just a hack to unblock the demo" is not an acceptable standard anywhere in this codebase**, including in code an AI agent writes on its own initiative to satisfy an ambiguous request.

```text
❌ DON'T — reach for the fastest thing that makes an error go away:
   skipping validation to get past a blocked request, casting a type to
   silence a compiler error, hardcoding a value to avoid writing the
   config plumbing, skipping a test because the feature "obviously works,"
   or copy-pasting a whole function instead of extracting a genuinely
   reusable piece.

✅ DO — take the extra time to do it the way this document describes,
   every time, even under time pressure, even for a "small" feature, even
   if the shortcut would only be used "temporarily." Temporary code has a
   well-documented tendency to become permanent the moment it starts working.
```

If a genuine shortcut is truly necessary (a real deadline, a real constraint), it is called out **explicitly** — in the PR description, in a code comment, and ideally in an ADR — rather than quietly slipped in and left for someone else to discover later. Silence is what turns a one-time exception into an unreviewed, unremembered permanent decision.

## Step 1 — Understand the request

Convert the request into functional, non-functional, security, data, UI, and operational requirements.

## Step 2 — Find existing patterns

Search before creating a new: API endpoint, schema, repository, component, hook, Zustand store, query, mutation, job, event, or test helper. Reusing an established pattern beats inventing a new one — and inventing a near-duplicate of something that already exists is its own kind of shortcut, just one that looks more like "real work."

## Step 3 — Define ownership

```text
Who owns the data?        Who validates it?        Who transforms it?
Who authorizes it?        Who persists it?           Who publishes the event?
Who renders it?
```

## Step 4 — Define contracts

Before implementation: request schema, response schema, database changes (including the `seed.ts` update and the soft-delete fields — `08-database-prisma.md`), event/job schema, UI props. Naming things clearly here — no magic numbers or unexplained constants anywhere in the contract (`00-non-negotiables.md`) — saves far more time in review than it costs to think through up front.

## Step 5 — Implement backend

```text
schema → controller → authorization → application service → domain/policy → repository → database → outbox
```

Along the way, deliberately check: validation exists on the server regardless of what the frontend already checks (`05-contracts-zod-api.md`), the query pattern avoids N+1 and has a matching index (`08-database-prisma.md`, `19-performance-and-scalability.md`), any concurrent-write path is protected against race conditions (`08-database-prisma.md`), every endpoint's permissions are explicitly mapped (`10-security-auth-authorization.md`), and state-changing actions will be captured by the audit log interceptor (`10-security-auth-authorization.md`).

## Step 6 — Implement frontend

```text
page/smart component → query/mutation → contract → API → feature transformation → dumb component
```

Client-side validation is added for user experience using the *same* shared zod schema the backend uses — never a second, separately-maintained set of rules (`05-contracts-zod-api.md`).

## Step 7 — Implement mobile

Reuse contracts where runtime-safe. Don't force web-specific UI abstractions onto React Native — see `04-mobile-expo.md`.

## Step 8 — Add asynchronous work

Choose synchronous HTTP, Kafka, RabbitMQ, or BullMQ based on the semantics you actually need (`09-messaging-and-jobs.md`'s decision matrix), not based on what's already imported in the file you're editing. If it touches a payment gateway, idempotency is designed in from the start, not bolted on after a bug report.

## Step 9 — Test

Test the business rule before polishing implementation details — and write the test even for the "obviously simple" helper function you wrote along the way (`11-testing-vitest.md`). No exceptions for size or perceived obviousness.

## Step 10 — Verify UX

Check: loading, error, empty, disabled, permission-denied, mobile, dark mode, keyboard, accessibility.

## Step 11 — Document

Update relevant documentation and ADRs (`14-documentation.md`).

## Step 12 — Review

Ask: Is this the correct layer? Is data duplicated? Can another feature reuse this? Is authorization server-side and explicitly mapped? Can duplicate events break it? What happens when Redis/Kafka/RabbitMQ is down (`12-observability-and-operations.md`'s single-point-of-failure checklist)? What happens on retry? What happens during partial deployment? What happens with a second tenant? If this touches payments — is it idempotent? If this creates or edits a record — does the delete path (if any) soft-delete rather than hard-delete? Is there anything here that only works because of a shortcut, and if so, is that shortcut called out explicitly rather than left silent?

## Spikes and prototypes — labeled honestly, never shipped as-is

```text
❌ DON'T — write a quick, exploratory prototype to answer a technical
   question ("will this third-party API even support what we need?"),
   and then, once it technically works, quietly turn it into the real
   feature by bolting on a few more things — skipping the validation,
   error handling, tests, and review rigor this document requires,
   because "most of it is already written."

✅ DO — treat a spike as disposable, throwaway code by default, clearly
   labeled as such (a separate branch, an explicit note in the PR/ticket
   that this is exploratory). Once the technical question is answered,
   the REAL implementation is written properly, following this entire
   process from Step 1 — reusing insight from the spike, not its actual
   code, unless that code is deliberately reviewed against this
   document's full standard before being kept.
```

## Estimation and scope discipline

When a request is ambiguous about scope ("add search to the orders page" could mean a simple client-side filter or a full server-side search-and-facet system), resolve the ambiguity explicitly before starting, rather than picking the interpretation that's fastest to build and hoping it's what was actually wanted. An hour spent clarifying scope up front is cheaper than a day spent building the wrong thing well.

## Feature flag rollout process

For a feature shipped behind a flag (`13-ci-cd-and-quality-gates.md`), the rollout plan is part of the feature's definition, not an afterthought decided once the code happens to be ready: who sees it first (internal team, a small percentage, a specific tenant), what signals determine whether to widen or roll back the rollout, and who owns watching those signals during the rollout window.

## Cross-team/cross-app coordination

For a change that touches a shared contract (`packages/contracts`) or a shared package consumed by another team's app, identify every consumer and their release cadence BEFORE merging — not after, when a consumer's build has already broken. A shared-contract change with real downstream impact is coordinated explicitly (a heads-up, an agreed timeline), not dropped in without warning just because it technically passed this project's own CI.

## Definition of Ready — the bookend to Definition of Done

Before Step 1 of this process genuinely begins, a feature request should meet a basic bar of readiness — starting work on something too vague invites exactly the scope-guessing this document already warns against.

```text
A feature is READY to start when:
- [ ] The actual user/business problem is stated, not just a proposed solution
- [ ] Success is defined in a way that's checkable (not just "make it better")
- [ ] Any genuinely open design questions (which of two architectures,
      which of two UX approaches) have been resolved or explicitly
      deferred to a specific point in the process, not left ambiguous
- [ ] Dependencies on other teams/systems are identified up front, not
      discovered mid-implementation
```

A request that fails this bar isn't necessarily wrong to receive — but the right first step is clarifying it against this checklist, not starting to write code against best guesses.

## Worked example — applying this whole process to one concrete feature

To make the abstract steps above concrete, here's the process applied to a real, small example: "Let a customer download an invoice PDF for a past order."

```text
Step 1 (Understand): Functional: generate + serve a PDF for a completed
  order. Security: only the order's own customer (or an admin) can
  access it. Data: needs the order's full line-item detail, which may
  not currently be denormalized anywhere convenient. Operational: PDF
  generation could be slow — should it be synchronous or queued?

Step 2 (Existing patterns): Search — does this repo already generate any
  PDF anywhere (a receipt, a report)? Reuse that library/pattern rather
  than introducing a new PDF library for this one feature.

Step 3 (Ownership): The API owns generating and validating access to the
  PDF. Object storage (20-object-storage.md) owns the generated file
  once created. The web/mobile client owns triggering the download and
  showing a loading state while it's generated.

Step 4 (Contracts): GET /orders/:id/invoice → either streams a PDF
  directly (if fast enough to be synchronous) or returns a signed
  download URL once an async job completes.

Step 5 (Backend): Endpoint checks ownership (10-security-...), generates
  the PDF (a service method, unit-tested per 11-testing-vitest.md,
  including the "wrong customer requests someone else's invoice" denial
  case), and either returns bytes directly or uploads to object storage
  and returns a signed URL (20-object-storage.md).

Step 6 (Frontend): A "Download invoice" button (dumb component) whose
  onClick is wired up by the smart order-detail page, using a mutation
  (06-tanstack-...) that shows a loading state while the PDF generates.

Steps 9–12: Test the ownership-denial case explicitly. Verify the
  loading/error states on slow connections. Document the new endpoint's
  permission mapping. Review: does this endpoint need rate limiting
  (PDF generation can be CPU-expensive — a malicious actor requesting it
  repeatedly is a real concern, 19-performance-and-scalability.md)?
```

Notice how many of this document's cross-referenced rules got touched by even this one small, ordinary-sounding feature — that density is normal, not a sign the feature was unusually complex. This is what "doing it properly" actually looks like applied to a concrete case, not an abstract ideal.

## Pull request description template

```markdown
## What & why
<the user/business problem, and what this PR changes>

## Approach
<key design decisions; link ADR if any>

## Rule-set checklist
- [ ] Types: no any/unknown/never/casts/as const; no magic numbers
- [ ] Validation: shared zod schema on FE (UX) AND independently on BE (security)
- [ ] Authorization mapped per endpoint (permission / ownership / tenant / ReBAC / RLS): <table or link>
- [ ] Audit log covers every state change (incl. denied attempts)
- [ ] DB: migration + seed.ts + soft-delete fields + indexes justified
- [ ] Concurrency: race conditions addressed (which pattern?), idempotency if payments
- [ ] Performance: no N+1, bounded pagination, checked against realistic data size
- [ ] Failure modes: timeouts, fallbacks, no new SPOF
- [ ] Tests: unit (every new function) + integration + authorization denial + tenant isolation
- [ ] UI: loading/empty/error, responsive, light/dark, accessible, layout unchanged
- [ ] Docs: README / ADR / runbook / permission mapping updated

## Shortcuts or exceptions (must be empty or explicit)
<anything that deviates from the rules, why, and the tracked follow-up>

## How I verified
- [ ] `pnpm run lint` passes with zero errors and zero warnings (run after my last edit)
- [ ] `pnpm run test` passes (run after my last edit)
<other commands, screenshots for UI, load-test numbers if relevant>

## Risks / rollout
<flag? migration order? what to watch after deploy?>
```

A PR with an empty "Shortcuts or exceptions" section is making a claim: that there are none. Reviewers should treat that claim as something to verify, not skip.

## Commit and branch hygiene

```text
Branches:  <type>/<ticket>-<short-desc>     feat/REW-142-publish-reward · fix/ORD-88-double-cancel
Commits:   Conventional Commits            feat(rewards): add publish endpoint with atomic status transition
           One logical change per commit; a refactor never shares a commit with a behavior change.
❌ "wip", "fix", "stuff", "final final v2"
✅ messages that explain WHY when it isn't obvious from the diff
```

Keep PRs reviewable: aim for one concern per PR, and split a large change along the seams this rule set already defines (contract + migration → backend → frontend). A PR too large to review properly will be reviewed improperly — that is a process bug, not a reviewer failing.

## When a request conflicts with a rule

Decision order: (1) does a compliant approach achieve the actual goal? do that and explain; (2) if not, does the goal itself need to change? raise it; (3) only with explicit, recorded approval from a maintainer is an exception allowed — and it is then commented at the site, listed in the PR, and tracked with a follow-up. "The deadline" is never by itself an approval.
