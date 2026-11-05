---
title: "ADR 077: Personal-data export and account erasure"
tags: ["adr", "privacy", "security", "data"]
description: "\"Download my data\" streams a zip of a person's own data; \"Delete my account\" classifies every table (erase, anonymise, keep masked, merchant's record, blocks erasure), keeps a tombstone user row, waits a 30-day grace period, and lets support erase with a recorded, audited reason."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&h=630"
order: 77
---

# ADR 077: Personal-data export and account erasure

## Status

Accepted (2026-11-03). Enhancement 2.2 (P1). The owner answered the four questions (Q10–Q13, recorded at the
end): a 30-day grace period, a store's customer records anonymised, payment payer details kept ten years, and
support-assisted erasure behind `platform:manage_users` with a recorded reason, audited. **Export and erasure built (2026-11-03):** see the implementation notes.

## Context

People using the platform have a right to a copy of their personal data and to have their account removed:
Malaysia's Personal Data Protection Act 2010 (access, s.30; and, since the 2024 amendment, portability),
and the GDPR for users in the EU (Art. 15, 17, 20). Today neither exists. A survey on 2026-11-03 found 68 of
the 116 models referencing a person.

Erasure is harder than a delete, for three reasons found in that survey:

1. **Some records must outlive the account.** Audit, permission, impersonation and MFA-recovery logs are
   kept ten years (`RECORD_RETENTION_YEARS`, the owner's decision Q7) because they are the security record
   of what happened. Financial records (sales, redemptions, payments) are the *merchant's* records and
   Malaysian law makes them keep them (Income Tax Act 1967 s.82: at least seven years; the platform keeps
   them ten, its one retention for everything, Q7 and Q12).
2. **Personal data is copied into history.** `DataChangeLog` stores each row's before and after values
   (ADR 051), so a user's old email, phone and name sit inside snapshots of the `User` row and others.
   Masking the `User` row alone leaves them there.
3. **Other people's data refers to the person.** A merchant's claims, sales and customer bans, a broadcast
   report, a kanban comment: deleting those rows would corrupt someone else's records.

## Decision (proposed)

### Classes of data

Every model is put in exactly one class, in a registry (`apps/api/prisma/personal-data.ts`) that a test checks
against `schema.prisma`, like the soft-delete-unique registry (enhancement 2.8). A new model referencing a
person fails the test until it is classified.

| Class | What happens on erasure | Examples |
|---|---|---|
| **Erase** | Soft-deleted at once, hard-purged after the grace period | Avatar, preferences, notification preferences and schedules, push devices, sessions and refresh tokens, 2FA secrets and backup codes, password history, in-app inbox, GitHub link, signup referral code, pending invitations and access requests |
| **Anonymise** | Kept, with the person replaced by the tombstone user and free text about them cleared | Reward claims, redemptions and sales (merchant analytics and finance), referrals, broadcast reports, kanban comments and activity, a store's customer records (`TenantCustomer`, Q11) |
| **Keep, masked** | Kept for their legal retention, the identity columns pointed at the tombstone, copied personal values (emails, names, phones, user agents, IPs) masked | `AuditLog`, `DataChangeLog` (including the before/after values), `PermissionAuditLog`, `AuthorizationAudit`, impersonation and MFA-recovery logs, tenant and reward audit logs, `EmailLog` |
| **Merchant's record** | Not erased by the platform: the merchant is the data controller and must keep it. Payer details are purged once the payment is ten years old (`RECORD_RETENTION_YEARS`, Q12) | `PaymentIntent` payer name and email (matched by email, not user id), customer bans a merchant placed |
| **Blocks erasure** | Erasure is refused until resolved | Owning a tenant (transfer ownership or delete the tenant first), an open MFA-recovery case, a payment still PENDING |

### The tombstone

The `User` row is **kept** (its id holds every foreign key and audit reference) and anonymised in place:
email `erased+<id>@invalid` (the `.invalid` TLD can never receive mail), name "Deleted user", phone,
avatar and every optional profile field null, password hash replaced with an unusable value, `erasedAt` set.
Nothing that identifies the person stays on the row, and no other row needs its foreign key changed.

### Flow

| Step | What |
|---|---|
| Ask | `POST /me/erasure` with the password (or a fresh 2FA code), after the blocking checks. All sessions revoked at once; sign-in refused |
| Ask, by support | `POST /admin/users/:userId/erasure` for someone who asked another way (for example by email): needs `platform:manage_users` and a **recorded reason** (required, stored on the request and in the audit log). The same blocking checks and grace period apply, and the person is emailed that it was requested (Q13) |
| Grace | 30 days (Q10). Signing in during the grace period offers to cancel. A reminder email at the start and 3 days before the end |
| Erase | A system operation (`identity.account.erase`, RLS-scoped like every system write) runs each context's erasure port in one transaction per context, then the tombstone. Idempotent: a rerun after a crash finishes the job |
| Record | Audited at every step, in the one audit timeline: "erasure requested" (actor = the person, or the support user with the reason), "erasure cancelled", and "account erased" (run by the system operation, naming who requested it and the reason). The entries carry user ids and the reason, never personal values |

Each bounded context owns its own data, so each exposes a `PersonalDataPort` with two methods,
`export(userId)` and `erase(userId)`; the identity context orchestrates them (ADR 058's rule that a context
only touches another through its public API). No context reads another's tables.

### Export

`GET /me/data-export` streams a zip straight to the signed-in person: one JSON file per context plus a
`manifest.json` (when it was made, which sections, their schema version). Each context registers an exporter
in a `PersonalDataExportRegistry` (the registry pattern of `FileCategoryAccessRegistry`), and each exporter
reads under the person's own RLS context, so an export can only ever contain what that person may read. It
reuses the platform zip stream (`zipArchiveStream`, fflate) that file archives use. One export per 24 hours
per person (rate limit), and every export is audited.

Streaming was chosen over "build in the background, store, email a link": a person's own data is small, and
streaming means **no copy of their personal data is ever left in a bucket** (no expiring links, clean-up job
or email step). If a section ever grows too large to stream, that section moves to a background job.

## Consequences

- Every new model referencing a person must be classified, or the registry test fails: erasure can't
  silently miss a table.
- `DataChangeLog` gains a masking step for erased users, the one place where history is rewritten. It
  changes values, never removes rows, so the record of *what happened* survives and only *who* is hidden.
- Analytics and finance totals are unchanged by an erasure (rows are anonymised, not deleted).
- Restores from backups taken before an erasure bring the data back. The erasure log (user ids only) is
  re-applied after any restore; the restore runbook gets that step.

## The owner's answers (2026-11-03)

| # | Question | Answer |
|---|---|---|
| Q10 | How long is the grace period before erasure is final? | **30 days** |
| Q11 | A store's customer records (`TenantCustomer`): anonymise or delete? | **Anonymise** |
| Q12 | How long are payment payer details kept as the merchant's record? | **Ten years** (not seven): the platform's one retention, `RECORD_RETENTION_YEARS` |
| Q13 | Can support erase an account on a person's behalf? | **Yes**, behind `platform:manage_users` and a **recorded reason**, and it **must appear in the audit log** |

## Implementation notes (2026-11-03): the export

| Piece | Where |
|---|---|
| Registry | `apps/api/src/platform/application/personal-data/personal-data-export.registry.ts` (`PersonalDataExporter`, `PersonalDataExportRegistry`), provided once by the global `PersonalDataModule` |
| Reading as the person | `platform/infrastructure/personal-data/read-as-person.ts`: every exporter reads with `toRlsTransactionScope(actor, USER_OWNED_DATA_SCOPE)`, the scope the person's own requests get. `rowsToJson` turns rows into JSON (BigInt → number) |
| Sections (v1) | `account` (identity: profile, settings, signed-in devices), `notifications` (preferences, quiet hours, inbox, push devices, marketing consents), `claims` (claims, redemptions), `referrals` (invite codes, sign-up referrals with only the person's own role). Secrets are left out by name (`omit`): password hash, 2FA secret, session, push and claim tokens and their hashes |
| The privacy context | `apps/api/src/contexts/privacy/`: `ExportPersonalDataQuery` refuses anyone but the signed-in person (never while impersonating), records the sensitive-read audit row **before** release (nothing leaves unaudited), and streams `manifest.json` + one JSON file per section through the platform zip stream |
| Endpoint | `GET /api/v1/me/data-export` (`apiContract.privacy.dataExport`), rate limit `personalDataExport`: one per person per 24 hours. A restricted session (email not verified, required 2FA not set up) is refused by the existing gate |
| UI | `DownloadMyDataPanel` in the shared security settings ("Your data"), so web, admin and merchant all have it; a daily-limit refusal says how long to wait |
| Tests | Registry, handler (order: audit then archive; refusals; nothing released when audit fails), the ZIP read back, `rowsToJson`, the panel; `test/personal-data-export.e2e-spec.ts` over HTTP on a real database: a real ZIP with the person's data, no secret column anywhere in it, an audit row, the second export the same day refused (429), signed-out refused (401) |

Still to export (next sections): memberships and tenant roles, kanban items a person owns, GitHub link status, files a person uploaded, payment records where the person is the payer.

## Implementation notes (2026-11-03): erasure

| Piece | Where |
|---|---|
| Classification | `apps/api/prisma/personal-data.ts`: every one of the ~70 tables that refers to a person (by relation, a `…UserId`/`…ById` column, or a copied email, phone, name, IP, user agent, payer or recipient) is ERASE, ANONYMISE, KEEP_MASKED, MERCHANT_RECORD or TOMBSTONE, with the reason. `prisma/__tests__/personal-data.spec.ts` fails on an unclassified table or a stale entry |
| Schema | `AccountErasure` (`PENDING` / `CANCELLED` / `COMPLETED`; who asked, support's reason, when due, cancelled, completed; at most one `PENDING` per person by partial unique; never deleted) and `User.erasedAt`. Migration `…_account_erasure` |
| Masking kept records | `prisma/rls/75-account-erasure.sql` (hand-written, ADR 078): a NOLOGIN role `app_erasure`, the only role that may update the append-only audit tables (by policies naming it alone), and `app_mask_erased_person`, `SECURITY DEFINER`, pinned `search_path`, refused outside `privacy.account.erase` and for anyone without a **due** PENDING request. It nulls IPs and user agents and replaces personal values (by field name, and any mention of the person's email) inside audit bodies, change snapshots, consent, impersonation, MFA-recovery and authorization records, the email log and notifications |
| Per-context erasers | Registered in the platform `PersonalDataErasureRegistry`: identity (reset tokens, password history, backup codes, 2FA set-ups and challenges, avatar, preferences, sessions ended and device details cleared), authorization (roles, grants), tenancy (memberships ended, invitations, join requests), notifications (inbox, choices, quiet hours, push devices), claims (OTP codes, reward notices, referee IP), rewards (offer audiences), referrals (invite codes), kanban (follows), GitHub (the linked account) |
| Blockers | Owning a tenant (tenancy), an open MFA recovery (identity), a payment still pending as payer (payments). Checked when asking **and** again when due |
| The tombstone | `UserAccount.eraseAsTombstone` (identity's aggregate): `erased+<id>@erased.invalid` (RFC 2606: can never receive mail), "Deleted user", every credential and personal value cleared, an unusable password, deactivated, `tokenVersion` moved (`UserCredentialsChanged("account_erased")`), every session revoked (`DeviceSessionsRevoked("account_erasure")`) |
| Endpoints | `GET/POST /api/v1/me/erasure` (status; ask with the password), `POST /me/erasure/cancel`; support: `GET/POST /api/v1/admin/users/:userId/erasure` (a reason of 10–500 characters) and `…/cancel`, with the same guards as banning (super admin, verified email, `DELETE USER`, the security rate limit). The request, with support's reason, is in the HTTP audit log; every state change of `AccountErasure` is in the data-change trail |
| The job | `AccountErasureCron` (hourly): for each due request, mask kept records, run every eraser, tombstone, complete. Something new blocking it leaves it waiting; a failure is logged and retried next run (every step is idempotent) |
| UI | "Delete my account" in the shared security settings (password confirmation, the reasons it's blocked, the pending date and "Keep my account"); "Account erasure" on the admin user page (pending details, the reason, cancel) |
| Tests | Classification spec; service (password, blockers, support, cancel, impersonation, the order of steps, blocked and failed runs); panels (both); `test/account-erasure.e2e-spec.ts` on a real database: the whole lifecycle, the owner refusal, support with a reason |

**Not yet:** the reminder emails (when asked, and 3 days before) and the remaining export sections listed above. The interpretation of "`platform:manage_users`" (Q13): this platform authorises admin user management with `DELETE USER` on super admins (the account-ban guard), so erasure by support uses exactly that.
