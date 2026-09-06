# Contract-Driven Scaffolding Platform

This monorepo includes an internal generator at [`packages/cli`](../packages/cli) that turns a restricted TypeScript resource definition into production-oriented API, contract, client, and admin CRUD artifacts.

## Quick start

```bash
# Interactive wizard (4 steps: basics → access → columns → review)
pnpm app new resource

# Validate a definition
pnpm app schema validate sample-resource

# Preview planned changes
pnpm app schema diff sample-resource

# Generate (interactive confirmation unless --non-interactive)
pnpm app generate resource sample-resource --non-interactive

# Regenerate generator-owned files
pnpm app sync sample-resource

# Check project compatibility
pnpm app doctor
```

Definitions live in [`resources/definitions/`](../resources/definitions/).

## Interactive wizard (`app new resource`)

The wizard runs in **4 steps**:

1. **Basics** — resource name and admin menu label
2. **Access & lifecycle** — RLS policy, soft delete (advanced: concurrency / idempotency)
3. **Columns** — add fields one at a time
4. **Review** — summary before writing the definition file

### Column types

When adding each column you first choose:

1. **Regular column** — then pick text, number, boolean, etc.
2. **Link to another table** — foreign key to an existing resource (shown as option 2 when parent tables exist)

| Regular column type | Creates |
|---------------------|---------|
| Short text / Long text | `string` / `text` columns |
| Whole number / Decimal | `int` / `decimal` |
| Yes / No | `boolean` |
| Pick list | `enum` |
| Date / time | `datetime` |
| Link to another table (option 2) | `uuid` foreign key → parent `.id` |

`id`, `createdAt`, and `updatedAt` are automatic — never add them manually.

### Linking tables (foreign keys)

- One resource = **one table**
- Primary keys are automatic (`id` UUID on every table)
- To link child → parent:
  1. Generate the **parent** resource first (`pnpm app new resource` → e.g. `Category`)
  2. Run `pnpm db:migrate`
  3. Generate the **child** and choose **Link to another table**
  4. Pick the parent, confirm the column name (e.g. `categoryId`)

The wizard no longer asks about `uuid` types or relation cardinality — child→parent links always use a nullable/required `categoryId`-style column.

## Architecture

```
Resource DSL (.resource.ts)
  → static parser (no execution)
  → Zod validation
  → versioned ResourceIR
  → deterministic plan
  → generators (Prisma/RLS, NestJS, Zod, client router, admin UI, tests)
  → format / lint / typecheck (on by default)
```

### API persistence layers

All API modules follow the same inheritance model:

```
BaseRepository / BaseService          ← shared runtime (apps/api/src/platform/persistence/)
        ↓
Generated*Repository / Generated*Service   ← CLI-owned ports + thin subclass
        ↓
ProductRepository / ProductService    ← developer-owned extensions (optional)
```

- **`BaseRepository`** — generic list/create/find/update/soft-delete/restore via entity-specific `RepositoryPorts`.
- **`BaseService`** — wraps the repository, throws `NotFoundException`, and owns **`paginate()`** (returns `PaginatedServiceResult` for the response interceptor).
- **CLI generators** only emit ports + `extends BaseRepository` / `extends BaseService`.
- **Complex domains** (auth, rewards, email webhooks) use dedicated repositories; audit/idempotency hooks stay in the service layer when needed.

### Ownership model

| Level | Pattern | Regeneration |
|-------|---------|--------------|
| Generated | `*.generated.ts(x)` | Always overwritten |
| Scaffolded | module wrappers, pages | Created once, never overwritten |
| Manual | business logic extensions | Never touched |

Manifests are stored in [`.app/manifests/`](../.app/manifests/).

## Sample resource

The live acceptance resource is **SampleResource**:

- Definition: [`resources/definitions/sample-resource.resource.ts`](../resources/definitions/sample-resource.resource.ts)
- API module: [`apps/api/src/modules/sample-resource/`](../apps/api/src/modules/sample-resource/)
- Admin UI: [`apps/admin/app/(panel)/sample-resource/`](../apps/admin/app/(panel)/sample-resource/)
- Contracts: [`packages/shared/src/schemas/domain/sample-resource.generated.ts`](../packages/shared/src/schemas/domain/sample-resource.generated.ts)

It exercises soft delete, optimistic concurrency, idempotency hooks, workflow transition schemas, admin-only RLS, typed permissions (`SAMPLE_RESOURCE`), and the shared `DataTable` adapter pattern.

**Exposure policy:** API is protected by SuperAdmin permissions; navigation is hidden in production via the DSL (`hiddenInProduction: true`).

## Platform runtime

Generic cross-cutting services for generated resources:

- [`apps/api/src/platform/platform-resource.module.ts`](../apps/api/src/platform/platform-resource.module.ts)
- Prisma models: `PlatformResourceAuditLog`, `PlatformResourceIdempotencyRecord`
- Shared Zod contracts: [`packages/shared/src/schemas/platform/resource-platform.ts`](../packages/shared/src/schemas/platform/resource-platform.ts)

## Legacy vs generated modules

Existing modules (geo, rewards, auth, …) remain **manual**. Only resources with a committed `.resource.ts` definition and manifest are managed by the generator.

See also [`docs/ADDING-A-FEATURE.md`](./ADDING-A-FEATURE.md) for the manual workflow.

## Commands

| Command | Purpose |
|---------|---------|
| `app init` | Print discovered monorepo root |
| `app new resource` | Interactive wizard → `.resource.ts` (+ optional generate) |
| `app generate resource <name>` | Full resource generation |
| `app schema validate|inspect|diff` | Definition tooling |
| `app sync <name>` | Regenerate generator-owned outputs |
| `app doctor` | Compatibility checks |

Granular `generate module|model|page|…` commands are reserved for future plugin slices; `generate resource` is the supported v1 entry point.

## Safety

- Destructive Prisma changes require an explicit migration plan and `--allow-destructive` (planned enforcement).
- Local interactive runs may apply `prisma migrate dev` after review; CI uses dry validation only.
- Failed format/lint/typecheck keeps generated files and exits non-zero for debugging.
