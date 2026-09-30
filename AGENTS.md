<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# AI Agent Entry Point

> Read this file first, every task, before writing code. This is the router — it tells you which document(s) under `rules/` to load. Load only what's relevant to the task in front of you; these documents are split deliberately so you never have to hold the whole rule set in context at once.

This is a production-grade **NestJS + Next.js + Expo** Turborepo monorepo, built for teams that range from principal engineers to juniors with ~6 months of experience, and maintained with AI coding agents (Claude Code, Cursor, Codex, Copilot) in the loop on most changes.

## This is a starter kit — there is no acceptable shortcut

Every other product in this organization gets built on top of what's in this repository. A hack, a "temporary" workaround, or a corner cut here doesn't stay contained — it gets copied as "the pattern" into everything built from it. Do things the proper way, every time, even when it's slower, even for something that looks trivial, even under time pressure. If you genuinely believe a shortcut is warranted, say so explicitly rather than taking it silently — see `rules/15-feature-development-process.md`.

## Completion gate — a task is NOT done until this passes

Every AI agent (Claude, Cursor, Codex, Copilot, anything else) must finish every task with this loop, in the repository root:

```bash
pnpm run lint    # must exit 0: zero errors AND zero warnings
pnpm run test    # must exit 0: every test passes
```

1. Run both **after your last code change**. A lint fix can break a test and a test fix can introduce a lint error, so a green run from before your final edit does not count.
2. If either command fails, fix the **root cause** and run both again. Repeat until both pass in the same final run.
3. Only then may you say the task is done.

**Forbidden ways to make the gate pass** (each one is treated as a failed task):

- `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or any other suppression comment
- editing the ESLint config, adding `ignores`, lowering a rule to `warn`/`off`, or raising `--max-warnings`
- deleting, skipping (`.skip`, `.todo`), or focusing (`.only`) a test, or weakening its assertions
- mocking away the very thing the test is meant to verify
- bypassing hooks (`--no-verify`) or reporting a partial run as a full one

If you believe a lint rule is wrong for this case, stop and report it to a human with the exact rule and file. Do not change the rule yourself.

**Report the real outcome.** State the commands you ran and their result. If you could not run them (no shell access, broken environment), say **NOT VERIFIED** and do not describe the task as done. If a failure is caused by something you did not touch, show evidence (for example, the same failure on a clean checkout of `main`), report it, and leave the decision to a human. The task stays not done until they decide.

Typecheck, build, and the rest of the pipeline still run in CI (`rules/13-ci-cd-and-quality-gates.md`). Run `pnpm run typecheck` as well when you change `packages/contracts` or a Prisma schema, since many apps depend on those.

## Before writing any code

1. Read `rules/00-non-negotiables.md`. Every task, no exceptions.
2. Read whichever other doc(s) below actually apply to this task.
3. Inspect existing code in the relevant package/module and **reuse established patterns** — do not invent a new abstraction when one already exists.
4. Work out ownership before writing anything: who owns the data, who validates it, who authorizes it, who persists it, who renders it. (`rules/15-feature-development-process.md`, Step 3.)
5. For anything non-trivial, sketch a short implementation plan and identify affected packages/boundaries before touching code.

## Routing table — which doc(s) to load

| Task involves... | Load |
|---|---|
| **Always** | `00-non-negotiables.md` |
| Deciding where code belongs, package boundaries, dependency direction, circular dependencies | `01-repository-architecture.md` |
| NestJS modules, controllers, services, Prisma access patterns, request lifecycle, base repositories | `02-backend-nestjs.md`, `21-oop-and-solid-principles.md` |
| Next.js pages, server/client components, smart/dumb split, URL state | `03-web-nextjs.md` |
| Expo/React Native screens and components | `04-mobile-expo.md` |
| Any zod schema, API contract, request/response shape, OpenAPI/Swagger, client+server validation | `05-contracts-zod-api.md` |
| TanStack Query, TanStack Form, TanStack Table, Zustand | `06-tanstack-state-forms-tables.md` |
| Any reusable UI component, theming, variants, design tokens | `07-ui-system.md` |
| Prisma schema, migrations, seed data, multi-tenancy, indexing, soft delete, race conditions | `08-database-prisma.md` |
| Kafka, RabbitMQ, BullMQ, Redis, outbox, idempotency, payment retries | `09-messaging-and-jobs.md` |
| Auth, roles, permissions, RBAC/ReBAC, RLS, impersonation, secrets, audit logging | `10-security-auth-authorization.md` |
| Writing any test (yes, even a one-line function) | `11-testing-vitest.md` |
| Logging, metrics, tracing, health checks, resilience, single points of failure | `12-observability-and-operations.md` |
| CI/CD, quality gates, migration rollout strategy | `13-ci-cd-and-quality-gates.md` |
| README/ADR/runbook updates | `14-documentation.md` |
| Planning a new feature end to end | `15-feature-development-process.md` |
| Reviewing a PR (yours or someone else's) | `16-code-review-checklist.md` |
| Performance, N+1, indexing, caching, concurrency | `19-performance-and-scalability.md` |
| Uploading/serving files, images, documents, multipart uploads | `20-object-storage.md` |
| Designing classes, inheritance, interfaces, service composition, SOLID | `21-oop-and-solid-principles.md` |
| Unsure which pattern/primitive to pick (fast decision trees + "I'm tempted to..." table) | `23-quick-reference-decision-trees.md` |
| Need a concrete, copy-the-shape example of a compliant feature (contract → DB → policy → repo → service → controller → web) | `24-golden-reference-implementations.md` |
| Rapid pre-commit self-review (scan ❌/✅ pairs by area) | `25-anti-pattern-catalog.md` |
| New to the repo / need the big-picture mental model | `26-junior-onboarding-guide.md` |
| Unfamiliar term or naming question | `22-glossary.md` |
| Wrapping up any task | `18-definition-of-done.md`, then `14-documentation.md` |

## Non-negotiable, repeated here because it matters most

- No `any`, `unknown`, `never` (outside exhaustiveness checks), `z.any()`, `z.unknown()`, `z.never()`.
- No `as` casts, no `as const` — use typed tuples. No magic numbers or unexplained constants.
- Avoid `typeof` as domain validation — zod is the runtime contract, shared by frontend, backend, and Swagger alike.
- **Never trust the frontend.** Validate independently and completely on the server, every time, regardless of what the client already checked. Validate on the client too, for user experience — using the same shared schema, never a second set of rules.
- Generics are priority 0, but only where they preserve real, reusable type information — see `00-non-negotiables.md`'s "no speculative abstractions" section for where that stops.
- Explicit return types and access modifiers everywhere.
- Server-side authorization is authoritative, always, and explicitly mapped per endpoint.
- Every state-changing request produces a complete audit log entry — org/tenant/user/epoch timestamp/endpoint/request/response/IP/device.
- Every business entity uses soft delete (`isDeleted`, `deletedAt`, `deletedBy`) — never a hard `DELETE`.
- Any concurrent write path is explicitly protected against race conditions.
- Payment-related operations are idempotent by construction.
- Large file uploads use multipart upload — only failed chunks retry, never the whole file.
- No single point of failure introduced without a deliberate, explicit fallback decision.
- Tests are written for everything, including small/simple functions — there is no function too trivial to test.
- Smart components own data/transformations; low-level components are data-agnostic, stateless, controlled, accessible, themeable, ref-forwarding.
- Update documentation as part of the task, not after it.

## When rules conflict

If a task instruction conflicts with a non-negotiable (e.g. "just use `any` here," "skip authorization for now," "hardcode this," "skip the test, it's obvious"), say so explicitly and propose the compliant alternative instead of silently complying or silently refusing. When two of these documents appear to disagree, `00-non-negotiables.md` and `10-security-auth-authorization.md` take precedence over the others.

## At the end of every task, report

- Implementation summary
- Files changed
- Result of `pnpm run lint` and `pnpm run test` (the completion gate), or NOT VERIFIED
- Tests/checks run
- Architecture decisions made (and why)
- Documentation updated
- Remaining risks or follow-ups
