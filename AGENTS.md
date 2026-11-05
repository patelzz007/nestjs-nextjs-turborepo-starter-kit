<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. These bundled docs match the installed package version and are available without network access. Heed deprecation notices.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the managed block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# AI Agent Entry Point

> Read this file first, every task, before writing code. This is the router. It identifies the authoritative rules and workflows. Load only the documents relevant to the task, but always load `rules/00-non-negotiables.md`.

This is a production-grade NestJS + Next.js + Expo Turborepo monorepo. It is a starter kit used as a foundation for other products. Claude Code, Cursor, Codex, Copilot, and other agents must follow the same repository contract. Tool-specific capabilities do not change repository rules.

## No acceptable shortcut

A workaround, shortcut, speculative abstraction, weakened test, or hidden exception can become the pattern copied into every product built on this starter. Do the correct thing at the correct layer. If a genuine temporary mitigation is necessary, label it explicitly, document risk/owner/expiry, and track the permanent correction. Never weaken security or data integrity.

## Completion gate

A task is not complete until all these 6 commands pass from the repository root after the final code/config/test edit:

```bash
pnpm run format
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run ci:local
```

If either fails, diagnose and fix the root cause, then run both again. Do not use lint suppressions, relax configuration, ignore patterns, skip/focus tests, weaken assertions, mock away the behavior under test, or bypass hooks. If a check cannot run, report `NOT VERIFIED` and why. Typecheck/build/integration/architecture/security checks required by the affected rules must also be run.

## Mandatory start sequence

1. Read `rules/00-non-negotiables.md`.
2. Read the applicable rules from the routing table below.
3. For non-trivial work, bugs, shared contracts, architecture, security, data, or runtime behavior, read `rules/32-ai-agent-execution-protocol.md`.
4. Inspect git status and preserve pre-existing user changes.
5. Inspect existing code, installed package versions, docs, tests, consumers, and ADRs before designing or editing.
6. Identify ownership, acceptance criteria, blast radius, and verification plan.
7. For bugs, follow `rules/16-bug-fixing-and-debugging.md`: reproduce, trace, prove root cause, fix at owning layer, add regression coverage.

## Routing table

| Task involves... | Load |
|---|---|
| **Always** | `00-non-negotiables.md` |
| Non-trivial task, execution process, context handoff, parallel work | `32-ai-agent-execution-protocol.md` |
| Bug, regression, flaky test, performance defect, operational failure | `16-bug-fixing-and-debugging.md`, `32-ai-agent-execution-protocol.md`, `skills/diagnosing-bugs/SKILL.md` |
| Feature planning and implementation | `15-feature-development-process.md`, `32-ai-agent-execution-protocol.md`, `skills/tdd-vertical-slice/SKILL.md` |
| Ambiguous product requirements or unresolved decisions | `skills/grill-and-spec/SKILL.md` |
| Code review | `16-code-review-checklist.md`, `skills/independent-code-review/SKILL.md` |
| Shared module, reusable abstraction, extension point, package boundary | `01-repository-architecture.md`, `21-oop-and-solid-principles.md`, `skills/codebase-design/SKILL.md` |
| NestJS modules, controllers, services, Prisma access, request lifecycle | `02-backend-nestjs.md`, `21-oop-and-solid-principles.md` |
| Commands and queries | `02-backend-nestjs.md`, `21-oop-and-solid-principles.md`, `23-quick-reference-decision-trees.md`, ADR 059, `30-cqrs.md` |
| Cross-context interaction | `01-repository-architecture.md`, `02-backend-nestjs.md`, ADR 058, `docs/architecture/context-map.md` |
| Domain model, aggregates, entities, invariants, domain errors | `02-backend-nestjs.md`, ADR 058, `docs/architecture/ddd-cqrs-spec.md`, `29-domain-driven-design.md` |
| Domain/integration events or outbox | `02-backend-nestjs.md`, `09-messaging-and-jobs.md`, ADR 015, ADR 059, ADR 060, `30-cqrs.md` |
| Next.js pages, server/client components, URL state | `03-web-nextjs.md` plus installed Next.js docs |
| Expo/React Native screens and components | `04-mobile-expo.md` |
| Zod schema, API contract, request/response, Swagger/OpenAPI | `05-contracts-zod-api.md`, `28-runtime-validation.md` |
| TanStack Query/Form/Table, Zustand | `06-tanstack-state-forms-tables.md` |
| Reusable UI, themes, variants, design tokens | `07-ui-system.md` |
| Prisma schema, migrations, seed, indexing, soft delete, tenancy | `08-database-prisma.md`, applicable tenancy/security docs |
| Kafka, RabbitMQ, BullMQ, Redis, jobs, retries, idempotency | `09-messaging-and-jobs.md` |
| Auth, roles, permissions, RBAC/ReBAC, RLS, secrets, audit | `10-security-auth-authorization.md` |
| Tenant isolation and tenant context | `10-security-auth-authorization.md`, ADR 062, `docs/architecture/multi-tenancy-plan.md`, `31-multi-tenancy-and-tenant-isolation.md` |
| Tests | `11-testing-vitest.md` |
| Logging, metrics, tracing, resilience, health | `12-observability-and-operations.md` |
| CI/CD and quality gates | `13-ci-cd-and-quality-gates.md` |
| README/ADR/runbook updates | `14-documentation.md` |
| Performance, N+1, indexing, caching, concurrency | `19-performance-and-scalability.md` |
| Uploading/serving files and object storage | `20-object-storage.md` |
| Classes, interfaces, composition, SOLID | `21-oop-and-solid-principles.md` |
| Pattern decision trees | `23-quick-reference-decision-trees.md` |
| Compliant feature example | `24-golden-reference-implementations.md` |
| Anti-pattern quick scan | `25-anti-pattern-catalog.md` |
| New contributor mental model | `26-junior-onboarding-guide.md` |
| Array index readability | `27-array-index-readability.md` |
| Runtime validation | `28-runtime-validation.md` |
| DDD | `29-domain-driven-design.md` (subordinate to hand-written rules/ADRs/architecture docs) |
| CQRS | `30-cqrs.md` (subordinate to hand-written rules/ADRs/architecture docs) |
| Tenant isolation | `31-multi-tenancy-and-tenant-isolation.md` (subordinate to hand-written rules/ADRs/architecture docs) |
| Wrapping up | `18-definition-of-done.md`, `14-documentation.md`, `16-code-review-checklist.md` |

## Non-negotiables, quick reminder

- No `any`, `unknown`, `never` outside sanctioned exhaustiveness, `z.any()`, `z.unknown()`, or `z.never()`.
- No type casts, `as const`, magic numbers, or unexplained constants.
- No runtime `typeof`/`Array.isArray` for domain validation; use the repository's Zod boundary conventions. No numeric-literal array indices; see `27`.
- Validate independently on the server. Client validation is UX, never a security boundary.
- Generics preserve real reusable type information; they do not justify speculative abstractions.
- Explicit return types and access modifiers.
- Server-side authorization is authoritative and explicitly mapped per endpoint/use case.
- State-changing requests produce the required complete audit record.
- Business entities use the repository's soft-delete convention; no hard delete where soft delete applies.
- Concurrent writes are protected against races; payment operations are idempotent by construction.
- No new circular dependencies or single points of failure without deliberate documented decisions.
- Tests cover all written behavior, including small helpers; do not skip or weaken tests.
- Smart components own data/transformations; low-level UI remains data-agnostic and controlled.
- Update documentation, migrations, and seeds as part of the change.
- Fix root causes, not symptoms. If root cause is unproven, say so and investigate; do not disguise a guess as a fix.
- Shared code must be generic for its real consumers and extensible at real variation boundaries, without premature universal abstractions.

## Conflict handling

When rules conflict, follow the existing precedence in `00-non-negotiables.md` and `10-security-auth-authorization.md`. `29-*`, `30-*`, and `31-*` are generated rulebooks and remain subordinate to hand-written rules, ADRs, and `docs/architecture/`. Follow repository decisions over general model knowledge. Report unresolved conflicts rather than inventing a compromise.

## End-of-task report

- Summary and acceptance criteria.
- Root cause and violated invariant for bug work.
- Files changed.
- Architecture decisions and why.
- Tests/checks with exact commands and results, or `NOT VERIFIED`.
- Documentation/ADR/migration/seed updates.
- Shortcuts/exceptions (explicitly none if none).
- Remaining risks, assumptions, and follow-ups.
- Explain in simple English -- i.e. ELI5 me.
- Whatever can be placed within a table, place it in a table.. Things within a table is much more readable.
