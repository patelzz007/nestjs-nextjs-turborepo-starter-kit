# 31 — Multi-Tenancy and Tenant Isolation (generated rulebook, repository-verified)

> **Status: generated, then verified.** This rulebook was generated outside the repository and added on 2026-10-25. It is general guidance, not a description of this codebase. Every version-sensitive instruction and architectural assumption was checked 2026-10-25 against `main` @ a84ce32d plus this change set; the results are in **Repository verification** below and in the **Repository note** under each affected rule.
>
> **Precedence.** Below `00-non-negotiables.md`, `10-security-auth-authorization.md`, the tenancy ADRs (007, 008, 010, 062 in particular) and `docs/architecture/multi-tenancy-plan.md`. When this file disagrees with one of them, they win — the verification table lists every disagreement found. If you find another, follow the repository document and report the conflict; do not change code to match this file.

## How to read this file

- The source had **180 numbered rules**, but only **37 distinct rule texts**: the generator repeated the same body under up to seven section headings. Each distinct rule appears here **once**, with every original rule number and every section it was listed under, so references to an original number (`Rule 036`) still resolve. Wording is verbatim; only the generator's title suffixes (`(… section name)`, `--- … application rule NN`) were dropped.

- **Section headings carry little meaning.** Because of that repetition, a rule's "listed under" sections are often unrelated to its subject. Read a rule by its text, not its section.

- **Topics the rulebook names but does not cover.** Checked by reading every distinct rule: no rule addresses *Events and outbox (tenant scope of events and their consumers)*, although each is a section heading. What the repository does: event, outbox and inbox payloads carry `tenantId` (multi-tenancy plan D29), and a system command a consumer dispatches carries its tenant in `actor.tenantId` (`SystemCommandDispatcher`). Apply TI-16 (background jobs) to event consumers as well; see ADR 015 and ADR 062.

- MUST / MUST NOT are mandatory, SHOULD / SHOULD NOT strong defaults, MAY optional (the source's convention).

## Repository verification

| Rulebook assumption | What the repository actually does | Verdict |
|---|---|---|
| Tenant vs organization terminology (rules TI-01, TI-04, TI-13) | One tenant boundary (ADR 008); ADR 062 renamed it **"tenant"** in code, data, env and docs, and lint rejects `organization*` identifiers (MT-08 selectors in `packages/oxlint-config/restricted-syntax-rules.js`). UI copy keeps product words | ⚠️ read every `organization` / `organizationId` example as `tenant` / `tenantId` |
| Tenant resolved from trusted evidence (TI-13) | Stricter: the tenant comes **only** from the `/tenants/:tenantSlug` route or a machine credential; a `tenantId` in a request is rejected with 400 (ADR 062) | ⚠️ **ADR 062 wins** — never accept a client-supplied tenant id, even one checked against membership |
| Platform admins may operate cross-tenant / break-glass (exceptions in TI-08, TI-15, TI-19, TI-26) | **No bypass** (ADR 062): platform staff are ordinary users on tenant routes unless an approved `SupportAccessGrant` exists; impersonation needs one too. A system operation is allowlisted and names its tables — the RLS bypass is per table (`app_rls_bypass_on(<table>)`), never global | ⚠️ **ADR 062 wins** — those exception clauses apply only through a `SupportAccessGrant` or a named system operation |
| Neutral errors for foreign resources (TI-08, TI-28) | Mandatory, not "when appropriate": another tenant's resource returns 404 (ADR 062) | ✅ stricter |
| Isolation strategy | Shared tables + PostgreSQL RLS (ADR 007, 010, 062) | ✅ matches |
| RLS: runtime role cannot bypass; FORCE RLS (TI-29, TI-32) | `app_runtime` is `NOBYPASSRLS`; `FORCE ROW LEVEL SECURITY` on every RLS table (`apps/api/prisma/rls.sql`); boot + CI proof; `test/rls/runtime-role.e2e-spec.ts` | ✅ matches |
| Context set transaction-locally on the executing connection (TI-31, TI-33) | `set_config(…, true)` for role, user, tenant and system operation in one statement inside the transaction (`src/prisma/tenant-transaction.service.ts`, ADR 010) | ✅ matches |
| No mutable process-global tenant (TI-17) | Request context uses `AsyncLocalStorage` (ADR 017) — the rule's own exception, with propagation verified by the e2e suites; system work carries its actor explicitly | ✅ matches (exception clause) |
| Cross-tenant references guarded in the database (TI-09, TI-27) | Composite `(tenantId, id)` foreign keys (ADR 062; 14 in `schema.prisma`) | ✅ matches |
| Two-tenant isolation tests (TI-30) | Shared two-tenant fixture; `test/tenancy/multi/isolation.e2e-spec.ts` and 20+ cross-tenant suites; full e2e runs in multi mode | ✅ matches |
| Token claims are hints, not membership proof (TI-36) | JWTs carry identity only (ADR 003); per-session revocation is immediate (ADR 034) | ✅ stricter |
| Migrations (stack constraint 3, TI-34) | Migrations are generated from `schema.prisma` (`pnpm db:migrate:create`), never hand-written; RLS SQL lives in `prisma/rls.sql` and is applied by `pnpm db:apply-security` | ✅ matches |

## 0. Operating contract for the AI agent

This rulebook defines tenant isolation as a security invariant spanning
HTTP requests, authorization, database queries, PostgreSQL RLS when
enabled, background jobs, caches, files, reporting, and operations. A
tenant ID is scope data, not proof of authorization. Fail closed
whenever required tenant context cannot be established.

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

-   Inspect the actual tenant model and environment configuration before
    adding or changing tenancy behavior.
-   Respect the repository's Prisma 7 and PostgreSQL setup, including
    transaction adapter behavior and connection pooling.
-   Do not add manual SQL migration files or scripts that conflict with
    the repository's established migration workflow; inspect the current
    workflow first.
-   Do not assume RLS is enabled merely because tenancy exists; verify
    the configuration and actual database policies.
-   Follow strict TypeScript conventions and use explicit typed tenant
    context rather than unsafe casts or unvalidated payload values.
-   Keep tenant isolation enforcement in NestJS and the database where
    configured; Next.js and Expo are not security boundaries.

## 2. Rules

### TI-01 — Define the tenant model explicitly

*Original rules 001, 013, 025, 037, 049 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; Authorization and resource ownership; Repository/query scoping*

**Do:** Document whether tenant, organization, workspace, account, and
location are distinct concepts and how they relate.

**Don't:** Don't assume organization ID and tenant ID are
interchangeable or that a user belongs to only one tenant.

**Why:** Isolation decisions affect every query, token, job, and
database constraint.

**Verification:** Review the domain glossary, schema, and
tenant-resolution flow together.

**Example / implementation note:** A SaaS account may own multiple
branches while each record is scoped to the account.

**Exception policy:** Choose a simpler model only when product
requirements and migration paths support it.

**Repository note:** Defined by ADR 008 and ADR 062: one tenant boundary, global user identity, per-tenant membership. The code word is "tenant".

### TI-02 — Provision tenants atomically where possible

*Original rules 002, 014, 026, 038, 050 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; Authorization and resource ownership; Repository/query scoping*

**Do:** Define which records and defaults must exist before a tenant
becomes usable.

**Don't:** Don't expose a partially provisioned tenant as active.

**Why:** Provisioning failures can leave inconsistent authorization and
configuration.

**Verification:** Inject failures during provisioning and verify cleanup
or resumability.

**Example / implementation note:** Create tenant metadata and required
baseline settings in one transaction when feasible.

**Exception policy:** Long-running provisioning may use a resumable
state machine and background jobs.

### TI-03 — Review every new endpoint for tenancy

*Original rules 003, 015, 027, 039 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; Authorization and resource ownership*

**Do:** Require an explicit decision on whether an endpoint is global,
tenant-scoped, or platform-admin-only.

**Don't:** Don't assume a route is safe because it is read-only.

**Why:** Read-only data can still be confidential.

**Verification:** Include tenant scope and authorization in endpoint
review checklists.

**Example / implementation note:** A country-code lookup may be global;
a merchant listing is tenant-scoped.

**Exception policy:** Public endpoints need explicit visibility and
abuse-control rules.

### TI-04 — Model membership as its own relationship

*Original rules 004, 016, 028, 040, 171 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; Authorization and resource ownership; API and client behavior*

**Do:** Represent user-to-organization membership explicitly when users
can join multiple organizations or have scoped roles.

**Don't:** Don't store a single `organizationId` on the user if the
actual requirements allow multiple memberships.

**Why:** Identity and membership have different lifecycles and
permissions.

**Verification:** Test invite, accept, revoke, and switch-organization
workflows.

**Example / implementation note:** Membership holds status and role
assignments within a defined scope.

**Exception policy:** A true single-tenant-per-user product may use a
simpler model.

**Repository note:** Already modelled per tenant (ADR 008). Read `organizationId` as `tenantId` — the former is rejected by lint (TI-08).

### TI-05 — Make tenant context visible in tracing

*Original rules 005, 017, 029, 172 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; API and client behavior*

**Do:** Attach a safe tenant identifier or pseudonymous scope to traces
where policy permits.

**Don't:** Don't place sensitive tenant data, credentials, or personal
information into logs or metric labels.

**Why:** Observability must support diagnosis without leaking data or
creating high-cardinality metric explosions.

**Verification:** Inspect logs, traces, and metric dimensions for
sensitive values.

**Example / implementation note:** Use correlation IDs and controlled
tenant identifiers in structured logs.

**Exception policy:** Omit tenant identifiers where privacy policy or
cardinality makes them inappropriate.

### TI-06 — Make tenant-aware uniqueness explicit

*Original rules 006, 018, 030, 161, 173 · listed under: Tenant terminology and isolation model; Trusted tenant context; Authentication and membership; Migration and operations; API and client behavior*

**Do:** Define whether each unique value is global or unique within a
tenant.

**Don't:** Don't use global unique constraints by default when the
business allows the same name in separate tenants.

**Why:** Incorrect uniqueness can cause data leaks through conflict
responses and block valid tenant data.

**Verification:** Test same-value creation in two tenants and duplicate
creation within one tenant.

**Example / implementation note:** Unique `(tenantId, slug)` permits
tenant-local slugs.

**Exception policy:** Email or domain uniqueness may intentionally be
global.

### TI-07 — Handle tenant-aware uniqueness races

*Original rules 007, 019, 162, 174 · listed under: Tenant terminology and isolation model; Trusted tenant context; Migration and operations; API and client behavior*

**Do:** Enforce uniqueness in the database and translate expected
constraint conflicts into stable application errors.

**Don't:** Don't rely on a preflight query as the only uniqueness
guarantee.

**Why:** Concurrent creates can pass the same preflight check.

**Verification:** Run parallel creates with the same tenant-local unique
key.

**Example / implementation note:** Catch the specific known unique
constraint and map it to a conflict result.

**Exception policy:** Do not hide unrelated database errors as
duplicate-key failures.

### TI-08 — Prevent insecure direct object references

*Original rules 008, 020, 151, 163, 175 · listed under: Tenant terminology and isolation model; Trusted tenant context; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Treat all resource IDs as identifiers, not authorization proofs.

**Don't:** Don't reveal whether another tenant's resource exists unless
the API explicitly permits that distinction.

**Why:** ID guessing and leaked IDs are common attack paths.

**Verification:** Test foreign-tenant IDs in all endpoints that accept
object identifiers.

**Example / implementation note:** Use tenant-scoped lookup and
consistent error behavior.

**Exception policy:** An internal platform operator may have authorized
global visibility.

**Repository note:** ADR 062: another tenant's resource returns 404. The exception for platform operators applies only through an approved `SupportAccessGrant`.

### TI-09 — Prevent cross-tenant relation creation

*Original rules 009, 152, 164, 176 · listed under: Tenant terminology and isolation model; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Validate that every referenced tenant-owned object belongs to
the intended tenant before linking records.

**Don't:** Don't trust a valid foreign key alone when the schema permits
cross-tenant references.

**Why:** Database referential integrity may not enforce tenant equality
by itself.

**Verification:** Attempt to create an order in Tenant A using a
customer from Tenant B.

**Example / implementation note:** Use composite tenant-aware keys or
explicit validation where appropriate.

**Exception policy:** Intentional cross-tenant sharing requires an
explicit sharing model and authorization policy.

**Repository note:** Composite `(tenantId, id)` foreign keys enforce this in the database (ADR 062).

### TI-10 — Scope joins and nested relations

*Original rules 010, 141, 153, 165, 177 · listed under: Tenant terminology and isolation model; Observability and audit; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Ensure joined child records and nested includes are constrained
by the same ownership model.

**Don't:** Don't assume filtering the parent automatically enforces all
cross-tenant relationships in every query shape.

**Why:** Bad relationships can leak child data or expose inconsistent
records.

**Verification:** Test nested lists, counts, relation filters, and
detail projections across tenants.

**Example / implementation note:** Validate that a referenced customer
belongs to the same tenant before creating an order.

**Exception policy:** Cross-tenant relationships may be valid only when
explicitly modeled and authorized.

### TI-11 — Choose an isolation strategy deliberately

*Original rules 011, 023, 035, 047, 059 · listed under: Trusted tenant context; Authentication and membership; Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS*

**Do:** Document whether the application uses shared tables,
schema-per-tenant, or database-per-tenant and why.

**Don't:** Don't mix isolation strategies accidentally across modules.

**Why:** Each strategy has different security, cost, migration, and
operational trade-offs.

**Verification:** Verify the selected strategy is reflected in
configuration, repositories, and tests.

**Example / implementation note:** Shared PostgreSQL tables with tenant
keys can suit many SaaS products.

**Exception policy:** A regulated or high-isolation workload may justify
separate schemas or databases after review.

**Repository note:** Chosen: shared tables + PostgreSQL RLS (ADR 007, 010, 062).

### TI-12 — Make tenant lifecycle explicit

*Original rules 012, 024, 036, 048, 060 · listed under: Trusted tenant context; Authentication and membership; Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS*

**Do:** Define suspend, archive, delete, retention, and restore
semantics for tenant-owned data.

**Don't:** Don't equate account suspension with immediate destructive
deletion unless policy requires it.

**Why:** Lifecycle decisions affect billing, access, audit, and
retention obligations.

**Verification:** Test each lifecycle state against login and
data-access rules.

**Example / implementation note:** A suspended tenant may be denied
writes while retaining authorized read access for administrators.

**Exception policy:** Legal retention or regulatory requirements may
constrain deletion behavior.

### TI-13 — Resolve tenant context from trusted evidence

*Original rules 021, 033, 045, 057, 069 · listed under: Authentication and membership; Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS; Prisma and transaction context*

**Do:** Resolve tenant scope from authenticated identity and validated
membership or an explicitly authorized tenant switch.

**Don't:** Don't trust a request body, URL parameter, header, or query
parameter as proof of tenant membership.

**Why:** Client-controlled identifiers are untrusted input.

**Verification:** Attempt to substitute another tenant's ID and verify
access is denied.

**Example / implementation note:** A requested organization ID is
checked against current membership and policy.

**Exception policy:** Public unauthenticated resources need a separately
documented access policy.

**Repository note:** ADR 062 is stricter: the tenant comes only from the `/tenants/:tenantSlug` route or a machine credential, and a `tenantId` in the request is rejected with 400.

### TI-14 — Separate soft deletion from isolation

*Original rules 022, 034, 046, 058, 070 · listed under: Authentication and membership; Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS; Prisma and transaction context*

**Do:** Treat soft deletion as lifecycle behavior, not as a tenant
security boundary.

**Don't:** Don't rely on `deletedAt IS NULL` as a substitute for tenant
scoping.

**Why:** Deleted rows may still contain sensitive data and remain
queryable.

**Verification:** Test deleted and non-deleted rows across tenant
boundaries.

**Example / implementation note:** A repository applies both tenant
scope and deletion policy.

**Exception policy:** Some audit queries intentionally include deleted
records under privileged authorization.

### TI-15 — Fail closed when tenant context is missing

*Original rules 031, 043, 055, 067, 079 · listed under: Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints*

**Do:** Reject tenant-scoped operations when required context cannot be
established.

**Don't:** Don't silently fall back to a global query or a default
tenant.

**Why:** Missing context must not broaden access.

**Verification:** Test absent, malformed, expired, and unauthorized
tenant context.

**Example / implementation note:** A tenant-scoped repository requires a
validated tenant scope.

**Exception policy:** Explicit platform-admin operations may be
cross-tenant under a separate audited policy.

**Repository note:** Multi mode has no fallback tenant (ADR 062). "Explicit platform-admin operations" means an allowlisted system operation that names its tables, or a `SupportAccessGrant` — nothing broader.

### TI-16 — Guard background jobs with tenant context

*Original rules 032, 044, 056, 068, 080 · listed under: Authorization and resource ownership; Repository/query scoping; PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints*

**Do:** Include and validate tenant scope in every tenant-specific job
payload or derive it from a trusted record.

**Don't:** Don't assume a worker inherits the HTTP request's tenant
context.

**Why:** Workers run outside the originating request and may process
many tenants.

**Verification:** Execute two jobs sequentially for different tenants
and check for context leakage.

**Example / implementation note:** A job payload carries a tenant ID
validated against the referenced resource.

**Exception policy:** Global maintenance jobs use explicit privileged
job types.

### TI-17 — Keep tenant context explicit

*Original rules 041, 053, 065, 077, 089 · listed under: Repository/query scoping; PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle*

**Do:** Pass tenant scope through a typed application context or
explicit use-case input.

**Don't:** Don't use mutable process-global variables to hold the
current tenant.

**Why:** Concurrent requests and workers can interleave.

**Verification:** Run concurrent requests for different tenants and
inspect returned data.

**Example / implementation note:** A request-scoped context is populated
from verified authentication data.

**Exception policy:** Async-local context may be used only if lifecycle
propagation and worker behavior are verified.

**Repository note:** Request context uses `AsyncLocalStorage` (ADR 017) — this rule's exception clause, verified by the e2e suites.

### TI-18 — Scope cache keys by tenant

*Original rules 042, 054, 066, 078, 090 · listed under: Repository/query scoping; PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle*

**Do:** Include tenant identity and relevant authorization/version
dimensions in cache keys for tenant-specific data.

**Don't:** Don't cache by resource ID alone when IDs or visibility may
overlap across tenants.

**Why:** A shared cache can become a cross-tenant data leak.

**Verification:** Run cache hit/miss tests with identical resource keys
in separate tenants.

**Example / implementation note:** Use a stable composite cache key
including tenant scope.

**Exception policy:** Truly global immutable data may use a global key.

### TI-19 — Separate platform administrators from tenant users

*Original rules 051, 063, 075, 087, 099 · listed under: PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations*

**Do:** Define explicit permissions and audited use cases for
cross-tenant administration.

**Don't:** Don't let a generic `isAdmin` flag bypass tenant checks
everywhere.

**Why:** Platform administration and tenant-level administration have
different blast radii.

**Verification:** Test tenant admin access separately from platform
admin access.

**Example / implementation note:** A support operation requires a
specific permission and records its reason.

**Exception policy:** Break-glass access may exist with explicit
controls, expiration, and audit.

**Repository note:** ADR 062: no generic admin bypass; break-glass access is a `SupportAccessGrant` (approved, expiring, audited).

### TI-20 — Invalidate caches after authorization changes

*Original rules 052, 064, 076, 088, 100 · listed under: PostgreSQL RLS; Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations*

**Do:** Invalidate or version tenant-sensitive caches after membership,
role, or permission changes.

**Don't:** Don't assume cached authorization remains correct
indefinitely without an explicit policy.

**Why:** Revoked access must not persist beyond the accepted revocation
window.

**Verification:** Test role removal followed by requests using warm
caches.

**Example / implementation note:** Use versioned authorization context
or scoped invalidation where needed.

**Exception policy:** A documented short TTL may be acceptable only if
the security policy accepts the window.

**Repository note:** Authorization caching: ADR 004; session revocation is immediate (ADR 034).

### TI-21 — Authorize resource ownership

*Original rules 061, 073, 085, 097, 109 · listed under: Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs*

**Do:** Check that the target resource belongs to the active tenant and
that the actor may perform the action.

**Don't:** Don't authorize solely by checking a role name or endpoint
permission.

**Why:** A user with permission in Tenant A must not mutate a resource
in Tenant B.

**Verification:** Test direct object reference attacks with valid IDs
from another tenant.

**Example / implementation note:** Load the reward using both resource
ID and tenant scope.

**Exception policy:** Public global catalog items may have separate
ownership and visibility rules.

### TI-22 — Protect tenant files and object storage

*Original rules 062, 074, 086, 098, 110 · listed under: Prisma and transaction context; Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs*

**Do:** Scope object keys and authorization metadata to the tenant and
verify access before issuing download/upload permissions.

**Don't:** Don't rely on unguessable object keys as the only access
control.

**Why:** Storage URLs and metadata can outlive application sessions.

**Verification:** Attempt cross-tenant access to uploaded files and
generated signed URLs.

**Example / implementation note:** Use tenant-scoped prefixes or
metadata and short-lived signed URLs where appropriate.

**Exception policy:** Public assets may be intentionally public after an
explicit publication workflow.

**Repository note:** Follow `20-object-storage.md`.

### TI-23 — Scope every tenant-owned query

*Original rules 071, 083, 095, 107, 119 · listed under: Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs; Events and outbox*

**Do:** Include the tenant predicate in every applicable read, update,
delete, aggregate, and existence check.

**Don't:** Don't fetch by ID alone and rely on the frontend to filter
results.

**Why:** A single unscoped query can expose another tenant's data.

**Verification:** Search repository methods and test
list/detail/update/delete paths across two tenants.

**Example / implementation note:** `findByIdAndTenantId(id, tenantId)`
expresses the scope explicitly.

**Exception policy:** Global reference data is exempt only when its
global visibility is intentional.

### TI-24 — Scope exports and reports

*Original rules 072, 084, 096, 108, 120 · listed under: Data modeling and constraints; Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs; Events and outbox*

**Do:** Apply tenant filters to exports, analytics, CSV downloads, and
asynchronous report jobs.

**Don't:** Don't implement a separate reporting path that bypasses the
normal isolation rules.

**Why:** Bulk data paths can expose far more data than detail endpoints.

**Verification:** Generate an export as Tenant A and inspect every row
and included relation.

**Example / implementation note:** Bind tenant scope into the report
request and worker context.

**Exception policy:** Platform-level aggregate reports require explicit
authorization and audit.

### TI-25 — Make writes tenant-safe

*Original rules 081, 093, 105, 117, 129 · listed under: Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs; Events and outbox; Files and object storage*

**Do:** Derive or validate tenant ownership server-side before creating
or changing tenant-owned records.

**Don't:** Don't accept arbitrary tenant IDs from user-controlled write
payloads without authorization.

**Why:** A correctly scoped read does not guarantee a correctly scoped
write.

**Verification:** Attempt to create a child record using another
tenant's parent identifier.

**Example / implementation note:** Resolve parent and tenant membership
in the same use-case flow.

**Exception policy:** Platform migration/import operations may specify
tenant IDs through privileged interfaces.

### TI-26 — Audit cross-tenant access

*Original rules 082, 094, 106, 118, 130 · listed under: Tenant provisioning and lifecycle; Cross-tenant operations; Caching and background jobs; Events and outbox; Files and object storage*

**Do:** Record privileged cross-tenant operations with actor, reason,
target scope, operation, and timestamp, while minimizing sensitive
payloads.

**Don't:** Don't log secrets or full records to make an audit trail.

**Why:** Auditing should support investigation without creating another
sensitive data store.

**Verification:** Verify audit events are emitted for privileged reads
and writes as required.

**Example / implementation note:** Support staff access is linked to a
ticket or declared reason.

**Exception policy:** Routine tenant-scoped access may use a lighter
audit policy.

**Repository note:** Every state-changing request is audit-logged (ADR 025); support access is tied to its `SupportAccessGrant`.

### TI-27 — Use database constraints as defense in depth

*Original rules 091, 103, 115, 127, 139 · listed under: Cross-tenant operations; Caching and background jobs; Events and outbox; Files and object storage; Search, reporting, and exports*

**Do:** Add tenant-aware uniqueness and foreign-key constraints where
the schema's business rules require them.

**Don't:** Don't depend exclusively on application checks for uniqueness
or referential integrity.

**Why:** Concurrent requests can bypass check-then-write application
logic.

**Verification:** Inspect migrations and attempt conflicting writes in
integration tests.

**Example / implementation note:** A unique key may be
`(tenant_id, normalized_slug)` rather than globally unique slug.

**Exception policy:** Global uniqueness is valid if the product
intentionally requires it.

**Repository note:** Tenant-aware composite keys exist (ADR 062); add new ones in `schema.prisma` and generate the migration.

### TI-28 — Use neutral external errors when appropriate

*Original rules 092, 104, 116, 128, 140 · listed under: Cross-tenant operations; Caching and background jobs; Events and outbox; Files and object storage; Search, reporting, and exports*

**Do:** Avoid disclosing another tenant's resource existence through
unauthorized lookup responses when the threat model requires it.

**Don't:** Don't return different detailed errors that enable
enumeration of foreign tenant IDs.

**Why:** Error behavior can become an information side channel.

**Verification:** Compare responses for nonexistent IDs and IDs
belonging to another tenant.

**Example / implementation note:** Return a consistent not-found result
for inaccessible resources when appropriate.

**Exception policy:** Internal operators and diagnostic APIs may need
more detail behind stricter controls.

**Repository note:** Not optional here: ADR 062 returns 404 for another tenant's resource.

### TI-29 — Use PostgreSQL RLS as a deliberate layer

*Original rules 101, 113, 125, 137, 149 · listed under: Caching and background jobs; Events and outbox; Files and object storage; Search, reporting, and exports; Observability and audit*

**Do:** If RLS is enabled, define policies for all relevant operations
and verify the runtime role cannot bypass them unintentionally.

**Don't:** Don't assume enabling RLS automatically protects every table
or every database role.

**Why:** Policy gaps and owner/BYPASSRLS behavior can undermine
isolation.

**Verification:** Test SELECT, INSERT, UPDATE, DELETE, and relevant
`WITH CHECK` behavior using the actual runtime role.

**Example / implementation note:** Set tenant context
transaction-locally and verify policy enforcement.

**Exception policy:** Application-only scoping may be selected, but the
threat model and compensating controls must be documented.

**Repository note:** Enabled with `FORCE ROW LEVEL SECURITY` and a `NOBYPASSRLS` runtime role (`apps/api/prisma/rls.sql`).

### TI-30 — Test isolation as a security property

*Original rules 102, 114, 126, 138, 150 · listed under: Caching and background jobs; Events and outbox; Files and object storage; Search, reporting, and exports; Observability and audit*

**Do:** Create at least two tenants and test positive and negative
access paths for every tenant-owned operation.

**Don't:** Don't rely on single-tenant tests to establish multi-tenant
correctness.

**Why:** Isolation failures are often invisible when all test data
belongs to one tenant.

**Verification:** Test list, detail, update, delete, counts, search,
exports, jobs, and nested relations.

**Example / implementation note:** Tenant A cannot read or mutate Tenant
B's reward even with its valid ID.

**Exception policy:** A focused unit test supplements but does not
replace integration tests.

**Repository note:** Use the shared two-tenant fixture (`test/tenancy/multi/`).

### TI-31 — Avoid tenant context leakage through pooled connections

*Original rules 111, 123, 135, 147, 159 · listed under: Events and outbox; Files and object storage; Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios*

**Do:** Set database tenant context transaction-locally where supported
and clear or isolate it safely.

**Don't:** Don't use persistent session variables that can leak across
pooled requests.

**Why:** A reused connection may serve another tenant's request.

**Verification:** Run sequential and concurrent cross-tenant tests
through the actual pool.

**Example / implementation note:** Use transaction-local configuration
for RLS context where compatible with the chosen adapter.

**Exception policy:** If session-level state is unavoidable, prove
cleanup on success and failure.

**Repository note:** Context is transaction-local (`set_config(…, true)`, ADR 010).

### TI-32 — Test RLS using the real runtime role

*Original rules 112, 124, 136, 148, 160 · listed under: Events and outbox; Files and object storage; Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios*

**Do:** Run database policy tests using the role and connection behavior
used by the application, not only a superuser.

**Don't:** Don't treat superuser tests as proof that RLS works.

**Why:** Superusers and table owners may bypass policies depending on
configuration.

**Verification:** Verify policies with the actual non-bypass runtime
role and connection pool.

**Example / implementation note:** Test missing tenant context and
cross-tenant access at SQL level.

**Exception policy:** Administrative migration roles should be separate
from runtime roles.

**Repository note:** `test/rls/runtime-role.e2e-spec.ts` does this.

### TI-33 — Bind RLS context to the transaction

*Original rules 121, 133, 145, 157, 169 · listed under: Files and object storage; Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios; Migration and operations*

**Do:** Ensure tenant-scoped database operations and the context-setting
statement use the same transaction/connection.

**Don't:** Don't set tenant context on one connection and query through
another pooled connection.

**Why:** RLS only protects a query if the correct context reaches the
executing connection.

**Verification:** Instrument integration tests to verify context and
query share the transaction.

**Example / implementation note:** A transaction manager exposes a
scoped persistence context to adapters.

**Exception policy:** Exact implementation depends on the installed
Prisma adapter and PostgreSQL setup.

**Repository note:** `src/prisma/tenant-transaction.service.ts` sets every session variable inside the transaction that runs the work.

### TI-34 — Plan tenant-aware migrations

*Original rules 122, 134, 146, 158, 170 · listed under: Files and object storage; Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios; Migration and operations*

**Do:** Review every schema change for tenant-local uniqueness, foreign
keys, backfills, and default values.

**Don't:** Don't add a non-null tenant column to populated tables
without a safe backfill plan.

**Why:** Migrations can accidentally assign data to the wrong tenant or
lock large tables.

**Verification:** Test migrations against a realistic copy or fixture of
existing data.

**Example / implementation note:** Backfill ownership from a verified
relation before enforcing NOT NULL.

**Exception policy:** Exact rollout sequencing depends on table size and
deployment strategy.

**Repository note:** Migrations are generated (`pnpm db:migrate:create`), never hand-written.

### TI-35 — Use explicit tenant-aware repository interfaces

*Original rules 131, 143, 155, 167, 179 · listed under: Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Design repository methods so tenant scope is difficult to omit
for tenant-owned data.

**Don't:** Don't create a generic `findById(id)` API for every
tenant-owned aggregate without an enforced scope mechanism.

**Why:** API shape can prevent accidental unscoped access.

**Verification:** Review interfaces and call sites for required tenant
arguments or verified scoped context.

**Example / implementation note:** A tenant-owned repository can expose
`findById(id, scope)`.

**Exception policy:** Global repositories may use a different interface
and must be clearly named.

### TI-36 — Keep tenant identifiers out of untrusted claims

*Original rules 132, 144, 156, 168, 180 · listed under: Search, reporting, and exports; Observability and audit; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Treat token tenant claims as context hints unless their
integrity, freshness, and membership semantics are explicitly
established.

**Don't:** Don't assume a long-lived token reflects current membership
or role revocation.

**Why:** Membership can change after token issuance.

**Verification:** Test revocation and tenant switching with existing
access tokens.

**Example / implementation note:** Revalidate active membership for
sensitive operations or use a documented freshness strategy.

**Exception policy:** Short-lived signed claims may be acceptable when
revocation and scope policy are explicit.

**Repository note:** JWTs carry identity only (ADR 003).

### TI-37 — Define tenant switching safely

*Original rules 142, 154, 166, 178 · listed under: Observability and audit; Testing isolation and threat scenarios; Migration and operations; API and client behavior*

**Do:** Make switching organization/tenant context an authenticated
operation that verifies membership and resets client-scoped state.

**Don't:** Don't merely change a client-side `tenantId` variable and
reuse stale cached data.

**Why:** Stale caches and selections can display or mutate data under
the wrong scope.

**Verification:** Switch tenants while caches contain records from the
previous tenant and verify isolation.

**Example / implementation note:** Clear or partition TanStack Query
keys by tenant context.

**Exception policy:** A full reload may be used if it reliably resets
all relevant client state.

## 4. Cross-cutting implementation checklist

-   [ ] Tenant, organization, location, membership, and platform-admin
    concepts are explicitly defined.
-   [ ] Every tenant-owned query and mutation has an enforced scope.
-   [ ] Missing or invalid tenant context fails closed.
-   [ ] Cross-tenant references and relation creation are tested.
-   [ ] Database uniqueness and foreign-key constraints match tenant
    semantics.
-   [ ] RLS is tested using the actual runtime role if enabled.
-   [ ] Connection pooling cannot leak tenant context between requests.
-   [ ] Background jobs, caches, files, exports, and events preserve
    tenant scope.
-   [ ] Privileged cross-tenant operations have explicit authorization
    and audit requirements.
-   [ ] Migration, deletion, retention, and tenant-switching behavior
    are documented.

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
