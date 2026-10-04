---
title: "Bootstrap the first SuperAdmin"
tags: ["operations", "runbook", "security", "production"]
description: "Create the platform's first SuperAdmin from the command line on a deployment where the seed never runs: usage, guarantees, audit trail, refusals and recovery."
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop"
order: 5
---

# Bootstrap the first SuperAdmin

A real deployment never runs the seed, so no operator account exists. This one-time command creates
it, using the application's own password hashing, password policy, RBAC and audit code.

```bash
pnpm --filter @workspace/api admin:bootstrap-superadmin -- --email ops@example.com --full-name "Platform Operator"
```

| Flag | Meaning |
| --- | --- |
| `--email <email>` | Login email. Same rule as signup: valid address, at most 100 characters, stored lower-case. |
| `--full-name <name>` | Display name, 2-100 characters. |
| `--password-stdin` | Read the password from stdin (secret manager, CI) instead of the no-echo prompt. |

## The password never touches argv or the environment

- **Interactive:** a prompt with no echo, asked twice. It needs a real terminal; without one the command
  stops and tells you to use `--password-stdin`.
- **Piped:** `--password-stdin` reads all of stdin and drops one trailing newline, e.g.
  `vault kv get -field=password secret/bootstrap | pnpm --filter @workspace/api admin:bootstrap-superadmin -- --email … --full-name … --password-stdin`.
- `--password` (and `--pass`, `--pwd`) is **refused**, so the secret cannot reach shell history or the
  process list. There is no environment-variable route either.
- The password must pass the same policy as signup (`strongPassword` in `packages/shared`). The command
  prints the failed rules, never the value, and has not opened a database connection by then.

## Before you run it

1. `pnpm db:deploy` (migrations + RLS) against the production `DATABASE_URL`.
2. Load the platform reference data, because the command assigns the `SuperAdmin` role:
   `pnpm --filter @workspace/api db:sync-reference-data` (see [below](#loading-the-reference-data)).
   Without it the command exits `2` ("Not ready") and creates nothing.
3. The same environment as the API (`apps/api/.env`, loaded by the script): `DATABASE_URL`,
   `BCRYPT_SALT_ROUNDS` and the other required variables must validate, since the command parses the
   API's configuration.

## Loading the reference data

`db:sync-reference-data` loads exactly what the application assumes exists: the permission catalog, the
six system roles (`isSystem`, flat) with their role-permission matrix, and the merchant capability
catalog. It is **production-safe**: no users, tenants or demo data, no seed guard involved, and it
only ever adds or corrects rows defined by the code (it never deletes anything an operator created, such
as custom roles or permissions). Put it in every deploy, right after `pnpm db:deploy`.

- **Idempotent and diff-based.** It compares the database with the catalog and writes only differences. A
  run that finds nothing to change writes nothing at all, not even an audit row (it prints "nothing was
  written").
- **One transaction per section** (`permissions`, `system-roles`, `role-permissions`,
  `merchant-capabilities`), each under the allowlisted system operation `reference_data.sync`. A failed
  section rolls back alone and a re-run continues.
- **Audited.** Every section that changed something writes one `REFERENCE_DATA_SYNCED` row in
  `permission_audit_logs` in the same transaction (`actor_kind = SYSTEM_OPERATION`,
  `actor_id = reference_data.sync`, counts and the OS user and host in `detail`).
- **Same source as the seed.** `pnpm db:seed` calls this loader (`prisma/seed/reference-data.ts`); only the
  ABAC demo condition is seed-only. The definitions live in
  `apps/api/src/modules/authorization/reference-data/` (role catalog and matrix, capability catalog,
  sections). Per-tenant policy rows (the default role policy) are created by organization provisioning, not
  here.
- Changing the catalog in code and re-running the command converges existing databases: new grants are
  added, withdrawn ones soft-deleted.

## What it does

One transaction under the allowlisted system operation `auth.superadmin.bootstrap`
([system operations](../authorization/tenancy-and-rls.md#31-system-operations)):

1. Takes a transaction-scoped advisory lock (`pg_advisory_xact_lock`). A second run started at the same
   time waits, then sees the first run's SuperAdmin and refuses: two runs can never both succeed.
2. **Refuses** if any active, non-deleted account is a SuperAdmin, either through the `isSuperAdmin`
   flag or through a live assignment of the active `SuperAdmin` role. Deleted and deactivated
   SuperAdmins do not count.
3. **Refuses** if the email already belongs to any account (including a soft-deleted one). The command
   creates an account; it never promotes one.
4. Creates the account as signup would, with two deliberate differences:
   - **Email is marked verified.** The operator has shell access and database credentials, which is
     stronger proof than a mailbox, and a fresh deployment may have no email delivery yet. An
     unverified sole administrator would be locked out of the panel used to configure email.
   - **The MFA enrollment deadline is now, not now plus the grace period.** The first login gets a
     restricted session (`mfa_enrollment`) until two-factor authentication is enrolled. A platform
     operator gets no grace period.
5. Assigns the `SuperAdmin` role and runs the separation-of-duties check, as every role assignment does.
6. Writes two `permission_audit_logs` rows, `SUPER_ADMIN_BOOTSTRAPPED` and `ROLE_ASSIGNED_AT_PROVISIONING`.
   Both have `actor_kind = SYSTEM_OPERATION` and `actor_id = auth.superadmin.bootstrap`, never a
   placeholder user. `detail` records the email and `ranBy` (OS user and hostname of the process).
   The `rls.system_operation` log line is written too. Neither contains the password or its hash.

The password is hashed before the transaction starts, so the lock is never held during the slow hash.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Created (or `--help`). The output lists the next steps. |
| `1` | Refused: an active SuperAdmin exists, or the email is taken. Nothing changed. |
| `2` | Not ready: the `SuperAdmin` role is missing (load the reference data). Nothing changed. |
| `64` | Usage error: bad arguments, password on argv, no terminal for the prompt, or a password that fails the policy. |
| `70` | Unexpected failure (e.g. database unreachable). The transaction rolled back. |

## After it succeeds

1. Open the admin app and log in with the email and password you entered.
2. Enrol two-factor authentication immediately and store the recovery codes.
3. Create named staff accounts from the admin panel. Use the bootstrap account sparingly.

## Recovery

- **Typo in the email or name, run did not finish:** nothing was written; run it again.
- **Locked out of the only SuperAdmin:** the command refuses while that account is active. Use the
  [MFA recovery flow](../security/authentication.md) if 2FA is the problem. If the account is gone,
  deactivate or soft-delete it in the database (an audited operator action), then re-run with a new email.
- **Run at the wrong time or on the wrong database:** the audit row shows who and where
  (`SELECT * FROM permission_audit_logs WHERE action = 'SUPER_ADMIN_BOOTSTRAPPED'`).

## Verification

Unit tests cover argument parsing, the password sources and policy, the refusal paths and concurrent-run
safety (`apps/api/src/modules/auth/bootstrap/*.spec.ts`). The integration test
`apps/api/test/superadmin-bootstrap.e2e-spec.ts` creates and drops its own migrated, RLS-applied,
unseeded scratch database, races several runs on separate connections, and checks the stored hash,
role, audit rows and restricted first login.
