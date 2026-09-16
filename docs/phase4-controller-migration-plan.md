# Phase 4: Controller Migration to @Authorize Decorator

## Overview
Migrate all 122 controllers from `KernelIntegrationHelper` manual calls to the new `@Authorize` decorator.

## Migration Pattern

### Before (KernelIntegrationHelper approach):
```typescript
@Controller("orders")
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly helper: KernelIntegrationHelper,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    await this.helper.requireAction(user.id, "CREATE", "ORDER");
    return this.orderService.create(dto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.helper.requireResourceAccess(user.id, "UPDATE", "ORDER", id);
    return this.orderService.update(id, dto);
  }
}
```

### After (@Authorize decorator):
```typescript
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Authorize({ action: "CREATE", resource: "ORDER" })
  async create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @Patch(":id")
  @Authorize({
    action: "UPDATE",
    resource: "ORDER",
    resourceId: "id",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(id, dto);
  }
}
```

## Migration Rules

1. **Remove KernelIntegrationHelper injection** from constructor
2. **Replace `requireAction()`** → `@Authorize({ action, resource })`
3. **Replace `requireResourceAccess()`** → `@Authorize({ action, resource, resourceId })`
4. **Remove `@CurrentUser()` parameter** if only used for authorization
5. **Remove `await helper.xxx()` calls** from method bodies
6. **Add `@Authorize` import** at the top

## Controllers to Migrate (33 total)

### High Priority (CRUD Operations - 22 files)
- [ ] auth/auth.controller.ts
- [ ] auth/mfa-recovery.controller.ts
- [ ] auth/two-factor.controller.ts
- [ ] authorization/admin/permissions.controller.ts
- [ ] authorization/admin/roles.controller.ts
- [ ] authorization-cedar/controllers/policy-control-plane.controller.ts
- [ ] files/controllers/files.controller.ts
- [ ] geo/geo.controller.ts
- [ ] impersonation/impersonation.controller.ts
- [ ] notifications/email/email-preview.controller.ts
- [ ] notifications/email/email-webhook.controller.ts
- [ ] organization/controllers/organization-admin.controller.ts
- [ ] organization/controllers/organization-team-invite.controller.ts
- [ ] rewards/controllers/consumer-claims.controller.ts
- [ ] rewards/controllers/merchant-onboarding.controller.ts
- [ ] rewards/controllers/organization-rewards.controller.ts
- [ ] rewards/controllers/redemptions.controller.ts
- [ ] rewards/controllers/reward-legal.controller.ts
- [ ] rewards/controllers/reward-notifications.controller.ts
- [ ] rewards/controllers/rewards-admin.controller.ts
- [ ] sessions/sessions.controller.ts
- [ ] support-access/support-access.controller.ts

### Medium Priority (Query Operations - 7 files)
- [ ] authorization/admin/audit.controller.ts
- [ ] authorization/controllers/capabilities-catalog.controller.ts
- [ ] health/health.controller.ts
- [ ] health/version.controller.ts
- [ ] notifications/email/email-log.controller.ts
- [ ] rewards/controllers/consumer-rewards.controller.ts
- [ ] sessions/session-status.controller.ts

### Already Migrated (4 files)
- [x] organization/controllers/organization.controller.ts (example)
- [x] sample-category/sample-category.controller.ts (example)
- [x] authorization/kernel/examples.controller.ts (example)
- [x] product/product.controller.ts (generated)

## After Migration

1. **Delete** `apps/api/src/modules/authorization/kernel/kernel-integration.helper.ts`
2. **Update guard** to handle `@Authorize` decorator (already done)
3. **Run tests** to ensure nothing breaks
4. **Update docs** to reflect new pattern
