# 29 — Domain-Driven Design (generated rulebook, repository-verified)

> **Status: generated, then verified.** This rulebook was generated outside the repository and added on 2026-10-25. It is general guidance, not a description of this codebase. Every version-sensitive instruction and architectural assumption was checked 2026-10-25 against `main` @ a84ce32d plus this change set; the results are in **Repository verification** below and in the **Repository note** under each affected rule.
>
> **Precedence.** Below `00-non-negotiables.md`, `10-security-auth-authorization.md`, the ADRs (058, 059 in particular), `docs/architecture/ddd-cqrs-spec.md`, `docs/architecture/ddd-cqrs-migration-plan.md` and `docs/architecture/context-map.md`. When this file disagrees with one of them, they win — the verification table lists every disagreement found. If you find another, follow the repository document and report the conflict; do not change code to match this file.

## How to read this file

- The source had **180 numbered rules**, but only **33 distinct rule texts**: the generator repeated the same body under up to seven section headings. Each distinct rule appears here **once**, with every original rule number and every section it was listed under, so references to an original number (`Rule 036`) still resolve. Wording is verbatim; only the generator's title suffixes (`(… section name)`, `--- … application rule NN`) were dropped.

- **Section headings carry little meaning.** Because of that repetition, a rule's "listed under" sections are often unrelated to its subject. Read a rule by its text, not its section.

- MUST / MUST NOT are mandatory, SHOULD / SHOULD NOT strong defaults, MAY optional (the source's convention).

## Repository verification

| Rulebook assumption | What the repository actually does | Verdict |
|---|---|---|
| NestJS, Prisma 7, Zod, PostgreSQL stack | NestJS 12.2 on Fastify (ADR 027), Prisma 7.10.1 with the `prisma-client-js` generator and `@prisma/adapter-pg`, zod 4.6, PostgreSQL | ✅ matches — note the generator is `prisma-client-js`, not Prisma 7's newer `prisma-client` |
| Bounded contexts with domain / application / infrastructure / presentation layers | `apps/api/src/contexts/<context>/{domain,application,infrastructure,presentation}` + `public-api.ts`; shared `src/platform/`; context list in `docs/architecture/context-map.md` (ADR 058) | ✅ matches |
| Domain code free of NestJS, Prisma and HTTP | Enforced by lint: `apiArchitectureBoundaryConfigs` (`packages/oxlint-config/import-boundaries.js`), proven by `apps/api/src/__tests__/lint-boundaries.spec.ts` | ✅ enforced |
| Domain invariants must not depend on transport schemas (stack constraint 5, rule DDD-29) | ADR 058 deliberately lets the domain use the shared zod contracts and vocabulary from `@workspace/shared` (`EpochMs`, status enums, …) | ⚠️ **ADR 058 wins**: importing shared contracts in the domain is allowed; business rules still live in the domain |
| Aggregates collect events on behaviour, not on hydration | `AggregateRoot.record()` / `pullEvents()` (`src/platform/domain/aggregate-root.ts`), pulled once by the UnitOfWork collector | ✅ matches |
| Injectable clock | `CLOCK` port (`src/platform/application/clock.port.ts`); epoch-millisecond timestamps (ADR 028) | ✅ matches |
| Domain errors, not HTTP errors | `DomainError` (`src/platform/domain/errors/`), mapped to the error envelope in platform presentation (ADR 016) | ✅ matches |
| Transaction + outbox in one unit of work | `UnitOfWork.run()` (`src/platform/application/unit-of-work.port.ts`) under the RLS actor context; outbox and inbox (ADR 015, 060) | ✅ matches |
| Typed identifiers (`RewardId`) | Identifiers are validated strings; there are no branded ID types | ➖ the rule's own exception applies (existing explicit convention) |
| Example contexts (Orders, Payments, Customers) | Not contexts here; the real ones are in `context-map.md` | ➖ illustrative only — do not create them |

## 0. Operating contract for the AI agent

This rulebook defines how to model business capabilities with DDD
without confusing folder structure with domain design. It is
intentionally conservative: preserve the modular monolith, make business
invariants explicit, and only introduce tactical patterns when a real
use case benefits.

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

-   Use the repository's installed TypeScript and NestJS versions;
    verify APIs rather than relying on memory.
-   Keep domain code independent of NestJS, Prisma, HTTP transports, and
    client frameworks.
-   Use Prisma 7 configuration and generated-client conventions only if
    confirmed in the repository.
-   Follow the project's strict typing standards: no `any`, `unknown`,
    `never`, type assertions, or lint suppressions where prohibited.
-   Use Zod for public boundary validation where that is the repository
    convention; do not make domain invariants depend on transport
    schemas.
-   Do not move backend domain implementations into shared Turborepo
    packages merely to share code with Next.js and Expo.

## 2. Rules

### DDD-01 — Define the business problem first

*Original rule 001 · listed under: Strategic DDD and bounded contexts*

**Do:** Write down the business capability, actors, invariants, and
language before creating domain classes.

**Don't:** Don't begin by copying database tables into `domain/` and
calling the result DDD.

**Why:** DDD is a model of the business, not a folder layout.

**Verification:** Review the use-case description and confirm that each
modeled concept has business meaning.

**Example / implementation note:** For a reward module, define what
'publish' means before creating `Reward.publish()`.

**Exception policy:** For a genuinely simple CRUD feature, a lightweight
application service may be sufficient.

### DDD-02 — Keep repositories intention-revealing

*Original rules 002, 036, 070, 073, 107, 144, 178 · listed under: Strategic DDD and bounded contexts; Value objects and validation; Repositories and persistence boundaries; Application layer and use cases; Errors and result semantics; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** Define repository operations around loading and saving the
domain model required by use cases.

**Don't:** Don't create a generic repository with dozens of methods no
use case needs.

**Why:** Narrow interfaces are easier to implement and test.

**Verification:** Map each repository method to a real use case.

**Example / implementation note:** `findForPublication` may express a
meaningful load requirement.

**Exception policy:** Use a direct query port for read-only projections.

**Repository note:** Repository ports live in each context's `application/` layer; read-only projections use query handlers (ADR 059).

### DDD-03 — Make invariants explicit

*Original rules 003, 037, 074, 108, 111, 145, 179 · listed under: Strategic DDD and bounded contexts; Value objects and validation; Application layer and use cases; Errors and result semantics; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** State each invariant in code and in a focused test.

**Don't:** Don't rely on controller validation alone to protect rules
that must hold across all entry points.

**Why:** A command may be invoked by HTTP, jobs, tests, or future
consumers.

**Verification:** Test invalid transitions by calling the domain
operation directly.

**Example / implementation note:** `publish()` rejects an archived
reward.

**Exception policy:** Pure formatting or display constraints may remain
at the transport boundary.

### DDD-04 — Keep domain tests fast

*Original rules 004, 038, 075, 109, 112, 146, 180 · listed under: Strategic DDD and bounded contexts; Value objects and validation; Application layer and use cases; Errors and result semantics; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** Test domain behavior without network, framework, or database
dependencies.

**Don't:** Don't make a unit test boot the entire application to test a
state transition.

**Why:** Fast feedback encourages comprehensive invariant testing.

**Verification:** Measure that domain test suites run without
infrastructure services.

**Example / implementation note:** Construct the domain object directly
in a unit test.

**Exception policy:** Integration tests remain necessary for database
guarantees.

### DDD-05 — Avoid event side effects in constructors

*Original rules 005, 039, 042, 076, 110, 113, 147 · listed under: Strategic DDD and bounded contexts; Value objects and validation; Aggregates and invariants; Application layer and use cases; Errors and result semantics; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo*

**Do:** Collect events when domain behavior occurs, not while hydrating
an entity.

**Don't:** Don't emit `RewardCreated` every time a stored reward is
reconstructed.

**Why:** Hydration is not a new business occurrence.

**Verification:** Test loading an existing entity does not produce
duplicate events.

**Example / implementation note:** Only the creation use case emits a
creation fact.

**Exception policy:** Migration/import workflows may deliberately
produce events under an explicit policy.

**Repository note:** Verified: `AggregateRoot.record()` is the only way to add an event; a reconstitution path must never call it.

### DDD-06 — Make state transitions finite

*Original rules 006, 040, 043, 077, 114, 148, 151 · listed under: Strategic DDD and bounded contexts; Value objects and validation; Aggregates and invariants; Application layer and use cases; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo; Refactoring and migration discipline*

**Do:** Define allowed states and transitions where lifecycle complexity
warrants it.

**Don't:** Don't scatter string comparisons and status assignments
across handlers.

**Why:** Centralized transitions reduce illegal states and inconsistent
behavior.

**Verification:** Test every permitted transition and representative
forbidden transitions.

**Example / implementation note:** A state-transition table can drive
domain tests.

**Exception policy:** A simple boolean flag may be enough for a
genuinely binary property.

### DDD-07 — Use cases before abstractions

*Original rules 007, 044, 078, 081, 115, 149, 152 · listed under: Strategic DDD and bounded contexts; Aggregates and invariants; Application layer and use cases; Domain events and lifecycle; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo; Refactoring and migration discipline*

**Do:** Name the concrete use cases before introducing shared interfaces
or base classes.

**Don't:** Don't design a universal domain framework before implementing
a real module.

**Why:** Abstractions are justified by stable repeated needs, not
speculation.

**Verification:** Find at least two real callers and explain the
invariant the abstraction protects.

**Example / implementation note:** Introduce a transaction port when
multiple adapters need the same atomic boundary.

**Exception policy:** One clear use case may remain concrete.

### DDD-08 — Keep domain constructors safe

*Original rules 008, 045, 079, 082, 116, 150, 153 · listed under: Strategic DDD and bounded contexts; Aggregates and invariants; Application layer and use cases; Domain events and lifecycle; TypeScript and domain type safety; DDD across NestJS, Next.js, and Expo; Refactoring and migration discipline*

**Do:** Make invalid domain states unrepresentable where practical
through constructors or factories.

**Don't:** Don't use unchecked casts to force external data into domain
types.

**Why:** Invalid objects can undermine every downstream invariant.

**Verification:** Test construction with missing, malformed, and
inconsistent values.

**Example / implementation note:** A factory can return a typed domain
error for invalid initial state.

**Exception policy:** Legacy data may require an explicit tolerant
import path and remediation plan.

### DDD-09 — Do not leak persistence shapes

*Original rules 009, 012, 046, 080, 083, 117, 154 · listed under: Strategic DDD and bounded contexts; Domain model and ubiquitous language; Aggregates and invariants; Application layer and use cases; Domain events and lifecycle; TypeScript and domain type safety; Refactoring and migration discipline*

**Do:** Map Prisma records into domain or application representations at
the adapter boundary.

**Don't:** Don't return Prisma payload types from domain repository
interfaces.

**Why:** Persistence schema changes should not ripple through the
domain.

**Verification:** Search domain/application imports for generated Prisma
modules.

**Example / implementation note:** Return a domain `Reward` from an
aggregate repository.

**Exception policy:** Query-specific DTOs can be assembled by an
infrastructure read adapter.

**Repository note:** Enforced: the API architecture boundaries reject `@prisma/client` in `domain/` and `application/` (lint + `lint-boundaries.spec.ts`).

### DDD-10 — Avoid primitive obsession selectively

*Original rules 010, 013, 047, 084, 118, 121, 155 · listed under: Strategic DDD and bounded contexts; Domain model and ubiquitous language; Aggregates and invariants; Domain events and lifecycle; TypeScript and domain type safety; Testing domain behavior; Refactoring and migration discipline*

**Do:** Create value objects when validation, equality, or behavior is
domain-significant.

**Don't:** Don't wrap every string or number in a class merely to look
object-oriented.

**Why:** Value objects pay for themselves when they centralize a
meaningful rule.

**Verification:** Verify construction prevents invalid values and
equality is deterministic.

**Example / implementation note:** `Money` may enforce currency and
amount rules.

**Exception policy:** An opaque identifier can remain a branded or
validated primitive if project standards permit it.

### DDD-11 — Use bounded contexts deliberately

*Original rule 011 · listed under: Domain model and ubiquitous language*

**Do:** Group concepts whose terminology and rules are consistent;
document each context's responsibility and public interface.

**Don't:** Don't create a context for every entity or merge unrelated
concepts because they share a table.

**Why:** Explicit boundaries reduce accidental coupling and ambiguous
ownership.

**Verification:** Check whether a module has a coherent vocabulary,
lifecycle, and change reason.

**Example / implementation note:** Identity, Organizations, Orders, and
Payments may be separate contexts if requirements support that split.

**Exception policy:** Small products may begin with fewer contexts;
record the decision.

### DDD-12 — Use architecture tests

*Original rules 014, 048, 085, 119, 122, 156 · listed under: Domain model and ubiquitous language; Aggregates and invariants; Domain events and lifecycle; TypeScript and domain type safety; Testing domain behavior; Refactoring and migration discipline*

**Do:** Automate dependency rules where the repository tooling supports
it.

**Don't:** Don't rely solely on code-review memory to prevent forbidden
imports.

**Why:** Architecture drift accumulates across many modules.

**Verification:** Add lint/dependency checks for domain-to-Prisma
imports.

**Example / implementation note:** A path rule can prohibit imports from
`@prisma` inside domain folders.

**Exception policy:** Start with a documented manual check if adding
tooling is not justified.

**Repository note:** Already in place — `workspace/restricted-imports` with `apiArchitectureBoundaryConfigs`, plus the lint canaries. Extend those; do not add a second mechanism.

### DDD-13 — Make time injectable when needed

*Original rules 015, 049, 052, 086, 120, 123, 157 · listed under: Domain model and ubiquitous language; Aggregates and invariants; Domain services and policies; Domain events and lifecycle; TypeScript and domain type safety; Testing domain behavior; Refactoring and migration discipline*

**Do:** Use an explicit clock abstraction when time affects business
rules or deterministic tests.

**Don't:** Don't scatter `Date.now()` calls through domain logic when
the exact instant is significant.

**Why:** Time-dependent rules become testable and consistent.

**Verification:** Run tests with a fixed clock for expiry and scheduling
behavior.

**Example / implementation note:** Evaluate eligibility against a
supplied instant.

**Exception policy:** Simple audit timestamps can be assigned by
persistence infrastructure if they are not domain decisions.

**Repository note:** Use the `CLOCK` port; persist epoch milliseconds (ADR 028).

### DDD-14 — Keep aggregates small

*Original rules 016, 050, 053, 087, 124, 158, 161 · listed under: Domain model and ubiquitous language; Aggregates and invariants; Domain services and policies; Domain events and lifecycle; Testing domain behavior; Refactoring and migration discipline; Documentation and architecture decisions*

**Do:** Include only the objects that must change atomically to preserve
a business invariant.

**Don't:** Don't load an entire tenant's object graph into one
aggregate.

**Why:** Large aggregates create contention and make transactions
expensive.

**Verification:** Review aggregate boundaries against concurrent use
cases.

**Example / implementation note:** An order may own its order lines
while a customer profile remains separate.

**Exception policy:** A larger aggregate is justified when the invariant
truly requires it.

### DDD-15 — Keep public contracts stable

*Original rules 017, 054, 088, 091, 125, 159, 162 · listed under: Domain model and ubiquitous language; Domain services and policies; Domain events and lifecycle; Module boundaries and dependency direction; Testing domain behavior; Refactoring and migration discipline; Documentation and architecture decisions*

**Do:** Define the public operations and DTOs a context supports, then
keep internal classes private.

**Don't:** Don't expose internal entity methods or persistence
structures as API contracts.

**Why:** Stable contracts allow internal refactoring without client
churn.

**Verification:** Check generated API documentation and client imports
for internal types.

**Example / implementation note:** Expose `PublishRewardInput`, not the
aggregate class.

**Exception policy:** Breaking changes may be accepted through a
versioned migration plan.

### DDD-16 — Use explicit mapping

*Original rules 018, 055, 089, 092, 126, 160, 163 · listed under: Domain model and ubiquitous language; Domain services and policies; Domain events and lifecycle; Module boundaries and dependency direction; Testing domain behavior; Refactoring and migration discipline; Documentation and architecture decisions*

**Do:** Keep persistence-to-domain and domain-to-persistence mapping
deterministic.

**Don't:** Don't spread field mapping across controllers, handlers, and
unrelated utilities.

**Why:** Centralized mapping makes schema changes easier to review.

**Verification:** Round-trip representative records in adapter tests.

**Example / implementation note:** A mapper translates database enum
values to domain state.

**Exception policy:** Skip a mapper when it would only obscure an
obvious one-to-one representation.

### DDD-17 — Separate application orchestration

*Original rules 019, 022, 056, 090, 093, 127, 164 · listed under: Domain model and ubiquitous language; Entities and identity; Domain services and policies; Domain events and lifecycle; Module boundaries and dependency direction; Testing domain behavior; Documentation and architecture decisions*

**Do:** Keep transaction coordination and collaborator calls in the
application layer.

**Don't:** Don't turn entities into service locators or inject
repositories into entities.

**Why:** The domain models rules; the application coordinates the use
case.

**Verification:** Inspect domain constructors for infrastructure
dependencies.

**Example / implementation note:** A handler loads an aggregate, invokes
behavior, then saves it.

**Exception policy:** A domain service may accept domain-level
collaborators when the rule genuinely requires them.

### DDD-18 — Model identity explicitly

*Original rules 020, 023, 057, 094, 128, 131, 165 · listed under: Domain model and ubiquitous language; Entities and identity; Domain services and policies; Module boundaries and dependency direction; Testing domain behavior; DDD with Prisma 7; Documentation and architecture decisions*

**Do:** Use stable identifiers for entities and references between
contexts.

**Don't:** Don't use mutable names or display labels as entity identity.

**Why:** Names can change, collide, or be localized.

**Verification:** Test persistence round-trips preserve identifiers.

**Example / implementation note:** Use `RewardId` or the established
identifier type for references.

**Exception policy:** Use simple strings if that is the existing
explicit project convention and type safety remains adequate.

**Repository note:** This repository uses validated string identifiers (no branded ID types) — the exception clause applies.

### DDD-19 — Maintain a ubiquitous language

*Original rule 021 · listed under: Entities and identity*

**Do:** Use business terms consistently in code, API operations, tests,
and documentation.

**Don't:** Don't use vague names such as `processData`, `manageItem`, or
`CommonService` for domain behavior.

**Why:** Shared vocabulary makes requirements traceable to
implementation.

**Verification:** Compare handler, domain method, event, and test names
against the glossary.

**Example / implementation note:** Prefer `approveMerchant` over
`updateMerchantStatus` when approval is a meaningful business action.

**Exception policy:** Technical names remain appropriate for purely
technical utilities.

**Repository note:** Glossary: `rules/22-glossary.md`; tenancy vocabulary is fixed by ADR 062 ("tenant", never "organization", in code).

### DDD-20 — Refactor with characterization tests

*Original rules 024, 058, 095, 129, 132, 166 · listed under: Entities and identity; Domain services and policies; Module boundaries and dependency direction; Testing domain behavior; DDD with Prisma 7; Documentation and architecture decisions*

**Do:** Capture existing behavior before moving domain logic or changing
persistence mapping.

**Don't:** Don't combine a large architectural rewrite with unverified
business behavior changes.

**Why:** Tests distinguish structural refactoring from semantic changes.

**Verification:** Compare old and new behavior for key use cases.

**Example / implementation note:** Add tests for existing reward status
transitions before extracting an entity.

**Exception policy:** Intentional behavior changes require explicit
acceptance criteria.

### DDD-21 — Keep domain events immutable

*Original rules 025, 059, 062, 096, 130, 133, 167 · listed under: Entities and identity; Domain services and policies; Repositories and persistence boundaries; Module boundaries and dependency direction; Testing domain behavior; DDD with Prisma 7; Documentation and architecture decisions*

**Do:** Use stable, serializable event data that describes the fact at
occurrence time.

**Don't:** Don't put a mutable aggregate reference into an event
payload.

**Why:** Consumers must not observe later mutations through an old
event.

**Verification:** Mutate the aggregate after recording an event and
verify event contents remain unchanged.

**Example / implementation note:** Capture reward ID, tenant scope when
appropriate, and event timestamp.

**Exception policy:** Internal in-process event objects may be richer if
they remain immutable and non-public.

### DDD-22 — Use references across aggregates

*Original rules 026, 060, 063, 097, 134, 168, 171 · listed under: Entities and identity; Domain services and policies; Repositories and persistence boundaries; Module boundaries and dependency direction; DDD with Prisma 7; Documentation and architecture decisions; Anti-pattern detection*

**Do:** Reference other aggregates by identity and coordinate changes
through explicit use cases.

**Don't:** Don't hold live mutable object graphs across aggregate
boundaries.

**Why:** Aggregate boundaries define consistency ownership.

**Verification:** Check domain properties for nested mutable aggregates
owned elsewhere.

**Example / implementation note:** An order stores a customer identifier
rather than a mutable Customer aggregate.

**Exception policy:** A value snapshot may be stored when the business
requires historical semantics.

### DDD-23 — Use domain terminology in errors

*Original rules 027, 064, 098, 101, 135, 169, 172 · listed under: Entities and identity; Repositories and persistence boundaries; Module boundaries and dependency direction; Errors and result semantics; DDD with Prisma 7; Documentation and architecture decisions; Anti-pattern detection*

**Do:** Give domain failures names that describe the violated business
rule.

**Don't:** Don't make the domain throw HTTP status codes or database
exception objects.

**Why:** Business failures should remain meaningful outside HTTP.

**Verification:** Unit-test the domain error independently of NestJS.

**Example / implementation note:** `RewardCannotBePublished` is clearer
than `BadRequestException`.

**Exception policy:** A simple domain may use a well-defined error
result instead of a class hierarchy.

**Repository note:** Extend `DomainError`; the HTTP mapping is platform presentation's job (ADR 016).

### DDD-24 — Respect transaction semantics

*Original rules 028, 065, 099, 102, 136, 170, 173 · listed under: Entities and identity; Repositories and persistence boundaries; Module boundaries and dependency direction; Errors and result semantics; DDD with Prisma 7; Documentation and architecture decisions; Anti-pattern detection*

**Do:** Let application use cases define atomic work and infrastructure
implement it.

**Don't:** Don't begin transactions inside arbitrary entity methods.

**Why:** The entity cannot know the database transaction boundary.

**Verification:** Integration-test rollback for multi-write operations.

**Example / implementation note:** Save aggregate and outbox record in
one transaction when required.

**Exception policy:** A single atomic database statement may not need an
explicit transaction wrapper.

**Repository note:** The use case owns the boundary through `UnitOfWork.run()`; the outbox row is written in that same transaction (ADR 015).

### DDD-25 — Treat domain events as facts

*Original rules 029, 032, 066, 100, 103, 137, 174 · listed under: Entities and identity; Value objects and validation; Repositories and persistence boundaries; Module boundaries and dependency direction; Errors and result semantics; DDD with Prisma 7; Anti-pattern detection*

**Do:** Name events in past tense and record what happened.

**Don't:** Don't use events as disguised commands or mutable state
containers.

**Why:** Facts are suitable for audit, reactions, and integration
mapping.

**Verification:** Check event names and payloads against the operation
that already completed.

**Example / implementation note:** `RewardPublished` describes a
completed transition.

**Exception policy:** A command may request a future transition but must
not be named as an event.

### DDD-26 — Prefer behavior over public mutation

*Original rules 030, 033, 067, 104, 138, 141, 175 · listed under: Entities and identity; Value objects and validation; Repositories and persistence boundaries; Errors and result semantics; DDD with Prisma 7; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** Expose domain operations that preserve invariants rather than
unrestricted setters.

**Don't:** Don't let callers freely assign lifecycle state or
invariant-sensitive fields.

**Why:** Mutation should be constrained by the model that owns the rule.

**Verification:** Search for direct writes to status fields outside the
aggregate.

**Example / implementation note:** Use `reward.archive()` rather than
`reward.status = 'ARCHIVED'`.

**Exception policy:** A persistence mapper may reconstruct state through
a validated factory.

### DDD-27 — Separate contexts through contracts

*Original rule 031 · listed under: Value objects and validation*

**Do:** Expose narrow public application interfaces or integration
events for cross-context collaboration.

**Don't:** Don't import another context's private repository, Prisma
mapper, or internal entity implementation.

**Why:** A bounded context must be able to evolve without consumers
depending on its internals.

**Verification:** Search imports for paths into another module's
`infrastructure/` or private `domain/` folders.

**Example / implementation note:** Orders can request a payment
operation through a defined application port.

**Exception policy:** A monolith may share a process and database while
keeping code ownership explicit.

**Repository note:** Each context's `public-api.ts` is its contract; cross-context calls follow ADR 058 and `context-map.md`, and lint rejects imports of another context's internals.

### DDD-28 — Document decisions, not every line

*Original rules 034, 068, 105, 139, 142, 176 · listed under: Value objects and validation; Repositories and persistence boundaries; Errors and result semantics; DDD with Prisma 7; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** Record context boundaries, trade-offs, invariants, and
exceptions in concise ADRs.

**Don't:** Don't create stale documentation that merely restates the
source code.

**Why:** Decision records preserve the reasoning needed for future
changes.

**Verification:** Review ADRs when changing aggregate boundaries or
persistence guarantees.

**Example / implementation note:** Document why a module uses a rich
aggregate or a direct query model.

**Exception policy:** Trivial local implementation details belong in
code and tests.

**Repository note:** ADRs live in `docs/adr/` (`14-documentation.md`).

### DDD-29 — Validate at the right boundary

*Original rules 035, 069, 072, 106, 140, 143, 177 · listed under: Value objects and validation; Repositories and persistence boundaries; Application layer and use cases; Errors and result semantics; DDD with Prisma 7; DDD across NestJS, Next.js, and Expo; Anti-pattern detection*

**Do:** Validate transport shape at the API boundary and business
invariants in the domain.

**Don't:** Don't treat a valid Zod payload as proof that an operation is
allowed.

**Why:** Syntactic validity and business validity are different.

**Verification:** Test a schema-valid request that violates a domain
invariant.

**Example / implementation note:** A valid status string cannot bypass a
forbidden transition.

**Exception policy:** Duplicate checks are acceptable when they serve
different boundaries and purposes.

**Repository note:** Zod at the transport boundary is the shared schema from `@workspace/shared` (`05-contracts-zod-api.md`, `28-runtime-validation.md`); ADR 058 also allows those contracts inside the domain.

### DDD-30 — Document context ownership

*Original rule 041 · listed under: Aggregates and invariants*

**Do:** Assign one module as the authoritative owner of each business
concept and its state transitions.

**Don't:** Don't let two modules independently write the same concept's
records.

**Why:** Single ownership reduces inconsistent rules and conflicting
updates.

**Verification:** Trace every write path for a representative entity and
identify its owner.

**Example / implementation note:** Payments owns payment status; Orders
owns order lifecycle, even if they coordinate.

**Exception policy:** A deliberate shared kernel is allowed only when
its scope and governance are explicit.

**Repository note:** Ownership is recorded in `docs/architecture/context-map.md`.

### DDD-31 — Model workflows, not tables

*Original rule 051 · listed under: Domain services and policies*

**Do:** Identify commands, policies, state transitions, and invariants
from actual workflows.

**Don't:** Don't infer the domain model solely from the Prisma schema or
a generated CRUD endpoint.

**Why:** Tables describe storage; workflows describe business behavior.

**Verification:** Walk through success, rejection, cancellation, and
concurrency scenarios with tests.

**Example / implementation note:** A cancellation workflow may require
eligibility checks and refund coordination.

**Exception policy:** For reporting-only records, a table-oriented model
may be appropriate.

### DDD-32 — Keep domain logic framework-independent

*Original rule 061 · listed under: Repositories and persistence boundaries*

**Do:** Use plain TypeScript domain code wherever practical.

**Don't:** Don't import NestJS decorators, HTTP exceptions, Prisma
clients, or React code into domain entities.

**Why:** Framework-independent code is easier to test and reuse safely.

**Verification:** Run domain unit tests without bootstrapping NestJS or
connecting to a database.

**Example / implementation note:** A pure `Reward` object can enforce
whether it may be published.

**Exception policy:** Framework-specific decorators are acceptable in
outer layers when they don't leak inward.

### DDD-33 — Treat DDD depth as a decision

*Original rule 071 · listed under: Application layer and use cases*

**Do:** Use rich aggregates for meaningful invariants and simple models
for straightforward data maintenance.

**Don't:** Don't force full tactical DDD on every configuration table or
lookup list.

**Why:** Uniform complexity is not the same as consistent architecture.

**Verification:** Explain why each aggregate and value object exists in
a code review.

**Example / implementation note:** A role assignment workflow may need a
domain model; a static country list may not.

**Exception policy:** The simpler model must still follow security and
persistence boundaries.

## 4. Cross-cutting implementation checklist

-   [ ] Every bounded context has a stated responsibility and
    vocabulary.
-   [ ] Every aggregate has documented invariants and a justified
    consistency boundary.
-   [ ] Domain code imports no persistence or HTTP framework modules.
-   [ ] Cross-context dependencies use public interfaces or explicit
    integration contracts.
-   [ ] Domain errors are independent of HTTP response classes.
-   [ ] Persistence mapping is tested and does not expose Prisma types
    to the domain.
-   [ ] Time-dependent rules have deterministic tests.
-   [ ] Architecture checks detect at least the highest-risk forbidden
    dependencies.
-   [ ] Exceptions to the rules are documented with rationale and scope.

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
