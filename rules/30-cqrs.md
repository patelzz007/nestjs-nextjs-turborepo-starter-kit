# 30 — CQRS (generated rulebook, repository-verified)

> **Status: generated, then verified.** This rulebook was generated outside the repository and added on 2026-10-25. It is general guidance, not a description of this codebase. Every version-sensitive instruction and architectural assumption was checked 2026-10-25 against `main` @ a84ce32d plus this change set; the results are in **Repository verification** below and in the **Repository note** under each affected rule.
>
> **Precedence.** Below `00-non-negotiables.md`, `10-security-auth-authorization.md`, the ADRs (059, 015, 021, 060, 061 in particular), `docs/architecture/ddd-cqrs-spec.md` and `docs/architecture/ddd-cqrs-migration-plan.md`. When this file disagrees with one of them, they win — the verification table lists every disagreement found. If you find another, follow the repository document and report the conflict; do not change code to match this file.

## How to read this file

- The source had **180 numbered rules**, but only **27 distinct rule texts**: the generator repeated the same body under up to seven section headings. Each distinct rule appears here **once**, with every original rule number and every section it was listed under, so references to an original number (`Rule 036`) still resolve. Wording is verbatim; only the generator's title suffixes (`(… section name)`, `--- … application rule NN`) were dropped.

- **Section headings carry little meaning.** Because of that repetition, a rule's "listed under" sections are often unrelated to its subject. Read a rule by its text, not its section.

- **Topics the rulebook names but does not cover.** Checked by reading every distinct rule: no rule addresses *Authorization in use cases*, *Validation and error mapping*, although each is a section heading. For authorization in a handler use `10-security-auth-authorization.md` and ADR 026; for validation and error mapping, `05-contracts-zod-api.md`, `28-runtime-validation.md` and ADR 016.

- MUST / MUST NOT are mandatory, SHOULD / SHOULD NOT strong defaults, MAY optional (the source's convention).

## Repository verification

| Rulebook assumption | What the repository actually does | Verdict |
|---|---|---|
| `@nestjs/cqrs` is the dispatch model | `@nestjs/cqrs` 12.1.1: 156 `@CommandHandler`s, 109 `@QueryHandler`s (ADR 059, selective CQRS) | ✅ matches |
| No second, home-grown command bus | `SystemCommandDispatcher` (`src/platform/application/system-command-dispatcher.ts`) wraps `CommandBus` to add the audit row and correlation id for jobs, cron, CLI and consumers — it is not a second bus | ✅ matches; lint requires jobs to use it |
| Commands carry no Express request / response objects (rule CQRS-10) | The HTTP adapter is **Fastify** (ADR 027); there is no Express. Actor and tenant travel in `ActorContext` (ADR 017) | ⚠️ read "Express" as "Fastify"; the rule holds |
| Outbox for durable publication | Transactional outbox and inbox (ADR 015); email goes through the outbox (ADR 060); `integration-event-mapper.ts` maps domain → integration events | ✅ matches |
| Idempotent consumers and safe retries | Inbox de-duplication (ADR 015); idempotency keys with duplicate-wait and replay (ADR 061) | ✅ matches |
| Pagination and sort allowlists | One list-query grammar: `defineListQuery`, sort whitelist, keyset cursors, id tie-breaker (ADR 021) | ✅ matches — use it, never a new pagination shape |
| Same PostgreSQL for reads and writes | Yes; separate projections exist only where a context needs them (analytics-consumer) | ✅ matches |
| "Do not add Kafka, RabbitMQ or BullMQ merely to implement CQRS" | Kafka (ADR 024) and BullMQ already exist for their own reasons (`09-messaging-and-jobs.md`) | ✅ consistent — use what exists |
| Sections *Validation and error mapping* and *Authorization in use cases* | The source has no rule specific to either | ❓ **gap in the rulebook** — see How to read this file |

## 0. Operating contract for the AI agent

This rulebook defines safe, selective CQRS for a NestJS modular
monolith. Commands represent intentions to change state; queries
retrieve data. The same PostgreSQL database may serve both sides.
Durability, transaction semantics, idempotency, and consistency
guarantees must be explicit.

1.  Inspect the repository and its existing conventions before editing
    files.
2.  Distinguish verified repository facts from assumptions; never invent
    versions, paths, scripts, models, or business rules.
3.  Preserve working architecture unless a documented gap justifies
    changing it.
4.  Make changes incrementally, run the repository's actual checks, and
    report outcomes honestly.
5.  Do not claim production readiness merely because the code compiles.
6.  If a requirement is ambiguous and affects security, data integrity,
    or public contracts, stop and ask or document the unresolved
    decision.
7.  Prefer a small, coherent change over a speculative framework.
8.  Follow the repository's established strict TypeScript rules; do not
    introduce `any`, `unknown`, `never`, type assertions, or lint
    suppressions where project rules prohibit them.

## 1. Repository and stack constraints

-   Inspect the installed `@nestjs/cqrs` package and current NestJS
    version before using decorators or module APIs.
-   Use the existing Prisma 7 client, adapter, and transaction setup; do
    not copy outdated Prisma examples.
-   Keep command/query contracts server-side unless a deliberately
    client-safe contract is published.
-   Use the repository's strict TypeScript and Zod conventions; do not
    introduce prohibited unsafe types or type assertions.
-   Preserve existing queue and broker choices; do not add Kafka,
    RabbitMQ, or BullMQ merely to implement CQRS.
-   Treat external delivery guarantees separately from command dispatch
    and database transactions.

## 2. Rules

### CQRS-01 — Keep CQRS conceptual, not physical

*Original rules 001, 004, 007, 010, 092, 095, 098 · listed under: Command/query separation; Read-model performance*

**Do:** Separate state-changing operations from read operations at the
application boundary.

**Don't:** Don't create separate databases or services merely because
CQRS is present.

**Why:** Logical separation can improve clarity without
distributed-system costs.

**Verification:** Verify read and write paths are explicit while both
can use the same PostgreSQL database.

**Example / implementation note:** A command handler writes through a
repository; a query handler returns a projection.

**Exception policy:** Separate stores are allowed only after
requirements and consistency trade-offs are approved.

### CQRS-02 — Separate domain and integration events

*Original rules 002, 005, 008, 093, 096, 099 · listed under: Command/query separation; Read-model performance*

**Do:** Translate internal domain events into stable integration
contracts at the boundary.

**Don't:** Don't expose internal aggregates or private domain event
classes to external consumers.

**Why:** Public event schemas need independent compatibility and
versioning.

**Verification:** Inspect serialized messages for internal class
references and sensitive fields.

**Example / implementation note:** Map `RewardPublished` to a versioned
integration event if another context needs it.

**Exception policy:** A single bounded context may not need integration
events at all.

**Repository note:** `src/platform/application/events/integration-event-mapper.ts` is the translation point (ADR 059).

### CQRS-03 — Define pagination semantics

*Original rules 003, 006, 009, 091, 094, 097, 100 · listed under: Command/query separation; Read-model performance*

**Do:** Specify stable ordering, page size limits, filters, and cursor
or offset behavior.

**Don't:** Don't accept arbitrary unbounded page sizes or rely on
unspecified database ordering.

**Why:** Pagination must remain predictable at scale.

**Verification:** Test empty pages, maximum page size, duplicate sort
values, and invalid filters.

**Example / implementation note:** Use a unique tie-breaker in sorting
when stable ordering is required.

**Exception policy:** Offset pagination may be acceptable for small
datasets and existing API compatibility.

**Repository note:** Use the list-query grammar (`defineListQuery`, ADR 021): sort whitelist, keyset cursors, id tie-breaker.

### CQRS-04 — Name commands as intentions

*Original rules 011, 014, 017, 020, 102, 105, 108 · listed under: Command design; Validation and error mapping*

**Do:** Use business action names that express what the caller intends
to accomplish.

**Don't:** Don't name every command `UpdateEntityCommand` when a
business operation exists.

**Why:** Intent names make authorization, audit, and tests easier to
understand.

**Verification:** Review names against user stories and domain language.

**Example / implementation note:** `ApproveMerchantCommand` expresses
intent better than `SetStatusCommand`.

**Exception policy:** Generic update commands are acceptable for
genuinely generic editable metadata.

### CQRS-05 — Use outbox for durable publication

*Original rules 012, 015, 018, 103, 106, 109 · listed under: Command design; Validation and error mapping*

**Do:** Persist an outbox record in the same transaction as the business
update when durable publication is required.

**Don't:** Don't use an in-memory event bus as the sole reliability
mechanism for critical external effects.

**Why:** The outbox closes the database-commit/message-publish
dual-write gap.

**Verification:** Test crash after commit and before publish; verify
eventual retry.

**Example / implementation note:** A worker claims pending outbox rows,
publishes, and records delivery state.

**Exception policy:** Do not introduce outbox machinery for noncritical
local events without need.

**Repository note:** Implemented — ADR 015 (outbox + inbox) and ADR 060.

### CQRS-06 — Use explicit sorting allowlists

*Original rules 013, 016, 019, 101, 104, 107, 110 · listed under: Command design; Validation and error mapping*

**Do:** Map public sort keys to approved query expressions.

**Don't:** Don't concatenate user-provided column names into SQL or pass
unchecked sort expressions.

**Why:** Allowlisting prevents injection and undefined query behavior.

**Verification:** Try unknown sort fields and verify a controlled
validation error.

**Example / implementation note:** Map `createdAt` to the approved
persistence field.

**Exception policy:** Internal fixed queries need no dynamic sorting
layer.

**Repository note:** Built into `defineListQuery` (ADR 021).

### CQRS-07 — Make commands immutable

*Original rules 021, 024, 027, 030, 112, 115, 118 · listed under: Command handler responsibilities; Authorization in use cases*

**Do:** Treat command input as a stable snapshot of the requested
operation.

**Don't:** Don't mutate a command object while a handler executes.

**Why:** Immutable inputs make behavior predictable and easier to test.

**Verification:** Check that handlers do not rewrite command fields or
attach mutable runtime state.

**Example / implementation note:** Validate and map request input before
dispatch.

**Exception policy:** A separate normalized value may be created without
modifying the original command.

### CQRS-08 — Make consumers idempotent

*Original rules 022, 025, 028, 113, 116, 119 · listed under: Command handler responsibilities; Authorization in use cases*

**Do:** Design message handlers so duplicate delivery does not duplicate
business effects.

**Don't:** Don't assume a broker provides exactly-once business
processing end to end.

**Why:** At-least-once delivery commonly permits duplicates.

**Verification:** Replay the same message and assert only one effective
business operation occurs.

**Example / implementation note:** Use a processed-message key or
naturally idempotent conditional operation.

**Exception policy:** If the transport and business operation provide a
stronger verified guarantee, document it rather than assume it.

**Repository note:** Inbox de-duplication: ADR 015.

### CQRS-09 — Adopt NestJS CQRS intentionally

*Original rules 023, 026, 029, 111, 114, 117, 120 · listed under: Command handler responsibilities; Authorization in use cases*

**Do:** Use the installed `@nestjs/cqrs` version when it fits the
repository's architecture.

**Don't:** Don't mix the library with a second home-grown command bus
without a concrete gap.

**Why:** One dispatch model reduces duplicated infrastructure.

**Verification:** Inspect dependency versions and current module
registration before implementation.

**Example / implementation note:** Register handlers using the project's
established NestJS module pattern.

**Exception policy:** A simple service may be preferable for operations
that don't benefit from dispatch abstractions.

**Repository note:** Installed: `@nestjs/cqrs` 12.1.1. System callers dispatch through `SystemCommandDispatcher`, which wraps `CommandBus`.

### CQRS-10 — Keep commands transport-neutral

*Original rules 031, 034, 037, 040, 122, 125, 128 · listed under: Query design and projections; Testing CQRS workflows*

**Do:** Commands contain application inputs, not HTTP request or
response objects.

**Don't:** Don't pass Express requests, cookies, response objects, or
frontend stores into handlers.

**Why:** The same use case may be invoked by HTTP, jobs, or tests.

**Verification:** Instantiate a command in a unit test without an HTTP
server.

**Example / implementation note:** Pass actor and tenant context through
explicit application context or validated command fields according to
the security design.

**Exception policy:** A transport adapter may attach trusted context
before dispatch.

**Repository note:** The transport is Fastify, not Express (ADR 027). Pass the actor and tenant as `ActorContext` (ADR 017).

### CQRS-11 — Do not call every event a CQRS requirement

*Original rules 032, 035, 038, 123, 126, 129 · listed under: Query design and projections; Testing CQRS workflows*

**Do:** Add events only for meaningful reactions, decoupling, or audit
needs.

**Don't:** Don't introduce an event bus simply because commands and
queries exist.

**Why:** CQRS works without domain events or event sourcing.

**Verification:** Review whether any real consumer needs the event.

**Example / implementation note:** A direct command handler can save a
profile without publishing an event.

**Exception policy:** An event may be justified later as new consumers
appear.

### CQRS-12 — Keep dispatch thin

*Original rules 033, 036, 039, 121, 124, 127, 130 · listed under: Query design and projections; Testing CQRS workflows*

**Do:** Controllers dispatch application operations and map results.

**Don't:** Don't put business logic before and after
`commandBus.execute()` in controllers.

**Why:** Thin transport adapters make use cases transport-independent.

**Verification:** Review controllers for business branching, database
calls, and state mutation.

**Example / implementation note:** Controller validates input,
constructs command, dispatches, maps output.

**Exception policy:** Authentication and request-level validation remain
legitimate presentation responsibilities.

**Repository note:** Lint keeps persistence out of presentation (`apiArchitectureBoundaryConfigs`).

### CQRS-13 — Use one handler per use case

*Original rules 041, 044, 047, 050, 132, 135, 138 · listed under: NestJS CQRS integration; Observability and operations*

**Do:** Keep each handler focused on one command's application workflow.

**Don't:** Don't build a giant handler that switches on a command type
or performs unrelated actions.

**Why:** Focused handlers simplify testing and review.

**Verification:** Check that each handler has one clear purpose and
bounded collaborators.

**Example / implementation note:** `PublishRewardHandler` handles
publication only.

**Exception policy:** Shared private helper functions are fine when they
preserve clarity and do not hide transaction semantics.

### CQRS-14 — Keep read models honest

*Original rules 042, 045, 048, 133, 136, 139 · listed under: NestJS CQRS integration; Observability and operations*

**Do:** Document whether a query reads the transactional database or an
asynchronously maintained projection.

**Don't:** Don't promise read-after-write consistency when projections
may lag.

**Why:** Consistency guarantees affect UI behavior and support
expectations.

**Verification:** Test the chosen read path immediately after a command.

**Example / implementation note:** Return the committed state from a
command if the UI needs immediate confirmation.

**Exception policy:** An eventually consistent projection is valid when
the product accepts its lag.

### CQRS-15 — Define transaction ownership

*Original rules 043, 046, 049, 131, 134, 137, 140 · listed under: NestJS CQRS integration; Observability and operations*

**Do:** Make the application use case's atomic boundary explicit.

**Don't:** Don't hide multi-step transaction behavior inside unrelated
repository methods.

**Why:** Correctness depends on which operations commit together.

**Verification:** Integration-test rollback for a failure midway through
the use case.

**Example / implementation note:** Business update and outbox insert
commit in one transaction.

**Exception policy:** Single-statement atomic writes may not require an
explicit transaction wrapper.

### CQRS-16 — Keep business rules in the domain

*Original rules 051, 054, 057, 060, 142, 145, 148 · listed under: Transactions and consistency; Client/API boundaries*

**Do:** Invoke domain behavior rather than duplicating invariants inside
command handlers.

**Don't:** Don't let handlers directly assign lifecycle fields and
bypass aggregate methods.

**Why:** Multiple entry points must enforce the same invariant.

**Verification:** Test invalid transitions by invoking the aggregate
directly and through the handler.

**Example / implementation note:** Handler loads reward, calls
`publish()`, then saves it.

**Exception policy:** Simple CRUD without meaningful domain behavior can
use application validation.

### CQRS-17 — Use direct projections for reporting

*Original rules 052, 055, 058, 143, 146, 149 · listed under: Transactions and consistency; Client/API boundaries*

**Do:** Optimize queries using selected fields, joins, and aggregates
appropriate to the database.

**Don't:** Don't load every aggregate into application memory to
calculate a dashboard.

**Why:** Read workloads often need a different shape from domain writes.

**Verification:** Inspect generated SQL and query plans for large or
frequent reports.

**Example / implementation note:** Use Prisma select/aggregate patterns
through a query adapter.

**Exception policy:** A domain calculation remains appropriate when it
expresses a business rule rather than a display aggregate.

### CQRS-18 — Do not confuse command success with event delivery

*Original rules 053, 056, 059, 141, 144, 147, 150 · listed under: Transactions and consistency; Client/API boundaries*

**Do:** Define whether a command returns after database commit or after
an external effect completes.

**Don't:** Don't claim an email or message was delivered because a
command committed.

**Why:** The user-visible guarantee must match the actual delivery
model.

**Verification:** Test crash/retry scenarios for critical side effects.

**Example / implementation note:** Return accepted/pending status when
asynchronous processing is the contract.

**Exception policy:** Synchronous external work is possible but must
have explicit timeout and failure semantics.

### CQRS-19 — Return minimal command results

*Original rules 061, 064, 067, 070, 152, 155, 158 · listed under: Concurrency and idempotency; CQRS anti-patterns*

**Do:** Return the identifier or explicit result needed by the caller.

**Don't:** Don't return an entire persistence graph by default after
every command.

**Why:** Large return payloads couple writes to read-model shapes.

**Verification:** Inspect command result contracts for unnecessary
relations and internal fields.

**Example / implementation note:** A create command can return the new
ID; the client can then fetch the detail query.

**Exception policy:** Return a projection when the API contract
explicitly requires it.

### CQRS-20 — Observe command lifecycle

*Original rules 062, 065, 068, 153, 156, 159 · listed under: Concurrency and idempotency; CQRS anti-patterns*

**Do:** Log correlation ID, operation name, duration, outcome, and safe
identifiers.

**Don't:** Don't log secrets, full payment details, tokens, or sensitive
payloads.

**Why:** Operational diagnosis must not become a data leak.

**Verification:** Inspect structured logs and redaction tests.

**Example / implementation note:** Trace a command from HTTP request to
transaction and outbox worker.

**Exception policy:** Avoid high-cardinality or sensitive metric labels.

**Repository note:** Correlation ids come from `CorrelationScopePort`; logging rules: `12-observability-and-operations.md`.

### CQRS-21 — Protect concurrent commands

*Original rules 063, 066, 069, 151, 154, 157, 160 · listed under: Concurrency and idempotency; CQRS anti-patterns*

**Do:** Use database-level concurrency controls for invariants shared by
simultaneous requests.

**Don't:** Don't rely on an in-memory check before a later unconditional
write.

**Why:** Two requests can read the same state before either commits.

**Verification:** Run concurrent integration tests against the real
database engine.

**Example / implementation note:** Conditional update or version check
prevents redeeming the last unit twice.

**Exception policy:** Select the mechanism based on actual isolation and
contention requirements.

**Repository note:** Race-condition patterns: `08-database-prisma.md`.

### CQRS-22 — Keep queries side-effect free

*Original rules 071, 074, 077, 080, 162, 165, 168 · listed under: Domain and integration events; Migration and adoption*

**Do:** Queries read and map data without intentionally changing
business state.

**Don't:** Don't hide a write, status transition, email send, or domain
event publication in a query.

**Why:** Read behavior should be safe to repeat and reason about.

**Verification:** Test query execution leaves domain state unchanged.

**Example / implementation note:** `ListRewardsQuery` returns a page
DTO.

**Exception policy:** Read access metrics and tracing are allowed when
they don't change business state.

### CQRS-23 — Keep handlers testable

*Original rules 072, 075, 078, 163, 166, 169 · listed under: Domain and integration events; Migration and adoption*

**Do:** Test handler orchestration with explicit ports and focused
doubles.

**Don't:** Don't mock the command bus to test the command handler
itself.

**Why:** Tests should verify the use case, not only dispatch plumbing.

**Verification:** Assert repository calls, transaction behavior, and
domain outcomes.

**Example / implementation note:** A handler test supplies a fake
repository and transaction port.

**Exception policy:** Use integration tests for database guarantees that
mocks cannot prove.

### CQRS-24 — Make retries safe

*Original rules 073, 076, 079, 161, 164, 167, 170 · listed under: Domain and integration events; Migration and adoption*

**Do:** Classify retryable failures and define idempotency for
repeatable external commands.

**Don't:** Don't retry all exceptions or assume the client sends a
command only once.

**Why:** Network failures can occur after a write committed but before
the response arrived.

**Verification:** Test duplicate submissions and transient failures.

**Example / implementation note:** Persist an idempotency result for
payment or redemption where required.

**Exception policy:** Low-risk deterministic commands may not need an
idempotency store.

**Repository note:** Idempotency keys with duplicate-wait and replay: ADR 061. Payments are idempotent by construction (`00-non-negotiables.md`).

### CQRS-25 — Design queries for consumers

*Original rules 081, 084, 087, 090, 172, 175, 178 · listed under: Outbox and message delivery; Documentation and acceptance criteria*

**Do:** Return a purpose-built DTO containing exactly the fields the
consumer needs.

**Don't:** Don't expose Prisma rows or serialize entire aggregates for a
table.

**Why:** Projection shapes can be optimized without changing domain
invariants.

**Verification:** Compare response fields with the screen or reporting
requirement.

**Example / implementation note:** A table query returns title, status,
merchant label, and cursor metadata.

**Exception policy:** A detail query may return a richer DTO than a list
query.

### CQRS-26 — Adopt CQRS incrementally

*Original rules 082, 085, 088, 173, 176, 179 · listed under: Outbox and message delivery; Documentation and acceptance criteria*

**Do:** Introduce CQRS first in a module or use case with a real need.

**Don't:** Don't migrate every service in a single speculative rewrite.

**Why:** Incremental adoption lowers risk and reveals useful
conventions.

**Verification:** Compare before/after behavior and preserve public API
contracts.

**Example / implementation note:** Start with a complex state transition
while leaving simple profile CRUD intact.

**Exception policy:** A consistent all-CQRS policy is acceptable only if
explicitly chosen and its costs are accepted.

### CQRS-27 — Keep events factual

*Original rules 083, 086, 089, 171, 174, 177, 180 · listed under: Outbox and message delivery; Documentation and acceptance criteria*

**Do:** Publish past-tense facts after the relevant state transition is
accepted.

**Don't:** Don't publish a success event before the transaction commits.

**Why:** Consumers must not react to changes that later roll back.

**Verification:** Inject a failure before commit and verify no
externally visible event escapes.

**Example / implementation note:** `OrderPlaced` is a fact; `PlaceOrder`
is an intention.

**Exception policy:** In-memory domain events can be collected before
commit if dispatch is delayed until successful commit.

## 4. Cross-cutting implementation checklist

-   [ ] Commands represent intentions; events represent facts; queries
    do not intentionally mutate business state.
-   [ ] Handlers have narrow responsibilities and explicit transaction
    semantics.
-   [ ] Read DTOs are purpose-built and do not leak Prisma-generated
    types.
-   [ ] Concurrent state transitions are protected at the database
    boundary.
-   [ ] Retries and idempotency are defined for operations that need
    them.
-   [ ] Outbox is used only when durable event publication is required
    and is atomic with the business update.
-   [ ] Event consumers tolerate duplicate delivery where applicable.
-   [ ] Consistency guarantees are documented for any asynchronous read
    projection.
-   [ ] Tests cover failure, rollback, duplicate submission, and
    concurrency where relevant.

## 5. Required change report

For each implementation task, report:

1.  Repository facts inspected.
2.  Rules from this file that materially affect the implementation.
3.  Files added, changed, or removed.
4.  Architectural decisions and alternatives rejected.
5.  Tests and commands actually run, with results.
6.  Known limitations, unverified assumptions, and follow-up work.

## 6. Final quality gate

Do not finish until the implementation is consistent with this rulebook,
or explicitly list each unmet requirement and why it remains unmet.
Security, tenant isolation, transaction correctness, and domain
invariants require tests that demonstrate behavior; comments and
directory names are not evidence.
