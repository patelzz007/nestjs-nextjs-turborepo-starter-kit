# 22 — Glossary

A shared vocabulary for this codebase's domain and architectural terms, per `14-documentation.md`'s "shared glossary" guidance. When a term below is used anywhere in `rules/` or in code, it means exactly this — if you're tempted to use a different word for the same concept, use the term below instead, and if you need a genuinely new concept, add it here in the same PR that introduces it.

## Architectural terms

**Smart component** — a component (Next.js page/route, Expo screen) that owns data fetching, mutations, and domain-specific transformations. See `03-web-nextjs.md`, `04-mobile-expo.md`.

**Dumb component** (also "low-level component," "presentational component") — a stateless, fully-controlled, data-agnostic component that renders exactly what it's given via props. See `07-ui-system.md`.

**Application service** — orchestrates a use case (e.g. `CancelOrderService`), calling domain/policy logic and a repository. Distinct from a **domain policy**, which encapsulates a single named business rule (e.g. `OrderCancellationPolicy`). See `02-backend-nestjs.md`.

**Repository** — the persistence-access layer, translating between the domain model and Prisma. Never called directly from a controller. See `02-backend-nestjs.md`, `08-database-prisma.md`.

**Contract** — a zod schema in `packages/contracts` defining the shape of data crossing a boundary (API request/response, an event payload). The single source of truth for that shape across every consumer. See `05-contracts-zod-api.md`.

**Boundary** — any point where data enters the system from outside the currently-executing function: an HTTP request, a webhook, a message payload, an environment variable. Every boundary is validated via a zod schema; nothing crossing one is ever treated as trusted without validation. See `00-non-negotiables.md`, `05-contracts-zod-api.md`.

**Outbox (outbox pattern)** — writing an event to a database table in the same transaction as the business data it describes, so a separate worker can reliably publish it afterward without risking a "DB committed but event never published" inconsistency. See `09-messaging-and-jobs.md`.

**Idempotency key** — a value generated at the point of user intent, used to guarantee a retried request produces the same result as (and never duplicates the effect of) the original request. Mandatory for payment operations. See `09-messaging-and-jobs.md`.

**Soft delete** — marking a record as deleted (`isDeleted: true`, `deletedAt`, `deletedBy`) rather than physically removing it. The default and required behavior for every business entity in this codebase. See `08-database-prisma.md`.

**Race condition** — a bug where two concurrent operations each read a stale state, both decide independently that an action is safe, and both proceed, corrupting shared state in a way neither individually intended. See `08-database-prisma.md`.

**Single point of failure (SPOF)** — any one component whose failure takes down a capability with no fallback/degradation path. This codebase deliberately designs against SPOFs at both the messaging-infrastructure and general-dependency level. See `09-messaging-and-jobs.md`, `12-observability-and-operations.md`.

**Composition root** — the single place (NestJS's module provider registration) where concrete dependencies are actually constructed and wired together, as opposed to scattered `new` calls throughout business logic. See `21-oop-and-solid-principles.md`.

## Tooling and infrastructure terms

**Turborepo task graph** — the dependency-aware pipeline Turborepo uses to determine what needs to rebuild/retest and in what order, and to cache results. See `01-repository-architecture.md`.

**Workspace protocol** — the package-manager mechanism (`workspace:*`) that resolves an internal package to its local, in-repo source rather than a published version. See `01-repository-architecture.md`.

**Consumer group** (Kafka) — a set of consumers that split a topic's partitions between them for scaled processing; distinct consumer groups each receive their own full copy of every message. See `09-messaging-and-jobs.md`.

**Dead letter (dead-letter queue)** — where a message/job is routed after exhausting its retry policy, for human investigation, rather than being retried forever. See `09-messaging-and-jobs.md`.

**Expand/contract** — a migration strategy for backward-compatible schema changes: add the new shape, deploy code that handles both, migrate, deploy code that only uses the new shape, then remove the old shape. See `13-ci-cd-and-quality-gates.md`.

## Security terms

**RBAC (Role-Based Access Control)** — authorization based on a user's assigned role(s).

**ReBAC (Relationship-Based Access Control)** — authorization based on a relationship between the user and the resource (e.g. "manager of the location this resource belongs to"), rather than a flat role. See `10-security-auth-authorization.md`.

**RLS (Row-Level Security)** — a PostgreSQL feature restricting which rows a given database session can see/modify, used in this codebase as defense-in-depth alongside (never instead of) application-level authorization. See `10-security-auth-authorization.md`.

**PDPA** — Malaysia's Personal Data Protection Act 2010 (as amended 2024), the privacy law this project currently targets. See `10-security-auth-authorization.md`.

**Completion gate** — the mandatory end-of-task check: `pnpm run lint` (zero errors, zero warnings) and `pnpm run test` must both pass, run after the last edit. See `18-definition-of-done.md`.

**Audit log** — the durable, append-only record of every state-changing transaction, distinct from ordinary application logs, capturing org/tenant/user/timestamp/endpoint/request/response/IP/device. See `10-security-auth-authorization.md`.

## Project-specific process terms

**Definition of Ready** — the checklist a feature must satisfy before implementation begins. See `15-feature-development-process.md`.

**Definition of Done** — the checklist a feature must satisfy before it's considered complete. See `18-definition-of-done.md`.

**Blocking finding** (in code review) — an issue that must be resolved before a PR can merge, as opposed to a non-blocking suggestion. See `16-code-review-checklist.md`.

**ADR (Architecture Decision Record)** — a short, numbered document in `docs/adr/` capturing a meaningful architectural decision, its alternatives, and its consequences. See `14-documentation.md`.

## Domain terms

**Client type**:
The kind of app a request comes from: `web`, `admin`, `merchant` or `mobile`. It decides how the session's tokens travel, never what the caller is allowed to do.
_Avoid_: client, platform, app type

**Mobile app**:
The iOS and Android app built with Expo, served by the same API as the web apps under the `mobile` client type.
_Avoid_: native app, Expo app, the app

**Device session**:
One signed-in device's session, which can be signed out on its own ("this device") or together with all others ("everywhere").
_Avoid_: login, token, connection

**Minimum supported app version**:
The oldest mobile app version the API still serves; anything older must update before it can be used.
_Avoid_: min version, force update, kill switch
