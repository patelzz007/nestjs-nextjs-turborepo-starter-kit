# Final 22 Files - Authorization Kernel Integration

## Status: 100/122 Complete (82%)
**Remaining:** 15 high-priority + 7 medium-priority = 22 files

---

## Remaining High Priority Files (15)

### 1. auth.controller.ts
**Operations:** POST /signup, POST /change-password, POST /forgot-password, POST /reset-password, PATCH /admin/users/:id

```typescript
// Add imports:
import { KernelIntegrationHelper } from "../authorization/kernel/kernel-integration.helper";

// Update constructor:
constructor(
  // ... existing
  private readonly kernelHelper: KernelIntegrationHelper,
) {}

// Add to signup:
await this.kernelHelper.requireAction(user.sub, "CREATE", "USER");

// Add to changePassword:
await this.kernelHelper.requireResourceAccess(user.sub, "UPDATE", "USER", user.sub);

// Add to admin operations:
await this.kernelHelper.requireResourceAccess(adminUser.sub, "UPDATE", "USER", userId, {
  isSuperAdmin: true,
});
```

### 2-6. Rewards Controllers (5 files)

#### consumer-claims.controller.ts
```typescript
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";

constructor(...existing, private readonly kernelHelper: KernelIntegrationHelper) {}

// POST /claim
await this.kernelHelper.requireAction(userId, "CREATE", "ORDER");

// PATCH /claims/:id
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORDER", claimId);
```

#### merchant-onboarding.controller.ts
```typescript
// All POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});
```

#### redemptions.controller.ts
```typescript
// POST /redeem
await this.kernelHelper.requireAction(userId, "CREATE", "ORDER");

// PATCH /redemptions/:id  
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORDER", redemptionId);
```

#### reward-legal.controller.ts
```typescript
// POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});
```

#### reward-notifications.controller.ts
```typescript
// POST /notifications
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});

// PATCH /notifications/:id
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORGANIZATION", notificationId, {
  organizationId,
});

// DELETE /notifications/:id
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "ORGANIZATION", notificationId, {
  organizationId,
});
```

#### rewards-admin.controller.ts
```typescript
// POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "ORDER", {
  isSuperAdmin: true,
});

// PATCH /rewards/:id
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORDER", rewardId, {
  isSuperAdmin: true,
});

// DELETE /rewards/:id
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "ORDER", rewardId, {
  isSuperAdmin: true,
});
```

### 7-8. Organization Controllers (2 files)

#### organization-admin.controller.ts
```typescript
// POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});

// PATCH operations:
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "ORGANIZATION", organizationId, {
  organizationId,
});

// DELETE operations:
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "ORGANIZATION", organizationId, {
  organizationId,
});
```

#### organization-team-invite.controller.ts
```typescript
// POST /invite
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});

// DELETE /invite/:id
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "ORGANIZATION", inviteId, {
  organizationId,
});
```

### 9-12. Misc High-Priority Controllers (4 files)

#### files.controller.ts
```typescript
// POST /upload
await this.kernelHelper.requireAction(userId, "CREATE", "ORGANIZATION", {
  organizationId,
});

// DELETE /files/:id
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "ORGANIZATION", fileId, {
  organizationId,
});
```

#### geo.controller.ts
```typescript
// POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "USER");
```

#### email-preview.controller.ts
```typescript
// POST operations:
await this.kernelHelper.requireAction(userId, "CREATE", "USER");
```

#### email-webhook.controller.ts
```typescript
// POST operations (if authenticated):
await this.kernelHelper.requireAction(userId, "CREATE", "USER");
```

### 13. authorization-cedar/policy-control-plane.controller.ts
```typescript
// POST /policies
await this.kernelHelper.requireAction(userId, "CREATE", "USER", {
  isSuperAdmin: true,
});

// PATCH /policies/:id
await this.kernelHelper.requireResourceAccess(userId, "UPDATE", "USER", policyId, {
  isSuperAdmin: true,
});

// DELETE /policies/:id
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "USER", policyId, {
  isSuperAdmin: true,
});
```

### 14. support-access.controller.ts
```typescript
// POST /support-access/grant
await this.kernelHelper.requireAction(userId, "CREATE", "USER", {
  isSuperAdmin: true,
});

// POST /support-access/revoke
await this.kernelHelper.requireResourceAccess(userId, "DELETE", "USER", accessId, {
  isSuperAdmin: true,
});
```

---

## Remaining Medium Priority Files (7)

### Pattern for All Medium-Priority (Query/List Operations)

```typescript
// Add imports:
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";
import { GetUser } from "../auth/decorators/get-user.decorator";

// Update constructor:
constructor(
  // ... existing
  private readonly kernelHelper: KernelIntegrationHelper,
) {}

// For GET/list operations, add filtering:
@Get()
async list(@GetUser("sub") userId: string, @Query() query) {
  const authFilter = await this.kernelHelper.getQueryFilter(
    userId,
    "READ",
    "RESOURCE_TYPE",  // Change per controller
    { organizationId: query.organizationId }
  );
  
  return this.service.findMany({
    where: { ...authFilter, ...query },
  });
}
```

### 1. authorization/admin/audit.controller.ts
```typescript
// GET /admin/audit
const authFilter = await this.kernelHelper.getQueryFilter(userId, "READ", "USER");
```

### 2. authorization/controllers/capabilities-catalog.controller.ts
```typescript
// GET /capabilities
const authFilter = await this.kernelHelper.getQueryFilter(userId, "READ", "USER");
```

### 3. health/health.controller.ts
**Note:** Likely public/system endpoint - may not need kernel integration

### 4. health/version.controller.ts
**Note:** Likely public endpoint - may not need kernel integration

### 5. notifications/email/email-log.controller.ts
```typescript
// GET /email-logs
const authFilter = await this.kernelHelper.getQueryFilter(userId, "READ", "ORGANIZATION", {
  organizationId: query.organizationId,
});
```

### 6. rewards/controllers/consumer-rewards.controller.ts
```typescript
// GET /rewards
const authFilter = await this.kernelHelper.getQueryFilter(userId, "READ", "ORDER");
```

### 7. sessions/session-status.controller.ts
```typescript
// GET /session-status
const authFilter = await this.kernelHelper.getQueryFilter(userId, "READ", "USER");
```

---

## Implementation Checklist

- [ ] auth.controller.ts (1 file)
- [ ] Rewards controllers (5 files)
  - [ ] consumer-claims.controller.ts
  - [ ] merchant-onboarding.controller.ts
  - [ ] redemptions.controller.ts
  - [ ] reward-legal.controller.ts
  - [ ] reward-notifications.controller.ts
  - [ ] rewards-admin.controller.ts
- [ ] Organization controllers (2 files)
  - [ ] organization-admin.controller.ts
  - [ ] organization-team-invite.controller.ts
- [ ] Misc controllers (4 files)
  - [ ] files.controller.ts
  - [ ] geo.controller.ts
  - [ ] email-preview.controller.ts
  - [ ] email-webhook.controller.ts
- [ ] Cedar policy (1 file)
  - [ ] policy-control-plane.controller.ts
- [ ] Support access (1 file)
  - [ ] support-access.controller.ts
- [ ] Medium priority (7 files)
  - [ ] authorization/admin/audit.controller.ts
  - [ ] authorization/controllers/capabilities-catalog.controller.ts
  - [ ] health/health.controller.ts
  - [ ] health/version.controller.ts
  - [ ] notifications/email/email-log.controller.ts
  - [ ] rewards/controllers/consumer-rewards.controller.ts
  - [ ] sessions/session-status.controller.ts

---

## After Integration

1. Run integration check:
```bash
pnpm tsx scripts/integrate-kernel.ts
```

Expected output:
```
📊 Summary:
   Total files analyzed: 122
   Already integrated: 122
   Needs integration: 0
```

2. Update tests - mock `KernelIntegrationHelper` in test files

3. Fix any TypeScript errors

4. Run tests:
```bash
pnpm test:unit
pnpm test:e2e
```

---

## Completion Criteria

✅ All 122 files show as integrated in script  
✅ No TypeScript compilation errors  
✅ All tests passing  
✅ No runtime authorization errors  
✅ PR updated and ready for review
