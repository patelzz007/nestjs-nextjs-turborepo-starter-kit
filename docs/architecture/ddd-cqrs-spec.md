---
title: "DDD + CQRS architecture specification"
description: "The rule set for bounded contexts, commands, queries, events and layering across the API, web and mobile apps."
tags: ["architecture", "ddd", "cqrs", "spec"]
author: "Platform Team"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 1
---

# DDD + CQRS Architecture & Implementation Specification
## NestJS + Next.js + Expo | Turborepo Monorepo

**Document type:** Architecture decision record, engineering standards, and implementation specification  
**Audience:** Claude Code, Cursor, Codex, and senior engineers  
**Architecture decision:** DDD-inspired modular monolith with selective CQRS  
**Primary objective:** Establish a consistent, testable, production-grade architecture that can support multiple SaaS products, marketplaces, and business applications without forcing every feature into the same level of complexity.

> **Repository note.** This specification is the rule set. The concrete, repository-specific implementation plan — including the decisions that deliberately deviate from this document (for example, the domain layer *may* use the shared zod contracts from `@workspace/shared`, see ADR 058) — is `docs/architecture/ddd-cqrs-migration-plan.md`. Where the two differ, the plan's recorded decision wins and states why.

---

# 1. Instructions to the AI Agent

You are acting as a Staff/Principal Software Engineer responsible for implementing architecture in an existing Turborepo monorepo.

Your job is not to generate a generic DDD example. Your job is to inspect the repository, understand the existing conventions, and implement the architecture defined in this document without introducing contradictory patterns.

## 1.1 Mandatory operating rules

1. Inspect the repository before proposing or modifying its architecture.
2. Read existing engineering standards, `AGENTS.md`, package manifests, workspace configuration, TypeScript configuration, lint rules, Prisma configuration, existing modules, and tests.
3. Reuse existing implementations when they satisfy this specification.
4. Do not overwrite existing architecture merely because you prefer another pattern.
5. Do not assume package versions, APIs, file paths, or runtime capabilities. Verify them from the installed dependencies and official documentation when necessary.
6. Do not invent dependencies, scripts, environment variables, database models, or business requirements.
7. Do not create abstractions without a concrete use case.
8. Do not introduce microservices, event sourcing, a separate read database, Redis caching, or distributed transactions as prerequisites for DDD or CQRS.
9. Do not implement every CRUD operation using CQRS handlers solely for consistency.
10. Do not place business rules in controllers, Prisma repositories, React components, or transport DTOs.
11. Do not duplicate business logic between Next.js, Expo, and NestJS.
12. Do not claim that an implementation is complete while required tests, type checks, linting, or build checks are failing.

## 1.2 Existing repository takes precedence

Before implementation, establish the following facts:

- Actual directory structure.
- Actual package manager and lockfile.
- Actual Node.js and TypeScript versions.
- Actual NestJS, Next.js, Expo, Prisma, and Zod versions.
- Whether the API uses ESM.
- How NestJS is built and launched.
- Whether Prisma 7 is configured with `prisma.config.ts`, a generated client, and a PostgreSQL driver adapter.
- How dependency injection is configured.
- How API contracts are shared between applications.
- How authentication and authorization currently work.
- Whether tenancy is already implemented.
- Whether background jobs, domain events, or an outbox already exist.
- Existing naming conventions and testing tools.

Do not replace an existing working build pipeline with `nest start` or another build mechanism without an explicit requirement and an approved migration plan.

For example, if the repository uses Turborepo to orchestrate an esbuild-based NestJS build with SWC, preserve that arrangement unless repository evidence establishes a reason to change it.

## 1.3 Required deliverables

Before implementation, produce:

1. Repository architecture assessment.
2. Proposed architecture and dependency rules.
3. ADR explaining DDD and CQRS adoption.
4. Proposed module and file structure.
5. A phased implementation plan.
6. An explicit list of existing code that must be preserved or migrated.
7. Tests and acceptance criteria for every implemented phase.

Do not stop at documentation if implementation was requested. Implement the approved architecture in the repository, verify it, and document the actual changes.

---

# 2. Architecture Decision

## 2.1 Decision statement

Adopt a **DDD-inspired modular monolith with selective CQRS** inside the NestJS API.

DDD defines the domain boundaries and the structure used to express business rules.

CQRS defines how application operations are separated into commands that change state and queries that retrieve data.

These are independent decisions.

The architecture MUST NOT treat DDD and CQRS as mutually exclusive alternatives.

It MUST also NOT treat full tactical DDD or CQRS as mandatory for every module.

## 2.2 Architectural layers

The backend is divided into four logical layers:

1. Domain.
2. Application.
3. Infrastructure.
4. Presentation.

Their responsibilities are defined below.

| Layer | Responsibility | May depend on |
|---|---|---|
| Domain | Business invariants, entities, value objects, domain services, domain events | Domain primitives and other explicitly permitted domain abstractions |
| Application | Use cases, commands, queries, handlers, transaction orchestration, application ports | Domain |
| Infrastructure | Prisma, database repositories, external APIs, messaging adapters, persistence implementations | Application ports and Domain |
| Presentation | HTTP controllers, request validation, authentication integration, response mapping | Application interfaces and approved contracts |

Dependency direction is an architectural rule, not merely a directory naming convention.

**Domain and Application MUST NOT import Prisma, NestJS HTTP controllers, Next.js, Expo, or infrastructure implementations.**

The Application layer may depend on application-level abstractions such as repository interfaces, transaction interfaces, and event publication ports.

Infrastructure implements those abstractions.

Presentation translates external requests into application operations. It does not implement business decisions.

## 2.3 What this architecture does not imply

This decision does not require:

- Separate databases for reads and writes.
- A separate deployment for every bounded context.
- Event sourcing.
- An event store.
- A generic repository for every Prisma model.
- A universal base entity or aggregate.
- A universal base command handler.
- A generic CRUD engine for every module.
- A custom dependency injection framework.
- A custom mediator when NestJS CQRS already provides the required behavior.
- A shared package containing all backend business logic.
- A separate NestJS application for each domain module.

The default deployment remains one NestJS application with explicit internal module boundaries.

---

# 3. DDD: Tactical and Strategic Design

DDD is not simply arranging files into `domain`, `application`, and `infrastructure` folders.

The design must begin with business concepts and boundaries.

## 3.1 Strategic DDD

Strategic DDD determines which parts of the business belong together and where different models should remain separate.

### Bounded contexts

A bounded context defines the boundary within which a domain model and its terminology have a consistent meaning.

Potential contexts in a reusable SaaS starter include:

- Identity and Access.
- Organizations and Tenancy.
- Catalog.
- Orders.
- Payments.
- Rewards.
- Notifications.
- Reporting.

These are examples, not a requirement to create every module immediately.

A context MUST be created when its business rules, vocabulary, lifecycle, ownership, or change patterns justify an explicit boundary.

Do not split a module simply because it has many files.

Do not combine unrelated business concepts merely because they share a database table or API endpoint.

### Example: Identity versus Authorization

Identity answers questions such as:

- Who is the authenticated principal?
- How are credentials verified?
- How are access and refresh tokens managed?
- Is the account active?

Authorization answers different questions:

- Which actions may this principal perform?
- Which resources may they access?
- Which organization or tenant does the authorization apply to?
- Which contextual restrictions apply?

These contexts interact but have different responsibilities.

A user account is not automatically equivalent to an organization membership, a tenant, or a role assignment.

Keep those concepts distinct unless the existing domain explicitly defines another relationship.

### Example: Organization versus Tenant versus Location

Do not assume these concepts are interchangeable.

A possible model is:

- Organization: a business or customer account.
- Tenant: an isolation boundary for application data.
- Location: a branch, store, or physical operating location.
- Membership: the relationship between a principal and an organization.
- Role assignment: a principal's authorization within a particular scope.

Whether one organization maps to exactly one tenant, multiple tenants, or a configurable tenancy arrangement is a product decision.

Inspect existing schemas and requirements before choosing the mapping.

Never infer that every user is a tenant or that every branch is a tenant.

### Context maps

When two bounded contexts interact, document the relationship.

For example:

- Orders may reference a customer identity.
- Payments may receive an order identifier.
- Notifications may react to an order-placed event.
- Reporting may query order and payment projections.

An interaction does not mean that one context may freely mutate another context's database records.

Use explicit application interfaces, public domain events, or purpose-built queries.

## 3.2 Tactical DDD

Use tactical DDD when it helps express business rules.

### Entity

An entity has identity and a lifecycle.

Example: `Reward`.

Its identity remains stable even when its name, description, or status changes.

### Value object

A value object represents a concept defined by its value rather than its identity.

Examples:

- Money.
- Email address, if the domain requires value-level validation.
- Date range.
- Percentage.
- Quantity.

A value object should be immutable where practical and should enforce its own invariants.

Do not create a class for every primitive string or number without a domain justification.

### Aggregate and aggregate root

An aggregate is a consistency boundary for a group of related domain objects.

The aggregate root is the entry point through which its invariants are enforced.

For example, a reward aggregate might enforce:

- Only draft rewards may be published.
- An archived reward cannot be published.
- A reward must have the required publication information.
- A reward cannot be redeemed unless it is published.

These are illustrative rules. Confirm the actual business requirements before implementing them.

Do not create an aggregate around every database table.

### Domain service

A domain service represents a business rule that does not naturally belong to a single entity or value object.

It must not become a general-purpose application service or a place to put arbitrary business logic.

### Repository

A domain repository provides a persistence-independent interface for retrieving and saving domain aggregates when aggregate semantics are needed.

It MUST NOT expose Prisma-specific types.

For example, avoid:

`Promise<Prisma.RewardGetPayload<...>>`

in a domain repository interface.

The domain must not depend on Prisma-generated models.

### Domain event

A domain event records a meaningful fact that has already occurred within the domain.

Examples:

- `RewardPublished`.
- `OrderPlaced`.
- `PaymentCaptured`.

Events describe past occurrences, not instructions to perform an action.

`PublishReward` is a command. `RewardPublished` is an event.

Domain events do not automatically imply asynchronous messaging, persistence, or eventual consistency.

---

# 4. CQRS: Commands, Queries, and Handlers

## 4.1 Command definition

A command represents an intention to change application state.

Examples:

- `CreateReward`.
- `PublishReward`.
- `AssignRole`.
- `PlaceOrder`.
- `CancelOrder`.

Commands SHOULD use business-oriented names rather than generic database verbs when the operation represents a meaningful business action.

A command must have an explicit input contract.

It MUST NOT contain an HTTP request object, Prisma client, database connection, or frontend state object.

Commands do not need to return domain aggregates.

For a successful operation, return the minimum result needed by the caller, such as an identifier or an application result DTO.

## 4.2 Command handler

A command handler executes one command's application use case.

Its responsibilities may include:

1. Loading the required aggregate or domain state.
2. Performing application-level authorization where required.
3. Invoking domain behavior.
4. Persisting changes through the appropriate port.
5. Coordinating a transaction.
6. Recording domain events or initiating reliable event publication.
7. Returning a defined application result.

The handler MUST NOT become a second domain model.

Business invariants belong in domain behavior, while orchestration belongs in the application layer.

For example, a `PublishRewardHandler` coordinates loading, authorization, persistence, and transaction handling. The reward domain model decides whether publication is a valid transition.

## 4.3 Query definition

A query retrieves data without intentionally changing business state.

Examples:

- `GetRewardById`.
- `ListRewards`.
- `GetOrderSummary`.
- `GetAdminDashboard`.

A query MUST NOT:

- Change aggregate state.
- Trigger a business state transition.
- Publish a domain event as a side effect.
- Perform a write disguised as a read.

Observability, metrics, tracing, and read-only audit logging are not business-state mutations, provided their implementation preserves the query's semantics.

## 4.4 Query handler

Query handlers may use optimized read models instead of loading domain aggregates.

For example, a paginated reward listing may require:

- Reward ID.
- Title.
- Status.
- Merchant display name.
- Redemption count.
- Created date.

Loading every aggregate and navigating all its relationships to construct a table response would be wasteful.

A query handler may use a dedicated read repository or a direct Prisma projection through infrastructure.

Its output is a defined application DTO, not a Prisma-generated type exposed to controllers or clients.

## 4.5 Do reads and writes require separate databases?

No.

The default implementation uses one PostgreSQL database and one Prisma persistence configuration.

CQRS separates the application operations and their models. It does not require physically separate databases.

Use a separate read store only when measured requirements justify it, such as independent scaling, analytical workloads, or a projection architecture with explicit consistency requirements.

A separate read store introduces additional infrastructure and operational responsibilities. It is not part of the initial architecture decision.

## 4.6 CQRS adoption policy

CQRS is applied per use case, not per database model.

Use explicit command and query handlers when they provide meaningful value, including:

- Complex state transitions.
- Authorization-sensitive mutations.
- Multi-step business operations.
- Workflows with significant validation and invariants.
- Read models with specialized projections or aggregation.
- Operations that need explicit orchestration, transaction, or event-publication behavior.

Ordinary CRUD operations may use a simpler application service or conventional controller-to-service flow.

However, both approaches MUST obey the same dependency, validation, authorization, transaction, and testing rules.

Do not create a separate CQRS implementation framework alongside `@nestjs/cqrs` unless an ADR demonstrates a concrete gap that cannot be addressed with the existing library.

---

# 5. NestJS Module and Directory Architecture

The following is a target structure, not permission to restructure the entire repository blindly.

Adapt it to existing conventions and introduce only the required modules.

```text
apps/
  api/
    src/
      modules/
        rewards/
          domain/
            entities/
              reward.entity.ts
            value-objects/
            events/
              reward-published.event.ts
            errors/
              reward-domain.error.ts
            repositories/
              reward.repository.ts

          application/
            commands/
              create-reward/
                create-reward.command.ts
                create-reward.handler.ts
              publish-reward/
                publish-reward.command.ts
                publish-reward.handler.ts

            queries/
              get-reward/
                get-reward.query.ts
                get-reward.handler.ts
              list-rewards/
                list-rewards.query.ts
                list-rewards.handler.ts

            dto/
            ports/
              transaction-manager.port.ts
            services/

          infrastructure/
            persistence/
              prisma-reward.repository.ts
              reward.mapper.ts
            events/
            external-services/

          presentation/
            http/
              rewards.controller.ts
              request-mappers/

          rewards.module.ts

      shared/
        application/
        domain/
        infrastructure/
        presentation/

      main.ts

packages/
  contracts/
    src/
      rewards/
      users/
      index.ts

  validation/
    src/

  config/
```

## 5.1 File responsibilities

### `domain/entities/reward.entity.ts`

Owns reward identity, state, and domain behavior.

It MUST NOT import:

- `@nestjs/common`.
- `@nestjs/cqrs`.
- `@prisma/client` or generated Prisma client modules.
- Express or Fastify request/response objects.
- Zod schemas used exclusively for transport validation.

A pure domain model should be testable without starting NestJS or connecting to PostgreSQL.

### `domain/repositories/reward.repository.ts`

Defines the persistence operations the domain/application workflow requires.

Choose aggregate-oriented methods based on actual use cases.

Do not automatically expose every database operation.

For example, `findById`, `save`, and possibly `findByIdForUpdate` may be appropriate depending on the persistence and concurrency strategy.

Avoid speculative methods and generic CRUD interfaces that conceal required behavior.

### `application/commands/publish-reward/*`

Contains the command and its handler.

The command represents the requested operation. The handler orchestrates the use case.

Keep each handler focused on one application operation.

### `application/queries/list-rewards/*`

Contains the query input and handler.

It may use a dedicated read port or a persistence adapter designed for optimized projections.

It must define filtering, sorting, pagination, and output semantics explicitly.

### `infrastructure/persistence/prisma-reward.repository.ts`

Implements the appropriate repository interface using the actual generated Prisma client.

It translates persistence records into domain objects and domain objects into persistence operations.

It must not silently decide whether a business transition is valid.

### `infrastructure/persistence/reward.mapper.ts`

Maps between domain and persistence representations where mapping is required.

Do not introduce mapping files for trivial cases unless they improve clarity, isolate a genuine representation difference, or prevent framework leakage.

### `presentation/http/rewards.controller.ts`

Owns HTTP routing and transport integration.

It may:

- Define route paths and HTTP methods.
- Apply guards, pipes, and interceptors.
- Validate request inputs through the established contract strategy.
- Dispatch commands and queries.
- Translate application results and errors into HTTP responses.

It must not implement reward publication rules or call Prisma directly.

## 5.2 NestJS dependency injection

Use NestJS dependency injection to compose infrastructure implementations with application/domain interfaces.

For TypeScript interfaces, use explicit injection tokens where runtime interface metadata is unavailable.

Example:

```ts
export const REWARD_REPOSITORY =
  Symbol("REWARD_REPOSITORY");
```

The token belongs in a stable location that does not introduce a circular dependency.

The infrastructure provider binds the token to the implementation, and the application handler injects the token through the repository interface.

The exact provider and module arrangement must match the installed NestJS version and existing repository conventions.

Do not rely on TypeScript interfaces alone as runtime provider tokens.

## 5.3 Shared abstractions

Do not build a universal framework before the first use case exists.

Introduce shared abstractions only when multiple modules have a real, stable requirement for them.

Potential shared abstractions include:

- Transaction manager.
- Clock abstraction when deterministic time control is required.
- Domain event publication port.
- Current-principal interface.
- Application-level pagination contract.
- Common application error representation.

Do not create `BaseEntity`, `BaseRepository`, `BaseCommandHandler`, `BaseQueryHandler`, `BaseDomainService`, and `BaseAggregate` by default.

Inheritance is not a substitute for explicit domain design.

---

# 6. Dependency Rules and Circular Dependencies

These rules are mandatory and must be verifiable.

## 6.1 Allowed dependencies

- Domain → permitted domain primitives.
- Application → Domain.
- Infrastructure → Application ports and Domain.
- Presentation → Application interfaces and approved transport contracts.
- Composition root → all required implementation modules.
- Next.js / Expo → shared client-safe contracts and the approved API client.

## 6.2 Prohibited dependencies

- Domain → Infrastructure.
- Domain → NestJS HTTP framework.
- Domain → Prisma.
- Application → Prisma client directly for aggregate writes.
- Presentation → Prisma client for business mutations.
- Shared client contracts → backend domain entities.
- Expo → server-only package imports.
- Browser bundles → database clients, credentials, or server-only modules.

Application queries may use an explicitly defined read port whose infrastructure implementation uses Prisma. The application handler must not import Prisma-generated persistence types.

## 6.3 Cross-context dependencies

A module MUST NOT reach into another module's private implementation directory.

For example, Orders must not import:

`modules/payments/infrastructure/persistence/prisma-payment.repository.ts`

Instead, define the required interaction through an explicit public application interface, a domain event, or a purpose-built integration contract.

The interaction mechanism depends on whether the operation needs an immediate result, a reliable asynchronous side effect, or a read-only projection.

## 6.4 Cycles

Avoid circular dependencies between NestJS modules and domain contexts.

Do not use `forwardRef()` as a default solution for architectural cycles.

If two contexts depend on each other's private models, redesign the boundary before introducing a framework-level workaround.

---

# 7. Domain Model and Persistence Boundaries

## 7.1 Prisma is not the domain model

Prisma provides persistence types and database access. It does not automatically provide the business semantics required by DDD.

A Prisma model may represent a row with fields such as:

- `id`.
- `status`.
- `createdAt`.
- `updatedAt`.

A domain entity may expose operations such as:

- `publish()`.
- `archive()`.
- `canBeRedeemedAt()`.
- `assertCanBeCancelled()`.

The domain model should express the invariants relevant to the business.

Do not simply rename a Prisma result to `RewardEntity` and claim that DDD has been implemented.

## 7.2 When to hydrate aggregates

Hydrate domain aggregates when a use case must enforce their invariants or perform domain behavior.

Use optimized projections for queries that only need display or reporting data.

Do not hydrate a large graph of aggregates for a paginated table.

Do not bypass domain behavior for business-critical writes simply because Prisma can update a row in one line.

## 7.3 Persistence mapping

Map persistence state into a valid domain representation.

If persisted data violates a domain invariant, handle the situation explicitly. Do not silently construct an invalid entity.

Use stable identifiers and explicit constructors or factory methods.

Do not introduce type assertions to force Prisma output into a domain entity.

## 7.4 Prisma-specific requirements

The repository implementation must use the actual Prisma configuration and generated client present in the repository.

If Prisma 7 is in use:

- Respect its configured generator and output path.
- Respect `prisma.config.ts` and the configured datasource strategy.
- Respect the PostgreSQL driver adapter where required by the installed configuration.
- Use the existing migration and seed workflow.
- Do not copy configuration patterns from older Prisma versions without verification.

Do not make domain code depend on generated Prisma types.

---

# 8. Transaction Boundaries and Concurrency

Transactions are a business correctness concern, not merely a database concern.

## 8.1 Who owns the transaction?

The application use case determines the atomic operation.

Infrastructure provides the mechanism for executing the persistence operations atomically.

For example, publishing a reward may require:

1. Load the reward.
2. Verify the expected state.
3. Apply the domain transition.
4. Persist the new state.
5. Record an outbox event if reliable asynchronous publication is required.

The state change and outbox record must commit atomically when the outbox pattern is used.

Do not commit the reward update and then independently insert the outbox event in a second unprotected transaction.

## 8.2 Transaction design

Use an explicit transaction abstraction only when it provides a meaningful boundary across repositories or persistence operations.

A transaction interface must not leak Prisma-specific types into the domain.

The infrastructure implementation may use Prisma's supported transaction mechanism and pass a transaction-scoped persistence context to the relevant adapters.

Avoid globally shared transaction state.

Avoid storing transaction clients in mutable singleton fields.

Do not assume that opening a transaction makes all business invariants safe against concurrent writes.

## 8.3 Concurrent state transitions

Consider two requests attempting to redeem the final available reward.

Both requests may observe availability before either commits.

The system must prevent overselling.

Choose a concurrency strategy based on the actual persistence model, such as:

- Conditional atomic updates.
- Optimistic concurrency using a version or state predicate.
- Pessimistic locking where supported and justified.
- Serializable transactions when appropriate, with bounded retry behavior.

The chosen mechanism must be implemented and tested.

A domain method alone cannot prevent two concurrent database transactions from violating a shared invariant.

## 8.4 Retry behavior

Only retry failures known to be transient and safe to retry.

Do not blindly retry all exceptions.

For commands that can be submitted repeatedly, consider idempotency keys where the business operation requires them.

An idempotency design must define:

- Key scope.
- Request fingerprint or equivalent request identity.
- Storage and expiration policy.
- Behavior for concurrent duplicate requests.
- Whether failures can be retried with the same key.
- How the original result is returned.

Do not add idempotency infrastructure to every endpoint without a requirement.

---

# 9. Domain Events, Integration Events, and Background Jobs

These concepts must remain distinct.

## 9.1 Domain events

Domain events describe facts inside a bounded context.

They may be collected during aggregate behavior and processed by the application after the domain transition is accepted.

A domain event is not automatically a durable message.

## 9.2 Integration events

Integration events communicate facts to another context or external system.

Examples:

- `OrderPlacedIntegrationEvent`.
- `PaymentCapturedIntegrationEvent`.

Define a stable event contract, including its versioning policy and identifier.

Do not publish private domain entity instances as external integration payloads.

## 9.3 In-process event bus

An in-process event bus is appropriate when event consumers run in the same process and the delivery requirements permit it.

It is not durable messaging.

A process crash can interrupt an in-memory event flow.

Do not use in-process events as the only guarantee that an external payment, email, or other critical side effect will eventually occur.

## 9.4 Transactional outbox

Use a transactional outbox when the application must reliably publish an event corresponding to a committed database change.

The write transaction stores:

1. The business state change.
2. The outbox record.

A separate publisher processes pending records and sends them to the configured message transport.

The publisher must handle retries and duplicate delivery.

Consumers must be idempotent where duplicate processing could produce incorrect results.

The outbox record must have a defined lifecycle, retention policy, retry strategy, and operational visibility.

Do not introduce an outbox solely because the application uses CQRS.

## 9.5 Background jobs

Background jobs and domain events solve different problems.

Use a job queue for work requiring scheduling, retries, delayed execution, or worker processing.

Examples include:

- Email delivery.
- Report generation.
- Media processing.
- Retryable third-party integrations.

Use the existing approved queue infrastructure when available.

Do not introduce Kafka, RabbitMQ, and BullMQ simultaneously without clear ownership and use cases.

A queue is not a substitute for a transaction, and a successful enqueue operation is not proof that the business operation and job record were committed atomically.

---

# 10. Error Handling

Errors must be classified according to their meaning.

## 10.1 Domain errors

Represent violated business rules explicitly.

Examples:

- Reward cannot be published in its current state.
- Order cannot be cancelled after capture.
- Membership is not eligible for the requested operation.

Domain errors must not depend on HTTP status codes or NestJS exception classes.

## 10.2 Application errors

Represent use-case outcomes such as:

- Resource not found.
- Conflict.
- Authorization failure.
- Invalid operation for the current application state.

The exact error types should match the repository's established conventions.

## 10.3 Infrastructure errors

Represent failures from:

- Database connections.
- Unique constraints.
- External APIs.
- Message transports.
- Storage services.

Translate infrastructure errors into stable application outcomes only when the mapping is known and meaningful.

Do not translate every database error into a generic `400 Bad Request`.

Do not leak SQL, database connection details, credentials, internal stack traces, or sensitive identifiers to clients.

## 10.4 HTTP mapping

The presentation layer maps application outcomes to appropriate HTTP semantics.

Examples:

- Invalid request: 400 or the existing validation convention.
- Unauthenticated: 401.
- Authenticated but forbidden: 403.
- Resource not found: 404.
- State conflict: 409.
- Unexpected infrastructure failure: 500 or an appropriate gateway/service error.

Do not make domain code throw `NotFoundException` or `ConflictException`.

---

# 11. Authorization and Multi-Tenancy

Authorization must be part of the use-case design, not an optional frontend convenience.

## 11.1 Separate authentication and authorization

Authentication establishes the identity of the principal.

Authorization decides whether the principal may perform the requested operation on the target resource within the relevant context.

Do not assume that a valid access token grants access to every tenant or organization.

## 11.2 Authorization layers

Use the existing authorization system where possible.

The design must distinguish:

1. Authentication guards.
2. Coarse-grained endpoint permissions.
3. Resource-level authorization.
4. Tenant and organization isolation.
5. Domain invariants.

For example, permission to publish rewards does not necessarily mean that a merchant can publish a reward owned by another merchant.

The application use case must verify the relevant resource scope.

## 11.3 Frontend permissions

Next.js and Expo may use permission data to hide unavailable actions or improve navigation.

That data is for user experience.

The backend remains authoritative.

Never rely on a hidden button, a disabled form, a client-side route guard, or a client-supplied `organizationId` as the security boundary.

## 11.4 Tenant context

Establish the authenticated principal and permitted tenant context through the existing trusted request/authentication pipeline.

The client may request a tenant or organization context, but the backend must verify that the principal is permitted to operate within it.

Do not silently trust arbitrary tenant identifiers in request bodies.

Tenant context should be passed explicitly into application operations or through a well-defined, request-scoped abstraction.

Avoid global mutable tenant state.

## 11.5 Database isolation

Every tenant-scoped read and write must enforce the appropriate isolation rule.

Depending on the existing model, this may involve:

- Scoped repository methods.
- Tenant predicates in database queries.
- Database constraints.
- PostgreSQL row-level security.
- Explicit tenant-aware authorization checks.

If PostgreSQL RLS is enabled, verify that transaction and connection-pooling behavior preserves the intended tenant context. Session state must not leak between requests.

Do not assume RLS is correctly configured merely because policies exist.

RLS and application authorization serve complementary purposes; neither should be added or removed without considering the actual security model.

---

# 12. Shared Contracts for Next.js and Expo

The API is the business boundary for both clients.

DDD and CQRS are backend implementation details and must not leak into client packages unnecessarily.

## 12.1 Shared package responsibilities

The shared contracts package may contain:

- Zod request schemas.
- Zod response schemas.
- API input and output types inferred from Zod.
- Stable enums or literal values that genuinely belong to the public contract.
- Pagination and sorting contracts.
- Client-safe error representations.

It must not contain:

- Prisma models or generated database clients.
- Domain aggregate classes.
- NestJS controllers or providers.
- Database credentials.
- Server-only service implementations.
- Private domain events unless they are intentionally defined as public integration contracts.

## 12.2 Validation

Validate untrusted HTTP input at the API boundary.

Use the established Zod version and conventions.

Do not assume that TypeScript types alone validate incoming requests.

Do not duplicate the same schema manually in Next.js, Expo, and NestJS when it can be shared safely.

However, do not force internal domain invariants to depend on the public API schema.

Transport validation and domain validation are different responsibilities.

## 12.3 API compatibility

The API contract should not expose command-handler implementation details.

A route does not need to be named after an internal class.

A public operation may map to a command, a conventional application service, or a query handler.

The contract must remain stable unless a deliberate API change is approved.

---

# 13. Next.js SSR and Expo Integration

## 13.1 Next.js

Server-side rendering may invoke backend reads directly through a server-side API client or an explicitly approved internal application integration.

The implementation must not bypass authentication, tenant isolation, authorization, or response validation simply because the caller runs on the server.

Do not expose backend credentials to client bundles.

Avoid duplicating backend domain logic in Server Components or Server Actions.

If a Next.js Server Action calls the NestJS API, it is still a transport adapter—not the authoritative domain layer.

## 13.2 Expo

Expo consumes the same public API contracts through a mobile-compatible client.

Do not import server-only modules into React Native.

Do not assume Node.js APIs or server filesystem functionality exist in the mobile runtime.

The client must handle authentication, refresh behavior, errors, and network failures using the established mobile architecture.

## 13.3 State management

Client state is not the source of truth for domain state.

TanStack Query may manage server data, cache invalidation, and request lifecycle.

Zustand or another approved store may manage appropriate client-side state.

Neither should reimplement the backend's business invariants.

After a successful command, invalidate or update relevant query caches according to the established client data strategy.

---

# 14. Testing Requirements

Testing must prove architectural and behavioral correctness, not just line coverage.

## 14.1 Domain unit tests

Domain tests must run without:

- NestJS application initialization.
- PostgreSQL.
- Prisma.
- Network access.
- Message brokers.

Test:

- Valid transitions.
- Invalid transitions.
- Value-object invariants.
- Boundary values.
- Domain event generation where applicable.

Example: a reward in an archived state cannot be published if that is the defined business rule.

## 14.2 Application handler tests

Test handlers independently from the HTTP layer.

Use explicit test doubles for repository and transaction ports.

Verify:

- The expected repository operations occur.
- Invalid states do not persist changes.
- Transactions are used where required.
- Authorization checks occur in the appropriate place.
- Duplicate commands behave according to the idempotency contract.
- Events are recorded or published according to the specified guarantees.
- Errors propagate or translate according to the established application policy.

Do not make tests pass by mocking away the business behavior being tested.

## 14.3 Infrastructure integration tests

Use a real test database or the repository's approved database integration test environment.

Test:

- Prisma mapping.
- Database constraints.
- Transaction rollback.
- Concurrent state changes.
- Tenant isolation.
- RLS behavior when enabled.
- Outbox atomicity and retry behavior when implemented.

Mocks alone cannot prove database isolation or transactional correctness.

## 14.4 API integration tests

Test the complete HTTP boundary:

- Request validation.
- Authentication.
- Authorization.
- Tenant context.
- Application dispatch.
- Response mapping.
- Error mapping.
- Pagination and sorting contracts.

## 14.5 Client contract tests

Verify that Next.js and Expo can consume the published API contracts.

Do not import backend-only code to make client tests pass.

## 14.6 Architecture tests

Add automated checks for prohibited dependency directions where practical.

At minimum, detect violations such as:

- Domain importing Prisma.
- Domain importing NestJS HTTP packages.
- Presentation importing Prisma for business writes.
- Client packages importing backend-only modules.
- Cross-context imports into private infrastructure directories.

Use existing lint or dependency-analysis tooling where available. Do not introduce a new architecture-testing dependency without checking existing capabilities first.

---

# 15. Implementation Phases

Implement this architecture incrementally.

## Phase 0 — Repository assessment

Inspect:

- Workspace structure.
- Dependency versions.
- TypeScript and lint configuration.
- API module conventions.
- Prisma setup.
- Auth and RBAC.
- Tenant model.
- Existing tests.
- Build and deployment pipeline.

Deliver an assessment that distinguishes verified facts from assumptions.

**Exit criteria:** No architecture-changing implementation begins before the existing structure and constraints are understood.

## Phase 1 — Architecture baseline

Establish:

- Dependency direction.
- Module boundaries.
- Error-handling conventions.
- Validation boundaries.
- Repository and application port conventions.
- Transaction ownership rules.
- Testing strategy.

Create an ADR explaining why DDD-inspired modular design and selective CQRS are being adopted.

**Exit criteria:** The conventions are explicit and consistent with the repository's existing stack.

## Phase 2 — One representative module

Choose one existing module with meaningful domain rules.

Do not invent a reward or order business domain if the repository does not contain one.

Implement:

- Domain behavior.
- Required application use cases.
- Persistence adapters.
- HTTP integration.
- Unit and integration tests.
- Dependency injection.
- Error mapping.

Keep simple operations simple. Introduce CQRS for the use cases that justify it.

**Exit criteria:** The module demonstrates the intended architecture end to end.

## Phase 3 — Cross-cutting concerns

Integrate the architecture with existing:

- Authentication.
- Authorization.
- Tenant context.
- Transaction management.
- Logging and tracing.
- Background processing.
- Event publication, if required.

Do not rebuild existing infrastructure unnecessarily.

**Exit criteria:** Security, tenant isolation, and operational behavior are verified by tests.

## Phase 4 — Shared client contracts

Ensure the Next.js and Expo applications consume validated, client-safe contracts.

Verify SSR and mobile compatibility.

**Exit criteria:** No server-only domain or persistence code leaks into client bundles.

## Phase 5 — Migration of additional modules

Migrate modules according to business complexity and risk.

Use simple application services for CRUD-heavy modules and CQRS where appropriate.

Avoid mass-generating handlers for every endpoint.

**Exit criteria:** Each migrated module satisfies the same architectural and testing rules.

## Phase 6 — Final verification

Run the actual repository commands for:

- Formatting.
- Linting.
- Type checking.
- Unit tests.
- Integration tests.
- API tests.
- Application builds.
- Architecture checks.

Report every failed or skipped check.

**Exit criteria:** The implementation is verified against the repository's actual toolchain, and remaining limitations are documented.

---

# 16. Definition of Done

An implementation is not complete merely because the code compiles.

## Architecture

- [ ] Business rules are located in the correct domain boundary.
- [ ] Application use cases are explicit and focused.
- [ ] CQRS is applied selectively.
- [ ] Domain code has no Prisma or HTTP framework dependencies.
- [ ] Cross-context interactions use explicit contracts.
- [ ] Circular dependencies have not been introduced.

## Data integrity

- [ ] Persistence mappings are explicit where required.
- [ ] Transaction boundaries match the business operation.
- [ ] Concurrent operations cannot violate the defined invariants.
- [ ] Tenant-scoped operations enforce isolation.
- [ ] Outbox guarantees are implemented if an outbox is required.

## Security

- [ ] Authorization is enforced on the server.
- [ ] Resource ownership and tenant context are validated.
- [ ] Sensitive information is not leaked in error responses.
- [ ] Client-side permissions are not treated as security controls.

## Client compatibility

- [ ] Public request and response contracts are shared appropriately.
- [ ] Zod validates untrusted request data.
- [ ] Next.js SSR and Expo do not import server-only code.
- [ ] Client caches are updated according to the established strategy.

## Quality

- [ ] Domain unit tests cover business invariants.
- [ ] Application tests cover use-case behavior.
- [ ] Integration tests cover persistence and transactions.
- [ ] Architecture checks cover prohibited dependencies where practical.
- [ ] Lint, type-check, test, and build results are reported honestly.
- [ ] Documentation reflects the actual implementation.

---

# 17. Anti-Patterns Explicitly Prohibited

Do not introduce these patterns without an approved, concrete architectural justification.

### Anemic domain model presented as full DDD

A class that only mirrors a database record and has no meaningful domain behavior is not automatically an effective DDD entity.

An anemic model can still be acceptable for simple CRUD modules. Do not pretend that adding `domain/` folders creates a rich domain model.

### CQRS for every endpoint

Do not create a command and handler for every field update solely to make the architecture look consistent.

Use a consistent application boundary while allowing the implementation complexity to match the use case.

### Prisma leaking into the domain

Do not use Prisma-generated models as domain entities, aggregate roots, or repository interfaces.

### Generic repositories that hide business semantics

Do not force every domain operation into `create`, `update`, `delete`, and `findMany` when the business requires explicit operations such as `publish`, `redeem`, or `capturePayment`.

### Event sourcing without a requirement

CQRS does not require event sourcing.

Do not store every domain event as the authoritative historical record unless event sourcing is a separately approved architectural decision.

### Unreliable side effects

Do not assume that a database commit followed by an email or broker publish is atomic.

Use an appropriate reliability strategy for the required delivery guarantees.

### Premature microservices

Do not split bounded contexts into separately deployed services solely because DDD encourages explicit boundaries.

### Over-generalized shared packages

Do not move backend business logic into shared packages merely to maximize code reuse across the monorepo.

Share stable contracts, not implementation details that violate the client/server boundary.

---

# 18. Required AI Agent Response Format

Before coding, the agent must report:

1. **Verified repository facts** — actual versions, folders, packages, conventions, and current implementation.
2. **Current architectural gaps** — specific findings, with file paths.
3. **Proposed changes** — the exact files or modules to add or modify.
4. **Architecture decisions** — why each change is needed and which alternatives were rejected.
5. **Migration and compatibility risks** — especially authentication, authorization, Prisma, SSR, and Expo.
6. **Implementation sequence** — ordered steps with dependencies.
7. **Testing plan** — exact relevant commands discovered in the repository.

After coding, report:

1. Files added or changed.
2. Architectural behavior implemented.
3. Tests added.
4. Commands executed and their actual outcomes.
5. Any skipped checks and why.
6. Remaining risks or unresolved requirements.
7. Documentation and ADR updates.

Do not claim that a test passed unless it was executed and passed.

Do not claim that the implementation is production-ready merely because it follows the directory structure in this document.

The final implementation must be justified by verified repository facts and demonstrated by tests.

---

# 19. Final Architecture Principle

The purpose of this architecture is to make the starter kit adaptable to different products without forcing every product into an unnecessarily complicated framework.

DDD establishes meaningful business boundaries and invariants.

CQRS separates reads and writes where the distinction improves clarity, correctness, or performance.

The modular monolith keeps deployment and operations manageable.

Prisma and PostgreSQL provide persistence without leaking into the domain.

Shared contracts keep Next.js and Expo aligned with the NestJS API.

Explicit authorization, transaction boundaries, concurrency controls, and tests protect correctness.

**Implement the simplest architecture that preserves these guarantees. Add complexity only when a verified business or technical requirement justifies it.**
