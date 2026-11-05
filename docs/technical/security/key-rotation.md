---
title: "Runbook: Rotating Encryption Keys"
tags: ["security", "encryption", "runbook", "operations"]
description: "How to rotate every key and key ring the API uses — add the new version, move data to it where needed, retire the old one — and which test proves each step."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1600&q=80"
order: 7
---

# Runbook: Rotating Encryption Keys

Rotate on a schedule (yearly), when someone with access leaves, and **at once** if a key may have leaked.
Key material and formats are in [Encryption and KMS](./encryption-and-kms.md). Generate new values with
`pnpm tools secrets:generate <env file>`; production values live in the server's env files or a secrets
manager, never in the repository.

## The rings at a glance

| Ring | Protects | Old data after a rotation | Re-encryption | Proven by |
|---|---|---|---|---|
| `MFA_ENCRYPTION_KEYS` | TOTP secrets | Readable with the old version | None yet: retire the old version once every affected user re-enrolled | `secret-encryption.service.spec.ts` |
| `GITHUB_CREDENTIAL_ENCRYPTION_KEYS` | Linked GitHub tokens | Readable with the old version | None: tokens are re-sealed when a user re-links | `github-credential.cipher.spec.ts` |
| `NOTIFICATIONS_ENCRYPTION_KEYS` | Push device tokens | Readable with the old version | None: devices re-register (and stale ones are pruned) | `gcm-push-token.cipher.spec.ts` |
| `CACHE_ENCRYPTION_KEYS` | Personal data inside Redis | **Not** read (the version is part of the cache key) | Not needed: old entries expire by TTL | `cache-cipher.spec.ts` |
| `REWARD_CODE_HASH_KEYS` | Lookup hashes of reward QR tokens and backup codes | Found: every version is tried on lookup | Not needed | `reward-code-hasher.spec.ts` |
| `TENANT_ENCRYPTION_MASTER_KEY` (KEK) | Tenant data keys | Readable via `TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS` | `db:rewrap-tenant-keys` | `tenant-encryption.service.spec.ts` |
| JWT and token HMAC secrets | Sessions and one-time tokens | Invalid: everyone signs in again | — | — |

## Rotating a key ring (MFA, GitHub, notifications, cache, reward codes)

The rings are JSON: `{"1":"<base64 32 bytes>"}`. The highest version encrypts; lower ones still decrypt
(or, for reward codes, are still tried on lookup).

1. **Add** a version: `{"1":"<old>","2":"<new>"}`. Never reuse or edit a version number.
2. **Deploy** (for a Droplet: edit `shared/env/api.env`, then `pm2 reload <slug>-api --update-env`).
   New data is sealed with version 2 from now on.
3. **Wait** until nothing uses version 1:
   - cache: one TTL (minutes);
   - reward codes: until every code issued before the rotation expired or was used;
   - MFA, GitHub, push: until the affected rows are re-created (re-enrolment, re-link, re-registration).
     Count what still uses it. For MFA: `SELECT count(*) FROM "User" WHERE "twoFactorSecretKeyVersion" = 1;`
     Every table forces row-level security (the owner is filtered too), so run it inside an allow-listed
     system operation that may read users: in `psql` as the migration login, first
     `SELECT set_config('app.rls_bypass', 'true', false), set_config('app.system_operation', 'auth.admin_users.read', false);`
4. **Retire** version 1: remove it from the JSON and deploy. A row still sealed with it can no longer be
   read, so step 3 must be finished.

If the key **leaked**, do steps 1–2 at once and decide step 4 by risk: removing the leaked version
immediately forces those users to re-enrol, re-link or re-register.

## Rotating the tenant KEK

1. Move the current key into `TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS` under its version.
2. Set a new `TENANT_ENCRYPTION_MASTER_KEY` and a higher `TENANT_ENCRYPTION_MASTER_KEY_VERSION`; deploy.
3. Re-wrap every tenant data key with the new KEK:
   `pnpm --filter @workspace/api db:rewrap-tenant-keys -- --actor-user-id <superadmin id>` (audited).
4. When it reports nothing left under the old version, remove it from the previous keys and deploy.

## Rotating the HMAC secrets

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `EMAIL_VERIFICATION_SECRET`, `TWO_FACTOR_PENDING_SECRET`,
`TENANT_JOB_HMAC_SECRET`: replace and deploy. Every session and pending link is invalidated, so do it in
a quiet hour and tell users. `RESEND_WEBHOOK_SECRET`: recreate the webhook in Resend, then update the env.

## After any rotation

- `GET /health/ready` is green and the API logs no decryption errors (`pm2 logs <slug>-api`).
- Record the rotation (date, ring, versions, who) in your operations log.
- Run `pnpm tools secrets:scan` before committing anything that touched env files.
