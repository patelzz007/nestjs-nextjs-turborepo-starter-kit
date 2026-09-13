---
title: "Data Classification Inventory"
tags: ["security", "tenancy", "data-classification"]
description: "Classification of every Prisma model and non-DB data surface by tenant ownership."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop"
order: 2
---

# Data Classification Inventory

## Classification legend

| Class | Meaning | RLS / access |
| --- | --- | --- |
| **GLOBAL** | Platform-wide; not organization-scoped | Bypass or public read catalog |
| **TENANT** | Owned by one organization | `organizationId` + membership policies |
| **MEMBERSHIP** | Junction between user and organization | Membership-scoped |
| **USER** | Owned by individual user (consumer) | `app_owns(user_id)` |
| **OPERATIONAL** | Infrastructure; no tenant business data | System operations only |

## Prisma models

| Model | Class | Tenant key | Notes |
| --- | --- | --- | --- |
| User | GLOBAL | — | Identity; own-row RLS for profile |
| Role, Permission, RolePermission | GLOBAL | — | Platform RBAC catalog |
| CapabilityDefinition, MerchantRoleCapability | GLOBAL | — | Capability catalog |
| UserRole, UserPermission | GLOBAL | — | Platform role assignments |
| PermissionAuditLog | OPERATIONAL | — | Platform RBAC audit |
| RefreshToken, PasswordResetToken, PasswordHistory | USER | user_id | Auth artifacts |
| BackupCode, TwoFactorPendingSetup, TwoFactorLoginChallenge | USER | user_id | MFA |
| MfaRecoveryRequest | USER | user_id | MFA recovery |
| Url, Tag, UrlTag, Click, ApiKey, ApiKeyUsageLog | USER | user_id | Consumer URL shortener |
| ImpersonationAuditLog | OPERATIONAL | — | Legacy; superseded by SupportAccessGrant audit |
| Log, EmailLog | OPERATIONAL | — | Redacted operational logs |
| Region, Subregion, Country, State, City | GLOBAL | — | Geo reference |
| Product, SampleCategory, ProductImage | GLOBAL | — | Platform catalog |
| Organization | TENANT | id | Canonical tenant root |
| OrganizationSlugHistory | TENANT | organization_id | Slug alias history |
| OrganizationLocation | TENANT | organization_id | Store/site |
| OrganizationMembership | MEMBERSHIP | organization_id | User ↔ org |
| OrganizationMembershipLocationScope | MEMBERSHIP | organization_id | Location grants |
| OrganizationMerchantProfile | TENANT | organization_id | KYB/branding |
| OrganizationInvitation, OrganizationAccessRequest | TENANT | organization_id | Join flows |
| OrganizationLifecycleEvent | OPERATIONAL | organization_id | State transitions audit |
| TenantPlacement | TENANT | organization_id | Future shard/dedicated routing |
| OrganizationEntitlement, OrganizationQuota | TENANT | organization_id | Plans and limits |
| AuthorizationPolicyDraft/Version/Simulation | TENANT + GLOBAL | organization_id nullable | Platform guardrails have null org |
| SupportAccessGrant | OPERATIONAL | organization_id | JIT support |
| TenantEncryptionKey | TENANT | organization_id | Envelope key metadata |
| OrganizationAuditLog | TENANT | organization_id | Security + mutation audit |
| MerchantOrg | TENANT | organization_id | Legacy; links to Organization |
| MerchantMember | MEMBERSHIP | organization_id via org | Migrating to OrganizationMembership |
| MerchantApiKey, MerchantTerminal, MerchantInvite | TENANT | organization_id | |
| Reward, RewardRedemption, RewardAuditLog | TENANT | organization_id | |
| MerchantKybDocument, MerchantKybFile, MerchantAsset | TENANT | organization_id | |
| StoredFile | TENANT or USER | organization_id optional | User avatar vs org files |
| FileVariant | TENANT or USER | via parent file | |
| RewardClaim, RewardReferral, RewardOtpChallenge | USER | user_id | Consumer-owned |
| RewardLegalAcceptance, RewardNotification | USER | user_id | |
| OutboxEvent, AnalyticsEvent | OPERATIONAL | optional org tag | Metadata tagging |
| PlatformResourceAuditLog, PlatformResourceIdempotencyRecord | OPERATIONAL | — | |
| UserAvatar | USER | user_id | |

## Non-database surfaces

| Surface | Class | Isolation control |
| --- | --- | --- |
| Redis auth cache | OPERATIONAL | Key: `auth:{userId}` — not tenant data |
| Redis authorization cache | OPERATIONAL | Include `policyVersion` |
| Merchant React Query cache | TENANT | Key must include `organizationId` |
| BullMQ job payloads | TENANT | Signed `TenantJobContext` |
| S3 object paths | TENANT | `orgs/{organizationId}/...` prefix |
| Kafka platform events | OPERATIONAL | Tenant id in envelope only |
| Analytics warehouse rows | OPERATIONAL | `organization_id` tag + row policies |
| Webhook secrets | TENANT | Envelope-encrypted per organization |
| Cedar policy bundle cache | OPERATIONAL | Versioned; org-scoped tenant policies |

## Schema test requirement

Every new Prisma model must declare its classification in a schema comment and appear in this inventory before merge. CI test `data-classification.spec.ts` validates coverage.

## References

- `apps/api/prisma/schema.prisma`
- [Threat model](./multi-tenancy-threat-model.md)
