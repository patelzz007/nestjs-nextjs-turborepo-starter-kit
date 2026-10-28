---
title: "Multi-Tenancy Operations Runbook"
tags: ["operations", "tenancy", "incident"]
description: "Incident response, kill switches, backup/restore, and tenant recovery procedures."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop"
order: 1
---

# Multi-Tenancy Operations Runbook

## Severity model

| Level | Example | Response |
| --- | --- | --- |
| S1 | Confirmed cross-tenant data exposure | Immediate fail-closed; revoke caches; postmortem within 48h |
| S2 | Authorization engine outage | Deny-by-default; rollback policy bundle version |
| S3 | Single-tenant data corruption | Read-only mode for affected org; isolated restore |
| S4 | Quota/performance degradation | Throttle; notify tenant admin |

## Kill switches

| Switch | Env / flag | Effect |
| --- | --- | --- |
| Tenant creation freeze | `ORG_CREATION_FROZEN=true` | Platform invite only (already default) |
| Tenant write freeze | Per-org `RESTRICTED` state | Read-only for tenant |
| Support access revoke all | Admin API `POST /admin/support-access/revoke-all` | Expire all active grants |

## Rollback rule

**Never disable RLS to restore availability.**

On an API/RLS disagreement after a release:

1. Fail closed (deny ambiguous requests)
2. Roll back the application version
3. Place affected tenants in read-only maintenance if needed
4. Use audited repair tooling

## Backup and restore (pilot)

- Encrypted WAL/archive + scheduled dumps to remote object storage
- Monthly automated restore verification
- Documented best-effort RPO/RTO (not contractual on VPS)

### Single-tenant recovery

1. Restore backup into isolated database
2. Verify checksums
3. Extract one `tenantId` dataset
4. Re-import with full audit trail

## Tenant deletion

1. Owner confirms → immediate access revocation
2. 30-day grace (step-up cancel allowed)
3. Async erasure saga (DB, files, search, queues, caches)
4. Backup expiry per retention policy
5. Issue deletion certificate

## On-call checklist

- [ ] Named on-call owner in team roster
- [ ] Access to remote backup console
- [ ] Access decision (allow path) dashboard from `TenantAuditLog` `authorize.*` rows
- [ ] RLS denial rate alert configured
- [ ] Support grant audit stream monitored

## References

- [Multi-tenancy guide](../authorization/tenancy-and-rls.md)
- [Threat model](../security/threat-model.md)
