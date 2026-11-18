# Database security — declared in TypeScript, generated into SQL

Everything PostgreSQL enforces about who may touch which row is declared here, in TypeScript, and generated into
`../rls/*.sql` (ADR 089). **Never write or edit `prisma/rls/*.sql`.**

How to protect a new table, every rule in plain words, and the commands:
[`docs/technical/database/adding-a-table.md`](../../../../docs/technical/database/adding-a-table.md).

## Commands

| Command | Does |
|---|---|
| `pnpm --filter @workspace/api db:security` | Generate the SQL from this folder, then apply it to `DATABASE_URL` (what you run after a change) |
| `pnpm --filter @workspace/api db:generate-security` | Generate only |
| `pnpm --filter @workspace/api db:check-security` | Fail when the committed SQL is stale (CI) |
| `pnpm --filter @workspace/api db:apply-security` | Apply the committed SQL (run by `db:migrate`, `db:deploy`, `db:push`, `db:reset`). In production it refuses to drop a policy `table-policies.ts` no longer declares unless given `--allow-policy-drops` |
| `pnpm --filter @workspace/api db:security-explain <Table>` | Who may read and write a table, in plain words |
| `pnpm --filter @workspace/api db:security-snapshot --out <file> [--compare <file>] [--upgrade-from <ref>]` | Build a fresh database in a throwaway Docker container and record what it enforces |
| `pnpm --filter @workspace/api db:security-benchmark [--rows N] [--runs N] [--max-overhead X]` | Time tenant queries as the superuser and as a member under RLS, in a throwaway container (ADR 093) |

## Files

| File | Holds |
|---|---|
| `table-policies.ts` | Every table and its policies (rules picked by name), type-checked against the Prisma schema |
| `table-types.ts` | `TableName`, `ColumnOf<Table>` and the catalogue/registry types the declarations are checked against |
| `rule-catalogue.ts` | `RULE`: every reusable rule with its description (hover it in the editor) |
| `capability-access.ts` | What each merchant capability's routes do to which tables as the member (the drift test holds it against the policies) |
| `explain.ts` | `db:security-explain`'s plain-words report |
| `sql-references.ts` | Checks every table and column the hand-written SQL names against the schema |
| `roles.ts` | The database roles and each role's grants (function grants by typed signature) |
| `triggers.ts` | The hand-picked triggers |
| `withheld-privileges.ts` | Table privileges `app_runtime` must never hold (append-only, never-deleted tables) |
| `generator/policy-rules.ts` | What each reusable rule checks |
| `generator/table-specific-rules.ts` | One-off conditions, each tied to one table |
| `generator/permission-check.ts` | `permitted(…)`: the role-and-grant check, evaluated once per statement (ADR 093) |
| `generator/functions/` | The SQL helper and trigger functions (written with the `sql` tag) |
| `generator/index.ts` | Turns all of the above into the five files |
| `manifest-index.ts` | Each table's tenancy profile (drift check against the Prisma schema) |
| `apply.ts`, `apply-plan.ts` | Applying the files in order, with the withheld REVOKEs and the checks |
| `data-change-capture.ts`, `row-audit.ts` | The capture and row-audit triggers, planned against the live catalog at apply time |

The generated files, in apply order: `01-roles.sql`, `02-functions.sql`, `03-triggers.sql`, `04-policies.sql`,
`05-grants.sql`.

## Do not patch `migrations/*/migration.sql` for security

Prisma regenerates table SQL only. Security lives here and is applied by `db:apply-security`, chained after migrate,
deploy, reset and push.
