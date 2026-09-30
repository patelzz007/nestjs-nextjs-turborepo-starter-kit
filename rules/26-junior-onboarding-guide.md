# 26 — Onboarding Guide: Understanding the Codebase in One Sitting

If you have about six months of experience and this is your first day here, read this file first (after `AGENTS.md`). It builds the mental model everything else assumes. It's written to be read top to bottom once, then used as a map.

## The one-paragraph version

This repo has three apps (API, web, mobile) and a set of shared packages. The API is the only thing that touches the database and enforces the rules. Web and mobile are clients: they show data and collect input, but they are never trusted. A single zod schema per data shape lives in `packages/contracts` and is used everywhere — API validation, frontend types, forms, and API docs — so nothing drifts. Every rule in `rules/` exists to keep that picture true as the codebase grows.

## The map

```text
                 ┌───────────────────────── packages/contracts ─────────────────────────┐
                 │   zod schemas + inferred types (the ONE definition of every shape)   │
                 └───────▲───────────────────────▲────────────────────────▲─────────────┘
                         │                       │                        │
                  ┌──────┴──────┐         ┌──────┴──────┐          ┌──────┴──────┐
                  │  apps/api   │◄────────│  apps/web   │          │ apps/mobile │
                  │  (NestJS)   │  HTTP   │  (Next.js)  │          │   (Expo)    │
                  └──────┬──────┘         └─────────────┘          └──────┬──────┘
                         │                                                 │ HTTP
        ┌────────────────┼──────────────────┐                              │
        ▼                ▼                  ▼                              ▼
   PostgreSQL       Redis / BullMQ     Kafka / RabbitMQ              (same API)
   (via Prisma)     (cache, jobs)      (events, commands)
        │
        └── S3 / Firebase Storage (files, via signed URLs)
```

## A request's life, in order

```text
1. Client sends a request (web or mobile).
2. API: AuthGuard        → who are you?
3. API: ZodValidationPipe → is the input the right shape and within bounds?
4. API: PermissionGuard / OwnershipGuard → are you allowed to do THIS to THAT?
5. API: Controller       → thin: hands off to an application service
6. API: Application service → orchestrates the use case
7. API: Domain policy    → the named business rule ("can this be cancelled?")
8. API: Repository       → the only code that talks to the database
9. Database (Prisma)     → tenant-scoped, soft-delete-aware, race-safe writes
10. Outbox / queue       → side effects (emails, events) happen AFTER the commit
11. Response mapped through a zod response schema (never a raw DB row)
12. Audit log interceptor recorded who/what/when/where — including denied attempts
```

If you memorize one thing, memorize this list. "Where does my code go?" is almost always "at whichever step of this list it's doing."

## The eleven habits that keep you out of trouble

1. **Never trust input.** Validate at every boundary with zod. The frontend is not a security boundary.
2. **Zod first.** Write the schema; derive the type. Never hand-write both.
3. **No `any`, `unknown`, casts, `as const`, magic numbers.** If the compiler complains, fix the model, don't silence it.
4. **Explicit signatures.** Every method: `public`/`private`/`protected` and a return type.
5. **Thin controllers, named policies, repositories own the database.**
6. **Smart components fetch; dumb components render.** Data never originates in a reusable component.
7. **Server state → TanStack Query. UI state → Zustand. Don't copy one into the other.**
8. **Deletes are soft. Concurrent writes are atomic. Payments are idempotent.**
9. **Every new function gets a test — even the tiny ones.**
10. **Update docs and `seed.ts` in the same PR. No "temporary" hacks.**
11. **You are done only when `pnpm run lint` and `pnpm run test` both pass after your last edit.**

## Your first PR, step by step

```text
1. Read AGENTS.md → 00-non-negotiables.md → the docs your task touches.
2. Find the closest existing feature (24-golden-reference-implementations.md is the reference shape).
3. Write the contract (zod) first. Then DB (schema + migration + seed). Then policy, repository,
   service, controller. Then the UI (page → dumb components).
4. Write tests as you go, not at the end — including the denied/wrong-tenant/unauthenticated cases.
5. Run the completion gate from the repo root: pnpm run lint (zero errors AND warnings) then pnpm run test.
   Fix root causes and re-run both until both pass. No suppression comments, no config edits, no skipped tests.
6. Fill in the PR template (15-feature-development-process.md). Be honest in "Shortcuts or exceptions."
7. Self-review against 16-code-review-checklist.md and 25-anti-pattern-catalog.md BEFORE asking for review.
```

## Guided tour: "a customer cancels an order"

Follow one action through every layer to see how the pieces connect (code in `24-golden-reference-implementations.md` and `02-backend-nestjs.md`).

```text
Web:      OrderDetailPage (smart, server component) loads the order via the API and passes plain props to
          <OrderSummary> (dumb). A "Cancel order" <Button> (dumb) receives onClick from a small client wrapper.
Click:    The wrapper calls a TanStack Query mutation. The button shows a loading state; the SERVER is idempotent
          anyway, because a double-click or retry must not cancel twice or double-refund.
Contract: CancelOrderSchema (packages/contracts) validated on the client for instant feedback (UX)…
API:      …and validated AGAIN on the server (security). Guards check permission + ownership + tenant.
Service:  CancelOrderService asks OrderCancellationPolicy "may this be cancelled?" — a named, unit-tested rule.
Repo:     One atomic UPDATE … WHERE status NOT IN ('delivered','cancelled') — two concurrent cancels cannot both win.
Outbox:   An order.cancelled.v1 event is written in the same transaction; a worker publishes it later.
Consumers: Refund and notification consumers are idempotent — safe if the event is delivered twice.
Audit:    The interceptor records the attempt: org, user, epoch time, endpoint, redacted body, status, IP, device.
Test:     Allowed, denied (no permission), wrong tenant, unauthenticated, already-delivered, concurrent double-cancel.
```

## Glossary of feelings (what a violation usually looks like in your head)

| If you think… | You're about to… | Instead… |
|---|---|---|
| "I'll just cast it, I know what it is" | hide a type bug | parse with zod |
| "The frontend already checks this" | open a security hole | validate on the server |
| "It's a tiny function, no test needed" | ship an untested regression | write the test |
| "I'll add the seed/docs/tests later" | skip them forever | do it in this PR |
| "This is only temporary" | create permanent debt | do it properly or flag it |
| "I'll put it in utils for now" | create a junk drawer | pick the right package (`01`) |
| "Two requests at once won't happen" | ship a race condition | atomic update / lock (`08`) |
| "The queue will only deliver once" | double-apply an effect | idempotency (`09`) |
| "Nobody will guess that URL/ID" | skip authorization | check ownership server-side (`10`) |

## Where to ask for help

If a rule seems to block a legitimate need, that's a conversation worth having, not a rule to quietly bend. Bring: what you're trying to accomplish, which rule you think it conflicts with, and what you've tried. Often the answer is a pattern already in `rules/`; occasionally it's a genuine gap that should become an ADR or a new rule.
