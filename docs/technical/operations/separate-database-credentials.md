---
title: "Runbook: Separate Database Credentials"
tags: ["operations", "database", "rls", "security", "runbook"]
description: "Run migrations and the API with separate database logins, so the runtime can never bypass row-level security."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 8
---

# Runbook: Separate Database Credentials

Tenant isolation rests on database facts the API cannot see from its own code (multi-tenancy plan D9). Production uses two logins:

| Login | Used by | Privileges |
| --- | --- | --- |
| **Migration login** (owns the tables) | `pnpm db:deploy` (`prisma migrate deploy` + `db:apply-security`), `pnpm db:seed` | Owns the schema. `NOSUPERUSER`, `NOBYPASSRLS`. Member of `app_runtime` and `analytics_consumer` (granted by `db:apply-security`). |
| **Runtime login** (the API's `DATABASE_URL`) | the API, its jobs and crons | `NOSUPERUSER`, `NOBYPASSRLS`, member of `app_runtime` only. Never the table owner. |

Every request, job and seed reaches the data as the `app_runtime` role (`NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS`, reached with `SET ROLE`). Every table **forces** RLS, so even the owner is filtered: the seed passes a policy only through its `seed.demo_dataset` system operation.

## Set up

1. Create the migration login as the database owner, without `SUPERUSER` or `BYPASSRLS`.
2. Run `pnpm db:deploy` with the migration login. It creates `app_runtime`, `app_enumerator` and `analytics_consumer` and grants them to the applying login.
3. Create the runtime login and `GRANT app_runtime TO <runtime login>`. Grant it nothing else.
4. Point the API's `DATABASE_URL` at the runtime login.
5. Start the API. Boot runs `RuntimeRoleProof`: it refuses to start when `app_runtime` is a superuser or has `BYPASSRLS`, or when any application table does not enable **and** force RLS. `GET /health/ready` reports the same check as `tenant-isolation` (critical).

## Verify

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('app_runtime', '<runtime login>', '<migration login>');
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
```

Every `rolsuper` / `rolbypassrls` is false and the second query returns no rows. CI checks the same facts (DB-006).

## Never

- Never run the API as the table owner or as a superuser: a superuser ignores every policy, FORCE included.
- Never grant `BYPASSRLS`, disable RLS, or drop FORCE to restore availability (see the [multi-tenancy runbook](./multi-tenancy-runbook.md)).

## Related

- [RLS coverage matrix](../database/rls-coverage.md)
- [Switching tenancy mode](./switching-tenancy-mode.md)
