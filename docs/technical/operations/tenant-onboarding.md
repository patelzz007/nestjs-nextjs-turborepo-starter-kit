---
title: "Runbook: Tenant Onboarding"
tags: ["operations", "tenancy", "runbook"]
description: "Bringing a new merchant tenant from invitation to an active, isolated tenant."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 6
---

# Runbook: Tenant Onboarding

A tenant is created by the platform, never by self-signup (multi-tenant mode).

1. **Invite.** A platform admin sends the merchant invitation from the admin app (`tenant.provision.admin_merchant_invite`). This creates the tenant in `PROVISIONING`, its merchant profile, placement, lifecycle event and default policy version, plus the invitation and its email.
2. **Accept.** The invitee completes merchant onboarding (`tenant.invitation.accept_merchant_onboarding`): owner membership with an `ALL_LOCATIONS` scope, merchant profile, first location and store, and activation, in one transaction with its audit row.
3. **KYB.** The owner submits KYB documents on the onboarding page; a platform admin reviews them (`tenant.kyb.admin_decide`).
4. **Encryption key.** The tenant's data key is provisioned (`encryption.tenant_key.provision`) the first time it is needed; it is never destroyed.
5. **Verify isolation** before handing over:
   - `pnpm tools db:check-tenant-integrity` exits 0 (no child row references another tenant's parent).
   - The owner sees only their tenant; a user from another tenant gets 404 on the new tenant's routes.
6. **API keys.** The owner creates POS or integration keys from the merchant app. A key carries its tenant (and, when store-scoped, its store); integrations call the integration API (`/integration/rewards`, `/integration/analytics`, `/integration/redemptions`), which names no tenant.

Platform staff reach the tenant's data only with an approved support grant (D4, D21): request it, the tenant owner approves it, and every use is audited with the grant id.

## Related

- [Tenant suspension](./tenant-suspension.md)
- [POS integration](../pos-integration.md)
